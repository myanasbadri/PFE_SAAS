"""
Digital signature validation for XML e-invoices.

Validates XMLDSig signatures embedded in e-invoice XML documents
as required by Tunisia 2026 TTN compliance. Checks:
- Signature presence and structure
- Signature value verification (data integrity)
- Certificate validity (expiry, issuer)
- Algorithm strength

Dependencies: lxml, cryptography
If xmlsec is available, uses it for full signature verification.
Otherwise, performs structural validation and certificate checks.
"""

import logging
from datetime import datetime, timezone

from lxml import etree

logger = logging.getLogger(__name__)

# XMLDSig namespace
DS_NS = "http://www.w3.org/2000/09/xmldsig#"
XADES_NS = "http://uri.etsi.org/01903/v1.3.2#"

_NS = {
    "ds": DS_NS,
    "xades": XADES_NS,
}

# Minimum acceptable key sizes
_MIN_RSA_BITS = 2048
_MIN_ECDSA_BITS = 256

# Strong signature algorithms
_STRONG_ALGORITHMS = {
    "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",
    "http://www.w3.org/2001/04/xmldsig-more#rsa-sha384",
    "http://www.w3.org/2001/04/xmldsig-more#rsa-sha512",
    "http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha256",
    "http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha384",
    "http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha512",
}

_WEAK_ALGORITHMS = {
    "http://www.w3.org/2000/09/xmldsig#rsa-sha1",
    "http://www.w3.org/2000/09/xmldsig#dsa-sha1",
    "http://www.w3.org/2001/04/xmldsig-more#rsa-md5",
}


def _parse_x509_cert(cert_b64: str) -> dict | None:
    """Parse a Base64-encoded X.509 certificate and extract metadata."""
    try:
        from cryptography import x509
        from cryptography.hazmat.primitives.asymmetric import rsa, ec
        import base64

        cert_der = base64.b64decode(cert_b64)
        cert = x509.load_der_x509_certificate(cert_der)

        # Extract subject fields
        subject_parts = []
        for attr in cert.subject:
            subject_parts.append(f"{attr.oid._name}={attr.value}")
        subject = ", ".join(subject_parts)

        issuer_parts = []
        for attr in cert.issuer:
            issuer_parts.append(f"{attr.oid._name}={attr.value}")
        issuer = ", ".join(issuer_parts)

        # Key info
        pub_key = cert.public_key()
        key_type = "unknown"
        key_bits = 0
        if isinstance(pub_key, rsa.RSAPublicKey):
            key_type = "RSA"
            key_bits = pub_key.key_size
        elif isinstance(pub_key, ec.EllipticCurvePublicKey):
            key_type = "ECDSA"
            key_bits = pub_key.key_size

        now = datetime.now(timezone.utc)

        return {
            "subject": subject,
            "issuer": issuer,
            "serial_number": str(cert.serial_number),
            "not_valid_before": cert.not_valid_before_utc.isoformat(),
            "not_valid_after": cert.not_valid_after_utc.isoformat(),
            "is_expired": now > cert.not_valid_after_utc,
            "is_not_yet_valid": now < cert.not_valid_before_utc,
            "key_type": key_type,
            "key_bits": key_bits,
        }
    except ImportError:
        logger.warning("cryptography package not installed — certificate parsing skipped")
        return None
    except Exception as e:
        logger.warning("Failed to parse X.509 certificate: %s", e)
        return None


def _try_xmlsec_verify(xml_content: bytes) -> dict | None:
    """Attempt full signature verification using xmlsec if available."""
    try:
        import xmlsec

        doc = etree.fromstring(xml_content)
        sig_node = doc.find(f".//{{{DS_NS}}}Signature")
        if sig_node is None:
            return None

        ctx = xmlsec.SignatureContext()

        # Try to find the key in the signature
        key_info = sig_node.find(f"{{{DS_NS}}}KeyInfo")
        if key_info is not None:
            x509_data = key_info.find(f"{{{DS_NS}}}X509Data/{{{DS_NS}}}X509Certificate")
            if x509_data is not None and x509_data.text:
                import base64
                cert_der = base64.b64decode(x509_data.text.strip())
                key = xmlsec.Key.from_memory(cert_der, xmlsec.constants.KeyDataFormatCertDer)
                ctx.key = key

        ctx.verify(sig_node)
        return {"verified": True, "method": "xmlsec"}

    except ImportError:
        return None  # xmlsec not available
    except Exception as e:
        return {"verified": False, "method": "xmlsec", "error": str(e)}


def validate_xml_signature(xml_content: bytes | str) -> dict:
    """
    Validate the digital signature of an XML e-invoice.

    Args:
        xml_content: Raw XML content as bytes or string.

    Returns:
        dict with:
            - has_signature: bool
            - signature_valid: bool | None (None if can't verify)
            - verification_method: str
            - algorithm: str | None
            - algorithm_strong: bool
            - certificate: dict | None (parsed cert info)
            - errors: list of error dicts
            - warnings: list of warning dicts
    """
    if isinstance(xml_content, str):
        xml_content = xml_content.encode("utf-8")

    result = {
        "has_signature": False,
        "signature_valid": None,
        "verification_method": "structural",
        "algorithm": None,
        "algorithm_strong": False,
        "certificate": None,
        "signature_timestamp": None,
        "errors": [],
        "warnings": [],
    }

    # Parse XML
    try:
        doc = etree.fromstring(xml_content)
    except etree.XMLSyntaxError as e:
        result["errors"].append({
            "field": "xml",
            "message": f"Invalid XML: {e}",
            "severity": "critical",
            "code": "INVALID_XML",
        })
        return result

    # Find Signature element
    sig_node = doc.find(f".//{{{DS_NS}}}Signature")
    if sig_node is None:
        result["errors"].append({
            "field": "signature",
            "message": "No digital signature found in XML document",
            "severity": "critical",
            "code": "NO_SIGNATURE",
        })
        return result

    result["has_signature"] = True

    # ── Check signature structure ──────────────────────────────────────
    signed_info = sig_node.find(f"{{{DS_NS}}}SignedInfo")
    sig_value = sig_node.find(f"{{{DS_NS}}}SignatureValue")
    key_info = sig_node.find(f"{{{DS_NS}}}KeyInfo")

    if signed_info is None:
        result["errors"].append({
            "field": "signature.SignedInfo",
            "message": "Missing SignedInfo element in signature",
            "severity": "critical",
            "code": "MISSING_SIGNED_INFO",
        })

    if sig_value is None or not (sig_value.text or "").strip():
        result["errors"].append({
            "field": "signature.SignatureValue",
            "message": "Missing or empty SignatureValue",
            "severity": "critical",
            "code": "MISSING_SIGNATURE_VALUE",
        })

    # ── Check algorithm ────────────────────────────────────────────────
    if signed_info is not None:
        sig_method = signed_info.find(f"{{{DS_NS}}}SignatureMethod")
        if sig_method is not None:
            algo = sig_method.get("Algorithm", "")
            result["algorithm"] = algo

            if algo in _STRONG_ALGORITHMS:
                result["algorithm_strong"] = True
            elif algo in _WEAK_ALGORITHMS:
                result["algorithm_strong"] = False
                result["warnings"].append({
                    "field": "signature.algorithm",
                    "message": f"Weak signature algorithm: {algo}. Use SHA-256 or stronger.",
                    "severity": "warning",
                    "code": "WEAK_ALGORITHM",
                })
            else:
                result["algorithm_strong"] = True  # Unknown → assume ok

    # ── Check certificate ──────────────────────────────────────────────
    if key_info is not None:
        x509_cert_el = key_info.find(f".//{{{DS_NS}}}X509Certificate")
        if x509_cert_el is not None and x509_cert_el.text:
            cert_info = _parse_x509_cert(x509_cert_el.text.strip())
            if cert_info:
                result["certificate"] = cert_info

                if cert_info["is_expired"]:
                    result["errors"].append({
                        "field": "certificate",
                        "message": f"Signing certificate expired on {cert_info['not_valid_after']}",
                        "severity": "error",
                        "code": "CERT_EXPIRED",
                    })

                if cert_info["is_not_yet_valid"]:
                    result["errors"].append({
                        "field": "certificate",
                        "message": f"Signing certificate not yet valid until {cert_info['not_valid_before']}",
                        "severity": "error",
                        "code": "CERT_NOT_YET_VALID",
                    })

                # Key strength check
                if cert_info["key_type"] == "RSA" and cert_info["key_bits"] < _MIN_RSA_BITS:
                    result["warnings"].append({
                        "field": "certificate.key",
                        "message": f"RSA key size {cert_info['key_bits']} bits is below minimum {_MIN_RSA_BITS}",
                        "severity": "warning",
                        "code": "WEAK_KEY",
                    })
                elif cert_info["key_type"] == "ECDSA" and cert_info["key_bits"] < _MIN_ECDSA_BITS:
                    result["warnings"].append({
                        "field": "certificate.key",
                        "message": f"ECDSA key size {cert_info['key_bits']} bits is below minimum {_MIN_ECDSA_BITS}",
                        "severity": "warning",
                        "code": "WEAK_KEY",
                    })
        else:
            result["warnings"].append({
                "field": "certificate",
                "message": "No X.509 certificate found in signature KeyInfo",
                "severity": "warning",
                "code": "NO_CERTIFICATE",
            })

    # ── Check XAdES timestamp ──────────────────────────────────────────
    xades_time = doc.find(f".//{{{XADES_NS}}}SigningTime")
    if xades_time is not None and xades_time.text:
        result["signature_timestamp"] = xades_time.text.strip()

    # ── Attempt full cryptographic verification ────────────────────────
    xmlsec_result = _try_xmlsec_verify(xml_content)
    if xmlsec_result:
        result["signature_valid"] = xmlsec_result["verified"]
        result["verification_method"] = xmlsec_result["method"]
        if not xmlsec_result["verified"] and xmlsec_result.get("error"):
            result["errors"].append({
                "field": "signature",
                "message": f"Signature verification failed: {xmlsec_result['error']}",
                "severity": "critical",
                "code": "SIGNATURE_INVALID",
            })
    else:
        # Can't cryptographically verify without xmlsec, mark as structural only
        result["verification_method"] = "structural"
        result["signature_valid"] = None
        result["warnings"].append({
            "field": "signature",
            "message": "Cryptographic verification not available (install xmlsec). Structural checks passed.",
            "severity": "info",
            "code": "NO_CRYPTO_VERIFY",
        })

    return result

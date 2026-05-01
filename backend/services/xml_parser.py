"""
TTN-compliant XML Invoice Parser for Tunisia 2026 e-invoicing.

Parses structured XML invoices and returns a dict matching the existing
MongoDB invoice schema (same shape as LLaMA extraction output).
Supports multiple XML namespaces and common Tunisian invoice formats.
"""

import re
import logging
from datetime import datetime
from lxml import etree

logger = logging.getLogger(__name__)

# ── Common XML namespaces used in e-invoicing ────────────────────────────────
NAMESPACES = {
    "inv": "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2",
    "cac": "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
    "cbc": "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
    "cec": "urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2",
    "ds": "http://www.w3.org/2000/09/xmldsig#",
    "xades": "http://uri.etsi.org/01903/v1.3.2#",
    # TTN-specific (placeholder — will be updated when TTN publishes final schema)
    "ttn": "urn:ttn:names:specification:einvoice:schema:xsd:Invoice-1",
}


def _text(el, xpath: str, ns: dict | None = None) -> str | None:
    """Extract text content from first matching element."""
    try:
        nodes = el.xpath(xpath, namespaces=ns or {})
        if nodes:
            val = nodes[0]
            return val.text.strip() if hasattr(val, "text") and val.text else str(val).strip()
    except Exception:
        pass
    return None


def _float(val) -> float | None:
    """Safely parse a numeric string."""
    if val is None:
        return None
    try:
        cleaned = re.sub(r"[^\d.\-]", "", str(val))
        return round(float(cleaned), 4) if cleaned else None
    except (ValueError, TypeError):
        return None


def _int_or_float(val):
    """Parse as int if whole number, else float."""
    f = _float(val)
    if f is None:
        return None
    return int(f) if f == int(f) else f


def _normalize_date(val: str | None) -> str | None:
    """Convert date string to YYYY-MM-DD."""
    if not val:
        return None
    # Already ISO format
    if re.match(r"^\d{4}-\d{2}-\d{2}", val):
        return val[:10]
    # Try common formats
    for fmt in ("%d/%m/%Y", "%d-%m-%Y", "%Y%m%d", "%d.%m.%Y"):
        try:
            return datetime.strptime(val.strip(), fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return val[:10] if len(val) >= 10 else None


# ── UBL 2.1 Parser (standard e-invoicing format) ────────────────────────────

def _parse_ubl_invoice(root, ns: dict) -> dict:
    """Parse a UBL 2.1 Invoice XML document."""

    # ── Seller (AccountingSupplierParty) ────────────────────────────────
    vendor_name = (
        _text(root, ".//cac:AccountingSupplierParty/cac:Party/cac:PartyName/cbc:Name", ns)
        or _text(root, ".//cac:AccountingSupplierParty/cac:Party/cac:PartyLegalEntity/cbc:RegistrationName", ns)
    )
    seller_vat = _text(
        root,
        ".//cac:AccountingSupplierParty/cac:Party/cac:PartyTaxScheme/cbc:CompanyID",
        ns,
    )

    # ── Buyer (AccountingCustomerParty) ──────────────────────────────────
    buyer_name = (
        _text(root, ".//cac:AccountingCustomerParty/cac:Party/cac:PartyName/cbc:Name", ns)
        or _text(root, ".//cac:AccountingCustomerParty/cac:Party/cac:PartyLegalEntity/cbc:RegistrationName", ns)
    )
    buyer_vat = _text(
        root,
        ".//cac:AccountingCustomerParty/cac:Party/cac:PartyTaxScheme/cbc:CompanyID",
        ns,
    )
    buyer_address = _text(
        root,
        ".//cac:AccountingCustomerParty/cac:Party/cac:PostalAddress/cbc:StreetName",
        ns,
    )
    buyer_email = _text(
        root,
        ".//cac:AccountingCustomerParty/cac:Party/cac:Contact/cbc:ElectronicMail",
        ns,
    )

    # ── Invoice header ──────────────────────────────────────────────────
    invoice_no = _text(root, ".//cbc:ID", ns)
    invoice_date = _normalize_date(_text(root, ".//cbc:IssueDate", ns))
    due_date = _normalize_date(_text(root, ".//cbc:DueDate", ns))
    currency = _text(root, ".//cbc:DocumentCurrencyCode", ns)
    notes = _text(root, ".//cbc:Note", ns)

    # ── Line items ──────────────────────────────────────────────────────
    line_items = []
    lines = root.xpath(".//cac:InvoiceLine", namespaces=ns)
    for line in lines:
        desc = (
            _text(line, "cac:Item/cbc:Name", ns)
            or _text(line, "cac:Item/cbc:Description", ns)
            or ""
        )
        qty = _int_or_float(_text(line, "cbc:InvoicedQuantity", ns))
        unit_price = _float(_text(line, "cac:Price/cbc:PriceAmount", ns))
        line_total = _float(_text(line, "cbc:LineExtensionAmount", ns))
        tax_rate = _float(
            _text(line, "cac:Item/cac:ClassifiedTaxCategory/cbc:Percent", ns)
            or _text(line, "cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cbc:Percent", ns)
        )

        # Calculate missing values
        if not line_total and qty and unit_price:
            line_total = round(qty * unit_price, 4)
        if not unit_price and line_total and qty:
            unit_price = round(line_total / qty, 4)
        if not qty and line_total and unit_price and unit_price != 0:
            qty = _int_or_float(line_total / unit_price)

        item = {
            "description": desc,
            "quantity": qty,
            "unit_price": unit_price,
            "total": line_total,
        }
        if tax_rate is not None:
            item["tax_rate"] = tax_rate
        line_items.append(item)

    # ── Totals ──────────────────────────────────────────────────────────
    subtotal = _float(
        _text(root, ".//cac:LegalMonetaryTotal/cbc:LineExtensionAmount", ns)
        or _text(root, ".//cac:LegalMonetaryTotal/cbc:TaxExclusiveAmount", ns)
    )
    tax_total = _float(_text(root, ".//cac:TaxTotal/cbc:TaxAmount", ns))
    grand_total = _float(
        _text(root, ".//cac:LegalMonetaryTotal/cbc:TaxInclusiveAmount", ns)
        or _text(root, ".//cac:LegalMonetaryTotal/cbc:PayableAmount", ns)
    )
    discount = _float(_text(root, ".//cac:LegalMonetaryTotal/cbc:AllowanceTotalAmount", ns))

    # Fallback calculations
    if not grand_total and subtotal and tax_total:
        grand_total = round(subtotal + tax_total, 4)
    if not tax_total and grand_total and subtotal:
        tax_total = round(grand_total - subtotal, 4)
    if not subtotal and line_items:
        subtotal = round(sum(i.get("total") or 0 for i in line_items), 4)

    # ── Payment method ──────────────────────────────────────────────────
    payment_method = _text(root, ".//cac:PaymentMeans/cbc:PaymentMeansCode", ns)

    return {
        "vendor_name": vendor_name,
        "invoice_no": invoice_no,
        "date": invoice_date,
        "due_date": due_date,
        "line_items": line_items,
        "totals": {
            "subtotal": subtotal,
            "tax": tax_total,
            "discount": discount,
            "grand_total": grand_total,
            "currency": currency or "TND",
        },
        "bill_to": {
            "name": buyer_name,
            "address": buyer_address,
            "email": buyer_email,
        },
        "payment_method": payment_method,
        "notes": notes,
        # Tunisia-specific fields
        "seller_vat_id": seller_vat,
        "buyer_vat_id": buyer_vat,
    }


# ── Generic / flat XML parser (fallback) ─────────────────────────────────────

# Map common XML tag names to our schema fields
_TAG_MAP = {
    # Vendor
    "vendorname": "vendor_name", "suppliername": "vendor_name",
    "sellername": "vendor_name", "from": "vendor_name",
    "fournisseur": "vendor_name",
    # Invoice number
    "invoicenumber": "invoice_no", "invoiceno": "invoice_no",
    "invoiceid": "invoice_no", "numero": "invoice_no",
    "numerofacture": "invoice_no", "id": "invoice_no",
    # Dates
    "invoicedate": "date", "issuedate": "date",
    "datefacture": "date", "dateemission": "date",
    "duedate": "due_date", "dateecheance": "due_date",
    # Totals
    "subtotal": "subtotal", "totalht": "subtotal",
    "montantht": "subtotal", "taxexclusiveamount": "subtotal",
    "taxtotal": "tax", "taxamount": "tax", "tva": "tax",
    "montanttva": "tax",
    "grandtotal": "grand_total", "totalttc": "grand_total",
    "montantttc": "grand_total", "payableamount": "grand_total",
    "taxinclusiveamount": "grand_total",
    "discount": "discount", "remise": "discount",
    "currency": "currency", "devise": "currency",
    "currencycode": "currency",
    # Buyer
    "buyername": "buyer_name", "customername": "buyer_name",
    "client": "buyer_name", "billto": "buyer_name",
    "buyeraddress": "buyer_address", "customeraddress": "buyer_address",
    "adresseclient": "buyer_address",
    "buyeremail": "buyer_email", "customeremail": "buyer_email",
    "emailclient": "buyer_email",
    # VAT IDs
    "sellervatid": "seller_vat_id", "suppliervatid": "seller_vat_id",
    "matriculefiscale": "seller_vat_id", "identifiantfiscal": "seller_vat_id",
    "sellertin": "seller_vat_id",
    "buyervatid": "buyer_vat_id", "customervatid": "buyer_vat_id",
    "clientmatricule": "buyer_vat_id", "buyertin": "buyer_vat_id",
    # Payment
    "paymentmethod": "payment_method", "modepaiement": "payment_method",
    "paymentmeans": "payment_method",
    # Notes
    "note": "notes", "notes": "notes", "remarque": "notes",
    "description": "notes",
}

# Line item tag mappings
_ITEM_TAG_MAP = {
    "description": "description", "name": "description",
    "itemname": "description", "designation": "description",
    "libelle": "description", "servicedescription": "description",
    "quantity": "quantity", "quantite": "quantity",
    "invoicedquantity": "quantity", "qty": "quantity",
    "unitprice": "unit_price", "prixunitaire": "unit_price",
    "price": "unit_price", "priceamount": "unit_price",
    "total": "total", "linetotal": "total",
    "lineextensionautotal": "total", "montant": "total",
    "taxrate": "tax_rate", "tauxtva": "tax_rate",
    "percent": "tax_rate", "vatrate": "tax_rate",
    "taxexempt": "tax_exempt", "exonere": "tax_exempt",
}


def _normalize_tag(tag: str) -> str:
    """Strip namespace and normalize to lowercase without separators."""
    # Remove namespace prefix {uri}localname
    if "}" in tag:
        tag = tag.split("}", 1)[1]
    # Remove namespace prefix ns:localname
    if ":" in tag:
        tag = tag.split(":", 1)[1]
    # Lowercase, remove underscores/dashes
    return re.sub(r"[_\-\s]", "", tag.lower())


def _parse_generic_xml(root) -> dict:
    """Fallback parser for non-UBL XML invoices (flat or semi-structured)."""
    data = {
        "vendor_name": None, "invoice_no": None,
        "date": None, "due_date": None,
        "subtotal": None, "tax": None, "discount": None,
        "grand_total": None, "currency": None,
        "buyer_name": None, "buyer_address": None, "buyer_email": None,
        "seller_vat_id": None, "buyer_vat_id": None,
        "payment_method": None, "notes": None,
    }
    line_items = []

    def _walk(el, is_line_item_context=False, current_item=None):
        tag = _normalize_tag(el.tag)
        text = (el.text or "").strip() if el.text else None

        # Detect line item containers
        if tag in ("invoiceline", "line", "item", "lineitem", "ligne", "article", "lignedefacture"):
            item = {"description": None, "quantity": None, "unit_price": None, "total": None}
            for child in el:
                _walk(child, is_line_item_context=True, current_item=item)
            # Calculate missing
            if not item.get("total") and item.get("quantity") and item.get("unit_price"):
                item["total"] = round(item["quantity"] * item["unit_price"], 4)
            if item.get("description") or item.get("total"):
                line_items.append(item)
            return

        # Inside a line item
        if is_line_item_context and current_item is not None:
            mapped = _ITEM_TAG_MAP.get(tag)
            if mapped and text:
                if mapped in ("quantity", "unit_price", "total", "tax_rate"):
                    current_item[mapped] = _int_or_float(text) if mapped == "quantity" else _float(text)
                elif mapped == "tax_exempt":
                    current_item[mapped] = text.lower() in ("true", "1", "oui", "yes")
                else:
                    current_item[mapped] = text
            # Recurse into nested elements
            for child in el:
                _walk(child, is_line_item_context=True, current_item=current_item)
            return

        # Top-level fields
        mapped = _TAG_MAP.get(tag)
        if mapped and text and data.get(mapped) is None:
            if mapped in ("subtotal", "tax", "discount", "grand_total"):
                data[mapped] = _float(text)
            elif mapped == "date":
                data[mapped] = _normalize_date(text)
            elif mapped == "due_date":
                data[mapped] = _normalize_date(text)
            else:
                data[mapped] = text

        # Also check attributes for VAT IDs etc.
        for attr_name, attr_val in el.attrib.items():
            attr_key = _normalize_tag(attr_name)
            attr_mapped = _TAG_MAP.get(attr_key)
            if attr_mapped and attr_val and data.get(attr_mapped) is None:
                data[attr_mapped] = attr_val

        # Recurse
        for child in el:
            _walk(child)

    _walk(root)

    return {
        "vendor_name": data["vendor_name"],
        "invoice_no": data["invoice_no"],
        "date": data["date"],
        "due_date": data["due_date"],
        "line_items": line_items,
        "totals": {
            "subtotal": data["subtotal"],
            "tax": data["tax"],
            "discount": data["discount"],
            "grand_total": data["grand_total"],
            "currency": data["currency"] or "TND",
        },
        "bill_to": {
            "name": data["buyer_name"],
            "address": data["buyer_address"],
            "email": data["buyer_email"],
        },
        "payment_method": data["payment_method"],
        "notes": data["notes"],
        "seller_vat_id": data["seller_vat_id"],
        "buyer_vat_id": data["buyer_vat_id"],
    }


# ── Public API ───────────────────────────────────────────────────────────────

def parse_xml_invoice(xml_content: bytes | str) -> dict:
    """
    Parse an XML invoice file and return structured data matching the
    existing MongoDB invoice schema.

    Args:
        xml_content: Raw XML as bytes or string.

    Returns:
        dict with keys: vendor_name, invoice_no, date, due_date, line_items,
        totals, bill_to, payment_method, notes, seller_vat_id, buyer_vat_id,
        field_confidence, validation, source_format, invoice_category.

    Raises:
        ValueError: If the XML cannot be parsed.
    """
    if isinstance(xml_content, str):
        xml_content = xml_content.encode("utf-8")

    try:
        # Remove XML declaration encoding conflicts
        root = etree.fromstring(xml_content)
    except etree.XMLSyntaxError as e:
        raise ValueError(f"Invalid XML: {e}")

    # Detect format by root tag or namespace
    root_tag = _normalize_tag(root.tag)
    root_ns = root.nsmap.get(None, "")

    # Build namespace map: merge document's actual namespaces with our defaults
    ns = dict(NAMESPACES)
    for prefix, uri in root.nsmap.items():
        if prefix:
            ns[prefix] = uri

    # Try UBL format first
    is_ubl = (
        "invoice" in root_tag
        and ("oasis" in root_ns or "ubl" in root_ns or root.xpath(".//cac:*", namespaces=ns))
    )

    if is_ubl:
        logger.info("Detected UBL 2.1 invoice format")
        data = _parse_ubl_invoice(root, ns)
    else:
        logger.info("Using generic XML parser (non-UBL format)")
        data = _parse_generic_xml(root)

    # ── Build confidence scores (XML = high confidence) ─────────────────
    fc = {}
    field_checks = {
        "vendor_name": data.get("vendor_name"),
        "invoice_no": data.get("invoice_no"),
        "date": data.get("date"),
        "due_date": data.get("due_date"),
        "line_items": data.get("line_items"),
        "grand_total": (data.get("totals") or {}).get("grand_total"),
        "currency": (data.get("totals") or {}).get("currency"),
        "bill_to": (data.get("bill_to") or {}).get("name"),
        "payment_method": data.get("payment_method"),
        "notes": data.get("notes"),
    }
    for field, value in field_checks.items():
        has_value = bool(value) if not isinstance(value, list) else len(value) > 0
        fc[field] = 98 if has_value else 0  # XML data is structured → high confidence

    data["field_confidence"] = fc

    # ── Validation ──────────────────────────────────────────────────────
    warnings = []
    if not data.get("vendor_name"):
        warnings.append("Missing vendor/seller name")
    if not data.get("invoice_no"):
        warnings.append("Missing invoice number")
    if not data.get("date"):
        warnings.append("Missing invoice date")
    if not (data.get("totals") or {}).get("grand_total"):
        warnings.append("Missing grand total")
    if not data.get("line_items"):
        warnings.append("No line items found")

    found_count = sum(1 for f in ("vendor_name", "invoice_no", "date")
                      if data.get(f)) + (1 if (data.get("totals") or {}).get("grand_total") else 0)

    overall = round(sum(fc.values()) / max(len(fc), 1))

    data["validation"] = {
        "is_valid": found_count >= 2,
        "confidence": overall,
        "needs_human_review": found_count < 3 or len(warnings) > 2,
        "warnings": warnings,
    }

    # ── Metadata ────────────────────────────────────────────────────────
    data["source_format"] = "xml"
    data["raw_text_length"] = len(xml_content)
    data["_model_used"] = "xml_parser"
    data["processed_at"] = datetime.utcnow().isoformat()

    return data


def is_xml_file(filename: str, content: bytes | None = None) -> bool:
    """Check if a file is XML by extension and optionally magic bytes."""
    if filename and filename.lower().endswith(".xml"):
        return True
    if content and content.lstrip()[:5] in (b"<?xml", b"<Invo", b"<invo", b"<fact"):
        return True
    return False

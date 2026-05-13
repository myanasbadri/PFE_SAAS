"""
TEJ (التصريح الإلكتروني الجبائي) XML Generator for Tunisian withholding tax certificates.

Generates XML declarations compliant with the Tunisian tax authority's TEJ schema
for "Certificat de Retenue à la Source" (withholding tax certificates).

Supports:
- Multiple withholding types: salaries, professional fees, rent, vendor payments
- Auto-calculation of withholding amounts based on official TN rates
- Multi-currency support (TND, EUR, USD)
- XSD validation with detailed error reporting
- Batch generation from CSV
- PDF export with signature placeholder
- QR code generation for certificate verification
"""

import csv
import io
import hashlib
import json
import logging
import os
import uuid
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from typing import Optional

from lxml import etree

logger = logging.getLogger(__name__)

# ── TEJ Schema Configuration ──────────────────────────────────────────────────

TEJ_SCHEMA_DIR = Path(__file__).parent.parent / "schemas" / "tej"
TEJ_SCHEMA_VERSION = "2026.1.0"
TEJ_NAMESPACE = "urn:tn:gov:finances:tej:declaration:2026"
TEJ_XSD_FILE = TEJ_SCHEMA_DIR / f"tej_declaration_{TEJ_SCHEMA_VERSION.replace('.', '_')}.xsd"

# ── Tunisian Withholding Tax Rates (2026) ─────────────────────────────────────
# Based on Code de l'IRPP et de l'IS and Finance Law 2026

WITHHOLDING_RATES = {
    # Salaries and wages (retenue sur salaires)
    "salaries": {
        "code": "RS",
        "description": "Retenue sur salaires et traitements",
        "rates": {
            "resident": Decimal("0.00"),  # Progressive scale applied separately
            "non_resident": Decimal("0.20"),
        },
        "threshold": Decimal("0"),
    },
    # Professional fees / honoraires (Art. 52 CIRPPIS)
    "fees": {
        "code": "RH",
        "description": "Retenue sur honoraires, commissions et courtages",
        "rates": {
            "resident_individual": Decimal("0.15"),
            "resident_company": Decimal("0.10"),
            "non_resident": Decimal("0.15"),
        },
        "threshold": Decimal("1000"),
    },
    # Rent / loyers (Art. 52)
    "rent": {
        "code": "RL",
        "description": "Retenue sur loyers",
        "rates": {
            "resident_individual": Decimal("0.15"),
            "resident_company": Decimal("0.10"),
            "non_resident": Decimal("0.15"),
        },
        "threshold": Decimal("0"),
    },
    # Vendor payments / achats (Art. 52)
    "vendor_payments": {
        "code": "RA",
        "description": "Retenue sur achats auprès de non-inscrits",
        "rates": {
            "not_registered": Decimal("0.015"),
            "partially_registered": Decimal("0.01"),
        },
        "threshold": Decimal("1000"),
    },
    # Service payments to non-residents
    "non_resident_services": {
        "code": "RNR",
        "description": "Retenue sur rémunérations servies aux non-résidents",
        "rates": {
            "services": Decimal("0.15"),
            "royalties": Decimal("0.15"),
            "interest": Decimal("0.20"),
            "dividends": Decimal("0.10"),
        },
        "threshold": Decimal("0"),
    },
    # Commissions and brokerage
    "commissions": {
        "code": "RC",
        "description": "Retenue sur commissions et courtages",
        "rates": {
            "resident_individual": Decimal("0.15"),
            "resident_company": Decimal("0.10"),
            "non_resident": Decimal("0.15"),
        },
        "threshold": Decimal("1000"),
    },
}

# Supported currencies with conversion note
SUPPORTED_CURRENCIES = {"TND", "EUR", "USD"}

# ── XSD Schema (embedded for offline validation) ──────────────────────────────

_TEJ_XSD_CONTENT = """<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"
           xmlns:tej="urn:tn:gov:finances:tej:declaration:2026"
           targetNamespace="urn:tn:gov:finances:tej:declaration:2026"
           elementFormDefault="qualified">

  <xs:element name="DeclarationRetenue" type="tej:DeclarationRetenueType"/>

  <xs:complexType name="DeclarationRetenueType">
    <xs:sequence>
      <xs:element name="Entete" type="tej:EnteteType"/>
      <xs:element name="Declarant" type="tej:DeclarantType"/>
      <xs:element name="Beneficiaires" type="tej:BeneficiairesType"/>
      <xs:element name="Totaux" type="tej:TotauxType"/>
      <xs:element name="Metadata" type="tej:MetadataType" minOccurs="0"/>
    </xs:sequence>
    <xs:attribute name="version" type="xs:string" use="required"/>
  </xs:complexType>

  <xs:complexType name="EnteteType">
    <xs:sequence>
      <xs:element name="TypeDeclaration" type="tej:TypeDeclarationType"/>
      <xs:element name="Periode" type="tej:PeriodeType"/>
      <xs:element name="DateDepot" type="xs:date"/>
      <xs:element name="Reference" type="xs:string"/>
    </xs:sequence>
  </xs:complexType>

  <xs:simpleType name="TypeDeclarationType">
    <xs:restriction base="xs:string">
      <xs:enumeration value="MENSUELLE"/>
      <xs:enumeration value="TRIMESTRIELLE"/>
      <xs:enumeration value="ANNUELLE"/>
      <xs:enumeration value="COMPLEMENTAIRE"/>
    </xs:restriction>
  </xs:simpleType>

  <xs:complexType name="PeriodeType">
    <xs:sequence>
      <xs:element name="Annee" type="xs:gYear"/>
      <xs:element name="Mois" type="xs:positiveInteger" minOccurs="0"/>
      <xs:element name="Trimestre" type="xs:positiveInteger" minOccurs="0"/>
    </xs:sequence>
  </xs:complexType>

  <xs:complexType name="DeclarantType">
    <xs:sequence>
      <xs:element name="MatriculeFiscal" type="tej:MatriculeFiscalType"/>
      <xs:element name="RaisonSociale" type="xs:string"/>
      <xs:element name="Adresse" type="tej:AdresseType"/>
      <xs:element name="Activite" type="xs:string" minOccurs="0"/>
    </xs:sequence>
  </xs:complexType>

  <xs:simpleType name="MatriculeFiscalType">
    <xs:restriction base="xs:string">
      <xs:pattern value="[0-9]{7}[A-Z]/[A-Z]/[A-Z]/[0-9]{3}"/>
    </xs:restriction>
  </xs:simpleType>

  <xs:complexType name="AdresseType">
    <xs:sequence>
      <xs:element name="Rue" type="xs:string"/>
      <xs:element name="CodePostal" type="xs:string"/>
      <xs:element name="Ville" type="xs:string"/>
      <xs:element name="Gouvernorat" type="xs:string" minOccurs="0"/>
    </xs:sequence>
  </xs:complexType>

  <xs:complexType name="BeneficiairesType">
    <xs:sequence>
      <xs:element name="Beneficiaire" type="tej:BeneficiaireType" maxOccurs="unbounded"/>
    </xs:sequence>
  </xs:complexType>

  <xs:complexType name="BeneficiaireType">
    <xs:sequence>
      <xs:element name="Identifiant" type="xs:string"/>
      <xs:element name="NomOuRaisonSociale" type="xs:string"/>
      <xs:element name="TypeBeneficiaire" type="tej:TypeBeneficiaireType"/>
      <xs:element name="Adresse" type="tej:AdresseType" minOccurs="0"/>
      <xs:element name="Operations" type="tej:OperationsType"/>
    </xs:sequence>
  </xs:complexType>

  <xs:simpleType name="TypeBeneficiaireType">
    <xs:restriction base="xs:string">
      <xs:enumeration value="PERSONNE_PHYSIQUE"/>
      <xs:enumeration value="PERSONNE_MORALE"/>
      <xs:enumeration value="NON_RESIDENT"/>
    </xs:restriction>
  </xs:simpleType>

  <xs:complexType name="OperationsType">
    <xs:sequence>
      <xs:element name="Operation" type="tej:OperationType" maxOccurs="unbounded"/>
    </xs:sequence>
  </xs:complexType>

  <xs:complexType name="OperationType">
    <xs:sequence>
      <xs:element name="TypeRetenue" type="xs:string"/>
      <xs:element name="CodeRetenue" type="xs:string"/>
      <xs:element name="DateOperation" type="xs:date"/>
      <xs:element name="MontantBrut" type="tej:MontantType"/>
      <xs:element name="TauxRetenue" type="xs:decimal"/>
      <xs:element name="MontantRetenue" type="tej:MontantType"/>
      <xs:element name="MontantNet" type="tej:MontantType"/>
      <xs:element name="ReferenceFacture" type="xs:string" minOccurs="0"/>
      <xs:element name="Description" type="xs:string" minOccurs="0"/>
    </xs:sequence>
  </xs:complexType>

  <xs:complexType name="MontantType">
    <xs:simpleContent>
      <xs:extension base="xs:decimal">
        <xs:attribute name="devise" type="tej:DeviseType" default="TND"/>
      </xs:extension>
    </xs:simpleContent>
  </xs:complexType>

  <xs:simpleType name="DeviseType">
    <xs:restriction base="xs:string">
      <xs:enumeration value="TND"/>
      <xs:enumeration value="EUR"/>
      <xs:enumeration value="USD"/>
    </xs:restriction>
  </xs:simpleType>

  <xs:complexType name="TotauxType">
    <xs:sequence>
      <xs:element name="TotalMontantBrut" type="tej:MontantType"/>
      <xs:element name="TotalRetenue" type="tej:MontantType"/>
      <xs:element name="TotalMontantNet" type="tej:MontantType"/>
      <xs:element name="NombreOperations" type="xs:positiveInteger"/>
      <xs:element name="NombreBeneficiaires" type="xs:positiveInteger"/>
    </xs:sequence>
  </xs:complexType>

  <xs:complexType name="MetadataType">
    <xs:sequence>
      <xs:element name="GeneratedAt" type="xs:dateTime"/>
      <xs:element name="GeneratedBy" type="xs:string"/>
      <xs:element name="SchemaVersion" type="xs:string"/>
      <xs:element name="Checksum" type="xs:string" minOccurs="0"/>
      <xs:element name="QRCode" type="xs:string" minOccurs="0"/>
    </xs:sequence>
  </xs:complexType>

</xs:schema>
"""

# Cache the parsed schema object
_CACHED_SCHEMA: Optional[etree.XMLSchema] = None


def _get_schema() -> etree.XMLSchema:
    """Load and cache the TEJ XSD schema."""
    global _CACHED_SCHEMA
    if _CACHED_SCHEMA is not None:
        return _CACHED_SCHEMA

    # Try loading from file first, fall back to embedded
    if TEJ_XSD_FILE.exists():
        logger.info(f"Loading TEJ schema from file: {TEJ_XSD_FILE}")
        schema_doc = etree.parse(str(TEJ_XSD_FILE))
    else:
        logger.info("Loading embedded TEJ schema")
        schema_doc = etree.parse(io.BytesIO(_TEJ_XSD_CONTENT.encode("utf-8")))

    _CACHED_SCHEMA = etree.XMLSchema(schema_doc)
    return _CACHED_SCHEMA


# ── TEJ XML Generator Class ──────────────────────────────────────────────────


class TEJXMLGenerator:
    """
    Generates TEJ-compliant XML for Tunisian withholding tax certificates.

    Usage:
        generator = TEJXMLGenerator()
        result = generator.generate_withholding_cert(invoice_data)
        # result["xml"] contains the XML string
        # result["validation"] contains the validation report
    """

    def __init__(self, schema_version: str = TEJ_SCHEMA_VERSION, generated_by: str = "SmartInvoice"):
        self.schema_version = schema_version
        self.generated_by = generated_by
        self.ns = TEJ_NAMESPACE
        self.nsmap = {None: self.ns}

    def generate_withholding_cert(self, data: dict) -> dict:
        """
        Generate a TEJ-compliant withholding tax certificate XML.

        Args:
            data: Dictionary containing:
                - declaration_type: "MENSUELLE"|"TRIMESTRIELLE"|"ANNUELLE"|"COMPLEMENTAIRE"
                - period: {"year": 2026, "month": 1} or {"year": 2026, "quarter": 1}
                - filing_date: "2026-02-15" (date of filing)
                - reference: Unique declaration reference
                - declarant: {
                    "tax_id": "1234567A/P/M/000",
                    "name": "Company Name",
                    "address": {"street": "...", "postal_code": "...", "city": "...", "governorate": "..."},
                    "activity": "..."
                  }
                - beneficiaries: [{
                    "id": "tax_id or passport",
                    "name": "Beneficiary Name",
                    "type": "PERSONNE_PHYSIQUE"|"PERSONNE_MORALE"|"NON_RESIDENT",
                    "address": {...},  (optional)
                    "operations": [{
                        "withholding_type": "fees"|"rent"|"salaries"|...,
                        "date": "2026-01-15",
                        "gross_amount": 5000.00,
                        "rate": null,  (auto-calculated if null)
                        "rate_category": "resident_individual",  (for auto-calculation)
                        "currency": "TND",
                        "invoice_ref": "INV-001",  (optional)
                        "description": "..."  (optional)
                    }]
                  }]

        Returns:
            Dictionary with:
                - success: bool
                - xml: XML string (if successful)
                - validation: Validation report
                - metadata: Generation metadata
                - errors: List of errors (if failed)
        """
        logger.info(f"Generating TEJ withholding certificate: ref={data.get('reference', 'N/A')}")

        try:
            # Strip whitespace from all string fields to avoid XSD pattern failures
            self._strip_strings(data)

            # Validate input data
            input_errors = self._validate_input(data)
            if input_errors:
                return {
                    "success": False,
                    "xml": None,
                    "validation": {"valid": False, "errors": input_errors},
                    "metadata": None,
                    "errors": input_errors,
                }

            # Build XML tree
            root = self._build_xml_tree(data)

            # Generate XML string
            xml_bytes = etree.tostring(
                root, pretty_print=True, xml_declaration=True, encoding="UTF-8"
            )
            xml_string = xml_bytes.decode("utf-8")

            # Validate against schema
            validation_report = self.validate_against_schema(xml_string)

            # Generate metadata
            checksum = hashlib.sha256(xml_bytes).hexdigest()
            qr_data = self._generate_qr_data(data, checksum)
            metadata = {
                "generated_at": datetime.utcnow().isoformat() + "Z",
                "generated_by": self.generated_by,
                "schema_version": self.schema_version,
                "checksum": checksum,
                "qr_code_data": qr_data,
                "declaration_ref": data.get("reference", ""),
            }

            return {
                "success": validation_report["valid"],
                "xml": xml_string,
                "validation": validation_report,
                "metadata": metadata,
                "errors": validation_report.get("errors", []),
            }

        except Exception as e:
            logger.exception("Failed to generate TEJ XML")
            return {
                "success": False,
                "xml": None,
                "validation": {"valid": False, "errors": [str(e)]},
                "metadata": None,
                "errors": [f"Generation failed: {str(e)}"],
            }

    def validate_against_schema(self, xml_string: str) -> dict:
        """
        Validate an XML string against the TEJ XSD schema.

        Args:
            xml_string: XML content to validate

        Returns:
            Dictionary with:
                - valid: bool
                - errors: List of validation error dicts
                - warnings: List of warning dicts
        """
        logger.info("Validating XML against TEJ schema")
        errors = []
        warnings = []

        try:
            schema = _get_schema()
            doc = etree.parse(io.BytesIO(xml_string.encode("utf-8")))

            is_valid = schema.validate(doc)

            if not is_valid:
                for error in schema.error_log:
                    error_entry = {
                        "line": error.line,
                        "column": error.column,
                        "message": error.message,
                        "level": error.level_name,
                        "domain": error.domain_name,
                        "type": error.type_name,
                    }
                    if error.level_name == "WARNING":
                        warnings.append(error_entry)
                    else:
                        errors.append(error_entry)

            logger.info(f"Schema validation: valid={is_valid}, errors={len(errors)}, warnings={len(warnings)}")

            return {
                "valid": is_valid,
                "errors": errors,
                "warnings": warnings,
                "schema_version": self.schema_version,
            }

        except etree.XMLSyntaxError as e:
            logger.error(f"XML syntax error during validation: {e}")
            return {
                "valid": False,
                "errors": [{"line": e.lineno, "column": e.offset, "message": str(e), "level": "ERROR"}],
                "warnings": [],
                "schema_version": self.schema_version,
            }

    def calculate_withholding(self, withholding_type: str, gross_amount: float,
                              rate_category: str) -> dict:
        """
        Calculate withholding amount based on official Tunisian rates.

        Args:
            withholding_type: Key from WITHHOLDING_RATES (e.g., "fees", "rent")
            gross_amount: Gross payment amount
            rate_category: Sub-category for rate lookup (e.g., "resident_individual")

        Returns:
            Dictionary with rate, withholding_amount, net_amount
        """
        gross = Decimal(str(gross_amount))

        if withholding_type not in WITHHOLDING_RATES:
            raise ValueError(f"Unknown withholding type: {withholding_type}. "
                             f"Valid types: {list(WITHHOLDING_RATES.keys())}")

        rate_info = WITHHOLDING_RATES[withholding_type]
        rates = rate_info["rates"]
        threshold = rate_info["threshold"]

        if rate_category not in rates:
            raise ValueError(f"Unknown rate category '{rate_category}' for type '{withholding_type}'. "
                             f"Valid categories: {list(rates.keys())}")

        rate = rates[rate_category]

        # Check threshold
        if gross < threshold:
            return {
                "rate": Decimal("0"),
                "withholding_amount": Decimal("0"),
                "net_amount": gross,
                "below_threshold": True,
                "threshold": threshold,
            }

        withholding_amount = (gross * rate).quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)
        net_amount = gross - withholding_amount

        return {
            "rate": rate,
            "withholding_amount": withholding_amount,
            "net_amount": net_amount,
            "below_threshold": False,
            "code": rate_info["code"],
        }

    def batch_generate_from_csv(self, csv_content: str, declarant_data: dict) -> dict:
        """
        Generate TEJ XML from a CSV file containing multiple beneficiary operations.

        CSV columns:
            beneficiary_id, beneficiary_name, beneficiary_type, withholding_type,
            rate_category, date, gross_amount, currency, invoice_ref, description

        Args:
            csv_content: CSV string content
            declarant_data: Dict with declarant info and period/declaration metadata

        Returns:
            Dictionary with success status, XML, validation, and per-row errors
        """
        logger.info("Processing batch CSV for TEJ generation")
        row_errors = []
        beneficiaries_map = {}

        reader = csv.DictReader(io.StringIO(csv_content))
        required_columns = {"beneficiary_id", "beneficiary_name", "beneficiary_type",
                            "withholding_type", "rate_category", "date", "gross_amount"}

        if not required_columns.issubset(set(reader.fieldnames or [])):
            missing = required_columns - set(reader.fieldnames or [])
            return {
                "success": False,
                "xml": None,
                "validation": {"valid": False, "errors": [f"Missing CSV columns: {missing}"]},
                "row_errors": [],
                "errors": [f"Missing required CSV columns: {missing}"],
            }

        for row_num, row in enumerate(reader, start=2):
            try:
                ben_id = row["beneficiary_id"].strip()
                gross = float(row["gross_amount"])
                currency = row.get("currency", "TND").strip().upper()
                wh_type = row["withholding_type"].strip()
                rate_cat = row["rate_category"].strip()

                if currency not in SUPPORTED_CURRENCIES:
                    row_errors.append({"row": row_num, "error": f"Unsupported currency: {currency}"})
                    continue

                # Calculate withholding
                calc = self.calculate_withholding(wh_type, gross, rate_cat)

                operation = {
                    "withholding_type": wh_type,
                    "date": row["date"].strip(),
                    "gross_amount": gross,
                    "rate": float(calc["rate"]),
                    "withholding_amount": float(calc["withholding_amount"]),
                    "net_amount": float(calc["net_amount"]),
                    "currency": currency,
                    "invoice_ref": row.get("invoice_ref", "").strip(),
                    "description": row.get("description", "").strip(),
                    "rate_category": rate_cat,
                }

                if ben_id not in beneficiaries_map:
                    beneficiaries_map[ben_id] = {
                        "id": ben_id,
                        "name": row["beneficiary_name"].strip(),
                        "type": row["beneficiary_type"].strip(),
                        "operations": [],
                    }

                beneficiaries_map[ben_id]["operations"].append(operation)

            except (ValueError, KeyError) as e:
                row_errors.append({"row": row_num, "error": str(e)})

        if not beneficiaries_map:
            return {
                "success": False,
                "xml": None,
                "validation": {"valid": False, "errors": ["No valid rows found in CSV"]},
                "row_errors": row_errors,
                "errors": ["No valid beneficiary data could be parsed from CSV"],
            }

        # Build full declaration data
        full_data = {
            **declarant_data,
            "beneficiaries": list(beneficiaries_map.values()),
        }

        result = self.generate_withholding_cert(full_data)
        result["row_errors"] = row_errors
        result["rows_processed"] = sum(len(b["operations"]) for b in beneficiaries_map.values())
        result["rows_skipped"] = len(row_errors)

        return result

    def export_to_pdf(self, data: dict, xml_string: str, output_path: str,
                      include_signature: bool = True) -> dict:
        """
        Export withholding certificate as PDF with optional signature placeholder.

        Args:
            data: Original declaration data dict
            xml_string: Generated XML string
            output_path: File path to write the PDF
            include_signature: Whether to include signature/stamp placeholder

        Returns:
            Dictionary with success status and file path
        """
        try:
            from reportlab.lib.pagesizes import A4
            from reportlab.lib.units import cm
            from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
            from reportlab.lib.enums import TA_CENTER, TA_RIGHT
            from reportlab.platypus import (
                SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
            )
            from reportlab.lib import colors
        except ImportError:
            logger.error("reportlab not installed — PDF export unavailable")
            return {
                "success": False,
                "path": None,
                "error": "reportlab package required for PDF export. Install with: pip install reportlab",
            }

        try:
            doc = SimpleDocTemplate(output_path, pagesize=A4,
                                    leftMargin=1.5 * cm, rightMargin=1.5 * cm,
                                    topMargin=2 * cm, bottomMargin=2 * cm)
            styles = getSampleStyleSheet()
            elements = []

            # Title
            title_style = ParagraphStyle("Title", parent=styles["Title"],
                                         fontSize=14, alignment=TA_CENTER)
            elements.append(Paragraph("CERTIFICAT DE RETENUE À LA SOURCE", title_style))
            elements.append(Spacer(1, 0.5 * cm))

            # Subtitle with reference
            subtitle_style = ParagraphStyle("Subtitle", parent=styles["Normal"],
                                            fontSize=10, alignment=TA_CENTER)
            ref = data.get("reference", "N/A")
            period = data.get("period", {})
            period_str = f"{period.get('year', '')}"
            if period.get("month"):
                period_str += f" - Mois {period['month']}"
            elif period.get("quarter"):
                period_str += f" - Trimestre {period['quarter']}"

            elements.append(Paragraph(f"Référence: {ref} | Période: {period_str}", subtitle_style))
            elements.append(Spacer(1, 1 * cm))

            # Declarant section
            declarant = data.get("declarant", {})
            elements.append(Paragraph("<b>DÉCLARANT</b>", styles["Heading3"]))
            declarant_info = [
                ["Matricule Fiscal:", declarant.get("tax_id", "")],
                ["Raison Sociale:", declarant.get("name", "")],
                ["Adresse:", self._format_address(declarant.get("address", {}))],
            ]
            t = Table(declarant_info, colWidths=[4 * cm, 13 * cm])
            t.setStyle(TableStyle([
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]))
            elements.append(t)
            elements.append(Spacer(1, 0.8 * cm))

            # Beneficiaries and operations
            elements.append(Paragraph("<b>BÉNÉFICIAIRES ET OPÉRATIONS</b>", styles["Heading3"]))
            elements.append(Spacer(1, 0.3 * cm))

            for ben in data.get("beneficiaries", []):
                elements.append(Paragraph(
                    f"<b>{ben.get('name', '')}</b> ({ben.get('id', '')})",
                    styles["Normal"]
                ))

                op_table_data = [["Date", "Type", "Brut", "Taux", "Retenue", "Net"]]
                for op in ben.get("operations", []):
                    currency = op.get("currency", "TND")
                    rate = op.get("rate")
                    if rate is None:
                        rate = self._get_rate_for_operation(op)
                    gross = op.get("gross_amount", 0)
                    wh_amount = op.get("withholding_amount")
                    if wh_amount is None:
                        calc = self.calculate_withholding(
                            op["withholding_type"], gross, op.get("rate_category", "")
                        )
                        wh_amount = float(calc["withholding_amount"])
                        rate = float(calc["rate"])

                    net = gross - (wh_amount or 0)
                    op_table_data.append([
                        op.get("date", ""),
                        op.get("withholding_type", ""),
                        f"{gross:,.3f} {currency}",
                        f"{float(rate) * 100:.1f}%",
                        f"{wh_amount:,.3f} {currency}",
                        f"{net:,.3f} {currency}",
                    ])

                op_table = Table(op_table_data, colWidths=[2.2 * cm, 2.5 * cm, 3 * cm, 1.8 * cm, 3 * cm, 3 * cm])
                op_table.setStyle(TableStyle([
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e0e0e0")),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 8),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                    ("ALIGN", (2, 1), (-1, -1), "RIGHT"),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("TOPPADDING", (0, 0), (-1, -1), 3),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ]))
                elements.append(op_table)
                elements.append(Spacer(1, 0.5 * cm))

            # Signature placeholder
            if include_signature:
                elements.append(Spacer(1, 1.5 * cm))
                sig_style = ParagraphStyle("Sig", parent=styles["Normal"],
                                           fontSize=9, alignment=TA_RIGHT)
                elements.append(Paragraph("Cachet et signature du déclarant", sig_style))
                elements.append(Spacer(1, 2 * cm))
                elements.append(Paragraph("_" * 40, sig_style))

            # QR Code (if qrcode library available)
            qr_image_path = self._generate_qr_image(data, xml_string)
            if qr_image_path:
                elements.append(Spacer(1, 0.5 * cm))
                elements.append(Image(qr_image_path, width=3 * cm, height=3 * cm))

            doc.build(elements)

            # Clean up temp QR image
            if qr_image_path and os.path.exists(qr_image_path):
                os.remove(qr_image_path)

            logger.info(f"PDF exported to: {output_path}")
            return {"success": True, "path": output_path}

        except Exception as e:
            logger.exception("PDF export failed")
            return {"success": False, "path": None, "error": str(e)}

    # ── Private Methods ───────────────────────────────────────────────────────

    def _strip_strings(self, obj):
        """Recursively strip whitespace from all string values."""
        if isinstance(obj, dict):
            for k, v in obj.items():
                if isinstance(v, str):
                    obj[k] = v.strip()
                elif isinstance(v, (dict, list)):
                    self._strip_strings(v)
        elif isinstance(obj, list):
            for item in obj:
                if isinstance(item, (dict, list)):
                    self._strip_strings(item)

    def _validate_input(self, data: dict) -> list:
        """Validate required fields in input data."""
        errors = []

        if not data.get("declaration_type"):
            errors.append("Missing required field: declaration_type")
        elif data["declaration_type"] not in ("MENSUELLE", "TRIMESTRIELLE", "ANNUELLE", "COMPLEMENTAIRE"):
            errors.append(f"Invalid declaration_type: {data['declaration_type']}")

        if not data.get("period"):
            errors.append("Missing required field: period")
        elif not data["period"].get("year"):
            errors.append("Missing required field: period.year")

        if not data.get("declarant"):
            errors.append("Missing required field: declarant")
        else:
            dec = data["declarant"]
            if not dec.get("tax_id"):
                errors.append("Missing required field: declarant.tax_id")
            if not dec.get("name"):
                errors.append("Missing required field: declarant.name")
            if not dec.get("address"):
                errors.append("Missing required field: declarant.address")

        if not data.get("beneficiaries"):
            errors.append("Missing required field: beneficiaries (must have at least one)")
        else:
            for i, ben in enumerate(data["beneficiaries"]):
                if not ben.get("id"):
                    errors.append(f"Beneficiary [{i}]: missing id")
                if not ben.get("name"):
                    errors.append(f"Beneficiary [{i}]: missing name")
                if not ben.get("type"):
                    errors.append(f"Beneficiary [{i}]: missing type")
                if not ben.get("operations"):
                    errors.append(f"Beneficiary [{i}]: must have at least one operation")
                else:
                    for j, op in enumerate(ben["operations"]):
                        if not op.get("withholding_type"):
                            errors.append(f"Beneficiary [{i}] Operation [{j}]: missing withholding_type")
                        if not op.get("date"):
                            errors.append(f"Beneficiary [{i}] Operation [{j}]: missing date")
                        if op.get("gross_amount") is None:
                            errors.append(f"Beneficiary [{i}] Operation [{j}]: missing gross_amount")

        return errors

    def _build_xml_tree(self, data: dict) -> etree._Element:
        """Build the full XML element tree from data dict."""
        nsmap = {None: self.ns}
        root = etree.Element(f"{{{self.ns}}}DeclarationRetenue", nsmap=nsmap)
        root.set("version", self.schema_version)

        # Entete (header)
        entete = etree.SubElement(root, f"{{{self.ns}}}Entete")
        etree.SubElement(entete, f"{{{self.ns}}}TypeDeclaration").text = data["declaration_type"]

        periode = etree.SubElement(entete, f"{{{self.ns}}}Periode")
        etree.SubElement(periode, f"{{{self.ns}}}Annee").text = str(data["period"]["year"])
        if data["period"].get("month"):
            etree.SubElement(periode, f"{{{self.ns}}}Mois").text = str(data["period"]["month"])
        if data["period"].get("quarter"):
            etree.SubElement(periode, f"{{{self.ns}}}Trimestre").text = str(data["period"]["quarter"])

        filing_date = data.get("filing_date", datetime.utcnow().strftime("%Y-%m-%d"))
        etree.SubElement(entete, f"{{{self.ns}}}DateDepot").text = filing_date

        ref = data.get("reference", f"TEJ-{uuid.uuid4().hex[:12].upper()}")
        etree.SubElement(entete, f"{{{self.ns}}}Reference").text = ref

        # Declarant
        dec_data = data["declarant"]
        declarant = etree.SubElement(root, f"{{{self.ns}}}Declarant")
        etree.SubElement(declarant, f"{{{self.ns}}}MatriculeFiscal").text = dec_data["tax_id"].strip()
        etree.SubElement(declarant, f"{{{self.ns}}}RaisonSociale").text = dec_data["name"].strip()
        self._build_address(declarant, dec_data.get("address", {}))
        if dec_data.get("activity"):
            etree.SubElement(declarant, f"{{{self.ns}}}Activite").text = dec_data["activity"]

        # Beneficiaires
        beneficiaires = etree.SubElement(root, f"{{{self.ns}}}Beneficiaires")
        total_brut = Decimal("0")
        total_retenue = Decimal("0")
        total_net = Decimal("0")
        total_operations = 0

        for ben_data in data["beneficiaries"]:
            ben_el = etree.SubElement(beneficiaires, f"{{{self.ns}}}Beneficiaire")
            etree.SubElement(ben_el, f"{{{self.ns}}}Identifiant").text = ben_data["id"].strip()
            etree.SubElement(ben_el, f"{{{self.ns}}}NomOuRaisonSociale").text = ben_data["name"].strip()
            etree.SubElement(ben_el, f"{{{self.ns}}}TypeBeneficiaire").text = ben_data["type"].strip()

            if ben_data.get("address"):
                self._build_address(ben_el, ben_data["address"])

            operations_el = etree.SubElement(ben_el, f"{{{self.ns}}}Operations")

            for op_data in ben_data["operations"]:
                op_el = etree.SubElement(operations_el, f"{{{self.ns}}}Operation")
                wh_type = op_data["withholding_type"]
                currency = op_data.get("currency", "TND")
                gross = Decimal(str(op_data["gross_amount"]))

                # Get rate info
                rate_info = WITHHOLDING_RATES.get(wh_type, {})
                code = rate_info.get("code", wh_type.upper())

                # Calculate or use provided rate
                if op_data.get("rate") is not None:
                    rate = Decimal(str(op_data["rate"]))
                    wh_amount = (gross * rate).quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)
                elif op_data.get("rate_category"):
                    calc = self.calculate_withholding(wh_type, float(gross), op_data["rate_category"])
                    rate = calc["rate"]
                    wh_amount = calc["withholding_amount"]
                else:
                    rate = Decimal("0")
                    wh_amount = Decimal("0")

                net = gross - wh_amount

                etree.SubElement(op_el, f"{{{self.ns}}}TypeRetenue").text = rate_info.get("description", wh_type)
                etree.SubElement(op_el, f"{{{self.ns}}}CodeRetenue").text = code
                etree.SubElement(op_el, f"{{{self.ns}}}DateOperation").text = op_data["date"]

                brut_el = etree.SubElement(op_el, f"{{{self.ns}}}MontantBrut")
                brut_el.text = str(gross.quantize(Decimal("0.001")))
                brut_el.set("devise", currency)

                etree.SubElement(op_el, f"{{{self.ns}}}TauxRetenue").text = str(rate)

                ret_el = etree.SubElement(op_el, f"{{{self.ns}}}MontantRetenue")
                ret_el.text = str(wh_amount.quantize(Decimal("0.001")))
                ret_el.set("devise", currency)

                net_el = etree.SubElement(op_el, f"{{{self.ns}}}MontantNet")
                net_el.text = str(net.quantize(Decimal("0.001")))
                net_el.set("devise", currency)

                if op_data.get("invoice_ref"):
                    etree.SubElement(op_el, f"{{{self.ns}}}ReferenceFacture").text = op_data["invoice_ref"]
                if op_data.get("description"):
                    etree.SubElement(op_el, f"{{{self.ns}}}Description").text = op_data["description"]

                total_brut += gross
                total_retenue += wh_amount
                total_net += net
                total_operations += 1

        # Totaux
        totaux = etree.SubElement(root, f"{{{self.ns}}}Totaux")
        total_brut_el = etree.SubElement(totaux, f"{{{self.ns}}}TotalMontantBrut")
        total_brut_el.text = str(total_brut.quantize(Decimal("0.001")))
        total_brut_el.set("devise", "TND")

        total_ret_el = etree.SubElement(totaux, f"{{{self.ns}}}TotalRetenue")
        total_ret_el.text = str(total_retenue.quantize(Decimal("0.001")))
        total_ret_el.set("devise", "TND")

        total_net_el = etree.SubElement(totaux, f"{{{self.ns}}}TotalMontantNet")
        total_net_el.text = str(total_net.quantize(Decimal("0.001")))
        total_net_el.set("devise", "TND")

        etree.SubElement(totaux, f"{{{self.ns}}}NombreOperations").text = str(total_operations)
        etree.SubElement(totaux, f"{{{self.ns}}}NombreBeneficiaires").text = str(len(data["beneficiaries"]))

        # Metadata
        metadata = etree.SubElement(root, f"{{{self.ns}}}Metadata")
        etree.SubElement(metadata, f"{{{self.ns}}}GeneratedAt").text = datetime.utcnow().isoformat() + "Z"
        etree.SubElement(metadata, f"{{{self.ns}}}GeneratedBy").text = self.generated_by
        etree.SubElement(metadata, f"{{{self.ns}}}SchemaVersion").text = self.schema_version

        return root

    def _build_address(self, parent: etree._Element, addr: dict):
        """Build an address sub-element."""
        addr_el = etree.SubElement(parent, f"{{{self.ns}}}Adresse")
        etree.SubElement(addr_el, f"{{{self.ns}}}Rue").text = addr.get("street", "")
        etree.SubElement(addr_el, f"{{{self.ns}}}CodePostal").text = addr.get("postal_code", "")
        etree.SubElement(addr_el, f"{{{self.ns}}}Ville").text = addr.get("city", "")
        if addr.get("governorate"):
            etree.SubElement(addr_el, f"{{{self.ns}}}Gouvernorat").text = addr["governorate"]

    def _generate_qr_data(self, data: dict, checksum: str) -> str:
        """Generate QR code payload for certificate verification."""
        declarant = data.get("declarant", {})
        period = data.get("period", {})

        qr_payload = {
            "ref": data.get("reference", ""),
            "tax_id": declarant.get("tax_id", ""),
            "period": f"{period.get('year', '')}-{period.get('month', period.get('quarter', ''))}",
            "type": data.get("declaration_type", ""),
            "checksum": checksum[:16],
            "ts": datetime.utcnow().strftime("%Y%m%d%H%M%S"),
        }
        return json.dumps(qr_payload, separators=(",", ":"))

    def _generate_qr_image(self, data: dict, xml_string: str) -> Optional[str]:
        """Generate a QR code image file and return the temp path."""
        try:
            import qrcode
        except ImportError:
            logger.debug("qrcode package not available — skipping QR generation")
            return None

        try:
            checksum = hashlib.sha256(xml_string.encode("utf-8")).hexdigest()
            qr_data = self._generate_qr_data(data, checksum)

            qr = qrcode.QRCode(version=1, box_size=10, border=4)
            qr.add_data(qr_data)
            qr.make(fit=True)

            img = qr.make_image(fill_color="black", back_color="white")
            tmp_path = os.path.join("tmp_pdf_ocr", f"qr_{uuid.uuid4().hex[:8]}.png")
            img.save(tmp_path)
            return tmp_path
        except Exception as e:
            logger.debug(f"QR code generation failed: {e}")
            return None

    def _get_rate_for_operation(self, op: dict) -> float:
        """Get the rate for an operation, calculating if needed."""
        if op.get("rate") is not None:
            return float(op["rate"])
        wh_type = op.get("withholding_type", "")
        rate_cat = op.get("rate_category", "")
        if wh_type in WITHHOLDING_RATES and rate_cat:
            rates = WITHHOLDING_RATES[wh_type]["rates"]
            if rate_cat in rates:
                return float(rates[rate_cat])
        return 0.0

    def _format_address(self, addr: dict) -> str:
        """Format address dict into a single line string."""
        parts = [
            addr.get("street", ""),
            addr.get("postal_code", ""),
            addr.get("city", ""),
            addr.get("governorate", ""),
        ]
        return ", ".join(p for p in parts if p)


# ── Module-level convenience functions ────────────────────────────────────────


def generate_tej_xml(data: dict, schema_version: str = TEJ_SCHEMA_VERSION) -> dict:
    """Convenience function to generate TEJ XML from invoice data."""
    generator = TEJXMLGenerator(schema_version=schema_version)
    return generator.generate_withholding_cert(data)


def validate_tej_xml(xml_string: str) -> dict:
    """Convenience function to validate TEJ XML against schema."""
    generator = TEJXMLGenerator()
    return generator.validate_against_schema(xml_string)


def batch_generate_tej(csv_content: str, declarant_data: dict) -> dict:
    """Convenience function for batch TEJ generation from CSV."""
    generator = TEJXMLGenerator()
    return generator.batch_generate_from_csv(csv_content, declarant_data)

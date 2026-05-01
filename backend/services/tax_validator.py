"""
Tunisia 2026 e-invoicing compliance validator.

Validates extracted invoice data against the regulatory requirements:
- Mandatory fields (seller, buyer, items, totals, dates)
- VAT ID format validation (Tunisian matricule fiscale)
- Arithmetic validation (line totals, net, gross reconciliation)
- Tax rate validation (standard 19%, reduced 7%/13%, exempt 0%)
- Service transaction compliance checks

Returns a structured validation report with errors, warnings,
compliance score, and suggestions.
"""

import re
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

# ── Tunisian VAT ID (Matricule Fiscale) format ───────────────────────────────
# Format: 7 digits + 1 letter + "/" + 1 letter + "/" + 1 letter + "/" + 3 digits
# Example: "1234567A/P/M/000" or sometimes written as "1234567APM000"
# Some also use: 12 digits + 1 letter (e.g., "123456789012A")
_TUNISIAN_VAT_PATTERNS = [
    r"^\d{7}[A-Za-z]/[A-Za-z]/[A-Za-z]/\d{3}$",     # 1234567A/P/M/000
    r"^\d{7}[A-Za-z][A-Za-z][A-Za-z]\d{3}$",          # 1234567APM000
    r"^\d{7}[A-Za-z]$",                                 # Short form: 1234567A
    r"^\d{12}[A-Za-z]$",                                # 12 digits + letter
    r"^\d{7,13}$",                                       # Numeric-only fallback
]

# Valid Tunisian VAT rates
_VALID_TAX_RATES = {0, 7, 13, 19}
_TOLERANCE = 0.01  # 1% tolerance for arithmetic checks


def _validate_vat_id(vat_id: str | None, field_name: str) -> list[dict]:
    """Validate a Tunisian VAT ID format."""
    errors = []
    if not vat_id:
        errors.append({
            "field": field_name,
            "message": f"Missing {field_name}",
            "severity": "critical",
            "code": "MISSING_VAT_ID",
        })
        return errors

    cleaned = vat_id.strip().upper()
    matched = any(re.match(p, cleaned, re.IGNORECASE) for p in _TUNISIAN_VAT_PATTERNS)

    if not matched:
        errors.append({
            "field": field_name,
            "message": f"Invalid Tunisian VAT ID format: '{vat_id}'. Expected format: 1234567A/P/M/000",
            "severity": "error",
            "code": "INVALID_VAT_FORMAT",
        })

    return errors


def _validate_date(date_str: str | None, field_name: str) -> list[dict]:
    """Validate a date field."""
    errors = []
    if not date_str:
        errors.append({
            "field": field_name,
            "message": f"Missing {field_name}",
            "severity": "critical" if field_name == "date" else "warning",
            "code": "MISSING_DATE",
        })
        return errors

    try:
        parsed = datetime.strptime(date_str[:10], "%Y-%m-%d")
        # Check for future dates (more than 1 day ahead)
        if parsed.date() > datetime.utcnow().date():
            errors.append({
                "field": field_name,
                "message": f"Invoice date is in the future: {date_str}",
                "severity": "warning",
                "code": "FUTURE_DATE",
            })
    except ValueError:
        errors.append({
            "field": field_name,
            "message": f"Invalid date format: '{date_str}'. Expected YYYY-MM-DD",
            "severity": "error",
            "code": "INVALID_DATE_FORMAT",
        })

    return errors


def _validate_mandatory_fields(data: dict) -> list[dict]:
    """Check all mandatory fields are present."""
    errors = []

    if not data.get("vendor_name"):
        errors.append({
            "field": "vendor_name",
            "message": "Missing seller/vendor name",
            "severity": "critical",
            "code": "MISSING_VENDOR",
        })

    if not data.get("invoice_no"):
        errors.append({
            "field": "invoice_no",
            "message": "Missing invoice number",
            "severity": "critical",
            "code": "MISSING_INVOICE_NO",
        })

    bill_to = data.get("bill_to") or {}
    if not bill_to.get("name"):
        errors.append({
            "field": "bill_to.name",
            "message": "Missing buyer/client name",
            "severity": "critical",
            "code": "MISSING_BUYER",
        })

    if not data.get("line_items"):
        errors.append({
            "field": "line_items",
            "message": "No line items found",
            "severity": "critical",
            "code": "MISSING_LINE_ITEMS",
        })

    totals = data.get("totals") or {}
    if not totals.get("grand_total") and totals.get("grand_total") != 0:
        errors.append({
            "field": "totals.grand_total",
            "message": "Missing grand total",
            "severity": "critical",
            "code": "MISSING_GRAND_TOTAL",
        })

    return errors


def _validate_line_items(data: dict) -> list[dict]:
    """Validate each line item has required fields and valid data."""
    errors = []
    line_items = data.get("line_items") or []

    for i, item in enumerate(line_items):
        prefix = f"line_items[{i}]"
        desc = item.get("description")

        if not desc:
            errors.append({
                "field": prefix,
                "message": f"Line item {i + 1}: missing description",
                "severity": "error",
                "code": "MISSING_ITEM_DESCRIPTION",
            })

        qty = item.get("quantity")
        unit_price = item.get("unit_price")
        total = item.get("total")

        if total is None and (qty is None or unit_price is None):
            errors.append({
                "field": prefix,
                "message": f"Line item {i + 1}: cannot determine line total (missing quantity, unit_price, or total)",
                "severity": "error",
                "code": "MISSING_ITEM_TOTAL",
            })

    return errors


def _validate_arithmetic(data: dict) -> list[dict]:
    """Validate arithmetic consistency: line totals, subtotal, tax, grand total."""
    errors = []
    line_items = data.get("line_items") or []
    totals = data.get("totals") or {}

    # Check individual line item math: total ≈ quantity × unit_price
    for i, item in enumerate(line_items):
        qty = item.get("quantity")
        unit_price = item.get("unit_price")
        total = item.get("total")

        if qty and unit_price and total:
            expected = round(qty * unit_price, 2)
            if abs(expected - total) > max(abs(total) * _TOLERANCE, 0.02):
                errors.append({
                    "field": f"line_items[{i}].total",
                    "message": f"Line item {i + 1}: total ({total}) ≠ quantity ({qty}) × unit_price ({unit_price}) = {expected}",
                    "severity": "warning",
                    "code": "ARITHMETIC_MISMATCH_LINE",
                })

    # Check subtotal = sum of line totals
    subtotal = totals.get("subtotal")
    line_sum = sum(item.get("total") or 0 for item in line_items)

    if subtotal and line_items and line_sum > 0:
        if abs(subtotal - line_sum) > max(abs(subtotal) * _TOLERANCE, 0.02):
            errors.append({
                "field": "totals.subtotal",
                "message": f"Subtotal ({subtotal}) ≠ sum of line totals ({round(line_sum, 2)})",
                "severity": "warning",
                "code": "ARITHMETIC_MISMATCH_SUBTOTAL",
            })

    # Check grand_total = subtotal + tax - discount
    grand_total = totals.get("grand_total")
    tax = totals.get("tax") or 0
    discount = totals.get("discount") or 0

    if grand_total and subtotal:
        expected_grand = round(subtotal + tax - discount, 2)
        if abs(grand_total - expected_grand) > max(abs(grand_total) * _TOLERANCE, 0.02):
            errors.append({
                "field": "totals.grand_total",
                "message": f"Grand total ({grand_total}) ≠ subtotal ({subtotal}) + tax ({tax}) - discount ({discount}) = {expected_grand}",
                "severity": "warning",
                "code": "ARITHMETIC_MISMATCH_GRAND",
            })

    return errors


def _validate_tax_rates(data: dict) -> list[dict]:
    """Validate tax rates are valid Tunisian rates."""
    errors = []
    line_items = data.get("line_items") or []

    items_without_tax = 0
    for i, item in enumerate(line_items):
        tax_rate = item.get("tax_rate")
        tax_exempt = item.get("tax_exempt", False)

        if tax_rate is None and not tax_exempt:
            items_without_tax += 1
            continue

        if tax_rate is not None and tax_rate not in _VALID_TAX_RATES:
            errors.append({
                "field": f"line_items[{i}].tax_rate",
                "message": f"Line item {i + 1}: tax rate {tax_rate}% is not a standard Tunisian rate (0%, 7%, 13%, 19%)",
                "severity": "warning",
                "code": "NON_STANDARD_TAX_RATE",
            })

    if items_without_tax > 0 and items_without_tax == len(line_items):
        errors.append({
            "field": "line_items.tax_rate",
            "message": "No line items have tax rate information. Each item should specify a tax rate or be marked as exempt.",
            "severity": "warning",
            "code": "MISSING_TAX_RATES",
        })

    return errors


def _validate_service_compliance(data: dict) -> list[dict]:
    """Additional checks for service invoices under Tunisia 2026 mandate."""
    errors = []
    category = data.get("invoice_category")

    if category in ("services", "mixed"):
        line_items = data.get("line_items") or []
        service_items = [item for item in line_items
                         if "consult" in (item.get("description") or "").lower()
                         or "service" in (item.get("description") or "").lower()
                         or "maintenance" in (item.get("description") or "").lower()
                         or "formation" in (item.get("description") or "").lower()
                         or "prestation" in (item.get("description") or "").lower()]

        if not service_items and category == "services":
            errors.append({
                "field": "invoice_category",
                "message": "Invoice classified as service but no service descriptions found in line items",
                "severity": "warning",
                "code": "SERVICE_DESCRIPTION_MISSING",
            })

    return errors


def validate_invoice(data: dict) -> dict:
    """
    Run all Tunisia 2026 compliance validation checks on invoice data.

    Args:
        data: Extracted invoice data dict.

    Returns:
        dict with:
            - is_compliant: bool
            - compliance_score: int (0-100)
            - errors: list of critical/error issues
            - warnings: list of non-critical issues
            - suggestions: list of improvement hints
            - checks_passed: int
            - checks_total: int
    """
    all_issues = []

    # 1. Mandatory fields
    all_issues.extend(_validate_mandatory_fields(data))

    # 2. Date validation
    all_issues.extend(_validate_date(data.get("date"), "date"))
    all_issues.extend(_validate_date(data.get("due_date"), "due_date"))

    # 3. VAT ID validation
    all_issues.extend(_validate_vat_id(data.get("seller_vat_id"), "seller_vat_id"))
    all_issues.extend(_validate_vat_id(data.get("buyer_vat_id"), "buyer_vat_id"))

    # 4. Line item validation
    all_issues.extend(_validate_line_items(data))

    # 5. Arithmetic validation
    all_issues.extend(_validate_arithmetic(data))

    # 6. Tax rate validation
    all_issues.extend(_validate_tax_rates(data))

    # 7. Service compliance
    all_issues.extend(_validate_service_compliance(data))

    # ── Separate by severity ────────────────────────────────────────────
    errors = [i for i in all_issues if i["severity"] in ("critical", "error")]
    warnings = [i for i in all_issues if i["severity"] == "warning"]

    # ── Generate suggestions ────────────────────────────────────────────
    suggestions = []
    has_vat = bool(data.get("seller_vat_id")) and bool(data.get("buyer_vat_id"))
    if not has_vat:
        suggestions.append("Add seller and buyer VAT IDs (matricule fiscale) for full Tunisia 2026 compliance")

    if not data.get("line_items"):
        suggestions.append("Add detailed line items with descriptions for compliance")

    has_tax_rates = any(item.get("tax_rate") is not None for item in (data.get("line_items") or []))
    if not has_tax_rates:
        suggestions.append("Specify tax rates per line item (19%, 13%, 7%, or 0% for exempt)")

    source = data.get("source_format")
    if source and source != "xml":
        suggestions.append("Submit invoices in XML format for full TTN compliance and automatic validation")

    # ── Compute compliance score ────────────────────────────────────────
    # Weight: critical=10, error=5, warning=2
    total_checks = 12  # base number of checks performed
    penalty = sum(10 for i in all_issues if i["severity"] == "critical")
    penalty += sum(5 for i in all_issues if i["severity"] == "error")
    penalty += sum(2 for i in all_issues if i["severity"] == "warning")

    max_score = total_checks * 10
    score = max(0, round(((max_score - penalty) / max_score) * 100))

    checks_passed = total_checks - len(errors)

    is_compliant = len(errors) == 0 and score >= 60

    # Determine status
    if is_compliant and len(warnings) == 0:
        status = "fully_compliant"
    elif is_compliant:
        status = "compliant_with_warnings"
    else:
        status = "non_compliant"

    result = {
        "is_compliant": is_compliant,
        "compliance_score": score,
        "compliance_status": status,
        "errors": errors,
        "warnings": warnings,
        "suggestions": suggestions,
        "checks_passed": checks_passed,
        "checks_total": total_checks,
        "validated_at": datetime.utcnow().isoformat(),
    }

    logger.info(
        "Compliance validation: score=%d, errors=%d, warnings=%d, status=%s",
        score, len(errors), len(warnings), status,
    )

    return result

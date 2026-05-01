import os
import json
import re
import logging
from datetime import datetime
from dateutil import parser as dateutil_parser

import requests

from config import OLLAMA_URL, OLLAMA_MODEL, GROQ_API_KEY, GROQ_MODEL
from services.pdf_service import extract_text_from_pdf
from services.image_service import extract_text_from_image

logger = logging.getLogger(__name__)

# ── Groq client singleton ─────────────────────────────────────────────────────
_groq_client = None

def _get_groq_client():
    global _groq_client
    if _groq_client is None:
        if not GROQ_API_KEY:
            return None
        from groq import Groq
        _groq_client = Groq(api_key=GROQ_API_KEY)
    return _groq_client


# ── Shared helpers ────────────────────────────────────────────────────────────
def now_iso():
    return datetime.utcnow().isoformat()


def allowed_file(filename: str, allowed_extensions: set) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in allowed_extensions


def _clean_json_response(raw: str) -> dict:
    """Strip markdown fences and parse JSON. Raises on failure."""
    cleaned = re.sub(r"```(?:json)?", "", raw).strip().rstrip("`").strip()
    return json.loads(cleaned)


def _build_default_empty(text: str, warning: str) -> dict:
    return {
        "vendor_name": None,
        "invoice_no": None,
        "date": None,
        "due_date": None,
        "line_items": [],
        "totals": {
            "subtotal": None,
            "tax": None,
            "discount": None,
            "grand_total": None,
            "currency": None,
        },
        "bill_to": {"name": None, "address": None, "email": None},
        "payment_method": None,
        "notes": None,
        "raw_text_length": len(text) if text else 0,
        "field_confidence": {
            "vendor_name": 0,
            "invoice_no": 0,
            "date": 0,
            "due_date": 0,
            "line_items": 0,
            "grand_total": 0,
            "currency": 0,
            "bill_to": 0,
            "payment_method": 0,
            "notes": 0,
        },
        "validation": {
            "is_valid": False,
            "confidence": 0,
            "needs_human_review": True,
            "warnings": [warning],
        },
    }


_PROMPT_TEMPLATE = """You are an invoice data extraction engine.
Extract all invoice fields from the raw text and return ONLY a valid JSON object.
No markdown, no explanation, no text outside the JSON.

--- EXAMPLE ---
Input text:
  INVOICE #INV-001  Date: January 5, 2024
  From: Acme Ltd
  Bill To: John Smith, 12 Oak St, New York
  Item            Qty  Unit Price  Total
  Web Design       2     500.00   1000.00
  Hosting          1      99.00     99.00
  Subtotal: 1099.00  Tax: 109.90  Total: 1208.90 USD

Expected output:
{{
  "vendor_name": "Acme Ltd",
  "invoice_no": "INV-001",
  "date": "2024-01-05",
  "due_date": null,
  "line_items": [
    {{"description": "Web Design", "quantity": 2, "unit_price": 500.00, "total": 1000.00}},
    {{"description": "Hosting",    "quantity": 1, "unit_price": 99.00,  "total": 99.00}}
  ],
  "totals": {{"subtotal": 1099.00, "tax": 109.90, "discount": null, "grand_total": 1208.90, "currency": "USD"}},
  "bill_to": {{"name": "John Smith", "address": "12 Oak St, New York", "email": null}},
  "payment_method": null,
  "notes": null,
  "field_confidence": {{
    "vendor_name": 95,
    "invoice_no": 98,
    "date": 97,
    "due_date": 0,
    "line_items": 90,
    "grand_total": 96,
    "currency": 85,
    "bill_to": 88,
    "payment_method": 0,
    "notes": 0
  }},
  "validation": {{"confidence": 95, "warnings": []}}
}}
--- END EXAMPLE ---

Required JSON structure:
{{
    "vendor_name": "string or null",
    "invoice_no": "string or null",
    "date": "YYYY-MM-DD or null",
    "due_date": "YYYY-MM-DD or null",
    "seller_vat_id": "string or null — seller tax/VAT ID (matricule fiscale)",
    "buyer_vat_id": "string or null — buyer tax/VAT ID",
    "line_items": [
        {{"description": "string", "quantity": number or null, "unit_price": number or null, "total": number or null, "tax_rate": number or null}}
    ],
    "totals": {{
        "subtotal": number or null,
        "tax": number or null,
        "discount": number or null,
        "grand_total": number or null,
        "currency": "ISO 4217 3-letter code or null"
    }},
    "bill_to": {{"name": "string or null", "address": "string or null", "email": "string or null"}},
    "payment_method": "string or null",
    "notes": "string or null",
    "field_confidence": {{
        "vendor_name": "integer 0-100 — how confident you are this field is correct",
        "invoice_no": "integer 0-100",
        "date": "integer 0-100",
        "due_date": "integer 0-100",
        "line_items": "integer 0-100 — overall confidence in the line items extraction",
        "grand_total": "integer 0-100",
        "currency": "integer 0-100",
        "bill_to": "integer 0-100",
        "payment_method": "integer 0-100",
        "notes": "integer 0-100"
    }},
    "validation": {{"confidence": integer 0-100, "warnings": ["missing or ambiguous fields"]}}
}}

Rules:
- vendor_name is who SENT the invoice (the seller/supplier), NOT the buyer.
- bill_to.name is who RECEIVES the invoice (the buyer/client). NEVER use labels like "Bill To", "Ship To", "Sold To" as the name — extract the actual person or company name written after those labels.
- invoice_no: extract only the number/code, strip label words like "Invoice #", "Ref:", etc.
- Dates MUST be YYYY-MM-DD. Example: "March 7, 2013" → "2013-03-07". null only if truly unparseable.
- currency: detect from symbols ($→USD, €→EUR, £→GBP, د.ت→TND) or explicit text. For Tunisian invoices, default to TND.
- tax: if grand_total and subtotal are both present and tax field is empty, calculate tax = grand_total - subtotal.
- line_items: each physical row in the invoice table = exactly ONE item. Never split or duplicate a row.
  * Product codes/SKUs on the same row belong to that item's description.
  * Never create an item with all-null numeric fields.
  * quantity must be a real count, never 0. Calculate from total/unit_price if missing.
  * For service items (consulting, maintenance, training, etc.), quantity may represent hours/days/months.
- All numeric values are plain numbers, no currency symbols.
- Absent fields → null, never 0 or empty string.
- field_confidence: for each field, give a confidence score 0-100 based on how clearly and unambiguously the value was found in the text. Use 0 if the field is null/absent. Use lower scores (30-60) for values that were guessed or ambiguous.
- seller_vat_id / buyer_vat_id: Look for tax IDs (matricule fiscale, identifiant fiscal, VAT ID, TIN). Tunisian format: 7-digit number + letter + 3 chars (e.g. "1234567A/P/M/000"). Extract as-is.
- For service invoices: preserve duration info in descriptions (e.g. "10 hours", "3 jours").

Raw invoice text:
{text}
"""


def _normalize_date(value) -> str | None:
    """Convert any date string to YYYY-MM-DD. Returns None if unparseable."""
    if not value or not isinstance(value, str):
        return None
    # Already correct format
    if re.match(r"^\d{4}-\d{2}-\d{2}$", value.strip()):
        return value.strip()
    try:
        return dateutil_parser.parse(value, fuzzy=True).strftime("%Y-%m-%d")
    except Exception:
        return None


def _fix_line_item_quantities(items: list) -> list:
    """
    For each line item, fill in any missing value among quantity/unit_price/total
    using the other two. Also removes items with no meaningful data.
    """
    fixed = []
    for item in items:
        qty        = item.get("quantity")
        total      = item.get("total")
        unit_price = item.get("unit_price")

        try:
            # Calculate missing field from the other two
            if (not qty or qty == 0) and total and unit_price:
                qty = round(total / unit_price, 4)
                qty = int(qty) if qty == int(qty) else qty
                item["quantity"] = qty
            elif not unit_price and total and qty:
                item["unit_price"] = round(total / qty, 4)
            elif not total and qty and unit_price:
                item["total"] = round(qty * unit_price, 4)
        except Exception:
            pass

        # Skip ghost items (no description and no total)
        if not item.get("description") and not item.get("total"):
            continue

        fixed.append(item)
    return fixed


def _merge_duplicate_line_items(items: list) -> list:
    """
    Detect and merge items that are clearly the same product split across rows.
    A duplicate is identified when item B's total equals item A's total × item A's quantity,
    meaning the model mistook the subtotal row for a separate line item.
    """
    if len(items) < 2:
        return items

    merged = []
    skip = set()

    for i, item_a in enumerate(items):
        if i in skip:
            continue

        total_a = item_a.get("total")
        qty_a   = item_a.get("quantity")

        for j, item_b in enumerate(items):
            if j <= i or j in skip:
                continue

            total_b     = item_b.get("total")
            unit_b      = item_b.get("unit_price")
            desc_b      = item_b.get("description", "") or ""

            # Case: item_b total = item_a total × item_a qty → item_b is the real total row
            if total_a and total_b and qty_a:
                try:
                    if abs(total_b - total_a * qty_a) < 0.05:
                        # Merge: keep item_a description, use item_b total as the real total
                        item_a["total"]      = total_b
                        item_a["unit_price"] = total_a  # item_a total was actually unit price
                        skip.add(j)
                        break
                except Exception:
                    pass

            # Case: item_b has no quantity/unit_price and its description looks like a SKU/code
            if not unit_b and not item_b.get("quantity") and re.match(r"^[A-Z0-9\-,\s]{3,30}$", desc_b):
                # Likely a product code row — merge description into item_a
                item_a["description"] = f"{item_a.get('description', '')} ({desc_b.strip()})".strip()
                skip.add(j)
                break

        merged.append(item_a)

    return merged


# Labels the model sometimes copies verbatim into name fields
_LABEL_WORDS = {
    "bill to", "ship to", "sold to", "customer", "client",
    "invoice to", "billed to", "pay to", "remit to",
}

def _clean_label_word(value) -> str | None:
    """Return None if value is just a label word, otherwise return as-is."""
    if not value or not isinstance(value, str):
        return None
    if value.strip().lower() in _LABEL_WORDS:
        return None
    return value


def _post_process(data: dict) -> dict:
    """Fix common LLM output issues: label words, bad dates, zero quantities, missing tax."""
    # Remove label words from name fields
    if data.get("bill_to"):
        data["bill_to"]["name"] = _clean_label_word(data["bill_to"].get("name"))

    data["vendor_name"] = _clean_label_word(data.get("vendor_name"))

    # Normalize dates
    data["date"]     = _normalize_date(data.get("date"))
    data["due_date"] = _normalize_date(data.get("due_date"))

    # Auto-calculate missing tax: tax = grand_total - subtotal
    totals = data.get("totals") or {}
    grand  = totals.get("grand_total")
    sub    = totals.get("subtotal")
    if grand and sub and not totals.get("tax"):
        diff = round(grand - sub, 4)
        if diff > 0:
            data["totals"]["tax"] = diff

    # Fix and deduplicate line items
    if data.get("line_items"):
        items = _fix_line_item_quantities(data["line_items"])
        items = _merge_duplicate_line_items(items)
        data["line_items"] = items

    return data


_CRITICAL_FIELDS = ["vendor_name", "invoice_no", "date", "grand_total", "line_items"]
_LOW_CONFIDENCE_THRESHOLD = 60   # below this → needs human review


def _compute_field_confidence(data: dict) -> dict:
    """
    Ensure field_confidence exists and back-fill any missing entries.
    If the LLM didn't return field_confidence, generate it heuristically
    based on whether the field has a non-null value.
    """
    fc = data.get("field_confidence")
    if not isinstance(fc, dict):
        fc = {}

    # Heuristic back-fill: if LLM didn't provide a score, use 85 if value exists, 0 if null
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
        if field not in fc or not isinstance(fc.get(field), (int, float)):
            has_value = bool(value) if not isinstance(value, list) else len(value) > 0
            fc[field] = 85 if has_value else 0

        # Clamp to 0-100
        fc[field] = max(0, min(100, int(fc[field])))

    data["field_confidence"] = fc
    return data


def _apply_validation_flags(data: dict) -> dict:
    data = _post_process(data)
    data = _compute_field_confidence(data)

    fc = data["field_confidence"]

    # Count how many critical fields have a non-null value
    found_count = sum([
        1 if data.get("vendor_name") else 0,
        1 if data.get("invoice_no") else 0,
        1 if data.get("date") else 0,
        1 if (data.get("totals") or {}).get("grand_total") else 0,
    ])

    # Compute overall confidence as weighted average of field scores
    # Critical fields weighted 2x, others 1x
    weights = {}
    for f in fc:
        weights[f] = 2 if f in _CRITICAL_FIELDS else 1

    total_weight = sum(weights.values())
    if total_weight > 0:
        weighted_sum = sum(fc[f] * weights[f] for f in fc)
        overall_confidence = round(weighted_sum / total_weight)
    else:
        overall_confidence = 0

    # Check if any critical field has low confidence
    low_confidence_fields = [
        f for f in _CRITICAL_FIELDS
        if fc.get(f, 0) > 0 and fc.get(f, 0) < _LOW_CONFIDENCE_THRESHOLD
    ]

    data.setdefault("validation", {})
    data["validation"]["is_valid"] = found_count >= 2
    data["validation"]["confidence"] = overall_confidence
    data["validation"]["needs_human_review"] = (
        found_count < 3
        or overall_confidence < _LOW_CONFIDENCE_THRESHOLD
        or len(low_confidence_fields) > 0
    )

    # Add warnings for low-confidence critical fields
    warnings = data["validation"].get("warnings", [])
    for f in low_confidence_fields:
        warnings.append(f"Low confidence on '{f}': {fc[f]}%")
    data["validation"]["warnings"] = warnings

    return data


# ── Ollama (primary — local, free, unlimited) ─────────────────────────────────
def _ollama_request(prompt: str, force_json: bool) -> str:
    body = {
        "model": OLLAMA_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "stream": False,
        "options": {"temperature": 0.0, "num_predict": 2048},
    }
    if force_json:
        body["format"] = "json"

    response = requests.post(f"{OLLAMA_URL}/api/chat", json=body, timeout=120)
    response.raise_for_status()
    return response.json()["message"]["content"]


def _extract_with_ollama(text: str) -> dict:
    prompt = _PROMPT_TEMPLATE.format(text=text[:12000])
    try:
        raw = _ollama_request(prompt, force_json=True)
        data = _clean_json_response(raw)
    except (json.JSONDecodeError, KeyError):
        logger.warning("Ollama JSON mode failed, retrying without format constraint…")
        raw = _ollama_request(prompt, force_json=False)
        data = _clean_json_response(raw)

    data["raw_text_length"] = len(text)
    data["_model_used"] = OLLAMA_MODEL
    return _apply_validation_flags(data)


# ── Groq (fallback — free API, 14,400 req/day) ───────────────────────────────
def _extract_with_groq(text: str) -> dict:
    client = _get_groq_client()
    if client is None:
        raise RuntimeError("GROQ_API_KEY not configured")

    prompt = _PROMPT_TEMPLATE.format(text=text[:12000])
    response = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.0,
        max_tokens=2048,
        response_format={"type": "json_object"},
    )

    raw = response.choices[0].message.content
    data = _clean_json_response(raw)
    data["raw_text_length"] = len(text)
    data["_model_used"] = GROQ_MODEL
    return _apply_validation_flags(data)


# ── Public entry point ────────────────────────────────────────────────────────
def extract_invoice_fields(text: str) -> dict:
    if not text or len(text.strip()) < 10:
        return _build_default_empty(text, "No readable text extracted")

    errors = []

    # 1. Try Ollama
    try:
        logger.info("Extracting with Ollama (%s)…", OLLAMA_MODEL)
        data = _extract_with_ollama(text)
        logger.info("Ollama succeeded (confidence=%s)", data.get("validation", {}).get("confidence"))
        return data
    except Exception as e:
        msg = f"Ollama ({OLLAMA_MODEL}): {type(e).__name__}: {e}"
        errors.append(msg)
        logger.warning("%s — falling back to Groq…", msg)

    # 2. Try Groq
    try:
        logger.info("Extracting with Groq (%s)…", GROQ_MODEL)
        data = _extract_with_groq(text)
        logger.info("Groq succeeded (confidence=%s)", data.get("validation", {}).get("confidence"))
        return data
    except Exception as e:
        msg = f"Groq ({GROQ_MODEL}): {type(e).__name__}: {e}"
        errors.append(msg)
        logger.error("All LLMs failed: %s", errors)

    result = _build_default_empty(text, "All LLMs failed")
    result["validation"]["warnings"] = errors
    return result


def extract_from_file(file_path: str) -> dict:
    ext = os.path.splitext(file_path)[1].lower()

    # XML files → structured parser (no AI needed)
    if ext == ".xml":
        from services.xml_parser import parse_xml_invoice
        with open(file_path, "rb") as f:
            xml_content = f.read()
        data = parse_xml_invoice(xml_content)
        data["source_file"] = os.path.basename(file_path)
        # Auto-detect service invoice from parsed data
        from services.service_detector import classify_invoice
        classification = classify_invoice(data)
        data["invoice_category"] = classification["invoice_category"]
        data["category_confidence"] = classification["confidence"]
        if classification.get("service_fields"):
            data["service_fields"] = classification["service_fields"]
        # Auto-validate Tunisia compliance
        from services.tax_validator import validate_invoice
        data["compliance"] = validate_invoice(data)
        return data

    if ext == ".pdf":
        text = extract_text_from_pdf(file_path)
    elif ext in {".png", ".jpg", ".jpeg", ".webp"}:
        text = extract_text_from_image(file_path)
    elif ext == ".txt":
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            text = f.read()
    else:
        text = ""

    data = extract_invoice_fields(text)
    data["source_file"] = os.path.basename(file_path)
    data["source_format"] = ext.lstrip(".")
    data["processed_at"] = now_iso()

    # Auto-detect service invoice
    from services.service_detector import classify_invoice
    classification = classify_invoice(data)
    data["invoice_category"] = classification["invoice_category"]
    data["category_confidence"] = classification["confidence"]
    if classification.get("service_fields"):
        data["service_fields"] = classification["service_fields"]

    # Auto-validate Tunisia compliance
    from services.tax_validator import validate_invoice
    data["compliance"] = validate_invoice(data)

    return data

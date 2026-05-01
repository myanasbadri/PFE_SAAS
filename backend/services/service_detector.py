"""
Service vs. Goods invoice classification for Tunisia 2026 e-invoicing.

Detects whether an invoice is for goods, services, or mixed based on
line item descriptions and extracted fields. Service transactions are
mandatory for e-invoicing under the 2026 mandate.
"""

import re
import logging

logger = logging.getLogger(__name__)

# ── Keywords for classification ──────────────────────────────────────────────

# Service-indicating keywords (EN / FR / AR transliterations)
_SERVICE_KEYWORDS = {
    # English
    "consultation", "consulting", "service", "services", "maintenance",
    "support", "training", "design", "development", "implementation",
    "installation", "configuration", "migration", "audit", "advisory",
    "coaching", "mentoring", "workshop", "session", "assessment",
    "analysis", "review", "inspection", "testing", "certification",
    "hosting", "subscription", "license", "licence", "saas", "paas",
    "management", "administration", "monitoring", "reporting",
    "integration", "customization", "deployment", "optimization",
    "transport", "transportation", "delivery", "shipping", "freight",
    "logistics", "warehousing", "insurance", "legal", "accounting",
    "bookkeeping", "payroll", "recruitment", "staffing", "cleaning",
    "security", "catering", "event", "marketing", "advertising",
    "photography", "videography", "translation", "interpreting",
    "research", "survey", "feasibility", "project management",
    # French
    "consultation", "conseil", "prestation", "prestations", "entretien",
    "formation", "conception", "développement", "developpement",
    "mise en place", "mise en service", "accompagnement", "expertise",
    "étude", "etude", "diagnostic", "assistance", "intervention",
    "maintenance", "hébergement", "hebergement", "abonnement",
    "location", "transport", "livraison", "assurance", "juridique",
    "comptabilité", "comptabilite", "recrutement", "nettoyage",
    "sécurité", "securite", "restauration", "événementiel",
    "publicité", "publicite", "traduction", "recherche",
    "honoraires", "forfait", "mission",
}

# Goods-indicating keywords
_GOODS_KEYWORDS = {
    # English
    "product", "products", "item", "items", "goods", "merchandise",
    "equipment", "hardware", "device", "component", "part", "parts",
    "material", "materials", "supply", "supplies", "accessory",
    "furniture", "appliance", "tool", "tools", "machine", "unit",
    "piece", "pack", "box", "carton", "pallet", "stock",
    # French
    "produit", "produits", "article", "articles", "marchandise",
    "marchandises", "équipement", "equipement", "matériel", "materiel",
    "fourniture", "fournitures", "accessoire", "mobilier",
    "appareil", "outil", "outils", "pièce", "piece", "lot",
}

# Duration/time indicators (strong service signal)
_DURATION_PATTERNS = [
    r"\b(\d+(?:\.\d+)?)\s*(hours?|hrs?|h)\b",
    r"\b(\d+(?:\.\d+)?)\s*(days?|d|jours?|j)\b",
    r"\b(\d+(?:\.\d+)?)\s*(months?|mo|mois)\b",
    r"\b(\d+(?:\.\d+)?)\s*(weeks?|wk|semaines?)\b",
    r"\b(\d+(?:\.\d+)?)\s*(years?|yr|ans?|année)\b",
    r"\bhourly\s+rate\b", r"\btaux\s+horaire\b",
    r"\bdaily\s+rate\b", r"\btaux\s+journalier\b",
    r"\bper\s+(hour|day|month|week|year)\b",
    r"\bpar\s+(heure|jour|mois|semaine|an)\b",
]


def _extract_duration(text: str) -> dict | None:
    """Extract duration value and unit from text."""
    text_lower = text.lower()
    for pattern in _DURATION_PATTERNS[:5]:  # Only value+unit patterns
        match = re.search(pattern, text_lower)
        if match:
            value = float(match.group(1))
            raw_unit = match.group(2).lower()
            # Normalize unit
            unit_map = {
                "h": "hour", "hr": "hour", "hrs": "hour", "hour": "hour", "hours": "hour",
                "d": "day", "day": "day", "days": "day", "jour": "day", "jours": "day", "j": "day",
                "wk": "week", "week": "week", "weeks": "week", "semaine": "week", "semaines": "week",
                "mo": "month", "month": "month", "months": "month", "mois": "month",
                "yr": "year", "year": "year", "years": "year", "an": "year", "ans": "year", "année": "year",
            }
            unit = unit_map.get(raw_unit, raw_unit)
            return {"value": value, "unit": unit}
    return None


def _extract_rate(text: str, total: float | None, duration: dict | None) -> float | None:
    """Extract hourly/daily rate from text or calculate from total and duration."""
    text_lower = text.lower()
    # Look for explicit rate mentions
    rate_patterns = [
        r"(?:rate|taux)\s*[:=]?\s*(\d+(?:[.,]\d+)?)",
        r"(\d+(?:[.,]\d+)?)\s*/\s*(?:h|hr|hour|heure|day|jour)",
    ]
    for pattern in rate_patterns:
        match = re.search(pattern, text_lower)
        if match:
            return float(match.group(1).replace(",", "."))

    # Calculate from total and duration
    if total and duration and duration.get("value") and duration["value"] > 0:
        return round(total / duration["value"], 2)

    return None


def classify_invoice(invoice_data: dict) -> dict:
    """
    Classify an invoice as goods, services, or mixed.

    Args:
        invoice_data: Extracted invoice data dict (from LLaMA or XML parser).

    Returns:
        dict with:
            - invoice_category: "goods" | "services" | "mixed"
            - confidence: "high" | "medium" | "low"
            - service_fields: list of dicts with service-specific data per line item
            - reasoning: str explaining the classification
    """
    line_items = invoice_data.get("line_items") or []
    if not line_items:
        return {
            "invoice_category": "goods",
            "confidence": "low",
            "service_fields": [],
            "reasoning": "No line items to classify",
        }

    service_count = 0
    goods_count = 0
    service_fields = []

    for item in line_items:
        desc = (item.get("description") or "").lower()
        total = item.get("total")
        is_service = False
        is_goods = False

        # Check for service keywords
        for kw in _SERVICE_KEYWORDS:
            if kw in desc:
                is_service = True
                break

        # Check for goods keywords
        if not is_service:
            for kw in _GOODS_KEYWORDS:
                if kw in desc:
                    is_goods = True
                    break

        # Check for duration patterns (strong service indicator)
        duration = _extract_duration(desc)
        if duration:
            is_service = True

        # Heuristic: no quantity or quantity=1 with high total → likely service
        qty = item.get("quantity")
        unit_price = item.get("unit_price")
        if not is_service and not is_goods:
            if qty is None or (qty == 1 and unit_price and unit_price > 500):
                is_service = True
            else:
                is_goods = True

        if is_service:
            service_count += 1
            sf = {
                "description": item.get("description"),
                "type": "service",
            }
            if duration:
                sf["duration_value"] = duration["value"]
                sf["duration_unit"] = duration["unit"]
            rate = _extract_rate(desc, total, duration)
            if rate:
                sf["rate"] = rate
            service_fields.append(sf)
        else:
            goods_count += 1
            service_fields.append({
                "description": item.get("description"),
                "type": "goods",
            })

    # Determine overall category
    total_items = service_count + goods_count
    if total_items == 0:
        category = "goods"
        confidence = "low"
    elif service_count == total_items:
        category = "services"
        confidence = "high" if service_count >= 2 else "medium"
    elif goods_count == total_items:
        category = "goods"
        confidence = "high" if goods_count >= 2 else "medium"
    else:
        category = "mixed"
        dominant = "services" if service_count > goods_count else "goods"
        confidence = "medium"

    reasoning_parts = []
    if service_count > 0:
        reasoning_parts.append(f"{service_count} service item(s)")
    if goods_count > 0:
        reasoning_parts.append(f"{goods_count} goods item(s)")

    return {
        "invoice_category": category,
        "confidence": confidence,
        "service_fields": service_fields,
        "reasoning": f"Detected {', '.join(reasoning_parts)} → classified as {category}",
    }

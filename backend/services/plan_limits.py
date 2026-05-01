"""
Plan tier definitions for SmartInvoice SaaS.
Each plan specifies usage limits and available features.
"""

PLAN_LIMITS = {
    "free": {
        "max_invoices_per_month": 50,
        "max_members": 3,
        "max_ai_queries_per_month": 20,
        "max_storage_mb": 100,
        "features": [
            "basic_extraction",
            "basic_dashboard",
            "manual_invoice",
            "export_pdf",
        ],
    },
    "pro": {
        "max_invoices_per_month": 500,
        "max_members": 15,
        "max_ai_queries_per_month": 200,
        "max_storage_mb": 5000,
        "features": [
            "basic_extraction",
            "batch_extraction",
            "basic_dashboard",
            "ai_advisor",
            "export_pdf",
            "export_excel",
            "custom_branding",
            "email_notifications",
            "audit_trail",
        ],
    },
    "enterprise": {
        "max_invoices_per_month": -1,   # unlimited
        "max_members": -1,
        "max_ai_queries_per_month": -1,
        "max_storage_mb": -1,
        "features": ["*"],              # all features
    },
}

PLAN_PRICES = {
    "free":       {"monthly": 0,     "yearly": 0},
    "pro":        {"monthly": 29,    "yearly": 290},
    "enterprise": {"monthly": 99,    "yearly": 990},
}


def get_plan_limit(plan: str, resource: str) -> int:
    """Return the limit for a resource on a given plan. -1 means unlimited."""
    limits = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])
    return limits.get(resource, 0)


def has_feature(plan: str, feature: str) -> bool:
    """Check if a plan includes a specific feature."""
    features = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])["features"]
    return "*" in features or feature in features

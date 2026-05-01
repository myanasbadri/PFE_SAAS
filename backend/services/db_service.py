from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.errors import CollectionInvalid
from config import MONGO_URI, DB_NAME

client = MongoClient(MONGO_URI)
db = client[DB_NAME]

# ── Schema Validators ────────────────────────────────────────────────────────

USERS_VALIDATOR = {
    "$jsonSchema": {
        "bsonType": "object",
        "required": ["name", "email", "password", "role", "created_at"],
        "properties": {
            "name": {
                "bsonType": "string",
                "minLength": 1,
                "description": "Full name of the user",
            },
            "email": {
                "bsonType": "string",
                "pattern": r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$",
                "description": "Valid email address",
            },
            "password": {
                "bsonType": "string",
                "minLength": 10,
                "description": "Bcrypt-hashed password",
            },
            "role": {
                "bsonType": "string",
                "enum": ["admin", "client"],
                "description": "User role",
            },
            "created_at": {
                "bsonType": "string",
                "description": "ISO 8601 creation timestamp",
            },
            "updated_at": {
                "bsonType": "string",
                "description": "ISO 8601 last-update timestamp",
            },
            "is_active": {
                "bsonType": "bool",
                "description": "Whether the account is active",
            },
            "last_login": {
                "bsonType": "string",
                "description": "ISO 8601 last login timestamp",
            },
            "profile": {
                "bsonType": "object",
                "properties": {
                    "company": {"bsonType": "string"},
                    "phone": {"bsonType": "string"},
                    "address": {"bsonType": "string"},
                },
            },
        },
    }
}

INVOICES_VALIDATOR = {
    "$jsonSchema": {
        "bsonType": "object",
        "required": ["user_id", "filename", "original_filename", "created_at"],
        "properties": {
            "user_id": {
                "bsonType": "string",
                "description": "Reference to the user who uploaded",
            },
            "org_id": {
                "bsonType": "string",
                "description": "Organization this invoice belongs to",
            },
            "filename": {
                "bsonType": "string",
                "description": "Stored filename on disk",
            },
            "original_filename": {
                "bsonType": "string",
                "description": "Original uploaded filename",
            },
            "status": {
                "bsonType": "string",
                "enum": ["processing", "completed", "failed", "reviewed", "paid", "unpaid", "pending"],
                "description": "Processing status",
            },
            "created_at": {
                "bsonType": "string",
                "description": "ISO 8601 creation timestamp",
            },
            "updated_at": {
                "bsonType": "string",
                "description": "ISO 8601 last-update timestamp",
            },
            "data": {
                "bsonType": "object",
                "properties": {
                    "vendor_name": {"bsonType": ["string", "null"]},
                    "invoice_no": {"bsonType": ["string", "null"]},
                    "date": {"bsonType": ["string", "null"]},
                    "due_date": {"bsonType": ["string", "null"]},
                    "line_items": {
                        "bsonType": "array",
                        "items": {
                            "bsonType": "object",
                            "properties": {
                                "description": {"bsonType": ["string", "null"]},
                                "quantity": {"bsonType": ["double", "int", "null"]},
                                "unit_price": {"bsonType": ["double", "int", "null"]},
                                "total": {"bsonType": ["double", "int", "null"]},
                            },
                        },
                    },
                    "totals": {
                        "bsonType": "object",
                        "properties": {
                            "subtotal": {"bsonType": ["double", "int", "null"]},
                            "tax": {"bsonType": ["double", "int", "null"]},
                            "discount": {"bsonType": ["double", "int", "null"]},
                            "grand_total": {"bsonType": ["double", "int", "null"]},
                            "currency": {"bsonType": ["string", "null"]},
                        },
                    },
                    "bill_to": {
                        "bsonType": "object",
                        "properties": {
                            "name": {"bsonType": ["string", "null"]},
                            "address": {"bsonType": ["string", "null"]},
                            "email": {"bsonType": ["string", "null"]},
                        },
                    },
                    "payment_method": {"bsonType": ["string", "null"]},
                    "notes": {"bsonType": ["string", "null"]},
                    "field_confidence": {
                        "bsonType": "object",
                        "description": "Per-field AI confidence scores (0-100)",
                    },
                    "validation": {
                        "bsonType": "object",
                        "properties": {
                            "is_valid": {"bsonType": "bool"},
                            "confidence": {"bsonType": ["int", "double"]},
                            "needs_human_review": {"bsonType": "bool"},
                            "warnings": {"bsonType": "array"},
                        },
                    },
                },
            },
            "tags": {
                "bsonType": "array",
                "items": {"bsonType": "string"},
                "description": "User-defined tags for organization",
            },
        },
    }
}

ACTIVITY_LOG_VALIDATOR = {
    "$jsonSchema": {
        "bsonType": "object",
        "required": ["user_id", "action", "timestamp"],
        "properties": {
            "user_id": {"bsonType": "string"},
            "action": {
                "bsonType": "string",
                "enum": [
                    "login",
                    "register",
                    "upload",
                    "view_invoice",
                    "delete_invoice",
                    "update_invoice",
                    "update_profile",
                    "export",
                    "advisor_chat",
                    "admin_create_user",
                    "admin_update_user",
                    "admin_toggle_user",
                    "admin_delete_user",
                    "validate_compliance",
                    "ttn_submission",
                ],
            },
            "timestamp": {"bsonType": "string"},
            "details": {"bsonType": "object"},
            "ip_address": {"bsonType": "string"},
        },
    }
}


# ── Collection Setup ─────────────────────────────────────────────────────────

def _get_or_create_collection(name, validator):
    if name in db.list_collection_names():
        db.command("collMod", name, validator=validator, validationLevel="moderate")
        return db[name]
    try:
        return db.create_collection(name, validator=validator)
    except CollectionInvalid:
        return db[name]


def init_db():
    """Create collections, apply validators, and build indexes."""

    # Users
    users = _get_or_create_collection("users", USERS_VALIDATOR)
    users.create_index([("email", ASCENDING)], unique=True, name="idx_email_unique")
    users.create_index([("role", ASCENDING)], name="idx_role")
    users.create_index([("created_at", DESCENDING)], name="idx_created_at")
    users.create_index([("is_active", ASCENDING)], name="idx_is_active", sparse=True)

    # Invoices
    invoices = _get_or_create_collection("invoices", INVOICES_VALIDATOR)
    invoices.create_index([("user_id", ASCENDING)], name="idx_user_id")
    invoices.create_index([("created_at", DESCENDING)], name="idx_created_at")
    invoices.create_index([("status", ASCENDING)], name="idx_status", sparse=True)
    invoices.create_index(
        [("user_id", ASCENDING), ("created_at", DESCENDING)],
        name="idx_user_created",
    )
    invoices.create_index(
        [("data.vendor_name", ASCENDING)],
        name="idx_vendor_name",
        sparse=True,
    )
    invoices.create_index(
        [("data.invoice_no", ASCENDING)],
        name="idx_invoice_no",
        sparse=True,
    )
    invoices.create_index(
        [("data.date", DESCENDING)],
        name="idx_invoice_date",
        sparse=True,
    )
    invoices.create_index(
        [("data.totals.grand_total", DESCENDING)],
        name="idx_grand_total",
        sparse=True,
    )
    invoices.create_index(
        [("data.validation.needs_human_review", ASCENDING)],
        name="idx_needs_review",
        sparse=True,
    )
    invoices.create_index([("tags", ASCENDING)], name="idx_tags", sparse=True)
    invoices.create_index([("org_id", ASCENDING)], name="idx_org_id", sparse=True)
    invoices.create_index(
        [("org_id", ASCENDING), ("created_at", DESCENDING)],
        name="idx_org_created",
        sparse=True,
    )

    # Activity log
    activity = _get_or_create_collection("activity_log", ACTIVITY_LOG_VALIDATOR)
    activity.create_index([("user_id", ASCENDING)], name="idx_user_id")
    activity.create_index([("action", ASCENDING)], name="idx_action")
    activity.create_index([("timestamp", DESCENDING)], name="idx_timestamp")
    activity.create_index(
        [("user_id", ASCENDING), ("action", ASCENDING), ("timestamp", DESCENDING)],
        name="idx_user_action_time",
    )
    activity.create_index(
        [("timestamp", ASCENDING)],
        name="idx_ttl_90_days",
        expireAfterSeconds=90 * 24 * 3600,
    )
    activity.create_index(
        [("org_id", ASCENDING), ("timestamp", DESCENDING)],
        name="idx_org_timestamp",
        sparse=True,
    )

    return users, invoices, activity


# ── Initialize on import ─────────────────────────────────────────────────────
users_collection, invoices_collection, activity_collection = init_db()

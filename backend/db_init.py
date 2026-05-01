"""
Database initialization and seeding script.

Usage:
    python db_init.py              # Initialize DB (indexes + validators only)
    python db_init.py --seed       # Initialize + seed with demo data
    python db_init.py --reset      # Drop DB and re-initialize (DESTRUCTIVE)
"""
import sys
from datetime import datetime

from config import MONGO_URI, DB_NAME


def now_iso():
    return datetime.utcnow().isoformat()


def main():
    from pymongo import MongoClient
    from services.auth_service import hash_password

    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]

    reset = "--reset" in sys.argv
    seed = "--seed" in sys.argv

    if reset:
        print(f"Dropping database '{DB_NAME}'...")
        client.drop_database(DB_NAME)
        print("Database dropped.")

    # Re-import to trigger init_db()
    print("Initializing collections, validators, and indexes...")
    from services.db_service import init_db
    users_col, invoices_col, activity_col = init_db()

    # Print current state
    for name in db.list_collection_names():
        count = db[name].count_documents({})
        indexes = list(db[name].list_indexes())
        print(f"  {name}: {count} docs, {len(indexes)} indexes")

    if seed:
        print("\nSeeding demo data...")

        # Demo admin
        if not users_col.find_one({"email": "admin@invoiceai.com"}):
            users_col.insert_one({
                "name": "Admin User",
                "email": "admin@invoiceai.com",
                "password": hash_password("admin123456"),
                "role": "admin",
                "is_active": True,
                "created_at": now_iso(),
                "profile": {
                    "company": "InvoiceAI",
                    "phone": "+1-555-0100",
                },
            })
            print("  Created admin: admin@invoiceai.com / admin123456")

        # Demo client
        if not users_col.find_one({"email": "demo@example.com"}):
            result = users_col.insert_one({
                "name": "Demo Client",
                "email": "demo@example.com",
                "password": hash_password("demo123456"),
                "role": "client",
                "is_active": True,
                "created_at": now_iso(),
                "profile": {
                    "company": "Demo Corp",
                },
            })
            demo_user_id = str(result.inserted_id)
            print("  Created client: demo@example.com / demo123456")

            # Demo invoice for the client
            invoices_col.insert_one({
                "user_id": demo_user_id,
                "filename": "20260101120000_sample.pdf",
                "original_filename": "sample.pdf",
                "status": "completed",
                "created_at": now_iso(),
                "data": {
                    "vendor_name": "Acme Corp",
                    "invoice_no": "INV-2026-001",
                    "date": "2026-01-15",
                    "due_date": "2026-02-15",
                    "line_items": [
                        {
                            "description": "Web Development",
                            "quantity": 40,
                            "unit_price": 75.0,
                            "total": 3000.0,
                        },
                        {
                            "description": "Hosting (Annual)",
                            "quantity": 1,
                            "unit_price": 199.0,
                            "total": 199.0,
                        },
                    ],
                    "totals": {
                        "subtotal": 3199.0,
                        "tax": 319.9,
                        "discount": None,
                        "grand_total": 3518.9,
                        "currency": "USD",
                    },
                    "bill_to": {
                        "name": "Demo Corp",
                        "address": "123 Main St, New York, NY",
                        "email": "demo@example.com",
                    },
                    "payment_method": "Bank Transfer",
                    "notes": "Net 30",
                    "validation": {
                        "is_valid": True,
                        "confidence": 92,
                        "needs_human_review": False,
                        "warnings": [],
                    },
                },
                "tags": ["web", "development"],
            })
            print("  Created sample invoice INV-2026-001")

            # Activity log entry
            activity_col.insert_one({
                "user_id": demo_user_id,
                "action": "upload",
                "timestamp": now_iso(),
                "details": {
                    "filename": "sample.pdf",
                    "invoice_id": "INV-2026-001",
                },
            })

    print("\nDatabase initialization complete.")
    print(f"  URI:      {MONGO_URI}")
    print(f"  Database: {DB_NAME}")
    print(f"  Collections: {db.list_collection_names()}")


if __name__ == "__main__":
    main()

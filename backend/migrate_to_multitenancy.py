"""
Migration script: Convert single-user app to multi-tenant SaaS.

For each existing user:
1. Creates a personal organization
2. Creates an owner membership
3. Adds org_id to all their invoices
4. Adds org_id to all their activity logs

This script is IDEMPOTENT — safe to run multiple times.

Usage:
    python migrate_to_multitenancy.py
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from bson import ObjectId
from services.db_service import db
from services.org_service import init_org_collections, _slugify, _now_iso

def migrate():
    print("=" * 60)
    print("  SmartInvoice — Multi-Tenancy Migration")
    print("=" * 60)

    # Ensure org collections exist
    init_org_collections(db)

    users = list(db["users"].find({}))
    print(f"\nFound {len(users)} users to migrate.\n")

    migrated = 0
    skipped = 0

    for user in users:
        user_id = str(user["_id"])
        user_name = user.get("name", "User")
        user_email = user.get("email", "")

        # Check if user already has a membership (already migrated)
        existing_membership = db["memberships"].find_one({"user_id": user_id})
        if existing_membership:
            print(f"  [SKIP] {user_email} — already has org membership")
            skipped += 1
            continue

        # Create personal organization
        org_name = f"{user_name}'s Workspace"
        base_slug = _slugify(user_name)
        slug = base_slug
        counter = 1
        while db["organizations"].find_one({"slug": slug}):
            slug = f"{base_slug}-{counter}"
            counter += 1

        org_doc = {
            "name": org_name,
            "slug": slug,
            "owner_id": user_id,
            "plan": "free",
            "stripe_customer_id": None,
            "stripe_subscription_id": None,
            "branding": {
                "logo_url": None,
                "primary_color": None,
                "invoice_template": None,
            },
            "settings": {
                "default_currency": "USD",
                "timezone": "UTC",
            },
            "usage": {
                "invoices_this_month": 0,
                "ai_queries_this_month": 0,
                "members_count": 1,
                "storage_bytes": 0,
            },
            "is_active": True,
            "created_at": _now_iso(),
            "updated_at": _now_iso(),
        }

        org_result = db["organizations"].insert_one(org_doc)
        org_id = str(org_result.inserted_id)

        # Create owner membership
        db["memberships"].insert_one({
            "user_id": user_id,
            "org_id": org_id,
            "role": "owner",
            "joined_at": _now_iso(),
            "invited_by": None,
        })

        # Update all invoices for this user
        inv_result = db["invoices"].update_many(
            {"user_id": user_id, "org_id": {"$exists": False}},
            {"$set": {"org_id": org_id}},
        )

        # Also update invoices that have org_id but it's empty
        inv_result2 = db["invoices"].update_many(
            {"user_id": user_id, "org_id": ""},
            {"$set": {"org_id": org_id}},
        )

        inv_count = inv_result.modified_count + inv_result2.modified_count

        # Update all activity logs for this user
        act_result = db["activity_log"].update_many(
            {"user_id": user_id, "org_id": {"$exists": False}},
            {"$set": {"org_id": org_id}},
        )

        act_result2 = db["activity_log"].update_many(
            {"user_id": user_id, "org_id": ""},
            {"$set": {"org_id": org_id}},
        )

        act_count = act_result.modified_count + act_result2.modified_count

        # Update invoice usage count
        total_invoices = db["invoices"].count_documents({"org_id": org_id})
        db["organizations"].update_one(
            {"_id": org_result.inserted_id},
            {"$set": {"usage.invoices_this_month": total_invoices}},
        )

        # Store last_org_id on user
        db["users"].update_one(
            {"_id": user["_id"]},
            {"$set": {"last_org_id": org_id}},
        )

        print(f"  [OK] {user_email}")
        print(f"       Org: {org_name} (slug: {slug})")
        print(f"       Invoices updated: {inv_count}")
        print(f"       Activity logs updated: {act_count}")
        migrated += 1

    # Also handle any notifications
    if "notifications" in db.list_collection_names():
        # For notifications, link them to orgs via user_id
        for user in users:
            user_id = str(user["_id"])
            membership = db["memberships"].find_one({"user_id": user_id})
            if membership:
                db["notifications"].update_many(
                    {"user_id": user_id, "org_id": {"$exists": False}},
                    {"$set": {"org_id": membership["org_id"]}},
                )

    print(f"\n{'=' * 60}")
    print(f"  Migration complete!")
    print(f"  Migrated: {migrated}")
    print(f"  Skipped (already done): {skipped}")
    print(f"  Total users: {len(users)}")
    print(f"{'=' * 60}\n")


if __name__ == "__main__":
    migrate()

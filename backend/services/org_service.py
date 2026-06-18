"""
Organization, Membership, and Invitation services for multi-tenant SaaS.
Handles MongoDB collection setup, CRUD helpers, and the Flask Blueprint.
"""

import re
import uuid
import logging
from datetime import datetime, timedelta
from functools import wraps

from bson import ObjectId
from flask import Blueprint, request, jsonify, g
from pymongo import ASCENDING, DESCENDING
from pymongo.errors import CollectionInvalid

from services.auth_service import token_required, create_token
from services.plan_limits import PLAN_LIMITS, get_plan_limit, has_feature

logger = logging.getLogger(__name__)

# ── Slugify helper ───────────────────────────────────────────────────────────

def _slugify(text: str) -> str:
    """Convert text to URL-safe slug."""
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_]+", "-", text)
    text = re.sub(r"-+", "-", text).strip("-")
    return text or "org"


def _now_iso() -> str:
    return datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.000Z")


# ── Collection Setup ─────────────────────────────────────────────────────────

def _get_or_create(db, name, validator=None):
    if name in db.list_collection_names():
        if validator:
            try:
                db.command("collMod", name, validator=validator, validationLevel="moderate")
            except Exception:
                pass
        return db[name]
    try:
        if validator:
            return db.create_collection(name, validator=validator)
        return db.create_collection(name)
    except CollectionInvalid:
        return db[name]


def init_org_collections(db):
    """Create organizations, memberships, invitations collections with indexes."""

    # ── Organizations ────────────────────────────────────────────────────
    orgs = _get_or_create(db, "organizations")
    orgs.create_index([("slug", ASCENDING)], unique=True, name="idx_slug_unique")
    orgs.create_index([("owner_id", ASCENDING)], name="idx_owner")
    orgs.create_index([("created_at", DESCENDING)], name="idx_org_created")

    # ── Memberships ──────────────────────────────────────────────────────
    members = _get_or_create(db, "memberships")
    members.create_index(
        [("user_id", ASCENDING), ("org_id", ASCENDING)],
        unique=True, name="idx_user_org_unique",
    )
    members.create_index([("org_id", ASCENDING)], name="idx_membership_org")
    members.create_index([("user_id", ASCENDING)], name="idx_membership_user")

    # ── Invitations ──────────────────────────────────────────────────────
    invites = _get_or_create(db, "invitations")
    invites.create_index([("token", ASCENDING)], unique=True, name="idx_invite_token")
    invites.create_index(
        [("org_id", ASCENDING), ("email", ASCENDING)],
        name="idx_invite_org_email",
    )
    invites.create_index(
        [("expires_at", ASCENDING)],
        name="idx_invite_ttl",
        expireAfterSeconds=0,
    )

    return orgs, members, invites


# ── org_required decorator ───────────────────────────────────────────────────

_db_ref = None

def _get_db():
    global _db_ref
    if _db_ref is None:
        from services.db_service import db
        _db_ref = db
    return _db_ref


def org_required(f):
    """Decorator: verifies org context from X-Org-Id header and sets g.org."""
    @wraps(f)
    def decorated(*args, **kwargs):
        db = _get_db()
        org_id = request.headers.get("X-Org-Id") or g.user.get("org_id")

        if not org_id:
            return jsonify({"success": False, "error": "Organization context required. Send X-Org-Id header."}), 400

        # Verify membership
        membership = db["memberships"].find_one({
            "user_id": g.user["user_id"],
            "org_id": org_id,
        })
        if not membership:
            return jsonify({"success": False, "error": "Not a member of this organization"}), 403

        org = db["organizations"].find_one({"_id": ObjectId(org_id), "is_active": True})
        if not org:
            return jsonify({"success": False, "error": "Organization not found or inactive"}), 404

        g.org = {
            "org_id": org_id,
            "org_role": membership["role"],
            "org_name": org["name"],
            "plan": org.get("plan", "free"),
        }
        return f(*args, **kwargs)
    return decorated


def org_admin_required(f):
    """Decorator: requires org owner or admin role."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if g.org.get("org_role") not in ("owner", "admin"):
            return jsonify({"success": False, "error": "Organization admin access required"}), 403
        return f(*args, **kwargs)
    return decorated


def org_owner_required(f):
    """Decorator: requires org owner role."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if g.org.get("org_role") != "owner":
            return jsonify({"success": False, "error": "Organization owner access required"}), 403
        return f(*args, **kwargs)
    return decorated


# ── Usage checking ───────────────────────────────────────────────────────────

def check_plan_limit(resource: str):
    """
    Decorator factory: checks if the org is within plan limits for a resource.
    resource should match the usage field name, e.g. "invoices" or "ai_queries".
    Plan limits key = "max_{resource}_per_month", usage key = "{resource}_this_month".
    """
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            db = _get_db()
            org_id = g.org["org_id"]
            plan = g.org.get("plan", "free")
            limit = get_plan_limit(plan, f"max_{resource}_per_month")

            if limit == -1:  # unlimited
                return f(*args, **kwargs)

            org = db["organizations"].find_one({"_id": ObjectId(org_id)})
            usage = (org or {}).get("usage", {})
            current = usage.get(f"{resource}_this_month", 0)

            if current >= limit:
                return jsonify({
                    "success": False,
                    "error": f"Plan limit reached: {current}/{limit} {resource} this month. Upgrade your plan.",
                    "limit": limit,
                    "current": current,
                    "plan": plan,
                }), 429

            return f(*args, **kwargs)
        return decorated
    return decorator


def increment_usage(db, org_id: str, resource: str, amount: int = 1):
    """Increment a usage counter for an organization."""
    db["organizations"].update_one(
        {"_id": ObjectId(org_id)},
        {"$inc": {f"usage.{resource}_this_month": amount}},
    )


# ── Helper: get user's orgs ─────────────────────────────────────────────────

def get_user_orgs(db, user_id: str) -> list:
    """Return list of orgs a user belongs to."""
    memberships = list(db["memberships"].find({"user_id": user_id}))
    if not memberships:
        return []

    org_ids = [ObjectId(m["org_id"]) for m in memberships]
    orgs = list(db["organizations"].find({"_id": {"$in": org_ids}}))

    # Build lookup
    role_map = {m["org_id"]: m["role"] for m in memberships}

    result = []
    for org in orgs:
        oid = str(org["_id"])
        result.append({
            "id": oid,
            "name": org.get("name", ""),
            "slug": org.get("slug", ""),
            "role": role_map.get(oid, "member"),
            "plan": org.get("plan", "free"),
            "logo_url": (org.get("branding") or {}).get("logo_url"),
            "members_count": org.get("usage", {}).get("members_count", 1),
        })

    return result


def create_personal_org(db, user_id: str, user_name: str) -> str:
    """Create a default personal organization for a new user. Returns org_id."""
    org_name = f"{user_name}'s Workspace"
    base_slug = _slugify(user_name)

    # Ensure slug is unique
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

    result = db["organizations"].insert_one(org_doc)
    org_id = str(result.inserted_id)

    # Create owner membership
    db["memberships"].insert_one({
        "user_id": user_id,
        "org_id": org_id,
        "role": "owner",
        "joined_at": _now_iso(),
        "invited_by": None,
    })

    return org_id


# ── Flask Blueprint ──────────────────────────────────────────────────────────

org_bp = Blueprint("organizations", __name__)


def register_org_routes(app, db):
    """Register the organization Blueprint with the Flask app."""
    init_org_collections(db)

    # ── List user's organizations ────────────────────────────────────
    @org_bp.route("/api/orgs", methods=["GET"])
    @token_required
    def list_orgs():
        orgs = get_user_orgs(db, g.user["user_id"])
        return jsonify({"success": True, "orgs": orgs}), 200

    # ── Create organization ──────────────────────────────────────────
    @org_bp.route("/api/orgs", methods=["POST"])
    @token_required
    def create_org():
        data = request.get_json(silent=True) or {}
        name = data.get("name", "").strip()

        if not name or len(name) < 2:
            return jsonify({"success": False, "error": "Organization name is required (min 2 chars)"}), 400

        base_slug = _slugify(name)
        slug = base_slug
        counter = 1
        while db["organizations"].find_one({"slug": slug}):
            slug = f"{base_slug}-{counter}"
            counter += 1

        org_doc = {
            "name": name,
            "slug": slug,
            "owner_id": g.user["user_id"],
            "plan": "free",
            "stripe_customer_id": None,
            "stripe_subscription_id": None,
            "branding": {
                "logo_url": None,
                "primary_color": data.get("primary_color"),
                "invoice_template": None,
            },
            "settings": {
                "default_currency": data.get("currency", "USD"),
                "timezone": data.get("timezone", "UTC"),
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

        result = db["organizations"].insert_one(org_doc)
        org_id = str(result.inserted_id)

        db["memberships"].insert_one({
            "user_id": g.user["user_id"],
            "org_id": org_id,
            "role": "owner",
            "joined_at": _now_iso(),
            "invited_by": None,
        })

        return jsonify({
            "success": True,
            "message": "Organization created",
            "org": {
                "id": org_id,
                "name": name,
                "slug": slug,
                "role": "owner",
                "plan": "free",
            },
        }), 201

    # ── Get organization details ─────────────────────────────────────
    @org_bp.route("/api/orgs/<org_id>", methods=["GET"])
    @token_required
    @org_required
    def get_org(org_id):
        org = db["organizations"].find_one({"_id": ObjectId(org_id)})
        if not org:
            return jsonify({"success": False, "error": "Not found"}), 404

        members_count = db["memberships"].count_documents({"org_id": org_id})

        return jsonify({
            "success": True,
            "org": {
                "id": str(org["_id"]),
                "name": org.get("name", ""),
                "slug": org.get("slug", ""),
                "plan": org.get("plan", "free"),
                "owner_id": org.get("owner_id", ""),
                "branding": org.get("branding", {}),
                "settings": org.get("settings", {}),
                "usage": org.get("usage", {}),
                "members_count": members_count,
                "created_at": org.get("created_at", ""),
            },
        }), 200

    # ── Update organization ──────────────────────────────────────────
    @org_bp.route("/api/orgs/<org_id>", methods=["PUT"])
    @token_required
    @org_required
    @org_admin_required
    def update_org(org_id):
        data = request.get_json(silent=True) or {}
        update = {}

        name = data.get("name", "").strip()
        if name and len(name) >= 2:
            update["name"] = name

        if "settings" in data and isinstance(data["settings"], dict):
            for key in ("default_currency", "timezone"):
                if key in data["settings"]:
                    update[f"settings.{key}"] = data["settings"][key]

        if "branding" in data and isinstance(data["branding"], dict):
            for key in ("primary_color", "invoice_template"):
                if key in data["branding"]:
                    update[f"branding.{key}"] = data["branding"][key]

        if not update:
            return jsonify({"success": False, "error": "No valid fields to update"}), 400

        update["updated_at"] = _now_iso()
        db["organizations"].update_one({"_id": ObjectId(org_id)}, {"$set": update})

        return jsonify({"success": True, "message": "Organization updated"}), 200

    # ── Delete organization ──────────────────────────────────────────
    @org_bp.route("/api/orgs/<org_id>", methods=["DELETE"])
    @token_required
    @org_required
    @org_owner_required
    def delete_org(org_id):
        # Don't allow deleting if it's the user's only org
        user_orgs = get_user_orgs(db, g.user["user_id"])
        if len(user_orgs) <= 1:
            return jsonify({"success": False, "error": "Cannot delete your only organization"}), 400

        db["organizations"].update_one(
            {"_id": ObjectId(org_id)},
            {"$set": {"is_active": False, "updated_at": _now_iso()}},
        )
        return jsonify({"success": True, "message": "Organization deactivated"}), 200

    # ── Switch organization (returns new token) ──────────────────────
    @org_bp.route("/api/orgs/<org_id>/switch", methods=["POST"])
    @token_required
    def switch_org(org_id):
        membership = db["memberships"].find_one({
            "user_id": g.user["user_id"],
            "org_id": org_id,
        })
        if not membership:
            return jsonify({"success": False, "error": "Not a member of this organization"}), 403

        org = db["organizations"].find_one({"_id": ObjectId(org_id), "is_active": True})
        if not org:
            return jsonify({"success": False, "error": "Organization not found"}), 404

        # Issue new token with org context
        token = create_token(
            g.user["user_id"],
            g.user["email"],
            g.user.get("role", "client"),
            org_id=org_id,
            org_role=membership["role"],
        )

        # Update user's last_org_id
        db["users"].update_one(
            {"_id": ObjectId(g.user["user_id"])},
            {"$set": {"last_org_id": org_id}},
        )

        return jsonify({
            "success": True,
            "token": token,
            "org": {
                "id": str(org["_id"]),
                "name": org["name"],
                "slug": org.get("slug", ""),
                "role": membership["role"],
                "plan": org.get("plan", "free"),
            },
        }), 200

    # ── List organization members ────────────────────────────────────
    @org_bp.route("/api/orgs/<org_id>/members", methods=["GET"])
    @token_required
    @org_required
    def list_members(org_id):
        memberships = list(db["memberships"].find({"org_id": org_id}))
        user_ids = []
        for m in memberships:
            try:
                user_ids.append(ObjectId(m["user_id"]))
            except Exception:
                pass
        users = {
            str(u["_id"]): u
            for u in db["users"].find({"_id": {"$in": user_ids}}, {"password": 0})
        }

        members = []
        for m in memberships:
            uid = str(ObjectId(m["user_id"])) if m.get("user_id") else m.get("user_id", "")
            user = users.get(uid, {})
            members.append({
                "user_id": m["user_id"],
                "name": user.get("name", "Unknown"),
                "email": user.get("email", ""),
                "role": m["role"],
                "joined_at": m.get("joined_at", ""),
                "is_active": user.get("is_active", True),
            })

        return jsonify({"success": True, "members": members}), 200

    # ── Update member role ───────────────────────────────────────────
    @org_bp.route("/api/orgs/<org_id>/members/<user_id>", methods=["PUT"])
    @token_required
    @org_required
    @org_owner_required
    def update_member_role(org_id, user_id):
        data = request.get_json(silent=True) or {}
        new_role = data.get("role", "").strip()

        if new_role not in ("admin", "member"):
            return jsonify({"success": False, "error": "Role must be 'admin' or 'member'"}), 400

        if user_id == g.user["user_id"]:
            return jsonify({"success": False, "error": "Cannot change your own role"}), 400

        result = db["memberships"].update_one(
            {"user_id": user_id, "org_id": org_id},
            {"$set": {"role": new_role}},
        )
        if result.matched_count == 0:
            return jsonify({"success": False, "error": "Member not found"}), 404

        return jsonify({"success": True, "message": f"Role updated to {new_role}"}), 200

    # ── Remove member ────────────────────────────────────────────────
    @org_bp.route("/api/orgs/<org_id>/members/<user_id>", methods=["DELETE"])
    @token_required
    @org_required
    @org_admin_required
    def remove_member(org_id, user_id):
        if user_id == g.user["user_id"]:
            return jsonify({"success": False, "error": "Cannot remove yourself"}), 400

        membership = db["memberships"].find_one({"user_id": user_id, "org_id": org_id})
        if not membership:
            return jsonify({"success": False, "error": "Member not found"}), 404

        if membership["role"] == "owner":
            return jsonify({"success": False, "error": "Cannot remove the owner"}), 400

        db["memberships"].delete_one({"user_id": user_id, "org_id": org_id})

        # Decrement member count
        db["organizations"].update_one(
            {"_id": ObjectId(org_id)},
            {"$inc": {"usage.members_count": -1}},
        )

        return jsonify({"success": True, "message": "Member removed"}), 200

    # ── Send invitation ──────────────────────────────────────────────
    @org_bp.route("/api/orgs/<org_id>/invitations", methods=["POST"])
    @token_required
    @org_required
    @org_admin_required
    def send_invitation(org_id):
        data = request.get_json(silent=True) or {}
        email = data.get("email", "").strip().lower()
        role = data.get("role", "member").strip()

        if not email:
            return jsonify({"success": False, "error": "Email is required"}), 400
        if role not in ("admin", "member"):
            role = "member"

        # Check if already a member
        existing_user = db["users"].find_one({"email": email})
        if existing_user:
            existing_membership = db["memberships"].find_one({
                "user_id": str(existing_user["_id"]),
                "org_id": org_id,
            })
            if existing_membership:
                return jsonify({"success": False, "error": "User is already a member"}), 409

        # Check plan member limit
        plan = g.org.get("plan", "free")
        max_members = get_plan_limit(plan, "max_members")
        if max_members != -1:
            current = db["memberships"].count_documents({"org_id": org_id})
            pending = db["invitations"].count_documents({"org_id": org_id, "status": "pending"})
            if (current + pending) >= max_members:
                return jsonify({
                    "success": False,
                    "error": f"Member limit reached ({max_members}). Upgrade your plan.",
                }), 429

        # Check for existing pending invitation
        existing_invite = db["invitations"].find_one({
            "org_id": org_id,
            "email": email,
            "status": "pending",
        })
        if existing_invite:
            return jsonify({"success": False, "error": "Invitation already pending for this email"}), 409

        invite_token = str(uuid.uuid4())
        invite_doc = {
            "org_id": org_id,
            "email": email,
            "role": role,
            "token": invite_token,
            "invited_by": g.user["user_id"],
            "status": "pending",
            "created_at": _now_iso(),
            "expires_at": datetime.utcnow() + timedelta(days=7),
        }

        db["invitations"].insert_one(invite_doc)

        # Send invitation email + in-app notification
        try:
            from services.notification_system_backend import EmailService, get_notification_service
            from config import APP_URL
            invite_url = f"{APP_URL}/invite/{invite_token}"
            org_name = g.org.get("org_name", "SmartInvoice")
            subject = f"You're invited to join {org_name} on SmartInvoice"
            html = EmailService._build_html(
                title="You've been invited!",
                subtitle="Team Invitation",
                content=f"You've been invited to join <strong>{org_name}</strong> on SmartInvoice as a <strong>{role}</strong>.",
                action_url=invite_url,
                action_label="Accept Invitation",
            )
            sent = EmailService.send_email([email], subject, html)
            if not sent:
                logger.warning("Invitation email to %s was not sent (SMTP not configured or failed)", email)

            # Create in-app notification if the invited user already has an account
            if existing_user:
                ns = get_notification_service()
                if ns:
                    ns.create_notification(
                        user_id=str(existing_user["_id"]),
                        title="Team Invitation",
                        content=f"You've been invited to join {org_name} as {role}.",
                        category="system",
                        action_url=f"/invite/{invite_token}",
                        priority="high",
                    )
        except Exception as e:
            logger.warning("Failed to send invitation email: %s", e)

        return jsonify({
            "success": True,
            "message": f"Invitation sent to {email}",
            "invitation": {
                "token": invite_token,
                "email": email,
                "role": role,
            },
        }), 201

    # ── List pending invitations ─────────────────────────────────────
    @org_bp.route("/api/orgs/<org_id>/invitations", methods=["GET"])
    @token_required
    @org_required
    @org_admin_required
    def list_invitations(org_id):
        invites = list(db["invitations"].find(
            {"org_id": org_id, "status": "pending"},
        ).sort("created_at", -1))

        result = []
        for inv in invites:
            result.append({
                "id": str(inv["_id"]),
                "email": inv["email"],
                "role": inv["role"],
                "token": inv["token"],
                "created_at": inv.get("created_at", ""),
            })

        return jsonify({"success": True, "invitations": result}), 200

    # ── Revoke invitation ────────────────────────────────────────────
    @org_bp.route("/api/orgs/<org_id>/invitations/<invite_id>", methods=["DELETE"])
    @token_required
    @org_required
    @org_admin_required
    def revoke_invitation(org_id, invite_id):
        result = db["invitations"].delete_one({
            "_id": ObjectId(invite_id),
            "org_id": org_id,
            "status": "pending",
        })
        if result.deleted_count == 0:
            return jsonify({"success": False, "error": "Invitation not found"}), 404

        return jsonify({"success": True, "message": "Invitation revoked"}), 200

    # ── Get my pending invitations (for the logged-in user) ────────
    @org_bp.route("/api/invitations/my", methods=["GET"])
    @token_required
    def my_invitations():
        """Return all pending invitations for the currently logged-in user's email."""
        user_email = g.user.get("email", "").strip().lower()
        if not user_email:
            return jsonify({"success": True, "invitations": []}), 200

        invites = list(db["invitations"].find(
            {"email": user_email, "status": "pending"},
            {"_id": 1, "org_id": 1, "role": 1, "token": 1, "created_at": 1},
        ).sort("created_at", -1))

        result = []
        for inv in invites:
            org = db["organizations"].find_one({"_id": ObjectId(inv["org_id"])})
            result.append({
                "id": str(inv["_id"]),
                "token": inv["token"],
                "org_id": inv["org_id"],
                "org_name": org.get("name", "Unknown") if org else "Unknown",
                "role": inv["role"],
                "created_at": inv.get("created_at", ""),
            })

        return jsonify({"success": True, "invitations": result}), 200

    # ── Accept invitation (public-ish — requires auth but no org) ────
    @org_bp.route("/api/invitations/<invite_token>/accept", methods=["POST"])
    @token_required
    def accept_invitation(invite_token):
        invite = db["invitations"].find_one({
            "token": invite_token,
            "status": "pending",
        })
        if not invite:
            return jsonify({"success": False, "error": "Invalid or expired invitation"}), 404

        org_id = invite["org_id"]
        user_id = g.user["user_id"]

        # Check not already a member
        if db["memberships"].find_one({"user_id": user_id, "org_id": org_id}):
            db["invitations"].update_one(
                {"_id": invite["_id"]},
                {"$set": {"status": "accepted"}},
            )
            return jsonify({"success": True, "message": "Already a member", "org_id": org_id}), 200

        # Create membership
        db["memberships"].insert_one({
            "user_id": user_id,
            "org_id": org_id,
            "role": invite["role"],
            "joined_at": _now_iso(),
            "invited_by": invite.get("invited_by"),
        })

        # Update invitation status
        db["invitations"].update_one(
            {"_id": invite["_id"]},
            {"$set": {"status": "accepted"}},
        )

        # Increment member count
        db["organizations"].update_one(
            {"_id": ObjectId(org_id)},
            {"$inc": {"usage.members_count": 1}},
        )

        org = db["organizations"].find_one({"_id": ObjectId(org_id)})

        return jsonify({
            "success": True,
            "message": "Invitation accepted",
            "org": {
                "id": org_id,
                "name": org.get("name", "") if org else "",
                "plan": org.get("plan", "free") if org else "free",
                "role": invite["role"],
            },
        }), 200

    app.register_blueprint(org_bp)
    logger.info("Organization routes registered")
    return org_bp

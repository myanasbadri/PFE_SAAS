import os
import json
import logging
from datetime import datetime
from collections import defaultdict
from bson import ObjectId
from flask import Flask, request, jsonify, g
from flask_cors import CORS
from werkzeug.utils import secure_filename

from config import PORT, UPLOAD_FOLDER, ALLOWED_EXTENSIONS, OLLAMA_URL, OLLAMA_MODEL, GROQ_API_KEY, GROQ_MODEL, CORS_ORIGINS
from services.db_service import users_collection, invoices_collection, activity_collection
from services.auth_service import (
    hash_password,
    verify_password,
    create_token,
    token_required,
)
from services.org_service import (
    register_org_routes,
    org_required,
    org_admin_required,
    get_user_orgs,
    create_personal_org,
    increment_usage,
    check_plan_limit,
)
from services.extractor_core import allowed_file, extract_from_file, now_iso
from services.celery_worker import celery, process_invoice_task, run_invoice_processing
from services.export_service import generate_single_invoice_excel, generate_all_invoices_excel
from services.notification_service import (
    compute_user_hmac,
    fetch_notifications,
    mark_notification_read,
    mark_all_read,
    notify_invoice_created,
    notify_invoice_updated,
    notify_invoice_deleted,
    notify_status_changed,
    notify_extraction_complete,
    notify_extraction_failed,
    notify_needs_review,
    notify_batch_complete,
    _send_email_to_admins,
)

app = Flask(__name__)
cors_origins = CORS_ORIGINS.split(",") if CORS_ORIGINS != "*" else "*"
CORS(app, origins=cors_origins, supports_credentials=True)

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs("logs", exist_ok=True)
os.makedirs("tmp_pdf_ocr", exist_ok=True)

@app.route("/api/health")
def health_check():
    return jsonify({"status": "ok"}), 200

# ── Register multi-channel notification system ────────────────────────────
from services.db_service import db
from services.notification_system_backend import register_notification_routes, get_notification_service
ns = register_notification_routes(app, db)

# ── Register organization/multi-tenant routes ───────────────────────────
register_org_routes(app, db)

# ── Register billing/Stripe routes ──────────────────────────────────────
from services.billing_service import register_billing_routes
register_billing_routes(app, db)


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "success": True,
        "message": "Backend is running",
        "time": now_iso()
    }), 200


@app.route("/api/auth/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}

    name = data.get("name", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "").strip()
    role = data.get("role", "client").strip().lower()

    if not name or not email or not password:
        return jsonify({
            "success": False,
            "error": "name, email and password are required"
        }), 400

    if role not in ["admin", "client"]:
        role = "client"

    existing_user = users_collection.find_one({"email": email})
    if existing_user:
        return jsonify({
            "success": False,
            "error": "Email already exists"
        }), 409

    password_hash = hash_password(password)

    user_doc = {
        "name": name,
        "email": email,
        "password": password_hash,
        "role": role,
        "is_active": True,
        "created_at": now_iso(),
    }

    result = users_collection.insert_one(user_doc)
    user_id = str(result.inserted_id)

    # Create a personal organization for the new user
    org_id = create_personal_org(db, user_id, name)

    activity_collection.insert_one({
        "user_id": user_id,
        "org_id": org_id,
        "action": "register",
        "timestamp": now_iso(),
        "details": {"email": email, "role": role},
        "ip_address": request.remote_addr or "",
    })

    token = create_token(user_id, email, role, org_id=org_id, org_role="owner")

    orgs = get_user_orgs(db, user_id)

    return jsonify({
        "success": True,
        "message": "User created successfully",
        "token": token,
        "user": {
            "id": user_id,
            "name": name,
            "email": email,
            "role": role
        },
        "orgs": orgs,
        "current_org_id": org_id,
    }), 201


@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}

    email = data.get("email", "").strip().lower()
    password = data.get("password", "").strip()

    if not email or not password:
        return jsonify({
            "success": False,
            "error": "email and password are required"
        }), 400

    user = users_collection.find_one({"email": email})
    if not user:
        return jsonify({
            "success": False,
            "error": "Invalid email or password"
        }), 401

    if not verify_password(password, user["password"]):
        return jsonify({
            "success": False,
            "error": "Invalid email or password"
        }), 401

    user_id = str(user["_id"])

    # Get user's organizations
    orgs = get_user_orgs(db, user_id)

    # Auto-create personal org for legacy users who have none
    if not orgs:
        new_org_id = create_personal_org(db, user_id, user.get("name", "User"))
        if new_org_id:
            db["invoices"].update_many(
                {"user_id": user_id, "$or": [{"org_id": {"$exists": False}}, {"org_id": ""}]},
                {"$set": {"org_id": new_org_id}},
            )
            db["activity_log"].update_many(
                {"user_id": user_id, "$or": [{"org_id": {"$exists": False}}, {"org_id": ""}]},
                {"$set": {"org_id": new_org_id}},
            )
            users_collection.update_one(
                {"_id": user["_id"]},
                {"$set": {"last_org_id": new_org_id}},
            )
            orgs = get_user_orgs(db, user_id)

    # Auto-select org: last used, or first available
    org_id = None
    org_role = None
    if orgs:
        last_org = user.get("last_org_id")
        selected = next((o for o in orgs if o["id"] == last_org), None) or orgs[0]
        org_id = selected["id"]
        org_role = selected["role"]

    token = create_token(user_id, user["email"], user["role"],
                         org_id=org_id, org_role=org_role)

    users_collection.update_one(
        {"_id": user["_id"]},
        {"$set": {"last_login": now_iso()}},
    )

    activity_collection.insert_one({
        "user_id": user_id,
        "org_id": org_id or "",
        "action": "login",
        "timestamp": now_iso(),
        "details": {},
        "ip_address": request.remote_addr or "",
    })

    return jsonify({
        "success": True,
        "message": "Login successful",
        "token": token,
        "user": {
            "id": user_id,
            "name": user["name"],
            "email": user["email"],
            "role": user["role"]
        },
        "orgs": orgs,
        "current_org_id": org_id,
    }), 200


@app.route("/api/auth/me", methods=["GET"])
@token_required
def me():
    user_id = g.user["user_id"]
    orgs = get_user_orgs(db, user_id)

    # Auto-create personal org for legacy users who have none
    if not orgs:
        user_doc = users_collection.find_one({"_id": ObjectId(user_id)})
        new_org_id = create_personal_org(db, user_id, user_doc.get("name", "User") if user_doc else "User")
        if new_org_id:
            db["invoices"].update_many(
                {"user_id": user_id, "$or": [{"org_id": {"$exists": False}}, {"org_id": ""}]},
                {"$set": {"org_id": new_org_id}},
            )
            db["activity_log"].update_many(
                {"user_id": user_id, "$or": [{"org_id": {"$exists": False}}, {"org_id": ""}]},
                {"$set": {"org_id": new_org_id}},
            )
            users_collection.update_one(
                {"_id": ObjectId(user_id)},
                {"$set": {"last_org_id": new_org_id}},
            )
            orgs = get_user_orgs(db, user_id)

    return jsonify({
        "success": True,
        "user": g.user,
        "orgs": orgs,
    }), 200


@app.route("/api/notifications/auth", methods=["GET"])
@token_required
def notifications_auth():
    """Return Base64 HMAC + API key for MagicBell client-side auth."""
    from config import MAGICBELL_API_KEY
    user_email = g.user.get("email", "")
    return jsonify({
        "success": True,
        "apiKey": MAGICBELL_API_KEY,
        "userEmail": user_email,
        "userKey": compute_user_hmac(user_email),
    }), 200


@app.route("/api/notifications/test", methods=["POST"])
@token_required
def test_notification():
    """Send a test notification to the current user."""
    from services.notification_service import _send_notification
    user_email = g.user.get("email", "")
    _send_notification(
        title="Test Notification",
        content="If you see this, your MagicBell notifications are working!",
        recipients=[{"email": user_email}],
        category="default",
    )
    return jsonify({"success": True, "message": f"Test notification sent to {user_email}"}), 200


@app.route("/api/notifications/test-email", methods=["POST"])
@token_required
def test_email_notification():
    """Send a test email notification to all admin users."""
    _send_email_to_admins(
        title="Test Email Notification",
        content="If you receive this email, the email notification system is working correctly!",
    )
    return jsonify({"success": True, "message": "Test email sent to all admin users"}), 200


@app.route("/api/notifications", methods=["GET"])
@token_required
def get_notifications():
    """Fetch notifications for the current user from MagicBell."""
    page = request.args.get("page", 1, type=int)
    data = fetch_notifications(g.user["email"], page=page)
    if data is None:
        return jsonify({"success": False, "error": "Failed to fetch notifications"}), 502
    return jsonify({"success": True, **data}), 200


@app.route("/api/notifications/<notification_id>/read", methods=["POST"])
@token_required
def read_notification(notification_id):
    """Mark a notification as read."""
    ok = mark_notification_read(g.user["email"], notification_id)
    if not ok:
        return jsonify({"success": False, "error": "Failed to mark as read"}), 502
    return jsonify({"success": True}), 200


@app.route("/api/notifications/mark-all-read", methods=["POST"])
@token_required
def read_all_notifications():
    """Mark all notifications as read."""
    ok = mark_all_read(g.user["email"])
    if not ok:
        return jsonify({"success": False, "error": "Failed to mark all read"}), 502
    return jsonify({"success": True}), 200


@app.route("/api/extract-file", methods=["POST"])
@token_required
@org_required
def extract_file():
    if "file" not in request.files:
        return jsonify({
            "success": False,
            "error": "No file part in request"
        }), 400

    file = request.files["file"]

    if file.filename == "":
        return jsonify({
            "success": False,
            "error": "No file selected"
        }), 400

    if not allowed_file(file.filename, ALLOWED_EXTENSIONS):
        return jsonify({
            "success": False,
            "error": "Unsupported file type"
        }), 400

    filename = secure_filename(file.filename)
    timestamp_prefix = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    final_filename = f"{timestamp_prefix}_{filename}"
    file_path = os.path.join(UPLOAD_FOLDER, final_filename)

    file.save(file_path)

    # Try async via Celery/Redis first; fall back to synchronous if Redis is unavailable
    try:
        task = process_invoice_task.delay(g.user["user_id"], file_path, filename, g.org["org_id"])
        return jsonify({
            "success": True,
            "message": "File processing started in background",
            "mode": "async",
            "task_id": task.id
        }), 202
    except Exception:
        # Redis not running — process synchronously so testing still works
        result = run_invoice_processing(g.user["user_id"], file_path, filename, org_id=g.org["org_id"])
        inv_id = result.get("invoice_id", "")
        ext_data = result.get("extracted_data", {})
        confidence = ext_data.get("validation", {}).get("confidence")
        needs_review = ext_data.get("validation", {}).get("needs_human_review", False)

        notify_extraction_complete(g.user["email"], inv_id, filename, confidence)
        if needs_review:
            notify_needs_review(g.user["email"], inv_id, ext_data.get("vendor_name"))

        return jsonify({
            "success": True,
            "message": "File processed synchronously (Redis unavailable)",
            "mode": "sync",
            "invoice_id": inv_id,
            "extracted_data": ext_data
        }), 200

@app.route("/api/tasks/<task_id>", methods=["GET"])
@token_required
def get_task_status(task_id):
    task = celery.AsyncResult(task_id)
    if task.state == 'PENDING':
        response = {
            'state': task.state,
            'status': 'Processing...'
        }
    elif task.state != 'FAILURE':
        response = {
            'state': task.state,
            'result': task.info,
        }
    else:
        response = {
            'state': task.state,
            'status': str(task.info),
        }
    return jsonify(response)


@app.route("/api/extract-batch", methods=["POST"])
@token_required
@org_required
def extract_batch():
    """Accept multiple files (and/or ZIP archives) and process each one."""
    import zipfile
    import tempfile

    files = request.files.getlist("files")
    if not files:
        return jsonify({"success": False, "error": "No files provided"}), 400

    # Collect all processable files (expand ZIPs)
    file_entries = []  # list of (filename, file_path)

    for file in files:
        if not file.filename:
            continue

        filename = secure_filename(file.filename)
        timestamp_prefix = datetime.utcnow().strftime("%Y%m%d%H%M%S%f")

        # Handle ZIP archives
        if filename.lower().endswith(".zip"):
            tmp_zip = os.path.join(UPLOAD_FOLDER, f"{timestamp_prefix}_{filename}")
            file.save(tmp_zip)
            try:
                with zipfile.ZipFile(tmp_zip, "r") as zf:
                    for member in zf.namelist():
                        # Skip directories and hidden files
                        if member.endswith("/") or member.startswith("__"):
                            continue
                        member_name = secure_filename(os.path.basename(member))
                        if not member_name or not allowed_file(member_name, ALLOWED_EXTENSIONS):
                            continue
                        # Extract to uploads folder
                        member_path = os.path.join(
                            UPLOAD_FOLDER,
                            f"{timestamp_prefix}_{member_name}",
                        )
                        with zf.open(member) as src, open(member_path, "wb") as dst:
                            dst.write(src.read())
                        file_entries.append((member_name, member_path))
            except zipfile.BadZipFile:
                pass
            finally:
                try:
                    os.remove(tmp_zip)
                except OSError:
                    pass
        else:
            if not allowed_file(filename, ALLOWED_EXTENSIONS):
                continue
            final_filename = f"{timestamp_prefix}_{filename}"
            file_path = os.path.join(UPLOAD_FOLDER, final_filename)
            file.save(file_path)
            file_entries.append((filename, file_path))

    if not file_entries:
        return jsonify({
            "success": False,
            "error": "No supported files found (PDF, PNG, JPG, WEBP, TXT, XML)"
        }), 400

    # Process each file synchronously and collect results
    results = []
    for original_name, file_path in file_entries:
        entry = {"filename": original_name, "status": "processing"}
        try:
            result = run_invoice_processing(g.user["user_id"], file_path, original_name, org_id=g.org["org_id"])
            entry["status"] = "completed"
            entry["invoice_id"] = result.get("invoice_id")
            entry["extracted_data"] = result.get("extracted_data")
        except Exception as e:
            entry["status"] = "failed"
            entry["error"] = str(e)
        results.append(entry)

    success_count = sum(1 for r in results if r["status"] == "completed")
    failed_count = sum(1 for r in results if r["status"] == "failed")

    activity_collection.insert_one({
        "user_id": g.user["user_id"],
        "org_id": g.org["org_id"],
        "action": "upload",
        "timestamp": now_iso(),
        "details": {
            "method": "batch",
            "file_count": len(file_entries),
            "success_count": success_count,
        },
        "ip_address": request.remote_addr or "",
    })

    notify_batch_complete(g.user["email"], len(results), success_count, failed_count)

    return jsonify({
        "success": True,
        "message": f"Processed {len(results)} file(s)",
        "total": len(results),
        "results": results,
    }), 200


@app.route("/api/invoices", methods=["POST"])
@token_required
@org_required
def create_invoice():
    data = request.get_json(silent=True) or {}

    vendor_name = data.get("vendor_name", "").strip() or None
    invoice_no = data.get("invoice_no", "").strip() or None
    invoice_date = data.get("date", "").strip() or None
    due_date = data.get("due_date", "").strip() or None
    bill_to = data.get("bill_to") or {}
    line_items = data.get("line_items") or []
    totals = data.get("totals") or {}
    payment_method = data.get("payment_method", "").strip() or None
    notes = data.get("notes", "").strip() or None
    tags = data.get("tags") or []

    if not vendor_name and not invoice_no:
        return jsonify({
            "success": False,
            "error": "At least vendor name or invoice number is required"
        }), 400

    invoice_data = {
        "vendor_name": vendor_name,
        "invoice_no": invoice_no,
        "date": invoice_date,
        "due_date": due_date,
        "line_items": line_items,
        "totals": {
            "subtotal": totals.get("subtotal"),
            "tax": totals.get("tax"),
            "discount": totals.get("discount"),
            "grand_total": totals.get("grand_total"),
            "currency": totals.get("currency"),
        },
        "bill_to": {
            "name": bill_to.get("name"),
            "address": bill_to.get("address"),
            "email": bill_to.get("email"),
        },
        "payment_method": payment_method,
        "notes": notes,
        "validation": {
            "is_valid": True,
            "confidence": 100,
            "needs_human_review": False,
            "warnings": [],
        },
    }

    invoice_doc = {
        "user_id": g.user["user_id"],
        "org_id": g.org["org_id"],
        "filename": "manual_entry",
        "original_filename": f"manual_{invoice_no or 'invoice'}",
        "status": "completed",
        "data": invoice_data,
        "tags": tags,
        "created_at": now_iso(),
    }

    result = invoices_collection.insert_one(invoice_doc)
    increment_usage(db, g.org["org_id"], "invoices")

    activity_collection.insert_one({
        "user_id": g.user["user_id"],
        "org_id": g.org["org_id"],
        "action": "upload",
        "timestamp": now_iso(),
        "details": {"invoice_id": str(result.inserted_id), "method": "manual"},
        "ip_address": request.remote_addr or "",
    })

    notify_invoice_created(g.user["email"], str(result.inserted_id), vendor_name)

    return jsonify({
        "success": True,
        "message": "Invoice created successfully",
        "invoice_id": str(result.inserted_id)
    }), 201


@app.route("/api/invoices", methods=["GET"])
@token_required
@org_required
def get_invoices():
    import re

    query = {"org_id": g.org["org_id"]}

    # ── Text search (vendor, invoice_no, notes, bill_to name) ──────────
    search = request.args.get("search", "").strip()
    if search:
        regex = {"$regex": re.escape(search), "$options": "i"}
        query["$or"] = [
            {"data.vendor_name": regex},
            {"data.invoice_no": regex},
            {"data.notes": regex},
            {"data.bill_to.name": regex},
            {"original_filename": regex},
        ]

    # ── Status filter ──────────────────────────────────────────────────
    status = request.args.get("status", "").strip()
    if status:
        query["status"] = status

    # ── Vendor filter (exact match, case-insensitive) ──────────────────
    vendor = request.args.get("vendor", "").strip()
    if vendor:
        query["data.vendor_name"] = {"$regex": f"^{re.escape(vendor)}$", "$options": "i"}

    # ── Currency filter ────────────────────────────────────────────────
    currency = request.args.get("currency", "").strip().upper()
    if currency:
        query["data.totals.currency"] = {"$regex": f"^{re.escape(currency)}$", "$options": "i"}

    # ── Date range filter (on invoice date) ────────────────────────────
    date_from = request.args.get("date_from", "").strip()
    date_to = request.args.get("date_to", "").strip()
    if date_from or date_to:
        date_filter = {}
        if date_from:
            date_filter["$gte"] = date_from
        if date_to:
            date_filter["$lte"] = date_to
        query["data.date"] = date_filter

    # ── Amount range filter (grand_total) ──────────────────────────────
    amount_min = request.args.get("amount_min", "").strip()
    amount_max = request.args.get("amount_max", "").strip()
    if amount_min or amount_max:
        amount_filter = {}
        if amount_min:
            try:
                amount_filter["$gte"] = float(amount_min)
            except ValueError:
                pass
        if amount_max:
            try:
                amount_filter["$lte"] = float(amount_max)
            except ValueError:
                pass
        if amount_filter:
            query["data.totals.grand_total"] = amount_filter

    # ── Sorting ────────────────────────────────────────────────────────
    sort_by = request.args.get("sort_by", "created_at").strip()
    order = request.args.get("order", "desc").strip().lower()
    sort_dir = -1 if order == "desc" else 1

    sort_field_map = {
        "created_at": "created_at",
        "date": "data.date",
        "amount": "data.totals.grand_total",
        "vendor": "data.vendor_name",
        "status": "status",
    }
    mongo_sort_field = sort_field_map.get(sort_by, "created_at")

    # ── Pagination ─────────────────────────────────────────────────────
    try:
        page = max(1, int(request.args.get("page", 1)))
    except ValueError:
        page = 1
    try:
        limit = min(100, max(1, int(request.args.get("limit", 50))))
    except ValueError:
        limit = 50

    total = invoices_collection.count_documents(query)
    pages = max(1, (total + limit - 1) // limit)

    cursor = (
        invoices_collection
        .find(query)
        .sort(mongo_sort_field, sort_dir)
        .skip((page - 1) * limit)
        .limit(limit)
    )

    invoices = []
    for doc in cursor:
        invoices.append({
            "id": str(doc["_id"]),
            "user_id": doc.get("user_id"),
            "filename": doc.get("filename"),
            "original_filename": doc.get("original_filename"),
            "status": doc.get("status", "completed"),
            "created_at": doc.get("created_at"),
            "updated_at": doc.get("updated_at"),
            "tags": doc.get("tags", []),
            "data": doc.get("data", {}),
        })

    return jsonify({
        "success": True,
        "count": len(invoices),
        "total": total,
        "page": page,
        "limit": limit,
        "pages": pages,
        "invoices": invoices
    }), 200


@app.route("/api/invoices/filters", methods=["GET"])
@token_required
@org_required
def get_invoice_filters():
    """Return unique vendors, currencies, and statuses for filter dropdowns."""
    query = {"org_id": g.org["org_id"]}

    pipeline = [
        {"$match": query},
        {"$group": {
            "_id": None,
            "vendors": {"$addToSet": "$data.vendor_name"},
            "currencies": {"$addToSet": "$data.totals.currency"},
            "statuses": {"$addToSet": "$status"},
        }},
    ]
    result = list(invoices_collection.aggregate(pipeline))

    if result:
        vendors = sorted([v for v in (result[0].get("vendors") or []) if v])
        currencies = sorted([c for c in (result[0].get("currencies") or []) if c])
        statuses = sorted([s for s in (result[0].get("statuses") or []) if s])
    else:
        vendors, currencies, statuses = [], [], []

    return jsonify({
        "success": True,
        "vendors": vendors,
        "currencies": currencies,
        "statuses": statuses,
    }), 200


@app.route("/api/invoices/<invoice_id>", methods=["GET"])
@token_required
@org_required
def get_invoice_by_id(invoice_id):
    try:
        doc = invoices_collection.find_one({"_id": ObjectId(invoice_id)})
        if not doc:
            return jsonify({
                "success": False,
                "error": "Invoice not found"
            }), 404

        if doc.get("org_id") != g.org["org_id"]:
            return jsonify({
                "success": False,
                "error": "Access denied"
            }), 403

        invoice = {
            "id": str(doc["_id"]),
            "user_id": doc.get("user_id"),
            "filename": doc.get("filename"),
            "original_filename": doc.get("original_filename"),
            "status": doc.get("status", "completed"),
            "created_at": doc.get("created_at"),
            "updated_at": doc.get("updated_at"),
            "tags": doc.get("tags", []),
            "data": doc.get("data", {}),
        }

        return jsonify({
            "success": True,
            "invoice": invoice
        }), 200

    except Exception:
        return jsonify({
            "success": False,
            "error": "Invalid invoice id"
        }), 400


@app.route("/api/invoices/<invoice_id>", methods=["PUT"])
@token_required
@org_required
def update_invoice(invoice_id):
    try:
        doc = invoices_collection.find_one({"_id": ObjectId(invoice_id)})
        if not doc:
            return jsonify({
                "success": False,
                "error": "Invoice not found"
            }), 404

        if doc.get("org_id") != g.org["org_id"]:
            return jsonify({
                "success": False,
                "error": "Access denied"
            }), 403

        body = request.get_json(silent=True) or {}
        update_fields = {}

        if "data" in body:
            update_fields["data"] = body["data"]
        if "tags" in body:
            update_fields["tags"] = body["tags"]
        if "status" in body and body["status"] in (
            "completed", "reviewed", "failed", "paid", "unpaid", "pending"
        ):
            update_fields["status"] = body["status"]

        if not update_fields:
            return jsonify({
                "success": False,
                "error": "No valid fields to update"
            }), 400

        update_fields["updated_at"] = now_iso()

        invoices_collection.update_one(
            {"_id": ObjectId(invoice_id)},
            {"$set": update_fields},
        )

        activity_collection.insert_one({
            "user_id": g.user["user_id"],
            "org_id": g.org["org_id"],
            "action": "update_invoice",
            "timestamp": now_iso(),
            "details": {"invoice_id": invoice_id},
            "ip_address": request.remote_addr or "",
        })

        vendor = doc.get("data", {}).get("vendor_name")
        if "status" in body:
            notify_status_changed(g.user["email"], invoice_id, body["status"], vendor)
        else:
            notify_invoice_updated(g.user["email"], invoice_id, vendor)

        return jsonify({
            "success": True,
            "message": "Invoice updated successfully"
        }), 200

    except Exception:
        return jsonify({
            "success": False,
            "error": "Invalid invoice id"
        }), 400


@app.route("/api/invoices/<invoice_id>", methods=["DELETE"])
@token_required
@org_required
def delete_invoice(invoice_id):
    try:
        doc = invoices_collection.find_one({"_id": ObjectId(invoice_id)})
        if not doc:
            return jsonify({
                "success": False,
                "error": "Invoice not found"
            }), 404

        if doc.get("org_id") != g.org["org_id"]:
            return jsonify({
                "success": False,
                "error": "Access denied"
            }), 403

        invoices_collection.delete_one({"_id": ObjectId(invoice_id)})

        activity_collection.insert_one({
            "user_id": g.user["user_id"],
            "org_id": g.org["org_id"],
            "action": "delete_invoice",
            "timestamp": now_iso(),
            "details": {
                "invoice_id": invoice_id,
                "original_filename": doc.get("original_filename", ""),
            },
            "ip_address": request.remote_addr or "",
        })

        notify_invoice_deleted(g.user["email"], invoice_id, doc.get("original_filename", ""))

        return jsonify({
            "success": True,
            "message": "Invoice deleted successfully"
        }), 200

    except Exception:
        return jsonify({
            "success": False,
            "error": "Invalid invoice id"
        }), 400


@app.route("/api/invoices/<invoice_id>/history", methods=["GET"])
@token_required
@org_required
def get_invoice_history(invoice_id):
    try:
        doc = invoices_collection.find_one({"_id": ObjectId(invoice_id)})
        if not doc:
            return jsonify({"success": False, "error": "Invoice not found"}), 404

        if doc.get("org_id") != g.org["org_id"]:
            return jsonify({"success": False, "error": "Access denied"}), 403

        logs = list(
            activity_collection.find(
                {"details.invoice_id": invoice_id}
            ).sort("timestamp", -1).limit(50)
        )

        history = []
        for log in logs:
            # Resolve user name
            user_doc = users_collection.find_one({"_id": ObjectId(log["user_id"])}) if log.get("user_id") else None
            history.append({
                "id": str(log["_id"]),
                "action": log.get("action", ""),
                "timestamp": log.get("timestamp", ""),
                "user_name": user_doc.get("name", "Unknown") if user_doc else "Unknown",
                "user_email": user_doc.get("email", "") if user_doc else "",
                "details": log.get("details", {}),
                "ip_address": log.get("ip_address", ""),
            })

        return jsonify({
            "success": True,
            "invoice_id": invoice_id,
            "history": history,
        }), 200

    except Exception:
        return jsonify({"success": False, "error": "Invalid invoice id"}), 400


# ── Tunisia 2026 E-Invoicing Compliance Endpoints ──────────────────────────

@app.route("/api/invoices/<invoice_id>/validate", methods=["POST"])
@token_required
@org_required
def validate_invoice_endpoint(invoice_id):
    """Run Tunisia 2026 compliance validation on an invoice."""
    from services.tax_validator import validate_invoice as run_validation
    try:
        doc = invoices_collection.find_one({"_id": ObjectId(invoice_id)})
        if not doc:
            return jsonify({"success": False, "error": "Invoice not found"}), 404
        if doc.get("org_id") != g.org["org_id"]:
            return jsonify({"success": False, "error": "Access denied"}), 403

        data = doc.get("data", {})
        result = run_validation(data)

        # Store result on the invoice
        invoices_collection.update_one(
            {"_id": ObjectId(invoice_id)},
            {"$set": {
                "data.compliance": result,
                "compliance_status": result.get("compliance_status", "non_compliant"),
                "updated_at": now_iso(),
            }},
        )

        activity_collection.insert_one({
            "user_id": g.user["user_id"],
            "org_id": g.org["org_id"],
            "action": "validate_compliance",
            "timestamp": now_iso(),
            "details": {
                "invoice_id": invoice_id,
                "compliance_score": result.get("compliance_score"),
                "is_compliant": result.get("is_compliant"),
            },
            "ip_address": request.remote_addr or "",
        })

        return jsonify({"success": True, "invoice_id": invoice_id, "validation": result}), 200

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400


@app.route("/api/invoices/<invoice_id>/verify-signature", methods=["POST"])
@token_required
@org_required
def verify_signature_endpoint(invoice_id):
    """Verify the digital signature of an XML invoice."""
    from services.signature_validator import validate_xml_signature
    try:
        doc = invoices_collection.find_one({"_id": ObjectId(invoice_id)})
        if not doc:
            return jsonify({"success": False, "error": "Invoice not found"}), 404
        if doc.get("org_id") != g.org["org_id"]:
            return jsonify({"success": False, "error": "Access denied"}), 403

        raw_xml = doc.get("raw_xml")
        if not raw_xml:
            return jsonify({
                "success": False,
                "error": "No XML content available for this invoice. Signature verification requires XML format."
            }), 400

        result = validate_xml_signature(raw_xml)

        # Store result on the invoice
        invoices_collection.update_one(
            {"_id": ObjectId(invoice_id)},
            {"$set": {
                "signature_validation": result,
                "updated_at": now_iso(),
            }},
        )

        return jsonify({"success": True, "invoice_id": invoice_id, "signature": result}), 200

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400


@app.route("/api/invoices/<invoice_id>/submit-ttn", methods=["POST"])
@token_required
@org_required
def submit_to_ttn_endpoint(invoice_id):
    """Submit a validated invoice to the TTN El Fatoora platform."""
    from services.ttn_client import submit_to_ttn
    try:
        doc = invoices_collection.find_one({"_id": ObjectId(invoice_id)})
        if not doc:
            return jsonify({"success": False, "error": "Invoice not found"}), 404
        if doc.get("org_id") != g.org["org_id"]:
            return jsonify({"success": False, "error": "Access denied"}), 403

        # Check if already submitted
        if doc.get("ttn_unique_id"):
            return jsonify({
                "success": False,
                "error": f"Invoice already submitted to TTN (ID: {doc['ttn_unique_id']})",
            }), 409

        result = submit_to_ttn(doc, db)

        if result.success:
            invoices_collection.update_one(
                {"_id": ObjectId(invoice_id)},
                {"$set": {
                    "ttn_unique_id": result.ttn_id,
                    "ttn_submitted": True,
                    "ttn_submission_date": now_iso(),
                    "ttn_status": result.status,
                    "updated_at": now_iso(),
                }},
            )

        activity_collection.insert_one({
            "user_id": g.user["user_id"],
            "org_id": g.org["org_id"],
            "action": "ttn_submission",
            "timestamp": now_iso(),
            "details": {
                "invoice_id": invoice_id,
                "ttn_unique_id": result.ttn_id,
                "status": result.status,
            },
            "ip_address": request.remote_addr or "",
        })

        return jsonify({"success": True, "invoice_id": invoice_id, **result.to_dict()}), 200

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400


@app.route("/api/invoices/<invoice_id>/compliance-report", methods=["GET"])
@token_required
@org_required
def get_compliance_report(invoice_id):
    """Get full compliance report for an invoice (validation + signature + TTN status)."""
    try:
        doc = invoices_collection.find_one({"_id": ObjectId(invoice_id)})
        if not doc:
            return jsonify({"success": False, "error": "Invoice not found"}), 404
        if doc.get("org_id") != g.org["org_id"]:
            return jsonify({"success": False, "error": "Access denied"}), 403

        data = doc.get("data", {})
        report = {
            "invoice_id": invoice_id,
            "source_format": doc.get("source_format", "unknown"),
            "invoice_category": data.get("invoice_category") or doc.get("invoice_category"),
            "compliance": data.get("compliance"),
            "compliance_status": doc.get("compliance_status", "pending_review"),
            "signature": doc.get("signature_validation"),
            "ttn": {
                "submitted": doc.get("ttn_submitted", False),
                "unique_id": doc.get("ttn_unique_id"),
                "submission_date": doc.get("ttn_submission_date"),
                "status": doc.get("ttn_status"),
            },
            "seller_vat_id": data.get("seller_vat_id"),
            "buyer_vat_id": data.get("buyer_vat_id"),
        }

        return jsonify({"success": True, "report": report}), 200

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400


@app.route("/api/stats", methods=["GET"])
@token_required
@org_required
def get_stats():
    from collections import defaultdict

    query = {"org_id": g.org["org_id"]}

    docs = list(invoices_collection.find(query))

    total_invoices = len(docs)
    total_amount = 0
    needs_review = 0

    # Analytics accumulators
    monthly_amounts = defaultdict(float)   # "2026-01" -> total amount
    monthly_counts = defaultdict(int)      # "2026-01" -> invoice count
    vendor_totals = defaultdict(float)     # vendor name -> total amount
    status_counts = defaultdict(int)       # status -> count
    currency_counts = defaultdict(int)     # currency -> count

    for doc in docs:
        data = doc.get("data", {})
        totals_obj = data.get("totals") or {}
        grand_total = totals_obj.get("grand_total")
        review = (data.get("validation") or {}).get("needs_human_review", False)
        status = doc.get("status", "completed")

        status_counts[status] += 1

        if review:
            needs_review += 1

        # Parse month from invoice date or created_at
        inv_date = data.get("date") or (doc.get("created_at") or "")[:10]
        month_key = inv_date[:7] if len(inv_date) >= 7 else "unknown"

        monthly_counts[month_key] += 1

        amount = 0
        if grand_total is not None:
            try:
                amount = float(grand_total)
                total_amount += amount
            except Exception:
                pass

        if amount > 0:
            monthly_amounts[month_key] += amount

        # Vendor breakdown
        vendor = data.get("vendor_name")
        if vendor and amount > 0:
            vendor_totals[vendor] += amount

        # Currency
        currency = totals_obj.get("currency")
        if currency:
            currency_counts[currency] += 1

    # Build sorted monthly series (last 12 months max)
    all_months = sorted(set(list(monthly_amounts.keys()) + list(monthly_counts.keys())))
    all_months = [m for m in all_months if m != "unknown"][-12:]

    monthly_series = []
    for m in all_months:
        monthly_series.append({
            "month": m,
            "amount": round(monthly_amounts.get(m, 0), 2),
            "count": monthly_counts.get(m, 0),
        })

    # Top 6 vendors by total
    sorted_vendors = sorted(vendor_totals.items(), key=lambda x: x[1], reverse=True)[:6]
    vendor_breakdown = [
        {"name": name, "total": round(total, 2)}
        for name, total in sorted_vendors
    ]

    # Status breakdown
    status_breakdown = [
        {"status": s, "count": c}
        for s, c in sorted(status_counts.items())
    ]

    return jsonify({
        "success": True,
        "stats": {
            "total_invoices": total_invoices,
            "total_amount": round(total_amount, 2),
            "needs_review": needs_review,
            "monthly_series": monthly_series,
            "vendor_breakdown": vendor_breakdown,
            "status_breakdown": status_breakdown,
            "currency_counts": dict(currency_counts),
        }
    }), 200


@app.route("/api/activity", methods=["GET"])
@token_required
@org_required
def get_activity():
    query = {"org_id": g.org["org_id"]}

    # Filter by action type
    action = request.args.get("action")
    if action:
        query["action"] = action

    # Filter by date range
    date_from = request.args.get("from")
    date_to = request.args.get("to")
    if date_from or date_to:
        query["timestamp"] = {}
        if date_from:
            query["timestamp"]["$gte"] = date_from
        if date_to:
            query["timestamp"]["$lte"] = date_to + "T23:59:59"

    # Pagination
    page = max(int(request.args.get("page", 1)), 1)
    limit = min(int(request.args.get("limit", 50)), 200)
    skip = (page - 1) * limit

    total = activity_collection.count_documents(query)
    docs = list(
        activity_collection.find(query)
        .sort("timestamp", -1)
        .skip(skip)
        .limit(limit)
    )

    # Resolve user names for admin view
    user_ids = list({doc["user_id"] for doc in docs})
    users_map = {}
    if user_ids:
        for u in users_collection.find(
            {"_id": {"$in": [ObjectId(uid) for uid in user_ids]}},
            {"name": 1, "email": 1},
        ):
            users_map[str(u["_id"])] = {
                "name": u.get("name", ""),
                "email": u.get("email", ""),
            }

    logs = []
    for doc in docs:
        uid = doc.get("user_id", "")
        user_info = users_map.get(uid, {})
        logs.append({
            "id": str(doc["_id"]),
            "user_id": uid,
            "user_name": user_info.get("name", "Unknown"),
            "user_email": user_info.get("email", ""),
            "action": doc.get("action", ""),
            "timestamp": doc.get("timestamp", ""),
            "details": doc.get("details", {}),
            "ip_address": doc.get("ip_address", ""),
        })

    return jsonify({
        "success": True,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit,
        "logs": logs,
    }), 200


# ── Admin User Management ─────────────────────────────────────────────────

def admin_required(f):
    """Decorator that checks g.user exists and is admin."""
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        if g.user.get("role") != "admin":
            return jsonify({"success": False, "error": "Admin access required"}), 403
        return f(*args, **kwargs)
    return decorated


@app.route("/api/admin/users", methods=["GET"])
@token_required
@admin_required
def admin_get_users():
    """List all users with optional search and pagination."""
    import re

    query = {}
    search = request.args.get("search", "").strip()
    if search:
        regex = {"$regex": re.escape(search), "$options": "i"}
        query["$or"] = [
            {"name": regex},
            {"email": regex},
        ]

    role_filter = request.args.get("role", "").strip()
    if role_filter in ("admin", "client"):
        query["role"] = role_filter

    status_filter = request.args.get("status", "").strip()
    if status_filter == "active":
        query["is_active"] = {"$ne": False}
    elif status_filter == "inactive":
        query["is_active"] = False

    page = max(int(request.args.get("page", 1)), 1)
    limit = min(int(request.args.get("limit", 50)), 200)
    skip = (page - 1) * limit

    total = users_collection.count_documents(query)
    docs = list(
        users_collection.find(query, {"password": 0})
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
    )

    users = []
    for doc in docs:
        users.append({
            "id": str(doc["_id"]),
            "name": doc.get("name", ""),
            "email": doc.get("email", ""),
            "role": doc.get("role", "client"),
            "is_active": doc.get("is_active", True),
            "created_at": doc.get("created_at", ""),
            "last_login": doc.get("last_login", ""),
        })

    return jsonify({
        "success": True,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": max(1, (total + limit - 1) // limit),
        "users": users,
    }), 200


@app.route("/api/admin/users", methods=["POST"])
@token_required
@admin_required
def admin_create_user():
    """Create a new user (admin action)."""
    data = request.get_json(silent=True) or {}

    name = data.get("name", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "").strip()
    role = data.get("role", "client").strip().lower()

    if not name or not email or not password:
        return jsonify({"success": False, "error": "name, email and password are required"}), 400

    if role not in ("admin", "client"):
        role = "client"

    if users_collection.find_one({"email": email}):
        return jsonify({"success": False, "error": "Email already exists"}), 409

    user_doc = {
        "name": name,
        "email": email,
        "password": hash_password(password),
        "role": role,
        "is_active": True,
        "created_at": now_iso(),
    }

    result = users_collection.insert_one(user_doc)

    activity_collection.insert_one({
        "user_id": g.user["user_id"],
        "action": "admin_create_user",
        "timestamp": now_iso(),
        "details": {"target_user_id": str(result.inserted_id), "email": email, "role": role},
        "ip_address": request.remote_addr or "",
    })

    return jsonify({
        "success": True,
        "message": "User created successfully",
        "user_id": str(result.inserted_id),
    }), 201


@app.route("/api/admin/users/<user_id>", methods=["PUT"])
@token_required
@admin_required
def admin_update_user(user_id):
    """Update a user's name, email, role, or password."""
    try:
        doc = users_collection.find_one({"_id": ObjectId(user_id)})
        if not doc:
            return jsonify({"success": False, "error": "User not found"}), 404

        data = request.get_json(silent=True) or {}
        update_fields = {}

        name = data.get("name", "").strip()
        if name:
            update_fields["name"] = name

        email = data.get("email", "").strip().lower()
        if email and email != doc.get("email"):
            if users_collection.find_one({"email": email, "_id": {"$ne": ObjectId(user_id)}}):
                return jsonify({"success": False, "error": "Email already in use"}), 409
            update_fields["email"] = email

        role = data.get("role", "").strip().lower()
        if role in ("admin", "client"):
            update_fields["role"] = role

        password = data.get("password", "").strip()
        if password:
            update_fields["password"] = hash_password(password)

        if not update_fields:
            return jsonify({"success": False, "error": "No valid fields to update"}), 400

        update_fields["updated_at"] = now_iso()

        users_collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": update_fields},
        )

        activity_collection.insert_one({
            "user_id": g.user["user_id"],
            "action": "admin_update_user",
            "timestamp": now_iso(),
            "details": {
                "target_user_id": user_id,
                "updated_fields": [k for k in update_fields if k not in ("password", "updated_at")],
            },
            "ip_address": request.remote_addr or "",
        })

        return jsonify({"success": True, "message": "User updated successfully"}), 200

    except Exception:
        return jsonify({"success": False, "error": "Invalid user id"}), 400


@app.route("/api/admin/users/<user_id>/toggle-status", methods=["PUT"])
@token_required
@admin_required
def admin_toggle_user_status(user_id):
    """Activate or deactivate a user."""
    try:
        doc = users_collection.find_one({"_id": ObjectId(user_id)})
        if not doc:
            return jsonify({"success": False, "error": "User not found"}), 404

        # Prevent admin from deactivating themselves
        if user_id == g.user["user_id"]:
            return jsonify({"success": False, "error": "Cannot deactivate your own account"}), 400

        new_status = not doc.get("is_active", True)

        users_collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"is_active": new_status, "updated_at": now_iso()}},
        )

        activity_collection.insert_one({
            "user_id": g.user["user_id"],
            "action": "admin_toggle_user",
            "timestamp": now_iso(),
            "details": {"target_user_id": user_id, "is_active": new_status},
            "ip_address": request.remote_addr or "",
        })

        status_text = "activated" if new_status else "deactivated"
        return jsonify({"success": True, "message": f"User {status_text}", "is_active": new_status}), 200

    except Exception:
        return jsonify({"success": False, "error": "Invalid user id"}), 400


@app.route("/api/admin/users/<user_id>", methods=["DELETE"])
@token_required
@admin_required
def admin_delete_user(user_id):
    """Delete a user permanently."""
    try:
        doc = users_collection.find_one({"_id": ObjectId(user_id)})
        if not doc:
            return jsonify({"success": False, "error": "User not found"}), 404

        if user_id == g.user["user_id"]:
            return jsonify({"success": False, "error": "Cannot delete your own account"}), 400

        users_collection.delete_one({"_id": ObjectId(user_id)})

        activity_collection.insert_one({
            "user_id": g.user["user_id"],
            "action": "admin_delete_user",
            "timestamp": now_iso(),
            "details": {
                "target_user_id": user_id,
                "email": doc.get("email", ""),
                "name": doc.get("name", ""),
            },
            "ip_address": request.remote_addr or "",
        })

        return jsonify({"success": True, "message": "User deleted successfully"}), 200

    except Exception:
        return jsonify({"success": False, "error": "Invalid user id"}), 400


@app.route("/api/export/invoices/excel", methods=["GET"])
@token_required
@org_required
def export_all_invoices_excel():
    query = {"org_id": g.org["org_id"]}

    docs = list(invoices_collection.find(query).sort("_id", -1))
    if not docs:
        return jsonify({"success": False, "error": "No invoices to export"}), 404

    xlsx_bytes = generate_all_invoices_excel(docs)

    from flask import Response
    return Response(
        xlsx_bytes,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=invoices_report.xlsx"},
    )


@app.route("/api/export/invoice/<invoice_id>/excel", methods=["GET"])
@token_required
@org_required
def export_single_invoice_excel(invoice_id):
    try:
        doc = invoices_collection.find_one({"_id": ObjectId(invoice_id)})
        if not doc:
            return jsonify({"success": False, "error": "Invoice not found"}), 404

        if doc.get("org_id") != g.org["org_id"]:
            return jsonify({"success": False, "error": "Access denied"}), 403

        xlsx_bytes = generate_single_invoice_excel(doc)

        inv_no = (doc.get("data") or {}).get("invoice_no") or invoice_id[:8]
        filename = f"invoice_{inv_no}.xlsx"

        from flask import Response
        return Response(
            xlsx_bytes,
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )
    except Exception:
        return jsonify({"success": False, "error": "Invalid invoice id"}), 400


# ── AI Advisor Chat ─────────────────────────────────────────────────────────

_advisor_logger = logging.getLogger("advisor")


def _build_user_data_context(org_id: str) -> str:
    """Build a text summary of the org's invoice data for the LLM system prompt."""
    query = {"org_id": org_id} if org_id else {}
    docs = list(invoices_collection.find(query).sort("created_at", -1).limit(200))

    if not docs:
        return "This user has no invoices in the system yet."

    total_invoices = len(docs)
    total_amount = 0
    needs_review = 0
    vendor_totals = defaultdict(float)
    status_counts = defaultdict(int)
    currency_counts = defaultdict(int)
    monthly_amounts = defaultdict(float)
    monthly_counts = defaultdict(int)
    recent_invoices = []

    for doc in docs:
        data = doc.get("data", {})
        totals_obj = data.get("totals") or {}
        grand_total = totals_obj.get("grand_total")
        review = (data.get("validation") or {}).get("needs_human_review", False)
        status = doc.get("status", "completed")
        status_counts[status] += 1

        if review:
            needs_review += 1

        inv_date = data.get("date") or (doc.get("created_at") or "")[:10]
        month_key = inv_date[:7] if len(inv_date) >= 7 else "unknown"
        monthly_counts[month_key] += 1

        amount = 0
        if grand_total is not None:
            try:
                amount = float(grand_total)
                total_amount += amount
            except Exception:
                pass

        if amount > 0:
            monthly_amounts[month_key] += amount

        vendor = data.get("vendor_name")
        if vendor and amount > 0:
            vendor_totals[vendor] += amount

        currency = totals_obj.get("currency")
        if currency:
            currency_counts[currency] += 1

        # Collect recent invoice summaries (max 20)
        if len(recent_invoices) < 20:
            recent_invoices.append({
                "invoice_no": data.get("invoice_no", "N/A"),
                "vendor": data.get("vendor_name", "Unknown"),
                "date": inv_date,
                "grand_total": grand_total,
                "currency": totals_obj.get("currency", "USD"),
                "status": status,
                "needs_review": review,
                "line_items_count": len(data.get("line_items") or []),
                "payment_method": data.get("payment_method", "N/A"),
            })

    # Top vendors
    sorted_vendors = sorted(vendor_totals.items(), key=lambda x: x[1], reverse=True)[:10]

    # Monthly trend
    sorted_months = sorted([m for m in monthly_amounts.keys() if m != "unknown"])[-6:]

    context = f"""=== USER'S INVOICE DATA SUMMARY ===
Total invoices: {total_invoices}
Total amount: ${total_amount:,.2f}
Invoices needing review: {needs_review}
Statuses: {dict(status_counts)}
Currencies used: {dict(currency_counts)}

Top vendors by spend:
{chr(10).join(f"  - {name}: ${total:,.2f}" for name, total in sorted_vendors)}

Monthly trend (recent):
{chr(10).join(f"  - {m}: ${monthly_amounts.get(m, 0):,.2f} ({monthly_counts.get(m, 0)} invoices)" for m in sorted_months)}

Recent invoices (newest first):
"""
    for inv in recent_invoices:
        context += f"  - #{inv['invoice_no']} | {inv['vendor']} | {inv['date']} | {inv['currency']} {inv['grand_total']} | Status: {inv['status']} | Review: {inv['needs_review']} | Items: {inv['line_items_count']} | Payment: {inv['payment_method']}\n"

    return context


_ADVISOR_SYSTEM_PROMPT = """You are an intelligent AI Financial Advisor for an invoice management system. You have access to the user's real invoice data provided below.

Your capabilities:
- Analyze the user's invoices, expenses, and spending patterns
- Provide financial insights, trends, and recommendations
- Answer questions about specific invoices, vendors, or time periods
- Suggest cost optimizations and budgeting strategies
- Help with financial forecasting based on historical data
- Explain invoice statuses, review needs, and data quality

Guidelines:
- Always base your answers on the REAL data provided below. Never make up numbers.
- If the data is insufficient to answer a question, say so honestly.
- Be concise but thorough. Use bullet points and formatting for clarity.
- When mentioning amounts, always include the currency.
- If the user asks about something outside of invoice/financial data, politely redirect.
- Be professional, helpful, and proactive in offering insights.

{user_data}
"""


def _chat_with_ollama(messages: list) -> str:
    """Send chat messages to Ollama and return the response."""
    import requests
    body = {
        "model": OLLAMA_MODEL,
        "messages": messages,
        "stream": False,
        "options": {"temperature": 0.7, "num_predict": 1024},
    }
    response = requests.post(f"{OLLAMA_URL}/api/chat", json=body, timeout=120)
    response.raise_for_status()
    return response.json()["message"]["content"]


def _chat_with_groq(messages: list) -> str:
    """Send chat messages to Groq and return the response."""
    from services.extractor_core import _get_groq_client
    client = _get_groq_client()
    if client is None:
        raise RuntimeError("GROQ_API_KEY not configured")

    response = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=messages,
        temperature=0.7,
        max_tokens=1024,
    )
    return response.choices[0].message.content


@app.route("/api/advisor/chat", methods=["POST"])
@token_required
@org_required
def advisor_chat():
    body = request.get_json(silent=True) or {}
    message = body.get("message", "").strip()
    history = body.get("history", [])  # [{role, content}, ...]

    if not message:
        return jsonify({"success": False, "error": "Message is required"}), 400

    try:
        # Build context from user's real data
        user_data = _build_user_data_context(g.org["org_id"])
        system_prompt = _ADVISOR_SYSTEM_PROMPT.format(user_data=user_data)

        # Build message list: system + history + new user message
        messages = [{"role": "system", "content": system_prompt}]

        # Add conversation history (limit to last 10 exchanges to stay within context)
        for msg in history[-20:]:
            if msg.get("role") in ("user", "assistant"):
                messages.append({"role": msg["role"], "content": msg["content"]})

        messages.append({"role": "user", "content": message})

        # Try Ollama first, then Groq
        reply = None
        model_used = None
        errors = []

        try:
            _advisor_logger.info("Advisor chat via Ollama (%s)", OLLAMA_MODEL)
            reply = _chat_with_ollama(messages)
            model_used = OLLAMA_MODEL
        except Exception as e:
            errors.append(f"Ollama: {e}")
            _advisor_logger.warning("Ollama failed for advisor: %s, trying Groq...", e)

        if reply is None:
            try:
                _advisor_logger.info("Advisor chat via Groq (%s)", GROQ_MODEL)
                reply = _chat_with_groq(messages)
                model_used = GROQ_MODEL
            except Exception as e:
                errors.append(f"Groq: {e}")
                _advisor_logger.error("All LLMs failed for advisor: %s", errors)

        if reply is None:
            return jsonify({
                "success": False,
                "error": "AI service is currently unavailable. Please try again later.",
                "details": errors,
            }), 503

        # Log the advisor interaction
        activity_collection.insert_one({
            "user_id": g.user["user_id"],
            "org_id": g.org["org_id"],
            "action": "advisor_chat",
            "timestamp": now_iso(),
            "details": {"question_length": len(message), "model": model_used},
            "ip_address": request.remote_addr or "unknown",
        })

        return jsonify({
            "success": True,
            "reply": reply,
            "model": model_used,
        }), 200

    except Exception as e:
        _advisor_logger.exception("Advisor chat error")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/debug/llm", methods=["POST"])
@token_required
def debug_llm():
    """Debug endpoint: send raw text and see what the LLM returns."""
    data = request.get_json(silent=True) or {}
    text = data.get("text", "").strip()
    if not text:
        return jsonify({"success": False, "error": "Provide a 'text' field"}), 400

    from services.extractor_core import _extract_with_ollama, _extract_with_groq
    from config import OLLAMA_MODEL, GROQ_MODEL

    results = {}

    try:
        results["ollama"] = {"status": "ok", "data": _extract_with_ollama(text)}
    except Exception as e:
        results["ollama"] = {"status": "error", "error": f"{type(e).__name__}: {e}"}

    try:
        results["groq"] = {"status": "ok", "data": _extract_with_groq(text)}
    except Exception as e:
        results["groq"] = {"status": "error", "error": f"{type(e).__name__}: {e}"}

    return jsonify({"success": True, "models_tested": results}), 200


@app.route("/api/debug/ocr", methods=["POST"])
@token_required
def debug_ocr():
    """Debug endpoint: upload an image/PDF and see the raw OCR output."""
    if "file" not in request.files:
        return jsonify({"success": False, "error": "No file provided"}), 400

    file = request.files["file"]
    filename = secure_filename(file.filename)
    file_path = os.path.join(UPLOAD_FOLDER, f"debug_{filename}")
    file.save(file_path)

    result = {"engine": "PaddleOCR", "text": None, "chars": 0, "error": None}

    try:
        from services.image_service import extract_text_from_image
        text = extract_text_from_image(file_path)
        result["text"]  = text[:1000]
        result["chars"] = len(text)
    except Exception as e:
        result["error"] = f"{type(e).__name__}: {e}"
    finally:
        try:
            os.remove(file_path)
        except Exception:
            pass

    return jsonify({"success": True, "ocr_debug": result}), 200


if __name__ == "__main__":
    debug = os.getenv("FLASK_DEBUG", "true").lower() == "true"
    app.run(host="0.0.0.0", port=PORT, debug=debug)
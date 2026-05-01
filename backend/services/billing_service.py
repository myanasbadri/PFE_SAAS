"""
Stripe Billing Service for SmartInvoice SaaS.
Handles checkout sessions, customer portal, webhooks, and usage tracking.
"""

import logging
from datetime import datetime
from bson import ObjectId
from flask import Blueprint, request, jsonify, g

from services.auth_service import token_required
from services.org_service import org_required, org_admin_required
from services.plan_limits import PLAN_LIMITS, PLAN_PRICES

logger = logging.getLogger(__name__)

billing_bp = Blueprint("billing", __name__)


def _now_iso() -> str:
    return datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.000Z")


def _get_stripe():
    """Lazy import stripe — returns None if not configured."""
    try:
        import stripe
        from config import STRIPE_SECRET_KEY
        if not STRIPE_SECRET_KEY:
            return None
        stripe.api_key = STRIPE_SECRET_KEY
        return stripe
    except ImportError:
        logger.warning("stripe package not installed. Run: pip install stripe")
        return None


def register_billing_routes(app, db):
    """Register billing Blueprint with Flask app."""

    # ── Get billing info ─────────────────────────────────────────────
    @billing_bp.route("/api/orgs/<org_id>/billing", methods=["GET"])
    @token_required
    @org_required
    def get_billing(org_id):
        org = db["organizations"].find_one({"_id": ObjectId(org_id)})
        if not org:
            return jsonify({"success": False, "error": "Organization not found"}), 404

        plan = org.get("plan", "free")
        usage = org.get("usage", {})
        limits = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])
        prices = PLAN_PRICES.get(plan, PLAN_PRICES["free"])

        # Get subscription status from Stripe if available
        subscription_status = None
        stripe = _get_stripe()
        sub_id = org.get("stripe_subscription_id")
        if stripe and sub_id:
            try:
                sub = stripe.Subscription.retrieve(sub_id)
                subscription_status = {
                    "status": sub.status,
                    "current_period_end": datetime.fromtimestamp(sub.current_period_end).isoformat(),
                    "cancel_at_period_end": sub.cancel_at_period_end,
                }
            except Exception as e:
                logger.warning("Failed to fetch Stripe subscription: %s", e)

        return jsonify({
            "success": True,
            "billing": {
                "plan": plan,
                "prices": prices,
                "usage": {
                    "invoices": {
                        "used": usage.get("invoices_this_month", 0),
                        "limit": limits.get("max_invoices_per_month", 0),
                    },
                    "members": {
                        "used": usage.get("members_count", 0),
                        "limit": limits.get("max_members", 0),
                    },
                    "ai_queries": {
                        "used": usage.get("ai_queries_this_month", 0),
                        "limit": limits.get("max_ai_queries_per_month", 0),
                    },
                    "storage_mb": {
                        "used": round(usage.get("storage_bytes", 0) / (1024 * 1024), 1),
                        "limit": limits.get("max_storage_mb", 0),
                    },
                },
                "features": limits.get("features", []),
                "subscription": subscription_status,
                "stripe_customer_id": org.get("stripe_customer_id"),
            },
        }), 200

    # ── Get all plans ────────────────────────────────────────────────
    @billing_bp.route("/api/plans", methods=["GET"])
    def get_plans():
        """Public endpoint: return all available plans."""
        plans = []
        for plan_key, limits in PLAN_LIMITS.items():
            prices = PLAN_PRICES.get(plan_key, {})
            plans.append({
                "key": plan_key,
                "limits": limits,
                "prices": prices,
            })
        return jsonify({"success": True, "plans": plans}), 200

    # ── Create Stripe checkout session ───────────────────────────────
    @billing_bp.route("/api/orgs/<org_id>/billing/checkout", methods=["POST"])
    @token_required
    @org_required
    @org_admin_required
    def create_checkout(org_id):
        stripe = _get_stripe()
        if not stripe:
            return jsonify({"success": False, "error": "Stripe is not configured"}), 503

        data = request.get_json(silent=True) or {}
        plan = data.get("plan", "pro")
        billing_period = data.get("period", "monthly")  # monthly or yearly

        if plan not in ("pro", "enterprise"):
            return jsonify({"success": False, "error": "Invalid plan"}), 400

        from config import STRIPE_PRICE_PRO, STRIPE_PRICE_ENTERPRISE, APP_URL

        price_map = {
            "pro": STRIPE_PRICE_PRO,
            "enterprise": STRIPE_PRICE_ENTERPRISE,
        }

        price_id = price_map.get(plan)
        if not price_id:
            return jsonify({"success": False, "error": f"Stripe price not configured for {plan}"}), 503

        org = db["organizations"].find_one({"_id": ObjectId(org_id)})

        # Create or reuse Stripe customer
        customer_id = org.get("stripe_customer_id")
        if not customer_id:
            customer = stripe.Customer.create(
                email=g.user["email"],
                name=org.get("name", ""),
                metadata={"org_id": org_id},
            )
            customer_id = customer.id
            db["organizations"].update_one(
                {"_id": ObjectId(org_id)},
                {"$set": {"stripe_customer_id": customer_id}},
            )

        try:
            session = stripe.checkout.Session.create(
                customer=customer_id,
                payment_method_types=["card"],
                line_items=[{"price": price_id, "quantity": 1}],
                mode="subscription",
                success_url=f"{APP_URL}/settings?billing=success",
                cancel_url=f"{APP_URL}/settings?billing=cancelled",
                metadata={"org_id": org_id, "plan": plan},
            )

            return jsonify({
                "success": True,
                "checkout_url": session.url,
                "session_id": session.id,
            }), 200

        except Exception as e:
            logger.error("Stripe checkout error: %s", e)
            return jsonify({"success": False, "error": str(e)}), 500

    # ── Create Stripe customer portal session ────────────────────────
    @billing_bp.route("/api/orgs/<org_id>/billing/portal", methods=["POST"])
    @token_required
    @org_required
    @org_admin_required
    def create_portal(org_id):
        stripe = _get_stripe()
        if not stripe:
            return jsonify({"success": False, "error": "Stripe is not configured"}), 503

        org = db["organizations"].find_one({"_id": ObjectId(org_id)})
        customer_id = org.get("stripe_customer_id")

        if not customer_id:
            return jsonify({"success": False, "error": "No billing account found. Subscribe first."}), 400

        from config import APP_URL

        try:
            session = stripe.billing_portal.Session.create(
                customer=customer_id,
                return_url=f"{APP_URL}/settings",
            )
            return jsonify({"success": True, "portal_url": session.url}), 200
        except Exception as e:
            logger.error("Stripe portal error: %s", e)
            return jsonify({"success": False, "error": str(e)}), 500

    # ── Stripe webhook ───────────────────────────────────────────────
    @billing_bp.route("/api/webhooks/stripe", methods=["POST"])
    def stripe_webhook():
        stripe = _get_stripe()
        if not stripe:
            return jsonify({"error": "Stripe not configured"}), 503

        from config import STRIPE_WEBHOOK_SECRET

        payload = request.get_data()
        sig_header = request.headers.get("Stripe-Signature", "")

        try:
            if STRIPE_WEBHOOK_SECRET:
                event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
            else:
                import json
                event = json.loads(payload)
        except Exception as e:
            logger.error("Webhook signature verification failed: %s", e)
            return jsonify({"error": "Invalid signature"}), 400

        event_type = event.get("type", "")
        data_obj = event.get("data", {}).get("object", {})

        if event_type == "checkout.session.completed":
            _handle_checkout_completed(db, data_obj)

        elif event_type == "customer.subscription.updated":
            _handle_subscription_updated(db, data_obj)

        elif event_type == "customer.subscription.deleted":
            _handle_subscription_deleted(db, data_obj)

        elif event_type == "invoice.payment_failed":
            _handle_payment_failed(db, data_obj)

        return jsonify({"received": True}), 200

    app.register_blueprint(billing_bp)
    logger.info("Billing routes registered")
    return billing_bp


# ── Webhook Handlers ─────────────────────────────────────────────────────────

def _handle_checkout_completed(db, session):
    """Handle successful Stripe checkout."""
    org_id = (session.get("metadata") or {}).get("org_id")
    plan = (session.get("metadata") or {}).get("plan", "pro")
    subscription_id = session.get("subscription")
    customer_id = session.get("customer")

    if not org_id:
        logger.warning("Checkout completed but no org_id in metadata")
        return

    update = {
        "plan": plan,
        "stripe_subscription_id": subscription_id,
        "updated_at": _now_iso(),
    }
    if customer_id:
        update["stripe_customer_id"] = customer_id

    db["organizations"].update_one(
        {"_id": ObjectId(org_id)},
        {"$set": update},
    )
    logger.info("Org %s upgraded to %s plan", org_id, plan)


def _handle_subscription_updated(db, subscription):
    """Handle subscription changes (upgrade/downgrade)."""
    customer_id = subscription.get("customer")
    if not customer_id:
        return

    org = db["organizations"].find_one({"stripe_customer_id": customer_id})
    if not org:
        return

    # Determine plan from price
    items = subscription.get("items", {}).get("data", [])
    price_id = items[0].get("price", {}).get("id") if items else None

    from config import STRIPE_PRICE_PRO, STRIPE_PRICE_ENTERPRISE

    plan = "free"
    if price_id == STRIPE_PRICE_PRO:
        plan = "pro"
    elif price_id == STRIPE_PRICE_ENTERPRISE:
        plan = "enterprise"

    db["organizations"].update_one(
        {"_id": org["_id"]},
        {"$set": {
            "plan": plan,
            "stripe_subscription_id": subscription.get("id"),
            "updated_at": _now_iso(),
        }},
    )
    logger.info("Org %s subscription updated to %s", str(org["_id"]), plan)


def _handle_subscription_deleted(db, subscription):
    """Handle subscription cancellation — downgrade to free."""
    customer_id = subscription.get("customer")
    if not customer_id:
        return

    org = db["organizations"].find_one({"stripe_customer_id": customer_id})
    if not org:
        return

    db["organizations"].update_one(
        {"_id": org["_id"]},
        {"$set": {
            "plan": "free",
            "stripe_subscription_id": None,
            "updated_at": _now_iso(),
        }},
    )
    logger.info("Org %s downgraded to free (subscription cancelled)", str(org["_id"]))


def _handle_payment_failed(db, invoice):
    """Handle failed payment — notify org admins."""
    customer_id = invoice.get("customer")
    if not customer_id:
        return

    org = db["organizations"].find_one({"stripe_customer_id": customer_id})
    if not org:
        return

    logger.warning("Payment failed for org %s", str(org["_id"]))

    # Send notification to org admins
    try:
        from services.notification_system_backend import get_notification_service
        ns = get_notification_service()
        if ns:
            ns.admin_broadcast(
                title="Payment Failed",
                message="Your subscription payment failed. Please update your payment method to avoid service interruption.",
                priority="high",
            )
    except Exception as e:
        logger.error("Failed to send payment failure notification: %s", e)

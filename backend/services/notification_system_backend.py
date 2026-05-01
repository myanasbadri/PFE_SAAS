"""
=============================================================================
  MULTI-CHANNEL NOTIFICATION SYSTEM — Backend
  For: SmartInvoice AI (Flask / pymongo / Celery / Redis)
=============================================================================

Architecture:
  Invoice Extraction  ──►  NotificationService (orchestrator)
                              ├── In-App   (MongoDB collection)
                              ├── Email    (Gmail SMTP)
                              └── SMS      (Twilio API)

  Celery worker handles async delivery so the main request is never blocked.

Integration:
  from services.notification_system_backend import notification_bp, ns
  app.register_blueprint(notification_bp)
  # then call  ns.notify_extraction_completed(...)  from your routes

=============================================================================
"""

import logging
import smtplib
import hashlib
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
from functools import wraps

from bson import ObjectId
from flask import Blueprint, request, jsonify, g
from pymongo import ASCENDING, DESCENDING

from config import (
    SMTP_EMAIL, SMTP_PASSWORD, SMTP_HOST, SMTP_PORT,
    TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER,
    APP_URL,
)

logger = logging.getLogger("notification_system")

# ═══════════════════════════════════════════════════════════════════════════
# PART 1 — MongoDB Collections & Indexes
# ═══════════════════════════════════════════════════════════════════════════

def init_notification_collections(db):
    """
    Create or retrieve notification collections and build indexes.
    Call once at app startup:
        from services.notification_system_backend import init_notification_collections
        init_notification_collections(db)
    """

    # ── notifications ─────────────────────────────────────────────────
    notif = db["notifications"]
    notif.create_index([("user_id", ASCENDING), ("created_at", DESCENDING)], name="idx_user_created")
    notif.create_index([("user_id", ASCENDING), ("is_read", ASCENDING)], name="idx_user_unread")
    notif.create_index([("category", ASCENDING)], name="idx_category")
    notif.create_index([("created_at", ASCENDING)], name="idx_ttl_90d", expireAfterSeconds=90 * 86400)

    # ── notification_preferences ──────────────────────────────────────
    prefs = db["notification_preferences"]
    prefs.create_index([("user_id", ASCENDING)], unique=True, name="idx_user_prefs")

    # ── notification_templates ────────────────────────────────────────
    tmpls = db["notification_templates"]
    tmpls.create_index([("key", ASCENDING)], unique=True, name="idx_template_key")

    # Seed default templates if empty
    if tmpls.count_documents({}) == 0:
        tmpls.insert_many(DEFAULT_TEMPLATES)

    return notif, prefs, tmpls


# ── Default notification templates ────────────────────────────────────────

DEFAULT_TEMPLATES = [
    {
        "key": "extraction_started",
        "title": "Extraction Started",
        "body": "AI extraction has started for <b>{invoice_name}</b>.",
        "category": "extraction",
        "channels": ["in_app"],
    },
    {
        "key": "extraction_completed",
        "title": "Extraction Complete",
        "body": "Invoice <b>{invoice_name}</b> extracted successfully. Confidence: {confidence}%.",
        "category": "extraction",
        "channels": ["in_app", "email"],
    },
    {
        "key": "extraction_failed",
        "title": "Extraction Failed",
        "body": "Failed to extract <b>{invoice_name}</b>. Error: {error_msg}",
        "category": "extraction",
        "channels": ["in_app", "email"],
    },
    {
        "key": "invoice_created",
        "title": "Invoice Created",
        "body": "New invoice from <b>{vendor_name}</b> has been created.",
        "category": "invoice",
        "channels": ["in_app"],
    },
    {
        "key": "invoice_updated",
        "title": "Invoice Updated",
        "body": "Invoice from <b>{vendor_name}</b> was updated.",
        "category": "invoice",
        "channels": ["in_app"],
    },
    {
        "key": "invoice_deleted",
        "title": "Invoice Deleted",
        "body": "Invoice <b>{filename}</b> was deleted.",
        "category": "invoice",
        "channels": ["in_app"],
    },
    {
        "key": "status_changed",
        "title": "Status Changed",
        "body": "<b>{vendor_name}</b> status changed to <b>{new_status}</b>.",
        "category": "invoice",
        "channels": ["in_app"],
    },
    {
        "key": "needs_review",
        "title": "Review Required",
        "body": "<b>{vendor_name}</b> needs human review — low confidence fields.",
        "category": "review",
        "channels": ["in_app", "email"],
    },
    {
        "key": "batch_complete",
        "title": "Batch Processing Complete",
        "body": "Batch done: <b>{successful}/{total}</b> succeeded, <b>{failed}</b> failed.",
        "category": "extraction",
        "channels": ["in_app", "email"],
    },
    {
        "key": "admin_broadcast",
        "title": "{title}",
        "body": "{message}",
        "category": "system",
        "channels": ["in_app", "email"],
    },
    {
        "key": "daily_digest",
        "title": "Daily Digest",
        "body": "You had {count} new invoices processed yesterday totaling {amount}.",
        "category": "system",
        "channels": ["email"],
    },
]

# Default preferences for a new user
DEFAULT_PREFERENCES = {
    "channels": {
        "in_app": True,
        "email": True,
        "sms": False,
    },
    "types": {
        "extraction": True,
        "invoice": True,
        "review": True,
        "system": True,
    },
    "quiet_hours": {
        "enabled": False,
        "start": "22:00",
        "end": "08:00",
        "timezone": "UTC",
    },
    "digest": {
        "enabled": False,
        "frequency": "daily",
        "time": "09:00",
    },
}


# ═══════════════════════════════════════════════════════════════════════════
# PART 2 — Email Service (Gmail SMTP)
# ═══════════════════════════════════════════════════════════════════════════

class EmailService:
    """Send HTML emails via Gmail SMTP."""

    # ── Base HTML template ────────────────────────────────────────────

    BASE_HTML = """\
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:32px 0;">
<tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
    <!-- Header -->
    <tr>
      <td style="background:linear-gradient(135deg,#0A2540 0%,#10B981 100%);padding:28px 32px;">
        <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">SmartInvoice AI</h1>
        <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">{subtitle}</p>
      </td>
    </tr>
    <!-- Body -->
    <tr>
      <td style="padding:32px;">
        <h2 style="margin:0 0 16px;color:#0A2540;font-size:20px;">{title}</h2>
        <div style="color:#4a5568;font-size:15px;line-height:1.7;">{content}</div>
        {action_block}
      </td>
    </tr>
    <!-- Footer -->
    <tr>
      <td style="padding:20px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;">
        <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">
          This is an automated notification from SmartInvoice AI.<br>
          <a href="{app_url}/notifications/preferences" style="color:#10B981;text-decoration:none;">Manage preferences</a>
        </p>
      </td>
    </tr>
  </table>
</td></tr>
</table>
</body>
</html>"""

    ACTION_BUTTON = """\
<div style="text-align:center;margin:28px 0 8px;">
  <a href="{url}" style="display:inline-block;background:#10B981;color:#ffffff;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;">
    {label}
  </a>
</div>"""

    @classmethod
    def _build_html(cls, title: str, content: str, subtitle: str = "Notification",
                    action_url: str = "", action_label: str = "") -> str:
        action_block = ""
        if action_url and action_label:
            action_block = cls.ACTION_BUTTON.format(url=action_url, label=action_label)
        return cls.BASE_HTML.format(
            title=title,
            subtitle=subtitle,
            content=content,
            action_block=action_block,
            app_url=APP_URL,
        )

    @staticmethod
    def send_email(to_emails: list[str], subject: str, html_body: str) -> bool:
        """Send an HTML email to one or more recipients. Returns True on success."""
        if not SMTP_EMAIL or not SMTP_PASSWORD:
            logger.warning("SMTP not configured — email skipped")
            return False
        if not to_emails:
            return False

        try:
            msg = MIMEMultipart("alternative")
            msg["From"] = f"SmartInvoice AI <{SMTP_EMAIL}>"
            msg["To"] = ", ".join(to_emails)
            msg["Subject"] = subject
            msg.attach(MIMEText(html_body, "html"))

            with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
                server.starttls()
                server.login(SMTP_EMAIL, SMTP_PASSWORD)
                server.sendmail(SMTP_EMAIL, to_emails, msg.as_string())

            logger.info("Email sent to %s: %s", to_emails, subject)
            return True
        except Exception as exc:
            logger.error("Email send failed: %s", exc)
            return False

    # ── Pre-built emails ──────────────────────────────────────────────

    @classmethod
    def send_extraction_complete(cls, to: list[str], invoice_name: str,
                                  invoice_id: str, confidence: int = 0):
        html = cls._build_html(
            title="Extraction Complete",
            subtitle="AI Extraction Result",
            content=f"""
            <p>Great news! The AI extraction for <b>{invoice_name}</b> has completed successfully.</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0;">
              <tr style="background:#f0fdf4;">
                <td style="padding:10px 14px;border:1px solid #d1fae5;font-weight:600;color:#065f46;">Status</td>
                <td style="padding:10px 14px;border:1px solid #d1fae5;color:#065f46;">Completed</td>
              </tr>
              <tr>
                <td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:600;">Invoice</td>
                <td style="padding:10px 14px;border:1px solid #e5e7eb;">{invoice_name}</td>
              </tr>
              <tr>
                <td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:600;">Confidence</td>
                <td style="padding:10px 14px;border:1px solid #e5e7eb;">{confidence}%</td>
              </tr>
            </table>
            """,
            action_url=f"{APP_URL}/invoices",
            action_label="View Invoice",
        )
        cls.send_email(to, f"[SmartInvoice] Extraction Complete — {invoice_name}", html)

    @classmethod
    def send_extraction_failed(cls, to: list[str], invoice_name: str, error_msg: str):
        html = cls._build_html(
            title="Extraction Failed",
            subtitle="AI Extraction Error",
            content=f"""
            <p>Unfortunately, the AI extraction for <b>{invoice_name}</b> has failed.</p>
            <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:14px;margin:16px 0;">
              <p style="margin:0;color:#991b1b;font-size:14px;"><b>Error:</b> {error_msg}</p>
            </div>
            <p>You can try uploading the file again or contact support if the issue persists.</p>
            """,
            action_url=f"{APP_URL}/extraction",
            action_label="Try Again",
        )
        cls.send_email(to, f"[SmartInvoice] Extraction Failed — {invoice_name}", html)

    @classmethod
    def send_needs_review(cls, to: list[str], invoice_name: str, invoice_id: str):
        html = cls._build_html(
            title="Review Required",
            subtitle="Human Review Needed",
            content=f"""
            <p>Invoice <b>{invoice_name}</b> has been flagged for human review.</p>
            <p>Some extracted fields have low confidence scores. Please review and correct any inaccuracies.</p>
            """,
            action_url=f"{APP_URL}/invoices",
            action_label="Review Now",
        )
        cls.send_email(to, f"[SmartInvoice] Review Required — {invoice_name}", html)

    @classmethod
    def send_admin_broadcast(cls, to: list[str], title: str, message: str):
        html = cls._build_html(
            title=title,
            subtitle="Admin Broadcast",
            content=f"<p>{message}</p>",
            action_url=APP_URL,
            action_label="Open Dashboard",
        )
        cls.send_email(to, f"[SmartInvoice] {title}", html)

    @classmethod
    def send_daily_digest(cls, to: list[str], stats: dict):
        count = stats.get("count", 0)
        amount = stats.get("amount", 0)
        review = stats.get("needs_review", 0)
        html = cls._build_html(
            title="Your Daily Digest",
            subtitle="Daily Summary",
            content=f"""
            <p>Here is your activity summary for yesterday:</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0;">
              <tr style="background:#f0f9ff;">
                <td style="padding:10px 14px;border:1px solid #bae6fd;font-weight:600;">Invoices Processed</td>
                <td style="padding:10px 14px;border:1px solid #bae6fd;">{count}</td>
              </tr>
              <tr>
                <td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:600;">Total Amount</td>
                <td style="padding:10px 14px;border:1px solid #e5e7eb;">${amount:,.2f}</td>
              </tr>
              <tr>
                <td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:600;">Needs Review</td>
                <td style="padding:10px 14px;border:1px solid #e5e7eb;">{review}</td>
              </tr>
            </table>
            """,
            action_url=f"{APP_URL}/dashboard",
            action_label="View Dashboard",
        )
        cls.send_email(to, "[SmartInvoice] Your Daily Digest", html)

    @classmethod
    def send_client_invoice_ready(cls, to: list[str], invoice_name: str,
                                   vendor_name: str, amount: str):
        """Email for external clients when their invoice is ready."""
        html = cls._build_html(
            title="Your Invoice is Ready",
            subtitle="Invoice Notification",
            content=f"""
            <p>Hello,</p>
            <p>An invoice from <b>{vendor_name}</b> has been processed and is ready for your review.</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0;">
              <tr>
                <td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:600;">Invoice</td>
                <td style="padding:10px 14px;border:1px solid #e5e7eb;">{invoice_name}</td>
              </tr>
              <tr>
                <td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:600;">Amount</td>
                <td style="padding:10px 14px;border:1px solid #e5e7eb;">{amount}</td>
              </tr>
            </table>
            """,
        )
        cls.send_email(to, f"[SmartInvoice] Invoice Ready — {vendor_name}", html)


# ═══════════════════════════════════════════════════════════════════════════
# PART 3 — SMS Service (Twilio)
# ═══════════════════════════════════════════════════════════════════════════

class SMSService:
    """Send SMS notifications via the Twilio API."""

    _client = None

    @classmethod
    def _get_client(cls):
        if cls._client is None:
            if not TWILIO_ACCOUNT_SID or not TWILIO_AUTH_TOKEN:
                return None
            try:
                from twilio.rest import Client
                cls._client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
            except ImportError:
                logger.warning("twilio package not installed — SMS disabled")
                return None
        return cls._client

    @classmethod
    def send_sms(cls, to_number: str, message: str) -> bool:
        """Send an SMS. Returns True on success."""
        client = cls._get_client()
        if not client or not TWILIO_PHONE_NUMBER:
            logger.warning("Twilio not configured — SMS skipped")
            return False
        try:
            msg = client.messages.create(
                body=message,
                from_=TWILIO_PHONE_NUMBER,
                to=to_number,
            )
            logger.info("SMS sent to %s (sid=%s)", to_number, msg.sid)
            return True
        except Exception as exc:
            logger.error("SMS send failed: %s", exc)
            return False

    @classmethod
    def send_extraction_complete(cls, to_number: str, invoice_name: str):
        cls.send_sms(to_number,
            f"[SmartInvoice] Extraction complete for '{invoice_name}'. "
            f"Log in to review: {APP_URL}/invoices")

    @classmethod
    def send_extraction_failed(cls, to_number: str, invoice_name: str):
        cls.send_sms(to_number,
            f"[SmartInvoice] Extraction failed for '{invoice_name}'. "
            f"Please retry or contact support.")


# ═══════════════════════════════════════════════════════════════════════════
# PART 4 — NotificationService Orchestrator
# ═══════════════════════════════════════════════════════════════════════════

class NotificationService:
    """
    Central orchestrator that creates in-app notifications,
    checks user preferences & quiet hours, then dispatches
    to email / SMS via Celery (or synchronously as fallback).
    """

    def __init__(self, db):
        self.db = db
        self.notifications = db["notifications"]
        self.preferences = db["notification_preferences"]
        self.templates = db["notification_templates"]
        self.users = db["users"]

    # ── helpers ────────────────────────────────────────────────────────

    @staticmethod
    def _now() -> str:
        return datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

    def _get_user(self, user_id: str) -> dict | None:
        try:
            return self.users.find_one({"_id": ObjectId(user_id)})
        except Exception:
            return None

    def _get_admin_emails(self) -> list[str]:
        admins = self.users.find({"role": "admin", "is_active": {"$ne": False}}, {"email": 1})
        return [a["email"] for a in admins if a.get("email")]

    def _get_admin_ids(self) -> list[str]:
        admins = self.users.find({"role": "admin", "is_active": {"$ne": False}}, {"_id": 1})
        return [str(a["_id"]) for a in admins]

    def _get_prefs(self, user_id: str) -> dict:
        doc = self.preferences.find_one({"user_id": user_id})
        if doc:
            return doc
        # Create default prefs
        prefs = {"user_id": user_id, **DEFAULT_PREFERENCES, "created_at": self._now()}
        self.preferences.insert_one(prefs)
        return prefs

    def _is_quiet_hours(self, prefs: dict) -> bool:
        qh = prefs.get("quiet_hours", {})
        if not qh.get("enabled"):
            return False
        try:
            now = datetime.utcnow()
            start_h, start_m = map(int, qh.get("start", "22:00").split(":"))
            end_h, end_m = map(int, qh.get("end", "08:00").split(":"))
            current_minutes = now.hour * 60 + now.minute
            start_minutes = start_h * 60 + start_m
            end_minutes = end_h * 60 + end_m

            if start_minutes > end_minutes:  # overnight (e.g. 22:00 → 08:00)
                return current_minutes >= start_minutes or current_minutes < end_minutes
            else:
                return start_minutes <= current_minutes < end_minutes
        except Exception:
            return False

    def _channel_enabled(self, prefs: dict, channel: str) -> bool:
        return prefs.get("channels", {}).get(channel, channel == "in_app")

    def _type_enabled(self, prefs: dict, category: str) -> bool:
        return prefs.get("types", {}).get(category, True)

    # ── Core: create & deliver ────────────────────────────────────────

    def create_notification(
        self,
        user_id: str,
        title: str,
        content: str,
        category: str = "system",
        action_url: str = "",
        channels: list[str] | None = None,
        email_subject: str = "",
        email_html: str = "",
        sms_text: str = "",
        priority: str = "normal",
        metadata: dict | None = None,
    ) -> str | None:
        """
        Create an in-app notification and deliver via requested channels.
        Respects user preferences and quiet hours.
        Returns the notification _id as string, or None on failure.
        """
        prefs = self._get_prefs(user_id)

        # Check if the user wants this notification type
        if not self._type_enabled(prefs, category):
            logger.info("User %s disabled type=%s — skipped", user_id, category)
            return None

        channels = channels or ["in_app"]
        delivered = []

        # ── In-app ────────────────────────────────────────────────────
        notif_id = None
        if "in_app" in channels and self._channel_enabled(prefs, "in_app"):
            doc = {
                "user_id": user_id,
                "title": title,
                "content": content,
                "category": category,
                "action_url": action_url,
                "is_read": False,
                "priority": priority,
                "metadata": metadata or {},
                "delivery_status": {},
                "created_at": self._now(),
            }
            result = self.notifications.insert_one(doc)
            notif_id = str(result.inserted_id)
            delivered.append("in_app")

        # During quiet hours, only deliver in-app (emails/SMS queued)
        is_quiet = self._is_quiet_hours(prefs)

        # ── Email ─────────────────────────────────────────────────────
        if "email" in channels and self._channel_enabled(prefs, "email") and not is_quiet:
            user = self._get_user(user_id)
            if user and user.get("email"):
                subject = email_subject or f"[SmartInvoice] {title}"
                html = email_html or EmailService._build_html(
                    title=title, content=content,
                    action_url=f"{APP_URL}{action_url}" if action_url else "",
                    action_label="View Details" if action_url else "",
                )
                try:
                    from services.notification_system_backend import async_send_email
                    async_send_email.delay([user["email"]], subject, html)
                except Exception:
                    EmailService.send_email([user["email"]], subject, html)
                delivered.append("email")

        # ── SMS ───────────────────────────────────────────────────────
        if "sms" in channels and self._channel_enabled(prefs, "sms") and not is_quiet:
            user = self._get_user(user_id)
            phone = (user.get("profile") or {}).get("phone") if user else None
            if phone:
                text = sms_text or f"[SmartInvoice] {title}: {content[:100]}"
                try:
                    from services.notification_system_backend import async_send_sms
                    async_send_sms.delay(phone, text)
                except Exception:
                    SMSService.send_sms(phone, text)
                delivered.append("sms")

        # Update delivery status
        if notif_id and delivered:
            self.notifications.update_one(
                {"_id": ObjectId(notif_id)},
                {"$set": {"delivery_status": {ch: True for ch in delivered}}},
            )

        return notif_id

    # ── Batch: send to multiple users ─────────────────────────────────

    def create_notification_for_many(self, user_ids: list[str], **kwargs) -> list[str]:
        """Send the same notification to multiple users."""
        ids = []
        for uid in user_ids:
            nid = self.create_notification(user_id=uid, **kwargs)
            if nid:
                ids.append(nid)
        return ids

    # ── Read / query ──────────────────────────────────────────────────

    def get_notifications(self, user_id: str, page: int = 1, limit: int = 20,
                          category: str = "", is_read: Optional[bool] = None) -> dict:
        query: dict = {"user_id": user_id}
        if category:
            query["category"] = category
        if is_read is not None:
            query["is_read"] = is_read

        total = self.notifications.count_documents(query)
        docs = list(
            self.notifications.find(query)
            .sort("created_at", DESCENDING)
            .skip((page - 1) * limit)
            .limit(limit)
        )
        notifications = []
        for d in docs:
            notifications.append({
                "id": str(d["_id"]),
                "title": d.get("title", ""),
                "content": d.get("content", ""),
                "category": d.get("category", ""),
                "action_url": d.get("action_url", ""),
                "is_read": d.get("is_read", False),
                "priority": d.get("priority", "normal"),
                "metadata": d.get("metadata", {}),
                "created_at": d.get("created_at", ""),
            })

        return {
            "notifications": notifications,
            "total": total,
            "page": page,
            "limit": limit,
            "pages": max(1, (total + limit - 1) // limit),
            "unread_count": self.get_unread_count(user_id),
        }

    def get_unread_count(self, user_id: str) -> int:
        return self.notifications.count_documents({"user_id": user_id, "is_read": False})

    def mark_as_read(self, user_id: str, notification_id: str) -> bool:
        result = self.notifications.update_one(
            {"_id": ObjectId(notification_id), "user_id": user_id},
            {"$set": {"is_read": True, "read_at": self._now()}},
        )
        return result.modified_count > 0

    def mark_all_as_read(self, user_id: str) -> int:
        result = self.notifications.update_many(
            {"user_id": user_id, "is_read": False},
            {"$set": {"is_read": True, "read_at": self._now()}},
        )
        return result.modified_count

    def delete_notification(self, user_id: str, notification_id: str) -> bool:
        result = self.notifications.delete_one(
            {"_id": ObjectId(notification_id), "user_id": user_id},
        )
        return result.deleted_count > 0

    # ── Preferences ───────────────────────────────────────────────────

    def get_preferences(self, user_id: str) -> dict:
        prefs = self._get_prefs(user_id)
        return {
            "channels": prefs.get("channels", DEFAULT_PREFERENCES["channels"]),
            "types": prefs.get("types", DEFAULT_PREFERENCES["types"]),
            "quiet_hours": prefs.get("quiet_hours", DEFAULT_PREFERENCES["quiet_hours"]),
            "digest": prefs.get("digest", DEFAULT_PREFERENCES["digest"]),
        }

    def update_preferences(self, user_id: str, updates: dict) -> dict:
        allowed = {"channels", "types", "quiet_hours", "digest"}
        set_fields = {"updated_at": self._now()}
        for key in allowed:
            if key in updates:
                set_fields[key] = updates[key]

        self.preferences.update_one(
            {"user_id": user_id},
            {"$set": set_fields, "$setOnInsert": {"user_id": user_id, "created_at": self._now()}},
            upsert=True,
        )
        return self.get_preferences(user_id)

    # ── Admin broadcast ───────────────────────────────────────────────

    def admin_broadcast(self, title: str, message: str, target: str = "all",
                        user_ids: list[str] | None = None, channels: list[str] | None = None):
        """
        Broadcast a notification to all users, all admins, or specific users.
        target: "all" | "admins" | "specific"
        """
        channels = channels or ["in_app", "email"]

        if target == "admins":
            recipients = list(self.users.find({"role": "admin", "is_active": {"$ne": False}}))
        elif target == "specific" and user_ids:
            recipients = list(self.users.find(
                {"_id": {"$in": [ObjectId(uid) for uid in user_ids]}, "is_active": {"$ne": False}}
            ))
        else:
            recipients = list(self.users.find({"is_active": {"$ne": False}}))

        sent_count = 0
        for u in recipients:
            uid = str(u["_id"])
            self.create_notification(
                user_id=uid,
                title=title,
                content=message,
                category="system",
                channels=channels,
                priority="high",
            )
            sent_count += 1

        return sent_count

    # ═══════════════════════════════════════════════════════════════════
    # Integration points — call these from your existing routes
    # ═══════════════════════════════════════════════════════════════════

    def notify_extraction_started(self, user_id: str, invoice_id: str, invoice_name: str):
        """Notify user that extraction has started (in-app only)."""
        self.create_notification(
            user_id=user_id,
            title="Extraction Started",
            content=f"AI extraction has started for <b>{invoice_name}</b>.",
            category="extraction",
            action_url="/extraction",
            channels=["in_app"],
            metadata={"invoice_id": invoice_id},
        )

    def notify_extraction_completed(self, user_id: str, invoice_id: str,
                                     invoice_name: str, confidence: int = 0,
                                     client_email: str = "", admin_ids: list[str] | None = None):
        """
        Notify on successful extraction.
        - user: in-app + email
        - external client: email only (if client_email provided)
        - admins: in-app
        """
        # User notification
        self.create_notification(
            user_id=user_id,
            title="Extraction Complete",
            content=f"Invoice <b>{invoice_name}</b> extracted successfully. Confidence: {confidence}%.",
            category="extraction",
            action_url="/invoices",
            channels=["in_app", "email"],
            metadata={"invoice_id": invoice_id, "confidence": confidence},
        )

        # External client email
        if client_email:
            EmailService.send_client_invoice_ready(
                to=[client_email],
                invoice_name=invoice_name,
                vendor_name=invoice_name,
                amount="See invoice details",
            )

        # Admin notifications (in-app only)
        targets = admin_ids or self._get_admin_ids()
        for aid in targets:
            if aid != user_id:
                self.create_notification(
                    user_id=aid,
                    title="New Extraction Complete",
                    content=f"User extracted invoice <b>{invoice_name}</b> (confidence {confidence}%).",
                    category="extraction",
                    action_url="/invoices",
                    channels=["in_app"],
                    metadata={"invoice_id": invoice_id, "triggered_by": user_id},
                )

    def notify_extraction_failed(self, user_id: str, invoice_id: str,
                                  invoice_name: str, error_msg: str = ""):
        """Notify on failed extraction — user gets in-app + email, admins get in-app."""
        self.create_notification(
            user_id=user_id,
            title="Extraction Failed",
            content=f"Failed to extract <b>{invoice_name}</b>. {error_msg}",
            category="extraction",
            action_url="/extraction",
            channels=["in_app", "email"],
            metadata={"invoice_id": invoice_id, "error": error_msg},
        )

        # Notify admins
        for aid in self._get_admin_ids():
            if aid != user_id:
                self.create_notification(
                    user_id=aid,
                    title="Extraction Failed",
                    content=f"Extraction failed for <b>{invoice_name}</b>: {error_msg}",
                    category="extraction",
                    channels=["in_app"],
                    metadata={"invoice_id": invoice_id, "triggered_by": user_id},
                )

    def notify_invoice_created(self, user_email: str, invoice_id: str,
                                vendor_name: str | None = None):
        user = self.users.find_one({"email": user_email})
        if not user:
            return
        vendor = vendor_name or "Unknown vendor"
        self.create_notification(
            user_id=str(user["_id"]),
            title="Invoice Created",
            content=f"New invoice from <b>{vendor}</b> has been created.",
            category="invoice",
            action_url="/invoices",
            channels=["in_app"],
            metadata={"invoice_id": invoice_id},
        )

    def notify_invoice_updated(self, user_email: str, invoice_id: str,
                                vendor_name: str | None = None):
        user = self.users.find_one({"email": user_email})
        if not user:
            return
        vendor = vendor_name or "Unknown vendor"
        self.create_notification(
            user_id=str(user["_id"]),
            title="Invoice Updated",
            content=f"Invoice from <b>{vendor}</b> was updated.",
            category="invoice",
            action_url="/invoices",
            channels=["in_app"],
            metadata={"invoice_id": invoice_id},
        )

    def notify_invoice_deleted(self, user_email: str, invoice_id: str, filename: str = ""):
        user = self.users.find_one({"email": user_email})
        if not user:
            return
        self.create_notification(
            user_id=str(user["_id"]),
            title="Invoice Deleted",
            content=f"Invoice <b>{filename or invoice_id}</b> was deleted.",
            category="invoice",
            channels=["in_app"],
            metadata={"invoice_id": invoice_id},
        )

    def notify_status_changed(self, user_email: str, invoice_id: str,
                               new_status: str, vendor_name: str | None = None):
        user = self.users.find_one({"email": user_email})
        if not user:
            return
        vendor = vendor_name or "Invoice"
        self.create_notification(
            user_id=str(user["_id"]),
            title="Status Changed",
            content=f"<b>{vendor}</b> status changed to <b>{new_status}</b>.",
            category="invoice",
            action_url="/invoices",
            channels=["in_app"],
            metadata={"invoice_id": invoice_id, "new_status": new_status},
        )

    def notify_needs_review(self, user_email: str, invoice_id: str,
                             vendor_name: str | None = None):
        user = self.users.find_one({"email": user_email})
        if not user:
            return
        vendor = vendor_name or "An invoice"
        self.create_notification(
            user_id=str(user["_id"]),
            title="Review Required",
            content=f"<b>{vendor}</b> needs human review — low confidence fields.",
            category="review",
            action_url="/invoices",
            channels=["in_app", "email"],
            metadata={"invoice_id": invoice_id},
        )

    def notify_batch_complete(self, user_email: str, total: int, successful: int, failed: int):
        user = self.users.find_one({"email": user_email})
        if not user:
            return
        self.create_notification(
            user_id=str(user["_id"]),
            title="Batch Processing Complete",
            content=f"Batch done: <b>{successful}/{total}</b> succeeded, <b>{failed}</b> failed.",
            category="extraction",
            action_url="/extraction",
            channels=["in_app", "email"],
        )


# ═══════════════════════════════════════════════════════════════════════════
# PART 5 — Flask Blueprint (REST API)
# ═══════════════════════════════════════════════════════════════════════════

notification_bp = Blueprint("notifications", __name__)

# The service instance is set at registration time (see register_notification_routes)
_ns: NotificationService | None = None


def register_notification_routes(app, db):
    """
    Call from your main app.py:
        from services.notification_system_backend import register_notification_routes
        register_notification_routes(app, db)
    """
    global _ns
    init_notification_collections(db)
    _ns = NotificationService(db)
    app.register_blueprint(notification_bp)
    return _ns


def _get_ns() -> NotificationService:
    if _ns is None:
        raise RuntimeError("NotificationService not initialised — call register_notification_routes()")
    return _ns


def _require_auth(f):
    """Use the existing token_required from auth_service."""
    from services.auth_service import token_required
    return token_required(f)


def _require_admin(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        if g.user.get("role") != "admin":
            return jsonify({"success": False, "error": "Admin access required"}), 403
        return f(*args, **kwargs)
    return wrapper


# ── User notifications ────────────────────────────────────────────────────

@notification_bp.route("/api/notifications/user", methods=["GET"])
@_require_auth
def api_get_notifications():
    ns = _get_ns()
    page = request.args.get("page", 1, type=int)
    limit = request.args.get("limit", 20, type=int)
    category = request.args.get("category", "")
    is_read_param = request.args.get("is_read")
    is_read = None
    if is_read_param == "true":
        is_read = True
    elif is_read_param == "false":
        is_read = False

    data = ns.get_notifications(g.user["user_id"], page=page, limit=limit,
                                category=category, is_read=is_read)
    return jsonify({"success": True, **data}), 200


@notification_bp.route("/api/notifications/unread-count", methods=["GET"])
@_require_auth
def api_unread_count():
    ns = _get_ns()
    count = ns.get_unread_count(g.user["user_id"])
    return jsonify({"success": True, "unread_count": count}), 200


@notification_bp.route("/api/notifications/<notification_id>/read", methods=["PATCH"])
@_require_auth
def api_mark_read(notification_id):
    ns = _get_ns()
    ok = ns.mark_as_read(g.user["user_id"], notification_id)
    if not ok:
        return jsonify({"success": False, "error": "Not found"}), 404
    return jsonify({"success": True}), 200


@notification_bp.route("/api/notifications/read-all", methods=["PATCH"])
@_require_auth
def api_mark_all_read():
    ns = _get_ns()
    count = ns.mark_all_as_read(g.user["user_id"])
    return jsonify({"success": True, "marked": count}), 200


@notification_bp.route("/api/notifications/<notification_id>", methods=["DELETE"])
@_require_auth
def api_delete_notification(notification_id):
    ns = _get_ns()
    ok = ns.delete_notification(g.user["user_id"], notification_id)
    if not ok:
        return jsonify({"success": False, "error": "Not found"}), 404
    return jsonify({"success": True}), 200


# ── Preferences ───────────────────────────────────────────────────────────

@notification_bp.route("/api/notifications/preferences", methods=["GET"])
@_require_auth
def api_get_preferences():
    ns = _get_ns()
    prefs = ns.get_preferences(g.user["user_id"])
    return jsonify({"success": True, "preferences": prefs}), 200


@notification_bp.route("/api/notifications/preferences", methods=["PUT"])
@_require_auth
def api_update_preferences():
    ns = _get_ns()
    data = request.get_json(silent=True) or {}
    prefs = ns.update_preferences(g.user["user_id"], data)
    return jsonify({"success": True, "preferences": prefs}), 200


# ── Admin broadcast ───────────────────────────────────────────────────────

@notification_bp.route("/api/notifications/admin/broadcast", methods=["POST"])
@_require_auth
@_require_admin
def api_admin_broadcast():
    ns = _get_ns()
    data = request.get_json(silent=True) or {}
    title = data.get("title", "").strip()
    message = data.get("message", "").strip()
    target = data.get("target", "all")
    user_ids = data.get("user_ids", [])
    channels = data.get("channels", ["in_app", "email"])

    if not title or not message:
        return jsonify({"success": False, "error": "title and message are required"}), 400

    count = ns.admin_broadcast(title, message, target=target,
                               user_ids=user_ids, channels=channels)
    return jsonify({"success": True, "sent_count": count}), 200


# ── Admin: send test notification ─────────────────────────────────────────

@notification_bp.route("/api/notifications/test", methods=["POST"])
@_require_auth
def api_test_notification():
    ns = _get_ns()
    ns.create_notification(
        user_id=g.user["user_id"],
        title="Test Notification",
        content="If you see this, the notification system is working!",
        category="system",
        channels=["in_app"],
    )
    return jsonify({"success": True, "message": "Test notification sent"}), 200


@notification_bp.route("/api/notifications/test-email", methods=["POST"])
@_require_auth
def api_test_email():
    ns = _get_ns()
    user = ns._get_user(g.user["user_id"])
    if not user:
        return jsonify({"success": False, "error": "User not found"}), 404
    EmailService.send_email(
        [user["email"]],
        "[SmartInvoice] Test Email",
        EmailService._build_html("Test Email", "If you receive this, email notifications are working!"),
    )
    return jsonify({"success": True, "message": f"Test email sent to {user['email']}"}), 200


# ═══════════════════════════════════════════════════════════════════════════
# PART 6 — Celery Tasks
# ═══════════════════════════════════════════════════════════════════════════

# Import the existing celery instance
try:
    from services.celery_worker import celery
except ImportError:
    celery = None


if celery:

    @celery.task(name="async_send_email", bind=True, max_retries=3)
    def async_send_email(self, to_emails: list[str], subject: str, html_body: str):
        """Send email asynchronously via Celery."""
        try:
            success = EmailService.send_email(to_emails, subject, html_body)
            if not success:
                raise RuntimeError("Email delivery returned False")
        except Exception as exc:
            logger.error("Async email failed (attempt %d): %s", self.request.retries, exc)
            self.retry(exc=exc, countdown=60 * (self.request.retries + 1))

    @celery.task(name="async_send_sms", bind=True, max_retries=3)
    def async_send_sms(self, to_number: str, message: str):
        """Send SMS asynchronously via Celery."""
        try:
            success = SMSService.send_sms(to_number, message)
            if not success:
                raise RuntimeError("SMS delivery returned False")
        except Exception as exc:
            logger.error("Async SMS failed (attempt %d): %s", self.request.retries, exc)
            self.retry(exc=exc, countdown=60 * (self.request.retries + 1))

    @celery.task(name="send_daily_digest")
    def send_daily_digest():
        """
        Send daily digest emails to users who have digest enabled.
        Schedule via Celery Beat:
            celery -A services.celery_worker beat --schedule=/tmp/celerybeat-schedule
        """
        from services.db_service import db
        ns_local = NotificationService(db)
        prefs_cursor = ns_local.preferences.find({"digest.enabled": True})

        yesterday = (datetime.utcnow() - timedelta(days=1)).strftime("%Y-%m-%d")

        for pref in prefs_cursor:
            uid = pref["user_id"]
            user = ns_local._get_user(uid)
            if not user or not user.get("email"):
                continue

            # Gather yesterday's stats for this user
            from services.db_service import invoices_collection
            query = {"user_id": uid, "created_at": {"$gte": yesterday}}
            docs = list(invoices_collection.find(query))
            if not docs:
                continue

            total_amount = 0
            needs_review = 0
            for d in docs:
                gt = (d.get("data") or {}).get("totals", {}).get("grand_total")
                if gt:
                    try:
                        total_amount += float(gt)
                    except (ValueError, TypeError):
                        pass
                if (d.get("data") or {}).get("validation", {}).get("needs_human_review"):
                    needs_review += 1

            EmailService.send_daily_digest(
                to=[user["email"]],
                stats={"count": len(docs), "amount": total_amount, "needs_review": needs_review},
            )

    @celery.task(name="process_scheduled_notifications")
    def process_scheduled_notifications():
        """Process any scheduled/recurring notifications. Run via Celery Beat every 5 min."""
        # Placeholder for future scheduled notification logic.
        # Example: payment reminders, recurring reports, etc.
        logger.info("Scheduled notification sweep complete")


# ═══════════════════════════════════════════════════════════════════════════
# Module-level convenience — used when importing directly
# ═══════════════════════════════════════════════════════════════════════════

# Expose a module-level service instance that gets initialised lazily
ns: NotificationService | None = None


def get_notification_service() -> NotificationService:
    """Get or create the global NotificationService instance."""
    global ns
    if ns is None:
        from services.db_service import db
        init_notification_collections(db)
        ns = NotificationService(db)
    return ns

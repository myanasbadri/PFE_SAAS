"""
MagicBell notification service + Gmail email alerts.

Sends real-time notifications to users via the MagicBell API.
Notifications appear in the in-app bell + optional email/push channels.
Additionally sends email alerts to all admin users via Gmail SMTP.
"""

import logging
import hmac
import hashlib
import base64
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import requests
from config import MAGICBELL_API_KEY, MAGICBELL_API_SECRET, SMTP_EMAIL, SMTP_PASSWORD, SMTP_HOST, SMTP_PORT

logger = logging.getLogger(__name__)

MAGICBELL_API_URL = "https://api.magicbell.com"

# ── Helpers ─────────────────────────────────────────────────────────────────

def _headers():
    """Common headers for MagicBell REST API."""
    return {
        "X-MAGICBELL-API-KEY": MAGICBELL_API_KEY,
        "X-MAGICBELL-API-SECRET": MAGICBELL_API_SECRET,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


def compute_user_hmac(user_email: str) -> str:
    """Compute Base64-encoded HMAC-SHA256 for MagicBell client-side auth."""
    if not MAGICBELL_API_SECRET:
        return ""
    digest = hmac.new(
        MAGICBELL_API_SECRET.encode("utf-8"),
        user_email.encode("utf-8"),
        hashlib.sha256,
    ).digest()
    return base64.b64encode(digest).decode("utf-8")


def _send_notification(
    title: str,
    content: str,
    recipients: list[dict],
    category: str = "default",
    action_url: str | None = None,
    topic: str | None = None,
):
    """Send a notification via MagicBell API."""
    if not MAGICBELL_API_KEY or not MAGICBELL_API_SECRET:
        logger.warning("MagicBell keys not configured — skipping notification")
        return

    payload = {
        "notification": {
            "title": title,
            "content": content,
            "category": category,
            "recipients": recipients,
        }
    }

    if action_url:
        payload["notification"]["action_url"] = action_url
    if topic:
        payload["notification"]["topic"] = topic

    try:
        resp = requests.post(
            f"{MAGICBELL_API_URL}/notifications",
            json=payload,
            headers=_headers(),
            timeout=10,
        )
        if resp.status_code in (200, 201):
            logger.info("Notification sent: %s", title)
        else:
            logger.error(
                "MagicBell API error %s: %s", resp.status_code, resp.text
            )
    except Exception as exc:
        logger.error("Failed to send MagicBell notification: %s", exc)

    # Also send email to all admin users
    _send_email_to_admins(title, content)


# ── Gmail SMTP email helpers ──────────────────────────────────────────────────

def _get_admin_emails() -> list[str]:
    """Fetch email addresses of all active admin users from the database."""
    from services.db_service import users_collection
    admins = users_collection.find(
        {"role": "admin", "is_active": {"$ne": False}},
        {"email": 1, "_id": 0},
    )
    return [a["email"] for a in admins if a.get("email")]


def _build_email_html(title: str, content: str) -> str:
    """Build a styled HTML email body for the notification."""
    return f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;
                border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
        <div style="background: #1a73e8; color: #fff; padding: 16px 24px;">
            <h2 style="margin: 0; font-size: 18px;">📋 Invoice System Notification</h2>
        </div>
        <div style="padding: 24px;">
            <h3 style="margin: 0 0 12px; color: #333;">{title}</h3>
            <p style="margin: 0 0 16px; color: #555; font-size: 14px; line-height: 1.6;">
                {content}
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 16px 0;">
            <p style="margin: 0; color: #999; font-size: 12px;">
                This is an automated notification from the Invoice Management System.
            </p>
        </div>
    </div>
    """


def _send_email(subject: str, html_body: str, recipient_emails: list[str]):
    """Send an HTML email via Gmail SMTP to the given recipients."""
    if not SMTP_EMAIL or not SMTP_PASSWORD:
        logger.warning("SMTP credentials not configured — skipping email")
        return
    if not recipient_emails:
        return

    try:
        msg = MIMEMultipart("alternative")
        msg["From"] = f"Invoice System <{SMTP_EMAIL}>"
        msg["To"] = ", ".join(recipient_emails)
        msg["Subject"] = f"[Invoice System] {subject}"
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_EMAIL, SMTP_PASSWORD)
            server.sendmail(SMTP_EMAIL, recipient_emails, msg.as_string())

        logger.info("Email sent to %d admin(s): %s", len(recipient_emails), subject)
    except Exception as exc:
        logger.error("Failed to send email: %s", exc)


def _send_email_to_admins(title: str, content: str):
    """Send an email notification to all admin users."""
    admin_emails = _get_admin_emails()
    if not admin_emails:
        logger.info("No admin users found — skipping email notification")
        return
    html_body = _build_email_html(title, content)
    _send_email(title, html_body, admin_emails)


# ── Fetch / manage notifications for a user ─────────────────────────────────

def _user_headers(user_email: str):
    """Headers for user-scoped MagicBell requests."""
    return {
        "X-MAGICBELL-API-KEY": MAGICBELL_API_KEY,
        "X-MAGICBELL-API-SECRET": MAGICBELL_API_SECRET,
        "X-MAGICBELL-USER-EMAIL": user_email,
        "Accept": "application/json",
        "Content-Type": "application/json",
    }


def fetch_notifications(user_email: str, page: int = 1, per_page: int = 15):
    """Fetch notifications for a user from MagicBell."""
    try:
        resp = requests.get(
            f"{MAGICBELL_API_URL}/notifications",
            params={"page": page, "per_page": per_page},
            headers=_user_headers(user_email),
            timeout=10,
        )
        if resp.status_code == 200:
            return resp.json()
        logger.error("Fetch notifications error %s: %s", resp.status_code, resp.text)
        return None
    except Exception as exc:
        logger.error("Failed to fetch notifications: %s", exc)
        return None


def mark_notification_read(user_email: str, notification_id: str):
    """Mark a single notification as read."""
    try:
        resp = requests.post(
            f"{MAGICBELL_API_URL}/notifications/{notification_id}/read",
            headers=_user_headers(user_email),
            timeout=10,
        )
        return resp.status_code in (200, 204)
    except Exception:
        return False


def mark_all_read(user_email: str):
    """Mark all notifications as read for a user."""
    try:
        resp = requests.post(
            f"{MAGICBELL_API_URL}/notifications/read",
            headers=_user_headers(user_email),
            timeout=10,
        )
        return resp.status_code in (200, 204)
    except Exception:
        return False


# ── Notification triggers ───────────────────────────────────────────────────

def notify_invoice_created(user_email: str, invoice_id: str, vendor_name: str | None = None):
    vendor = vendor_name or "Unknown vendor"
    _send_notification(
        title="Invoice Created",
        content=f"New invoice from <b>{vendor}</b> has been created successfully.",
        recipients=[{"email": user_email}],
        category="invoice",
        action_url=f"/invoices",
        topic=f"invoice-{invoice_id}",
    )


def notify_invoice_updated(user_email: str, invoice_id: str, vendor_name: str | None = None):
    vendor = vendor_name or "Unknown vendor"
    _send_notification(
        title="Invoice Updated",
        content=f"Invoice from <b>{vendor}</b> has been updated.",
        recipients=[{"email": user_email}],
        category="invoice",
        action_url=f"/invoices",
        topic=f"invoice-{invoice_id}",
    )


def notify_invoice_deleted(user_email: str, invoice_id: str, filename: str = ""):
    _send_notification(
        title="Invoice Deleted",
        content=f"Invoice <b>{filename or invoice_id}</b> has been deleted.",
        recipients=[{"email": user_email}],
        category="invoice",
        topic=f"invoice-{invoice_id}",
    )


def notify_status_changed(user_email: str, invoice_id: str, new_status: str, vendor_name: str | None = None):
    vendor = vendor_name or "Invoice"
    _send_notification(
        title="Status Changed",
        content=f"<b>{vendor}</b> status changed to <b>{new_status}</b>.",
        recipients=[{"email": user_email}],
        category="invoice",
        action_url=f"/invoices",
        topic=f"invoice-{invoice_id}",
    )


def notify_extraction_complete(user_email: str, invoice_id: str, filename: str, confidence: int | None = None):
    conf_text = f" (confidence: {confidence}%)" if confidence else ""
    _send_notification(
        title="Extraction Complete",
        content=f"AI extraction for <b>{filename}</b> is complete{conf_text}.",
        recipients=[{"email": user_email}],
        category="extraction",
        action_url=f"/extraction",
        topic=f"invoice-{invoice_id}",
    )


def notify_extraction_failed(user_email: str, filename: str, error: str = ""):
    _send_notification(
        title="Extraction Failed",
        content=f"Failed to extract data from <b>{filename}</b>. {error}",
        recipients=[{"email": user_email}],
        category="extraction",
        action_url=f"/extraction",
    )


def notify_needs_review(user_email: str, invoice_id: str, vendor_name: str | None = None):
    vendor = vendor_name or "An invoice"
    _send_notification(
        title="Review Required",
        content=f"<b>{vendor}</b> needs human review — some fields have low confidence.",
        recipients=[{"email": user_email}],
        category="review",
        action_url=f"/extraction",
        topic=f"invoice-{invoice_id}",
    )


def notify_batch_complete(user_email: str, total: int, successful: int, failed: int):
    _send_notification(
        title="Batch Processing Complete",
        content=f"Batch done: <b>{successful}/{total}</b> succeeded, <b>{failed}</b> failed.",
        recipients=[{"email": user_email}],
        category="extraction",
        action_url=f"/extraction",
    )

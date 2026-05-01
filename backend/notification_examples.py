"""
=============================================================================
  NOTIFICATION SYSTEM — 10 Real-World Usage Examples
  Copy-paste these into your Flask routes or Celery tasks
=============================================================================
"""


# ── Setup (do this once in app.py) ────────────────────────────────────────
#
#   from services.notification_system_backend import register_notification_routes
#   ns = register_notification_routes(app, db)
#
# After that, `ns` is your NotificationService instance.
# All examples below assume `ns` is available.


# ═══════════════════════════════════════════════════════════════════════════
# EXAMPLE 1: Notify user when extraction starts
# ═══════════════════════════════════════════════════════════════════════════

def example_extraction_started(ns, user_id, invoice_id, filename):
    """Call this right after saving the invoice doc with status=processing."""
    ns.notify_extraction_started(
        user_id=user_id,
        invoice_id=invoice_id,
        invoice_name=filename,
    )


# ═══════════════════════════════════════════════════════════════════════════
# EXAMPLE 2: Notify user + admins + client when extraction completes
# ═══════════════════════════════════════════════════════════════════════════

def example_extraction_completed(ns, user_id, invoice_id, filename, confidence):
    """Call this after extraction succeeds. Sends in-app to user & admins, email to user."""
    ns.notify_extraction_completed(
        user_id=user_id,
        invoice_id=invoice_id,
        invoice_name=filename,
        confidence=confidence,
        client_email="client@company.com",  # optional — external client gets email
        # admin_ids=["..."]                 # optional — defaults to all admins
    )


# ═══════════════════════════════════════════════════════════════════════════
# EXAMPLE 3: Notify when extraction fails
# ═══════════════════════════════════════════════════════════════════════════

def example_extraction_failed(ns, user_id, invoice_id, filename, error):
    """User gets in-app + email, admins get in-app."""
    ns.notify_extraction_failed(
        user_id=user_id,
        invoice_id=invoice_id,
        invoice_name=filename,
        error_msg=error,
    )


# ═══════════════════════════════════════════════════════════════════════════
# EXAMPLE 4: Admin broadcasts a system message to all users
# ═══════════════════════════════════════════════════════════════════════════

def example_admin_broadcast(ns):
    """Admin announces system maintenance to all users."""
    count = ns.admin_broadcast(
        title="Scheduled Maintenance",
        message="The system will be down for maintenance on Saturday 3:00 AM - 5:00 AM UTC.",
        target="all",              # "all" | "admins" | "specific"
        channels=["in_app", "email"],
    )
    print(f"Broadcast sent to {count} users")


# ═══════════════════════════════════════════════════════════════════════════
# EXAMPLE 5: Send a custom notification to a specific user
# ═══════════════════════════════════════════════════════════════════════════

def example_custom_notification(ns, user_id):
    """Custom notification with all channel options."""
    ns.create_notification(
        user_id=user_id,
        title="Payment Reminder",
        content="Invoice <b>INV-2026-042</b> is due in 3 days.",
        category="invoice",
        action_url="/invoices",
        channels=["in_app", "email", "sms"],
        priority="high",
        metadata={"invoice_id": "abc123", "due_date": "2026-05-01"},
    )


# ═══════════════════════════════════════════════════════════════════════════
# EXAMPLE 6: Batch complete notification
# ═══════════════════════════════════════════════════════════════════════════

def example_batch_complete(ns, user_email, total, success, failed):
    """After processing a batch of files."""
    ns.notify_batch_complete(
        user_email=user_email,
        total=total,
        successful=success,
        failed=failed,
    )


# ═══════════════════════════════════════════════════════════════════════════
# EXAMPLE 7: Send invoice status change notification
# ═══════════════════════════════════════════════════════════════════════════

def example_status_change(ns, user_email, invoice_id, new_status, vendor):
    ns.notify_status_changed(
        user_email=user_email,
        invoice_id=invoice_id,
        new_status=new_status,
        vendor_name=vendor,
    )


# ═══════════════════════════════════════════════════════════════════════════
# EXAMPLE 8: Send notification to multiple users at once
# ═══════════════════════════════════════════════════════════════════════════

def example_notify_team(ns, team_user_ids):
    """Notify a list of users about a project update."""
    ns.create_notification_for_many(
        user_ids=team_user_ids,
        title="New Report Available",
        content="The monthly financial report has been generated.",
        category="system",
        action_url="/dashboard",
        channels=["in_app", "email"],
    )


# ═══════════════════════════════════════════════════════════════════════════
# EXAMPLE 9: Using the Email Service directly (external client)
# ═══════════════════════════════════════════════════════════════════════════

def example_direct_email():
    """Send a standalone email without creating an in-app notification."""
    from services.notification_system_backend import EmailService

    EmailService.send_client_invoice_ready(
        to=["client@external.com"],
        invoice_name="INV-2026-099",
        vendor_name="Acme Corp",
        amount="$4,500.00",
    )


# ═══════════════════════════════════════════════════════════════════════════
# EXAMPLE 10: Integration in your existing extract_file route
# ═══════════════════════════════════════════════════════════════════════════

def example_integration_in_route():
    """
    Shows how to integrate with the existing synchronous extraction flow
    in app.py. Replace the current notify_* calls:

    Before:
        from services.notification_service import notify_extraction_complete
        notify_extraction_complete(g.user["email"], inv_id, filename, confidence)

    After:
        from services.notification_system_backend import get_notification_service
        ns = get_notification_service()
        ns.notify_extraction_completed(
            user_id=g.user["user_id"],
            invoice_id=inv_id,
            invoice_name=filename,
            confidence=confidence,
        )
    """
    pass


# ═══════════════════════════════════════════════════════════════════════════
# CELERY BEAT SCHEDULE EXAMPLE (add to celery_worker.py or config)
# ═══════════════════════════════════════════════════════════════════════════

CELERY_BEAT_SCHEDULE = {
    "daily-digest": {
        "task": "send_daily_digest",
        "schedule": {
            "hour": 9,
            "minute": 0,
        },
        # Uses: celery.schedules.crontab(hour=9, minute=0)
    },
    "scheduled-notifications": {
        "task": "process_scheduled_notifications",
        "schedule": 300,  # every 5 minutes
    },
}

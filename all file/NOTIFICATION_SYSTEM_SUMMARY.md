# Notification System — Architecture & Summary

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER ACTIONS                              │
│  Upload Invoice │ Create Invoice │ Update │ Delete │ Admin Cmd   │
└────────┬───────────────┬──────────────┬───────────┬─────────────┘
         │               │              │           │
         ▼               ▼              ▼           ▼
┌─────────────────────────────────────────────────────────────────┐
│                  NotificationService (Orchestrator)               │
│                                                                   │
│  1. Check user preferences (channels, types)                      │
│  2. Check quiet hours                                             │
│  3. Create in-app notification (MongoDB)                          │
│  4. Dispatch to channels via Celery (async)                       │
└────────┬───────────────┬──────────────┬─────────────────────────┘
         │               │              │
         ▼               ▼              ▼
   ┌───────────┐  ┌───────────┐  ┌───────────┐
   │  In-App   │  │   Email   │  │    SMS    │
   │ (MongoDB) │  │  (Gmail)  │  │ (Twilio)  │
   └─────┬─────┘  └─────┬─────┘  └─────┬─────┘
         │               │              │
         ▼               ▼              ▼
   ┌───────────┐  ┌───────────┐  ┌───────────┐
   │  Bell UI  │  │   Inbox   │  │   Phone   │
   │ Dropdown  │  │  Gmail    │  │   SMS     │
   └───────────┘  └───────────┘  └───────────┘
```

---

## Database Schema

### notifications collection

```json
{
  "_id": ObjectId,
  "user_id": "string",
  "title": "string",
  "content": "string (HTML allowed)",
  "category": "extraction | invoice | review | system",
  "action_url": "/invoices",
  "is_read": false,
  "priority": "normal | high | low",
  "metadata": { "invoice_id": "...", "confidence": 95 },
  "delivery_status": { "in_app": true, "email": true },
  "created_at": "ISO 8601",
  "read_at": "ISO 8601 | null"
}
```

**Indexes:**
- `(user_id, created_at DESC)` — fast user feed
- `(user_id, is_read)` — fast unread count
- `(category)` — filter by type
- `(created_at)` TTL 90 days — auto-cleanup

### notification_preferences collection

```json
{
  "_id": ObjectId,
  "user_id": "string (unique)",
  "channels": {
    "in_app": true,
    "email": true,
    "sms": false
  },
  "types": {
    "extraction": true,
    "invoice": true,
    "review": true,
    "system": true
  },
  "quiet_hours": {
    "enabled": false,
    "start": "22:00",
    "end": "08:00",
    "timezone": "UTC"
  },
  "digest": {
    "enabled": false,
    "frequency": "daily",
    "time": "09:00"
  },
  "created_at": "ISO 8601",
  "updated_at": "ISO 8601"
}
```

### notification_templates collection

```json
{
  "_id": ObjectId,
  "key": "extraction_completed (unique)",
  "title": "Extraction Complete",
  "body": "Invoice <b>{invoice_name}</b> extracted. Confidence: {confidence}%.",
  "category": "extraction",
  "channels": ["in_app", "email"]
}
```

---

## API Reference

### User Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/notifications/user?page=1&limit=20&category=&is_read=` | Paginated notifications |
| `GET` | `/api/notifications/unread-count` | Unread count |
| `PATCH` | `/api/notifications/{id}/read` | Mark one read |
| `PATCH` | `/api/notifications/read-all` | Mark all read |
| `DELETE` | `/api/notifications/{id}` | Delete notification |
| `GET` | `/api/notifications/preferences` | Get preferences |
| `PUT` | `/api/notifications/preferences` | Update preferences |
| `POST` | `/api/notifications/test` | Send test (in-app) |
| `POST` | `/api/notifications/test-email` | Send test email |

### Admin Endpoints

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| `POST` | `/api/notifications/admin/broadcast` | `{title, message, target, user_ids?, channels?}` | Broadcast |

`target`: `"all"` / `"admins"` / `"specific"` (with `user_ids`)

---

## Frontend Components

| Component | File | Description |
|-----------|------|-------------|
| `NotificationBellNew` | `NotificationSystem.tsx` | Bell icon + dropdown (last 10) |
| `NotificationCenter` | `NotificationSystem.tsx` | Full page with table, filters, pagination |
| `NotificationPreferences` | `NotificationSystem.tsx` | Settings: channels, types, quiet hours, digest |
| `useNotifications` | `NotificationSystem.tsx` | Hook: fetch, mark read, delete, unread count |
| `notificationApi` | `NotificationSystem.tsx` | API service with all endpoints |

### Routes

| Route | Component |
|-------|-----------|
| `/notifications` | `NotificationCenter` |
| `/notifications/preferences` | `NotificationPreferences` |

---

## Integration Points

### From Existing Routes

```python
from services.notification_system_backend import get_notification_service
ns = get_notification_service()

# Extraction flow
ns.notify_extraction_started(user_id, invoice_id, filename)
ns.notify_extraction_completed(user_id, invoice_id, filename, confidence)
ns.notify_extraction_failed(user_id, invoice_id, filename, error_msg)

# Invoice CRUD (accepts user_email like the old system)
ns.notify_invoice_created(user_email, invoice_id, vendor_name)
ns.notify_invoice_updated(user_email, invoice_id, vendor_name)
ns.notify_invoice_deleted(user_email, invoice_id, filename)
ns.notify_status_changed(user_email, invoice_id, new_status, vendor_name)
ns.notify_needs_review(user_email, invoice_id, vendor_name)
ns.notify_batch_complete(user_email, total, successful, failed)

# Admin
ns.admin_broadcast(title, message, target="all")
```

---

## 3 User Types

| Type | In-App | Email | SMS | Notes |
|------|--------|-------|-----|-------|
| **User** (client) | All notifications | Extraction, review, batch, digest | Optional | Primary user |
| **Admin** | All + admin-specific | Broadcast, failures | Optional | Sees all user activity |
| **External Client** | None | Invoice ready email | Optional | No account needed |

---

## Celery Tasks

| Task | Schedule | Description |
|------|----------|-------------|
| `async_send_email` | On demand | Send email in background (3 retries) |
| `async_send_sms` | On demand | Send SMS in background (3 retries) |
| `send_daily_digest` | Daily 09:00 | Summary email to opted-in users |
| `process_scheduled_notifications` | Every 5 min | Process queued notifications |

---

## Delivery Flow

```
1. Route calls ns.notify_extraction_completed(...)
2. NotificationService.create_notification() is called
3. Checks user preferences → is this type enabled?
4. Checks quiet hours → should we send email/SMS now?
5. Creates in-app notification in MongoDB
6. For email: dispatches async_send_email via Celery
   (falls back to sync if Redis unavailable)
7. For SMS: dispatches async_send_sms via Celery
8. Updates delivery_status on the notification doc
```

---

## Files Created

| File | Location | Description |
|------|----------|-------------|
| `notification_system_backend.py` | `backend/services/` | All backend: models, services, routes, tasks |
| `NotificationSystem.tsx` | `Front-end/.../components/` | All frontend: hook, bell, center, preferences |
| `notification_styles.css` | `Front-end/.../styles/` | CSS animations, dark mode, responsive |
| `notification_examples.py` | `backend/` | 10 usage examples |
| `NOTIFICATION_SETUP_GUIDE.md` | project root | Step-by-step installation |
| `NOTIFICATION_SYSTEM_SUMMARY.md` | project root | This file |

---

## Checklist

- [ ] Add `TWILIO_*` and `APP_URL` to `config.py`
- [ ] Add env vars to `.env`
- [ ] Register blueprint: `register_notification_routes(app, db)` in `app.py`
- [ ] Import CSS in layout: `import "@/styles/notification_styles.css"`
- [ ] Swap `NotificationBell` to `NotificationBellNew` in layout
- [ ] Create `/notifications` route page
- [ ] Create `/notifications/preferences` route page
- [ ] (Optional) Replace old `notify_*` calls with new `ns.notify_*` calls
- [ ] (Optional) Install `twilio` for SMS
- [ ] (Optional) Set up Celery Beat for daily digests
- [ ] Test: call `/api/notifications/test` and verify bell shows notification
- [ ] Test: call `/api/notifications/test-email` and verify inbox

# Notification System — Setup Guide

Step-by-step installation for the multi-channel notification system.

---

## 1. Backend Dependencies

Install the new Python packages:

```bash
cd backend
pip install twilio
```

> `smtplib`, `email` are built-in Python. No need to install Flask-Mail — we use `smtplib` directly (already working in your project).

---

## 2. Environment Variables

Add these to `backend/.env`:

```env
# Gmail SMTP (already configured)
SMTP_EMAIL=invoiceai71@gmail.com
SMTP_PASSWORD=gwlfzmhnqjrgtgnn
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587

# Twilio SMS (optional — leave empty to disable)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# App URL (used in email links)
APP_URL=http://localhost:3000
```

---

## 3. Config File

Add to `backend/config.py` (at the bottom):

```python
# Twilio SMS (optional)
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER", "")

# App URL (for email links)
APP_URL = os.getenv("APP_URL", "http://localhost:3000")
```

---

## 4. Register the Blueprint in app.py

Add these lines to `backend/app.py`:

```python
# At the top, with other imports:
from services.notification_system_backend import register_notification_routes, get_notification_service

# After app = Flask(__name__) and CORS(app), add:
from services.db_service import db
ns = register_notification_routes(app, db)
```

This registers all the `/api/notifications/*` endpoints automatically.

---

## 5. Use the New Notification Service

Replace old `notify_*` calls in your routes. Example in `extract_file`:

**Before:**
```python
from services.notification_service import notify_extraction_complete
notify_extraction_complete(g.user["email"], inv_id, filename, confidence)
```

**After:**
```python
ns = get_notification_service()
ns.notify_extraction_completed(
    user_id=g.user["user_id"],
    invoice_id=inv_id,
    invoice_name=filename,
    confidence=confidence,
)
```

The old `notification_service.py` (MagicBell) can remain — the new system runs in parallel.

---

## 6. Frontend Setup

### Import the CSS

In `Front-end/pfe-project/src/app/(routes)/layout.tsx`, add:

```tsx
import "@/styles/notification_styles.css";
```

### Replace the NotificationBell

In the same layout file, change:

```tsx
// Before:
const NotificationBell = dynamic(
  () => import("@/components/NotificationBell"),
  { ssr: false },
);

// After:
const NotificationBell = dynamic(
  () => import("@/components/NotificationSystem").then(mod => ({ default: mod.NotificationBellNew })),
  { ssr: false },
);
```

### Add Routes

Create `src/app/(routes)/notifications/page.tsx`:

```tsx
"use client";
import { NotificationCenter } from "@/components/NotificationSystem";
export default function NotificationsPage() {
  return <NotificationCenter />;
}
```

Create `src/app/(routes)/notifications/preferences/page.tsx`:

```tsx
"use client";
import { NotificationPreferences } from "@/components/NotificationSystem";
export default function NotificationPreferencesPage() {
  return <NotificationPreferences />;
}
```

---

## 7. Gmail SMTP Setup

1. Go to **Google Account** > **Security** > **2-Step Verification** — enable it
2. Go to **App Passwords** > select **Mail** > **Generate**
3. Copy the 16-character password into `SMTP_PASSWORD` in `.env`
4. Set `SMTP_EMAIL` to your Gmail address

Test it:
```bash
curl -X POST http://localhost:5000/api/notifications/test-email \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 8. Twilio SMS Setup (Optional)

1. Create a free account at [twilio.com](https://www.twilio.com)
2. Get your **Account SID** and **Auth Token** from the dashboard
3. Get a Twilio phone number (free trial includes one)
4. Add to `.env`:
   ```env
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   TWILIO_AUTH_TOKEN=your_auth_token_here
   TWILIO_PHONE_NUMBER=+1234567890
   ```
5. Users must have a `phone` field in their profile for SMS to work

---

## 9. Celery + Redis (Async Notifications)

If Redis is running, notifications are sent asynchronously (non-blocking).
If Redis is not running, they fall back to synchronous sending.

```bash
# Start Redis (if not already running)
redis-server

# Start Celery worker
cd backend
celery -A services.celery_worker worker --loglevel=info

# Start Celery Beat (for daily digests)
celery -A services.celery_worker beat --loglevel=info
```

---

## 10. API Endpoints Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/notifications/user` | JWT | Get user notifications (paginated) |
| GET | `/api/notifications/unread-count` | JWT | Get unread count |
| PATCH | `/api/notifications/{id}/read` | JWT | Mark one as read |
| PATCH | `/api/notifications/read-all` | JWT | Mark all as read |
| DELETE | `/api/notifications/{id}` | JWT | Delete a notification |
| GET | `/api/notifications/preferences` | JWT | Get user preferences |
| PUT | `/api/notifications/preferences` | JWT | Update preferences |
| POST | `/api/notifications/admin/broadcast` | Admin | Broadcast to users |
| POST | `/api/notifications/test` | JWT | Send test in-app |
| POST | `/api/notifications/test-email` | JWT | Send test email |

### Query Parameters for GET /api/notifications/user

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| page | int | 1 | Page number |
| limit | int | 20 | Items per page |
| category | string | — | Filter: extraction, invoice, review, system |
| is_read | string | — | Filter: "true" or "false" |

---

## 11. Verify Everything Works

1. Start the backend: `python app.py`
2. Start the frontend: `npm run dev`
3. Log in as admin
4. Click the notification bell — should show "No notifications yet"
5. Call test endpoint:
   ```bash
   curl -X POST http://localhost:5000/api/notifications/test \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```
6. Refresh — test notification should appear
7. Upload an invoice — extraction notifications should appear
8. Check email inbox for email notifications

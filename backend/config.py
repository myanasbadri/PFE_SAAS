import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
DB_NAME = os.getenv("DB_NAME", "invoice_ai")
JWT_SECRET = os.getenv("JWT_SECRET", "invoice_secret_2026_secure_key_x9z!")
PORT = int(os.getenv("PORT", 5000))

UPLOAD_FOLDER = "uploads"
ALLOWED_EXTENSIONS = {"pdf", "png", "jpg", "jpeg", "webp", "txt", "xml"}

# Tesseract OCR executable path
# On Linux/Docker: /usr/bin/tesseract  |  On Windows: full path to tesseract.exe
TESSERACT_CMD = os.getenv("TESSERACT_CMD", "/usr/bin/tesseract" if os.name != "nt" else r"C:\Users\MSI\miniconda3\envs\ai310\Library\bin\tesseract.exe")
TESSDATA_PREFIX = os.getenv("TESSDATA_PREFIX", "/usr/share/tesseract-ocr/5/tessdata" if os.name != "nt" else r"C:\Users\MSI\miniconda3\envs\ai310\share\tessdata")

# Ollama (primary LLM - local)
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:7b-instruct")

# Groq (fallback LLM — free tier 14,400 req/day)
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

# MagicBell Notifications
MAGICBELL_API_KEY = os.getenv("MAGICBELL_API_KEY", "")
MAGICBELL_API_SECRET = os.getenv("MAGICBELL_API_SECRET", "")

# Gmail SMTP for email notifications to admins
SMTP_EMAIL = os.getenv("SMTP_EMAIL", "")          # e.g. yourname@gmail.com
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")     # Gmail App Password (16-char)
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))

# Twilio SMS (optional — leave empty to disable)
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER", "")

# App URL (used in email links)
APP_URL = os.getenv("APP_URL", "http://localhost:3000")

# Stripe Billing
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_PUBLISHABLE_KEY = os.getenv("STRIPE_PUBLISHABLE_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
STRIPE_PRICE_PRO = os.getenv("STRIPE_PRICE_PRO", "")
STRIPE_PRICE_ENTERPRISE = os.getenv("STRIPE_PRICE_ENTERPRISE", "")

# CORS — comma-separated allowed origins (production frontend URLs)
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*")
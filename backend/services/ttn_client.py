"""
TTN (Tunisie TradeNet) El Fatoora platform integration client.

Handles submission of validated e-invoices to Tunisia's central clearance
platform. This module is designed as a stub — the actual TTN API endpoints
and authentication will be updated when TTN publishes their final specifications.

Current functionality:
- Simulated submission with validation pre-checks
- Audit trail recording for all submission attempts
- Retry handling for failed submissions
"""

import uuid
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

# TTN API configuration (to be updated with real endpoints)
TTN_API_BASE = "https://api.elfatoora.tn"  # Placeholder
TTN_API_VERSION = "v1"
TTN_TIMEOUT = 30  # seconds


class TTNSubmissionResult:
    """Result of a TTN submission attempt."""

    def __init__(self, success: bool, ttn_id: str | None = None,
                 status: str = "pending", message: str = "",
                 errors: list | None = None):
        self.success = success
        self.ttn_id = ttn_id
        self.status = status
        self.message = message
        self.errors = errors or []

    def to_dict(self) -> dict:
        return {
            "success": self.success,
            "ttn_unique_id": self.ttn_id,
            "status": self.status,
            "message": self.message,
            "errors": self.errors,
        }


def _pre_validate_for_submission(invoice_data: dict, compliance: dict | None) -> list[str]:
    """Check if invoice meets minimum requirements for TTN submission."""
    blockers = []

    if not compliance or not compliance.get("is_compliant"):
        blockers.append("Invoice must pass compliance validation before submission")

    data = invoice_data.get("data", invoice_data)

    if not data.get("seller_vat_id"):
        blockers.append("Seller VAT ID (matricule fiscale) is required for TTN submission")

    if not data.get("buyer_vat_id"):
        blockers.append("Buyer VAT ID (matricule fiscale) is required for TTN submission")

    if not data.get("invoice_no"):
        blockers.append("Invoice number is required")

    if not data.get("date"):
        blockers.append("Invoice date is required")

    if not data.get("line_items"):
        blockers.append("At least one line item is required")

    totals = data.get("totals") or {}
    if not totals.get("grand_total") and totals.get("grand_total") != 0:
        blockers.append("Grand total is required")

    source_format = data.get("source_format") or invoice_data.get("source_format")
    if source_format != "xml":
        blockers.append("TTN submission requires XML format invoice (convert PDF/image to XML first)")

    return blockers


def submit_to_ttn(invoice_doc: dict, db=None) -> TTNSubmissionResult:
    """
    Submit a validated invoice to the TTN El Fatoora platform.

    NOTE: This is currently a SIMULATED submission. It performs pre-validation
    and generates a mock TTN ID. Once TTN publishes their API, this function
    will make actual HTTP calls to the El Fatoora endpoints.

    Args:
        invoice_doc: Full invoice document from MongoDB.
        db: MongoDB database reference for audit logging.

    Returns:
        TTNSubmissionResult with submission status.
    """
    invoice_id = str(invoice_doc.get("_id", ""))
    data = invoice_doc.get("data", {})
    compliance = data.get("compliance") or invoice_doc.get("compliance", {})

    # Pre-validation
    blockers = _pre_validate_for_submission(invoice_doc, compliance)
    if blockers:
        result = TTNSubmissionResult(
            success=False,
            status="rejected",
            message="Invoice does not meet TTN submission requirements",
            errors=blockers,
        )
        _record_audit(db, invoice_id, result, "pre_validation_failed")
        return result

    # ── SIMULATED SUBMISSION ────────────────────────────────────────────
    # In production, this would be:
    # 1. Convert invoice data to TTN XML schema
    # 2. Sign with organization's digital certificate
    # 3. POST to TTN_API_BASE/api/v1/invoices
    # 4. Parse response for TTN unique ID

    ttn_unique_id = f"TTN-{datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:8].upper()}"

    logger.info(
        "TTN SIMULATED submission for invoice %s → TTN ID: %s",
        invoice_id, ttn_unique_id,
    )

    result = TTNSubmissionResult(
        success=True,
        ttn_id=ttn_unique_id,
        status="accepted",
        message="Invoice submitted successfully to El Fatoora (simulated)",
    )

    _record_audit(db, invoice_id, result, "submitted")

    return result


def check_ttn_status(ttn_unique_id: str) -> dict:
    """
    Check the status of a previously submitted invoice on TTN.

    NOTE: Stub implementation. Returns simulated status.
    """
    return {
        "ttn_unique_id": ttn_unique_id,
        "status": "accepted",
        "message": "Invoice accepted by El Fatoora platform (simulated)",
        "last_checked": datetime.utcnow().isoformat(),
    }


def _record_audit(db, invoice_id: str, result: TTNSubmissionResult, action: str):
    """Record submission attempt in audit trail."""
    if db is None:
        return

    try:
        db["ttn_audit_trail"].insert_one({
            "invoice_id": invoice_id,
            "action": action,
            "ttn_unique_id": result.ttn_id,
            "status": result.status,
            "message": result.message,
            "errors": result.errors,
            "timestamp": datetime.utcnow().isoformat(),
        })
    except Exception as e:
        logger.error("Failed to record TTN audit: %s", e)

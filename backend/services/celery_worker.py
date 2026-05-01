import os
from celery import Celery
from services.db_service import invoices_collection
from services.extractor_core import extract_from_file, now_iso
from services.xml_parser import is_xml_file

CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/0")

celery = Celery(
    "backend_worker",
    broker=CELERY_BROKER_URL,
    backend=CELERY_RESULT_BACKEND
)

def run_invoice_processing(user_id: str, file_path: str, original_filename: str,
                           org_id: str = None) -> dict:
    """
    Core processing logic — shared between the Celery task and the synchronous fallback.
    Extracts invoice data and saves it to MongoDB.
    """
    final_filename = os.path.basename(file_path)

    # Check if XML and store raw content
    raw_xml = None
    source_format = os.path.splitext(file_path)[1].lstrip(".").lower()
    if is_xml_file(original_filename):
        source_format = "xml"
        try:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                raw_xml = f.read()
        except Exception:
            pass

    invoice_doc = {
        "user_id": user_id,
        "org_id": org_id or "",
        "filename": final_filename,
        "original_filename": original_filename,
        "source_format": source_format,
        "status": "processing",
        "data": {},
        "created_at": now_iso(),
    }
    if raw_xml:
        invoice_doc["raw_xml"] = raw_xml

    result = invoices_collection.insert_one(invoice_doc)
    invoice_id = result.inserted_id

    try:
        extracted_data = extract_from_file(file_path)
        update_fields = {
            "data": extracted_data,
            "status": "completed",
            "updated_at": now_iso(),
            "source_format": extracted_data.get("source_format", source_format),
        }
        if extracted_data.get("invoice_category"):
            update_fields["invoice_category"] = extracted_data["invoice_category"]
        if extracted_data.get("compliance"):
            update_fields["compliance_status"] = (
                "compliant" if extracted_data["compliance"].get("is_compliant") else "non_compliant"
            )
        invoices_collection.update_one(
            {"_id": invoice_id},
            {"$set": update_fields},
        )
    except Exception:
        invoices_collection.update_one(
            {"_id": invoice_id},
            {"$set": {"status": "failed", "updated_at": now_iso()}},
        )
        raise

    return {
        "success": True,
        "message": "Processed successfully",
        "invoice_id": str(invoice_id),
        "extracted_data": extracted_data,
    }


@celery.task(bind=True)
def process_invoice_task(self, user_id: str, file_path: str, original_filename: str,
                         org_id: str = None):
    """Celery task wrapper around run_invoice_processing."""
    try:
        return run_invoice_processing(user_id, file_path, original_filename, org_id=org_id)
    except Exception as e:
        self.update_state(state="FAILURE", meta={"exc_type": type(e).__name__, "exc_message": str(e)})
        raise e

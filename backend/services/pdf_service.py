import io
import logging
import fitz  # PyMuPDF
import pdfplumber
from PIL import Image

logger = logging.getLogger(__name__)

_MIN_TEXT_LENGTH = 50


def _extract_with_pymupdf(file_path: str) -> str:
    text_parts = []
    try:
        doc = fitz.open(file_path)
        for page in doc:
            text_parts.append(page.get_text())
        doc.close()
    except Exception as e:
        logger.warning("PyMuPDF failed: %s", e)
    return "\n".join(text_parts).strip()


def _extract_with_pdfplumber(file_path: str) -> str:
    text_parts = []
    try:
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text)
    except Exception as e:
        logger.warning("pdfplumber failed: %s", e)
    return "\n".join(text_parts).strip()


def _ocr_pdf_pages(file_path: str) -> str:
    """Convert scanned PDF pages to images, then run Tesseract OCR."""
    try:
        from services.image_service import run_ocr

        doc = fitz.open(file_path)
        parts = []
        for i, page in enumerate(doc):
            logger.info("OCR on PDF page %d/%d…", i + 1, len(doc))
            pix = page.get_pixmap(dpi=300)
            img = Image.open(io.BytesIO(pix.tobytes("png")))
            text = run_ocr(img)
            if text:
                parts.append(text)
        doc.close()
        return "\n".join(parts).strip()
    except Exception as e:
        logger.error("PDF OCR fallback failed: %s", e)
        return ""


def extract_text_from_pdf(file_path: str) -> str:
    """
    1. PyMuPDF (fast, digital PDFs)
    2. pdfplumber (fallback)
    3. OCR via PyMuPDF render + Tesseract (scanned PDFs)
    """
    text = _extract_with_pymupdf(file_path)

    if len(text) < _MIN_TEXT_LENGTH:
        logger.info("PyMuPDF got %d chars, trying pdfplumber…", len(text))
        plumber_text = _extract_with_pdfplumber(file_path)
        if len(plumber_text) > len(text):
            text = plumber_text

    if len(text) < _MIN_TEXT_LENGTH:
        logger.info("Text extraction got %d chars — switching to OCR…", len(text))
        text = _ocr_pdf_pages(file_path)

    return text

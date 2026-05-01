import os
import logging
import pytesseract
from PIL import Image, ImageEnhance, ImageFilter, ImageOps

from config import TESSERACT_CMD, TESSDATA_PREFIX

logger = logging.getLogger(__name__)

# Configure Tesseract paths
pytesseract.pytesseract.tesseract_cmd = TESSERACT_CMD
os.environ["TESSDATA_PREFIX"] = TESSDATA_PREFIX

_TESS_CONFIG = "--oem 3 --psm 6"


def _ensure_min_size(img: Image.Image, min_width: int = 1500) -> Image.Image:
    if img.width < min_width:
        scale = min_width / img.width
        new_size = (int(img.width * scale), int(img.height * scale))
        img = img.resize(new_size, Image.LANCZOS)
    return img


def _strategy_standard(img: Image.Image) -> Image.Image:
    """Light background, dark text (most common)."""
    img = img.convert("L")
    img = _ensure_min_size(img)
    img = img.filter(ImageFilter.SHARPEN)
    img = ImageEnhance.Contrast(img).enhance(2.0)
    img = img.point(lambda px: 0 if px < 140 else 255, "1").convert("L")
    return img


def _strategy_adaptive(img: Image.Image) -> Image.Image:
    """Minimal processing — just grayscale + upscale + contrast."""
    img = img.convert("L")
    img = _ensure_min_size(img)
    img = ImageEnhance.Contrast(img).enhance(1.5)
    return img


def _strategy_original(img: Image.Image) -> Image.Image:
    """No preprocessing — just upscale."""
    return _ensure_min_size(img.convert("RGB"))


def run_ocr(img: Image.Image) -> str:
    return pytesseract.image_to_string(img, config=_TESS_CONFIG).strip()


def preprocess_image(img: Image.Image) -> Image.Image:
    return _strategy_adaptive(img)


def extract_text_from_image(file_path: str) -> str:
    """
    Try multiple OCR strategies and return the best result.
    Stops early if >200 chars extracted.
    """
    try:
        original = Image.open(file_path)
    except Exception as e:
        logger.error("Cannot open image %s: %s", file_path, e)
        return ""

    strategies = [
        ("original",  _strategy_original),
        ("adaptive",  _strategy_adaptive),
        ("standard",  _strategy_standard),
    ]

    best_text = ""
    best_len = 0

    for name, fn in strategies:
        try:
            processed = fn(original.copy())
            text = run_ocr(processed)
            char_count = len(text.strip())
            logger.info("OCR strategy '%s': %d chars", name, char_count)

            if char_count > best_len:
                best_text = text
                best_len = char_count

            if char_count > 200:
                break
        except Exception as e:
            logger.warning("OCR strategy '%s' failed: %s", name, e)
            continue

    logger.info("Best OCR: %d chars from %s", best_len, file_path)
    return best_text

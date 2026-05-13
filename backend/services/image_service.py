import os
import re
import logging
import pytesseract
from PIL import Image, ImageEnhance, ImageFilter, ImageOps

from config import TESSERACT_CMD, TESSDATA_PREFIX

logger = logging.getLogger(__name__)

# Configure Tesseract paths
pytesseract.pytesseract.tesseract_cmd = TESSERACT_CMD
os.environ["TESSDATA_PREFIX"] = TESSDATA_PREFIX

# Language configs for Tesseract OCR
_TESS_LANGS = {
    "auto": "eng+fra+ara",
    "en": "eng",
    "fr": "fra",
    "ar": "ara",
    "en+fr": "eng+fra",
    "en+ar": "eng+ara",
    "fr+ar": "fra+ara",
}

_TESS_BASE_CONFIG = "--oem 3 --psm 6"

# Regex patterns for Arabic character detection
_ARABIC_RE = re.compile(r"[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]")
_FRENCH_RE = re.compile(r"[àâäéèêëïîôùûüÿçœæÀÂÄÉÈÊËÏÎÔÙÛÜŸÇŒÆ]")


def _get_tess_config(lang: str = "auto") -> str:
    """Build Tesseract config string with the right language pack."""
    lang_code = _TESS_LANGS.get(lang, _TESS_LANGS["auto"])
    return f"{_TESS_BASE_CONFIG} -l {lang_code}"


def detect_text_language(text: str) -> str:
    """Detect the dominant language of extracted text."""
    if not text:
        return "en"
    arabic_count = len(_ARABIC_RE.findall(text))
    french_count = len(_FRENCH_RE.findall(text))
    total = len(text)

    if total == 0:
        return "en"

    arabic_ratio = arabic_count / total
    french_ratio = french_count / total

    if arabic_ratio > 0.05:
        return "ar"
    if french_ratio > 0.01:
        return "fr"
    return "en"


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


def run_ocr(img: Image.Image, lang: str = "auto") -> str:
    config = _get_tess_config(lang)
    return pytesseract.image_to_string(img, config=config).strip()


def preprocess_image(img: Image.Image) -> Image.Image:
    return _strategy_adaptive(img)


def extract_text_from_image(file_path: str, lang: str = "auto") -> str:
    """
    Try multiple OCR strategies and return the best result.
    Stops early if >200 chars extracted.

    lang: "auto" (try all), "en", "fr", "ar", "en+fr", etc.
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

    # First pass: try with the requested language
    for name, fn in strategies:
        try:
            processed = fn(original.copy())
            text = run_ocr(processed, lang)
            char_count = len(text.strip())
            logger.info("OCR strategy '%s' (lang=%s): %d chars", name, lang, char_count)

            if char_count > best_len:
                best_text = text
                best_len = char_count

            if char_count > 200:
                break
        except Exception as e:
            logger.warning("OCR strategy '%s' failed: %s", name, e)
            continue

    # If auto mode got poor results, try with specific language detection
    if lang == "auto" and best_len > 20:
        detected = detect_text_language(best_text)
        if detected != "en":
            logger.info("Detected language: %s, re-running OCR with specific lang", detected)
            for name, fn in strategies:
                try:
                    processed = fn(original.copy())
                    text = run_ocr(processed, detected)
                    char_count = len(text.strip())
                    if char_count > best_len:
                        best_text = text
                        best_len = char_count
                    if char_count > 200:
                        break
                except Exception:
                    continue

    logger.info("Best OCR: %d chars from %s", best_len, file_path)
    return best_text

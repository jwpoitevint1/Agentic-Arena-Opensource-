import math
import re
from decimal import Decimal
from typing import Any


_NUMERIC_TEXT_RE = re.compile(r"^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$")
_CURRENCY_SYMBOLS = {"$", "€", "£"}


def parse_numeric_like(value: Any) -> float | None:
    """Parse bounded numeric-like dataset values without guessing from free text.

    Supported encodings include plain numeric values, currency symbols, commas,
    percentages, surrounding whitespace, and accounting-style parentheses.
    Percentage text preserves displayed percentage units: 11.94% becomes 11.94.
    """
    if value is None or isinstance(value, bool):
        return None

    if isinstance(value, (int, float, Decimal)):
        number = float(value)
        return number if math.isfinite(number) else None

    if not isinstance(value, str):
        return None

    text = value.strip()
    if not text:
        return None

    negative_parentheses = text.startswith("(") and text.endswith(")")
    if negative_parentheses:
        text = text[1:-1].strip()

    if text.endswith("%"):
        text = text[:-1].strip()

    text = text.replace(",", "").strip()

    sign = ""
    if text[:1] in {"+", "-"}:
        sign = text[0]
        text = text[1:].strip()

    if text[:1] in _CURRENCY_SYMBOLS:
        text = text[1:].strip()

    text = sign + text
    if not _NUMERIC_TEXT_RE.fullmatch(text):
        return None

    number = float(text)
    if not math.isfinite(number):
        return None
    return -abs(number) if negative_parentheses else number

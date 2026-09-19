import logging
import re
from dataclasses import dataclass

from app.config import settings


logger = logging.getLogger("agentic_arena.chatbot_guardrails")


@dataclass(frozen=True)
class GuardResult:
    allowed: bool
    category: str | None
    response: str | None
    sanitized_text: str


_PROFANITY_PATTERNS = tuple(
    re.compile(pattern, re.IGNORECASE)
    for pattern in (
        r"\bf+u+c+k+(?:ing|ed|er|ers)?\b",
        r"\bsh+i+t+(?:ty|ting)?\b",
        r"\bb+i+t+c+h+(?:es|y)?\b",
        r"\ba+s+s+h+o+l+e+s?\b",
        r"\bc+u+n+t+s?\b",
        r"\bm+o+t+h+e+r+f+u+c+k+e+r+s?\b",
        r"\bd+a+m+n+(?:ed|it)?\b",
    )
)

_SEXUAL_EXPLICIT_PATTERNS = tuple(
    re.compile(pattern, re.IGNORECASE)
    for pattern in (
        r"\bporn(?:ography|ographic)?\b",
        r"\bsexual(?:ly)? explicit\b",
        r"\bexplicit sex(?:ual)?\b",
        r"\bsexual act(?:s)?\b",
        r"\bintercourse\b",
        r"\bmasturbat(?:e|ion|ing)\b",
        r"\bblowjob\b",
        r"\bhandjob\b",
        r"\borgasm(?:s|ic)?\b",
        r"\bnudes?\b",
        r"\berotic(?:a|ism)?\b",
        r"\bgenitals?\b",
        r"\bpenis\b",
        r"\bvagina\b",
    )
)

_PHILOSOPHY_PATTERNS = tuple(
    re.compile(pattern, re.IGNORECASE)
    for pattern in (
        r"\bphilosoph(?:y|ical|ically)\b",
        r"\bexistential(?:ism|ist|ist)?\b",
        r"\bstoic(?:ism)?\b",
        r"\bmetaphysics?\b",
        r"\bepistemolog(?:y|ical)\b",
        r"\bontology\b",
        r"\bnihilis(?:m|t)\b",
        r"\butilitarian(?:ism)?\b",
        r"\bdeontolog(?:y|ical)\b",
        r"\bmeaning of life\b",
        r"\bfree will\b",
    )
)

_TECH_ABSTRACT_TERMS = (
    "ai",
    "artificial intelligence",
    "llm",
    "model",
    "technology",
    "software",
    "computer",
    "computing",
    "algorithm",
    "data",
    "automation",
    "agent",
    "agentic",
    "governance",
    "policy",
    "security",
    "architecture",
    "system",
    "digital",
    "database",
    "mcp",
    "cv 1.1",
    "cv1.1",
)

_REDEFINITION_PHRASES = tuple(
    re.compile(pattern, re.IGNORECASE)
    for pattern in (
        r"\bredefine\b",
        r"\bchange the definition\b",
        r"\bnew definition\b",
        r"\bmeans something else\b",
        r"\bfrom now on .* means\b",
    )
)


def _redact(text: str) -> str:
    result = text
    for pattern in settings.chatbot.redactions.pii_like_patterns:
        try:
            result = re.sub(pattern, "[REDACTED]", result)
        except re.error:
            logger.warning("invalid_redaction_regex pattern=%r", pattern)
    return result


def _matches_any(text: str, patterns: tuple[re.Pattern[str], ...]) -> bool:
    return any(pattern.search(text) for pattern in patterns)


def _configured_regex_match(text: str, patterns: list[str]) -> bool:
    for pattern in patterns:
        try:
            if re.search(pattern, text):
                return True
        except re.error:
            logger.warning("invalid_guardrail_regex pattern=%r", pattern)
    return False


def _protected_redefinition(text: str) -> bool:
    if not settings.chatbot.protected_lexicon.redefinition_ban:
        return False
    lowered = text.lower()
    protected = any(term.lower() in lowered for term in settings.chatbot.protected_lexicon.terms)
    if not protected:
        return False
    if _matches_any(text, _REDEFINITION_PHRASES):
        return True
    return _configured_regex_match(text, settings.chatbot.philosophy.drift_indicators)


def _philosophy_out_of_scope(text: str) -> bool:
    if settings.chatbot.philosophy.allowed:
        return False
    if not _matches_any(text, _PHILOSOPHY_PATTERNS):
        return False
    if settings.chatbot.philosophy.abstract_technology_exception:
        lowered = text.lower()
        if any(
            re.search(r"(?<!\w)" + re.escape(term) + r"(?!\w)", lowered)
            for term in _TECH_ABSTRACT_TERMS
        ):
            return False
    return True


def _bias_severity(text: str) -> float:
    lowered = text.lower()
    lexicon = settings.chatbot.anti_bias.classifier.lexicon
    if any(term.lower() in lowered for term in lexicon.high_severity):
        return 1.0
    if any(term.lower() in lowered for term in lexicon.medium_severity):
        return 0.7
    if any(term.lower() in lowered for term in lexicon.low_severity):
        return 0.4
    return 0.0


def evaluate_input(text: str) -> GuardResult:
    sanitized = _redact(text)
    if not settings.chatbot.defaults.safe_mode:
        return GuardResult(True, None, None, sanitized)

    responses = settings.chatbot.responses

    if _configured_regex_match(sanitized, settings.chatbot.jailbreak_indicators.patterns):
        logger.warning("chatbot_guard_block category=jailbreak")
        return GuardResult(False, "jailbreak", responses.jailbreak_msg, sanitized)

    if _protected_redefinition(sanitized):
        logger.warning("chatbot_guard_block category=protected_redefinition")
        return GuardResult(False, "protected_redefinition", responses.redefinition_msg, sanitized)

    if (
        not settings.chatbot.content_controls.profanity.allowed
        and _matches_any(sanitized, _PROFANITY_PATTERNS)
    ):
        logger.warning("chatbot_guard_block category=profanity")
        return GuardResult(False, "profanity", responses.profanity_msg, sanitized)

    if (
        not settings.chatbot.content_controls.sexual_content.allowed
        and _matches_any(sanitized, _SEXUAL_EXPLICIT_PATTERNS)
    ):
        logger.warning("chatbot_guard_block category=sexual_or_explicit")
        return GuardResult(False, "sexual_or_explicit", responses.sexual_msg, sanitized)

    if _philosophy_out_of_scope(sanitized):
        logger.info("chatbot_guard_refocus category=philosophy")
        return GuardResult(False, "philosophy", responses.philosophy_msg, sanitized)

    severity = _bias_severity(sanitized)
    if severity >= settings.chatbot.anti_bias.classifier.threshold:
        logger.warning("chatbot_guard_block category=bias severity=%.2f", severity)
        return GuardResult(False, "bias", responses.bias_msg, sanitized)

    return GuardResult(True, None, None, sanitized)


def evaluate_output(text: str) -> GuardResult:
    sanitized = _redact(text)
    if not settings.chatbot.defaults.safe_mode:
        return GuardResult(True, None, None, sanitized)

    responses = settings.chatbot.responses
    if (
        not settings.chatbot.content_controls.profanity.allowed
        and _matches_any(sanitized, _PROFANITY_PATTERNS)
    ):
        logger.warning("chatbot_output_block category=profanity")
        return GuardResult(False, "profanity", responses.profanity_msg, sanitized)

    if (
        not settings.chatbot.content_controls.sexual_content.allowed
        and _matches_any(sanitized, _SEXUAL_EXPLICIT_PATTERNS)
    ):
        logger.warning("chatbot_output_block category=sexual_or_explicit")
        return GuardResult(False, "sexual_or_explicit", responses.sexual_msg, sanitized)

    if _philosophy_out_of_scope(sanitized):
        logger.info("chatbot_output_refocus category=philosophy")
        return GuardResult(False, "philosophy", responses.philosophy_msg, sanitized)

    severity = _bias_severity(sanitized)
    if severity >= settings.chatbot.anti_bias.classifier.threshold:
        logger.warning("chatbot_output_block category=bias severity=%.2f", severity)
        return GuardResult(False, "bias", responses.bias_msg, sanitized)

    return GuardResult(True, None, None, sanitized)


def tone_instruction() -> str:
    tone = settings.chatbot.defaults.tone
    profile = settings.chatbot.tone_profiles.get(tone)
    if profile is None:
        profile = settings.chatbot.tone_profiles["professional"]
    return profile.style


def sanitize_output(text: str) -> str:
    return _redact(text)

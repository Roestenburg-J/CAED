"""
Custom exception hierarchy for the CAED backend.

All exceptions carry http_status and error_code as class attributes so that
the Flask app-level error handler can produce consistent JSON responses without
any per-route exception mapping.
"""


class CAEDError(Exception):
    """Base exception for all CAED application errors."""

    http_status: int = 500
    error_code: str = "internal_error"


# ---------------------------------------------------------------------------
# Configuration / Setup Errors
# ---------------------------------------------------------------------------


class ConfigurationError(CAEDError):
    """Settings file missing, malformed, or missing required keys."""

    http_status = 500
    error_code = "configuration_error"


# ---------------------------------------------------------------------------
# LLM Provider Errors
# ---------------------------------------------------------------------------


class LLMError(CAEDError):
    """Base class for all LLM-related failures."""

    http_status = 503
    error_code = "llm_error"


class LLMAuthenticationError(LLMError):
    """API key is missing, invalid, or expired."""

    http_status = 503
    error_code = "llm_authentication_error"


class LLMRateLimitError(LLMError):
    """Provider rate limit or quota exceeded."""

    http_status = 503
    error_code = "llm_rate_limit_error"


class LLMResponseError(LLMError):
    """Provider returned an empty, malformed, or unparseable response."""

    http_status = 503
    error_code = "llm_response_error"


# ---------------------------------------------------------------------------
# Data / File System Errors
# ---------------------------------------------------------------------------


class DatasetNotFoundError(CAEDError):
    """Requested dataset_id does not exist on disk."""

    http_status = 404
    error_code = "dataset_not_found"


class AnalysisNotRunError(CAEDError):
    """A required analysis step has not been run yet (output file missing)."""

    http_status = 422
    error_code = "analysis_not_run"


class DataValidationError(CAEDError):
    """Uploaded or processed data does not meet structural requirements."""

    http_status = 422
    error_code = "data_validation_error"


class OutputParsingError(CAEDError):
    """LLM output could not be parsed into the expected structure."""

    http_status = 500
    error_code = "output_parsing_error"

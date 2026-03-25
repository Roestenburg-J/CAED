from abc import ABC, abstractmethod
import logging
import time

from .schemas import LLMRequest, LLMResponse

logger = logging.getLogger(__name__)


def call_with_retry(fn, provider_name: str, max_retries: int = 3):
    """
    Generic retry wrapper for transient LLM API errors.

    Callers are responsible for mapping SDK-specific exceptions to CAED
    exception types *inside* `fn` before this wrapper sees them.  This
    wrapper catches any exception, logs a warning, waits with exponential
    back-off, and re-raises on the final attempt.
    """
    for attempt in range(max_retries):
        try:
            return fn()
        except Exception as e:
            if attempt < max_retries - 1:
                wait = 2 ** attempt  # 1s, 2s, 4s
                logger.warning(
                    "%s API error (attempt %d/%d), retrying in %ds: %s",
                    provider_name, attempt + 1, max_retries, wait, e,
                )
                time.sleep(wait)
            else:
                raise


class BaseLLMProvider(ABC):
    def __init__(self, api_key: str):
        self.api_key = api_key

    @abstractmethod
    def generate(self, request: LLMRequest) -> LLMResponse:
        """Standard synchronous call"""
        pass

    @abstractmethod
    def stream(self, request: LLMRequest):
        """Streaming generator"""
        pass

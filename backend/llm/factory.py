import logging

from .providers.openai_provider import OpenAIProvider
from .base import BaseLLMProvider
from exceptions import LLMAuthenticationError

logger = logging.getLogger(__name__)


class LLMProviderFactory:

    @staticmethod
    def create(settings: dict) -> BaseLLMProvider:
        api_key = settings.get("openai_api_key", "")
        if not api_key:
            raise LLMAuthenticationError(
                "OpenAI API key is not configured in settings."
            )
        return OpenAIProvider(
            api_key=api_key,
            organization=settings.get("openai_organization") or None,
            project=settings.get("openai_project") or None,
        )

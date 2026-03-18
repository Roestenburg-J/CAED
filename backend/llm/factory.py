import logging

from .providers.openai_provider import OpenAIProvider
from .providers.anthropic_provider import AnthropicProvider
from .providers.gemini_provider import GeminiProvider
from .base import BaseLLMProvider
from exceptions import LLMProviderNotFoundError, LLMAuthenticationError

logger = logging.getLogger(__name__)


class LLMProviderFactory:

    @staticmethod
    def create(settings: dict) -> BaseLLMProvider:
        provider_name = settings.get("provider", "openai").lower()

        if provider_name == "openai":
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

        if provider_name == "anthropic":
            api_key = settings.get("anthropic_api_key", "")
            if not api_key:
                raise LLMAuthenticationError(
                    "Anthropic API key is not configured in settings."
                )
            return AnthropicProvider(api_key=api_key)

        if provider_name == "gemini":
            api_key = settings.get("gemini_api_key", "")
            if not api_key:
                raise LLMAuthenticationError(
                    "Gemini API key is not configured in settings."
                )
            return GeminiProvider(api_key=api_key)

        raise LLMProviderNotFoundError(
            f"Unsupported LLM provider: '{provider_name}'. Supported: openai, anthropic, gemini."
        )

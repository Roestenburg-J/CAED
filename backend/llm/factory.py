from .providers.openai_provider import OpenAIProvider
from .providers.anthropic_provider import AnthropicProvider
from .providers.gemini_provider import GeminiProvider
from .base import BaseLLMProvider


class LLMProviderFactory:

    @staticmethod
    def create(settings: dict) -> BaseLLMProvider:
        provider_name = settings.get("provider", "openai").lower()

        if provider_name == "openai":
            return OpenAIProvider(
                api_key=settings.get("openai_api_key", ""),
                organization=settings.get("openai_organization") or None,
                project=settings.get("openai_project") or None,
            )

        if provider_name == "anthropic":
            return AnthropicProvider(api_key=settings.get("anthropic_api_key", ""))

        if provider_name == "gemini":
            return GeminiProvider(api_key=settings.get("gemini_api_key", ""))

        raise ValueError(f"Unsupported provider: {provider_name}")

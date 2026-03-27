import logging
from typing import Optional

from openai import OpenAI, AuthenticationError, RateLimitError, APIError, APIConnectionError

from ..base import BaseLLMProvider, call_with_retry
from ..schemas import LLMRequest, LLMResponse
from exceptions import LLMAuthenticationError, LLMRateLimitError, LLMResponseError

logger = logging.getLogger(__name__)


class OpenAIProvider(BaseLLMProvider):
    def __init__(self, api_key: str, organization: Optional[str] = None, project: Optional[str] = None):
        super().__init__(api_key)
        self.client = OpenAI(
            api_key=api_key,
            organization=organization or None,
            project=project or None,
        )

    def generate(self, request: LLMRequest) -> LLMResponse:
        kwargs = dict(
            model=request.model,
            messages=[m.__dict__ for m in request.messages],
            # max_completion_tokens replaces the deprecated max_tokens parameter
            # for GPT-4o and later models (including all GPT-5 variants).
            max_completion_tokens=request.max_tokens,
        )
        if request.response_format is not None:
            kwargs["response_format"] = request.response_format

        def _call():
            try:
                return self.client.chat.completions.create(**kwargs)
            except AuthenticationError as e:
                raise LLMAuthenticationError(
                    f"OpenAI authentication failed. Check your API key. ({e})"
                ) from e
            except RateLimitError as e:
                raise LLMRateLimitError(
                    f"OpenAI rate limit exceeded: {e}"
                ) from e
            except (APIError, APIConnectionError) as e:
                raise LLMResponseError(
                    f"OpenAI API error: {e}"
                ) from e

        response = call_with_retry(_call, "OpenAI")

        if not response.choices or response.choices[0].message.content is None:
            raise LLMResponseError("OpenAI returned an empty response.")

        return LLMResponse(
            content=response.choices[0].message.content,
            completion_tokens=response.usage.completion_tokens,
            prompt_tokens=response.usage.prompt_tokens,
            total_tokens=response.usage.total_tokens,
        )

    def stream(self, request: LLMRequest):
        stream = self.client.chat.completions.create(
            model=request.model,
            messages=[m.__dict__ for m in request.messages],
            max_completion_tokens=request.max_tokens,
            stream=True,
        )

        for chunk in stream:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

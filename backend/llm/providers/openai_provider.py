from typing import Optional
from openai import OpenAI
from ..base import BaseLLMProvider
from ..schemas import LLMRequest, LLMResponse


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
            max_tokens=request.max_tokens,
        )
        if request.response_format is not None:
            kwargs["response_format"] = request.response_format

        response = self.client.chat.completions.create(**kwargs)

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
            max_tokens=request.max_tokens,
            stream=True,
        )

        for chunk in stream:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

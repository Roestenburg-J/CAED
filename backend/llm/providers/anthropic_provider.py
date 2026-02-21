import json
import anthropic
from ..base import BaseLLMProvider
from ..schemas import LLMRequest, LLMResponse


class AnthropicProvider(BaseLLMProvider):
    def __init__(self, api_key: str):
        super().__init__(api_key)
        self.client = anthropic.Anthropic(api_key=api_key)

    def generate(self, request: LLMRequest) -> LLMResponse:
        system_prompt = self._get_system_prompt(request)

        if request.response_format is not None:
            schema = self._extract_schema(request.response_format)
            schema_instruction = f"\n\nRespond ONLY with a valid JSON object matching this schema (no markdown, no extra text):\n{json.dumps(schema, indent=2)}"
            system_prompt = (system_prompt or "") + schema_instruction

        response = self.client.messages.create(
            model=request.model,
            max_tokens=request.max_tokens,
            messages=[
                {"role": m.role, "content": m.content}
                for m in request.messages
                if m.role != "system"
            ],
            system=system_prompt,
        )

        return LLMResponse(
            content=response.content[0].text,
            completion_tokens=response.usage.output_tokens,
            prompt_tokens=response.usage.input_tokens,
            total_tokens=response.usage.input_tokens + response.usage.output_tokens,
        )

    def stream(self, request: LLMRequest):
        system_prompt = self._get_system_prompt(request)

        if request.response_format is not None:
            schema = self._extract_schema(request.response_format)
            schema_instruction = f"\n\nRespond ONLY with a valid JSON object matching this schema (no markdown, no extra text):\n{json.dumps(schema, indent=2)}"
            system_prompt = (system_prompt or "") + schema_instruction

        with self.client.messages.stream(
            model=request.model,
            max_tokens=request.max_tokens,
            messages=[
                {"role": m.role, "content": m.content}
                for m in request.messages
                if m.role != "system"
            ],
            system=system_prompt,
        ) as stream:
            for text in stream.text_stream:
                yield text

    def _get_system_prompt(self, request: LLMRequest):
        for m in request.messages:
            if m.role == "system":
                return m.content
        return None

    def _extract_schema(self, response_format: dict) -> dict:
        """Extract the actual JSON schema from an OpenAI-style response_format dict."""
        if response_format.get("type") == "json_schema":
            return response_format.get("json_schema", {}).get("schema", response_format)
        return response_format

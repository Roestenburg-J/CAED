import json
from google import genai
from google.genai import types

from ..base import BaseLLMProvider
from ..schemas import LLMRequest, LLMResponse


class GeminiProvider(BaseLLMProvider):
    def __init__(self, api_key: str):
        super().__init__(api_key)
        self.client = genai.Client(api_key=api_key)

    def generate(self, request: LLMRequest) -> LLMResponse:
        system_prompt = self._extract_system_prompt(request)
        contents = self._convert_messages(request)

        if request.response_format is not None:
            schema = self._extract_schema(request.response_format)
            schema_instruction = f"\n\nRespond ONLY with a valid JSON object matching this schema (no markdown, no extra text):\n{json.dumps(schema, indent=2)}"
            system_prompt = (system_prompt or "") + schema_instruction

        response = self.client.models.generate_content(
            model=request.model,
            contents=contents,
            config=types.GenerateContentConfig(
                temperature=request.temperature,
                max_output_tokens=request.max_tokens,
                system_instruction=system_prompt,
            ),
        )

        usage = response.usage_metadata
        return LLMResponse(
            content=response.text,
            completion_tokens=usage.candidates_token_count or 0,
            prompt_tokens=usage.prompt_token_count or 0,
            total_tokens=usage.total_token_count or 0,
        )

    def stream(self, request: LLMRequest):
        system_prompt = self._extract_system_prompt(request)
        contents = self._convert_messages(request)

        if request.response_format is not None:
            schema = self._extract_schema(request.response_format)
            schema_instruction = f"\n\nRespond ONLY with a valid JSON object matching this schema (no markdown, no extra text):\n{json.dumps(schema, indent=2)}"
            system_prompt = (system_prompt or "") + schema_instruction

        stream = self.client.models.generate_content_stream(
            model=request.model,
            contents=contents,
            config=types.GenerateContentConfig(
                temperature=request.temperature,
                max_output_tokens=request.max_tokens,
                system_instruction=system_prompt,
            ),
        )

        for chunk in stream:
            if chunk.text:
                yield chunk.text

    def _convert_messages(self, request: LLMRequest):
        """Convert OpenAI-style messages to Gemini format."""
        contents = []
        for message in request.messages:
            if message.role == "system":
                continue  # handled separately via system_instruction
            role = "user" if message.role == "user" else "model"
            contents.append({"role": role, "parts": [{"text": message.content}]})
        return contents

    def _extract_system_prompt(self, request: LLMRequest):
        for message in request.messages:
            if message.role == "system":
                return message.content
        return None

    def _extract_schema(self, response_format: dict) -> dict:
        """Extract the actual JSON schema from an OpenAI-style response_format dict."""
        if response_format.get("type") == "json_schema":
            return response_format.get("json_schema", {}).get("schema", response_format)
        return response_format

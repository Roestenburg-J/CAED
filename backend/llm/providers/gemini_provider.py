import json
import logging

from google import genai
from google.genai import types

from ..base import BaseLLMProvider, call_with_retry
from ..schemas import LLMRequest, LLMResponse
from exceptions import LLMAuthenticationError, LLMRateLimitError, LLMResponseError

logger = logging.getLogger(__name__)

# google-genai raises from google.api_core.exceptions for most API errors
try:
    from google.api_core.exceptions import (
        Unauthenticated,
        ResourceExhausted,
        GoogleAPIError,
    )
except ImportError:
    # Graceful fallback if google-api-core is not installed separately
    Unauthenticated = Exception
    ResourceExhausted = Exception
    GoogleAPIError = Exception


class GeminiProvider(BaseLLMProvider):
    def __init__(self, api_key: str):
        super().__init__(api_key)
        self.client = genai.Client(api_key=api_key)

    # Hardcoded Gemini response schema matching the structured output format
    # used across all CAED analysis calls (attribute, dependency, violations).
    # Gemini's native response_schema enforces this at the API level, preventing
    # the model from returning prose or an empty output: [] for no-action prompts.
    _RESPONSE_SCHEMA = types.Schema(
        type=types.Type.OBJECT,
        properties={
            "output": types.Schema(
                type=types.Type.ARRAY,
                items=types.Schema(
                    type=types.Type.OBJECT,
                    properties={
                        "explanation": types.Schema(type=types.Type.STRING),
                        "index":       types.Schema(type=types.Type.NUMBER),
                        "annotation":  types.Schema(type=types.Type.INTEGER),
                        "possible_repair": types.Schema(type=types.Type.STRING),
                    },
                    required=["explanation", "index", "annotation", "possible_repair"],
                ),
            )
        },
        required=["output"],
    )

    def generate(self, request: LLMRequest) -> LLMResponse:
        system_prompt = self._extract_system_prompt(request)
        contents = self._convert_messages(request)

        # Build GenerateContentConfig — use native response_schema when a
        # structured format is requested so the API enforces the output shape
        # rather than relying on a text instruction (which Gemini ignores for
        # numeric/no-action prompts, returning output:[] and breaking processing).
        if request.response_format is not None:
            config = types.GenerateContentConfig(
                temperature=request.temperature,
                max_output_tokens=request.max_tokens,
                system_instruction=system_prompt,
                response_mime_type="application/json",
                response_schema=self._RESPONSE_SCHEMA,
            )
        else:
            config = types.GenerateContentConfig(
                temperature=request.temperature,
                max_output_tokens=request.max_tokens,
                system_instruction=system_prompt,
            )

        def _call():
            try:
                return self.client.models.generate_content(
                    model=request.model,
                    contents=contents,
                    config=config,
                )
            except Unauthenticated as e:
                raise LLMAuthenticationError(
                    f"Gemini authentication failed. Check your API key. ({e})"
                ) from e
            except ResourceExhausted as e:
                raise LLMRateLimitError(
                    f"Gemini rate limit exceeded: {e}"
                ) from e
            except GoogleAPIError as e:
                raise LLMResponseError(
                    f"Gemini API error: {e}"
                ) from e

        response = call_with_retry(_call, "Gemini")

        if response.text is None:
            raise LLMResponseError(
                "Gemini returned an empty response (content may have been filtered)."
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

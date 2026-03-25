import json
import logging

import anthropic
from anthropic import AuthenticationError, RateLimitError, APIError, APIConnectionError

from ..base import BaseLLMProvider, call_with_retry
from ..schemas import LLMRequest, LLMResponse
from exceptions import LLMAuthenticationError, LLMRateLimitError, LLMResponseError

logger = logging.getLogger(__name__)


class AnthropicProvider(BaseLLMProvider):
    def __init__(self, api_key: str):
        super().__init__(api_key)
        self.client = anthropic.Anthropic(api_key=api_key)

    def generate(self, request: LLMRequest) -> LLMResponse:
        system_prompt = self._get_system_prompt(request)

        messages = [
            {"role": m.role, "content": m.content}
            for m in request.messages
            if m.role != "system"
        ]

        if request.response_format is not None:
            # Use tool use to enforce structured JSON output.
            # Passing a schema as a plain text instruction is unreliable —
            # Claude may respond with prose before (or instead of) JSON.
            # Defining a tool with the required schema and forcing its use
            # guarantees the response is always valid, schema-conformant JSON.
            schema = self._extract_schema(request.response_format)
            tool_name = "structured_output"
            tools = [
                {
                    "name": tool_name,
                    "description": "Return the structured output as required.",
                    "input_schema": schema,
                }
            ]
            tool_choice = {"type": "tool", "name": tool_name}

            def _call():
                try:
                    return self.client.messages.create(
                        model=request.model,
                        max_tokens=request.max_tokens,
                        messages=messages,
                        system=system_prompt,
                        tools=tools,
                        tool_choice=tool_choice,
                    )
                except AuthenticationError as e:
                    raise LLMAuthenticationError(
                        f"Anthropic authentication failed. Check your API key. ({e})"
                    ) from e
                except RateLimitError as e:
                    raise LLMRateLimitError(
                        f"Anthropic rate limit exceeded: {e}"
                    ) from e
                except (APIError, APIConnectionError) as e:
                    raise LLMResponseError(
                        f"Anthropic API error: {e}"
                    ) from e

            response = call_with_retry(_call, "Anthropic")

            # Extract the tool call arguments — this is always valid JSON when
            # tool_choice forces a specific tool.
            tool_block = next(
                (block for block in response.content if block.type == "tool_use"),
                None,
            )
            if tool_block is None:
                raise LLMResponseError(
                    "Anthropic did not return a tool_use block. "
                    "Expected structured output via tool call."
                )

            content = json.dumps(tool_block.input)

        else:
            # No schema required — plain text response.
            def _call():  # type: ignore[no-redef]
                try:
                    return self.client.messages.create(
                        model=request.model,
                        max_tokens=request.max_tokens,
                        messages=messages,
                        system=system_prompt,
                    )
                except AuthenticationError as e:
                    raise LLMAuthenticationError(
                        f"Anthropic authentication failed. Check your API key. ({e})"
                    ) from e
                except RateLimitError as e:
                    raise LLMRateLimitError(
                        f"Anthropic rate limit exceeded: {e}"
                    ) from e
                except (APIError, APIConnectionError) as e:
                    raise LLMResponseError(
                        f"Anthropic API error: {e}"
                    ) from e

            response = call_with_retry(_call, "Anthropic")

            if not response.content or response.content[0].text is None:
                raise LLMResponseError("Anthropic returned an empty response.")

            content = response.content[0].text

        return LLMResponse(
            content=content,
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

from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any


@dataclass
class Message:
    role: str  # "system", "user", "assistant"
    content: str


@dataclass
class LLMRequest:
    model: str
    messages: List[Message]
    temperature: float = 0.7
    max_tokens: int = 1000
    stream: bool = False
    response_format: Optional[Dict[str, Any]] = None


@dataclass
class LLMResponse:
    content: str
    completion_tokens: int = 0
    prompt_tokens: int = 0
    total_tokens: int = 0

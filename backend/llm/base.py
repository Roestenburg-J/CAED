from abc import ABC, abstractmethod
from .schemas import LLMRequest, LLMResponse


class BaseLLMProvider(ABC):
    def __init__(self, api_key: str):
        self.api_key = api_key

    @abstractmethod
    def generate(self, request: LLMRequest) -> LLMResponse:
        """Standard synchronous call"""
        pass

    @abstractmethod
    def stream(self, request: LLMRequest):
        """Streaming generator"""
        pass

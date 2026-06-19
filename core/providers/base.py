from abc import ABC, abstractmethod

class BaseLLMProvider(ABC):
    """Abstract base class for LLM Providers."""
    
    @abstractmethod
    def invoke(self, prompt: str, model: str, messages: list, temperature: float = 0.7) -> dict:
        """Sends a request to the LLM provider.
        
        Args:
            prompt: System prompt / instruction.
            model: Model name.
            messages: List of message dicts [{"role": "user"|"assistant", "content": "..."}].
            temperature: Sampling temperature.
            
        Returns:
            dict with keys:
                success (bool): Whether the invocation succeeded.
                content (str): The response text.
                input_tokens (int): Count of input tokens.
                output_tokens (int): Count of output tokens.
                error (str): Error message (if success=False).
        """
        pass

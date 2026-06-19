from core.providers.base import BaseLLMProvider
from core.providers.ollama_provider import OllamaProvider
from core.providers.deepseek_provider import DeepSeekProvider
from core.providers.gemini_provider import GeminiProvider
from core.providers.anthropic_provider import AnthropicProvider

def get_provider(name: str, **kwargs) -> BaseLLMProvider:
    """Registry function to get provider instances by name.
    
    Args:
        name: Name of the provider ('ollama', 'deepseek', 'gemini', 'anthropic').
        **kwargs: Optional arguments for provider initialization (e.g. base_url for Ollama).
        
    Returns:
        BaseLLMProvider instance.
    """
    provider_name = name.lower().strip()
    if provider_name == 'ollama':
        return OllamaProvider(**kwargs)
    elif provider_name == 'deepseek':
        return DeepSeekProvider()
    elif provider_name == 'gemini':
        return GeminiProvider()
    elif provider_name == 'anthropic':
        return AnthropicProvider()
    else:
        raise ValueError(f"Provider tidak dikenali: {name}")

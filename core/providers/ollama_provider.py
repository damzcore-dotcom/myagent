import requests
from core.providers.base import BaseLLMProvider

class OllamaProvider(BaseLLMProvider):
    """Ollama local model provider."""
    
    def __init__(self, base_url: str = "http://localhost:11434"):
        self.base_url = base_url.rstrip("/")

    def invoke(self, prompt: str, model: str, messages: list, temperature: float = 0.7) -> dict:
        try:
            formatted_messages = []
            if prompt:
                formatted_messages.append({"role": "system", "content": prompt})
            
            # Ensure proper messages format
            for msg in messages:
                formatted_messages.append({
                    "role": msg.get("role", "user"),
                    "content": msg.get("content", "")
                })

            r = requests.post(
                f"{self.base_url}/api/chat",
                json={
                    "model": model,
                    "messages": formatted_messages,
                    "options": {"temperature": temperature},
                    "stream": False,
                },
                timeout=60,
            )
            r.raise_for_status()
            data = r.json()
            
            content = data.get("message", {}).get("content", "")
            input_tokens = data.get("prompt_eval_count", 0)
            output_tokens = data.get("eval_count", 0)
            
            return {
                "success": True,
                "content": content,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens
            }
        except Exception as e:
            return {
                "success": False,
                "content": f"Error Ollama: {str(e)}",
                "input_tokens": 0,
                "output_tokens": 0,
                "error": str(e)
            }

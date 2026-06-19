import os
import requests
from core.providers.base import BaseLLMProvider

class DeepSeekProvider(BaseLLMProvider):
    """DeepSeek Cloud API provider (OpenAI-compatible)."""

    def invoke(self, prompt: str, model: str, messages: list, temperature: float = 0.7) -> dict:
        api_key = os.environ.get("DEEPSEEK_API_KEY", "").strip()
        if not api_key:
            return {
                "success": False,
                "content": "",
                "input_tokens": 0,
                "output_tokens": 0,
                "error": "DEEPSEEK_API_KEY tidak dikonfigurasi di environment."
            }

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }

        formatted_messages = []
        if prompt:
            formatted_messages.append({"role": "system", "content": prompt})

        for msg in messages:
            formatted_messages.append({
                "role": msg.get("role", "user"),
                "content": msg.get("content", "")
            })

        # DeepSeek API endpoint (using fallback if v1 is down or standard endpoint)
        url = "https://api.deepseek.com/chat/completions"
        
        try:
            r = requests.post(
                url,
                headers=headers,
                json={
                    "model": model or "deepseek-chat",
                    "messages": formatted_messages,
                    "temperature": temperature,
                    "stream": False
                },
                timeout=60
            )
            
            if r.status_code != 200:
                return {
                    "success": False,
                    "content": "",
                    "input_tokens": 0,
                    "output_tokens": 0,
                    "error": f"API Error (Status {r.status_code}): {r.text}"
                }

            data = r.json()
            choices = data.get("choices", [])
            if not choices:
                return {
                    "success": False,
                    "content": "",
                    "input_tokens": 0,
                    "output_tokens": 0,
                    "error": "DeepSeek API response empty choices."
                }

            content = choices[0].get("message", {}).get("content", "")
            usage = data.get("usage", {})
            input_tokens = usage.get("prompt_tokens", 0)
            output_tokens = usage.get("completion_tokens", 0)

            return {
                "success": True,
                "content": content,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens
            }
        except Exception as e:
            return {
                "success": False,
                "content": "",
                "input_tokens": 0,
                "output_tokens": 0,
                "error": f"DeepSeek API Exception: {str(e)}"
            }

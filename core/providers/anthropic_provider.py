import os
import requests
from core.providers.base import BaseLLMProvider

class AnthropicProvider(BaseLLMProvider):
    """Anthropic API provider (Claude)."""

    def invoke(self, prompt: str, model: str, messages: list, temperature: float = 0.7) -> dict:
        api_key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
        if not api_key:
            return {
                "success": False,
                "content": "",
                "input_tokens": 0,
                "output_tokens": 0,
                "error": "ANTHROPIC_API_KEY tidak dikonfigurasi di environment."
            }

        headers = {
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        }

        # Filter messages: Anthropic only allows user/assistant roles. System goes to top-level.
        formatted_messages = []
        system_text = prompt or ""
        
        for msg in messages:
            role = msg.get("role", "user")
            if role == "system":
                system_text = f"{system_text}\n{msg.get('content', '')}".strip() if system_text else msg.get("content", "")
            else:
                formatted_messages.append({
                    "role": "assistant" if role in ("assistant", "model") else "user",
                    "content": msg.get("content", "")
                })

        url = "https://api.anthropic.com/v1/messages"
        
        payload = {
            "model": model or "claude-3-5-haiku-20241022",
            "messages": formatted_messages,
            "max_tokens": 4096,
            "temperature": temperature
        }
        
        if system_text:
            payload["system"] = system_text

        try:
            r = requests.post(
                url,
                headers=headers,
                json=payload,
                timeout=60
            )

            if r.status_code != 200:
                return {
                    "success": False,
                    "content": "",
                    "input_tokens": 0,
                    "output_tokens": 0,
                    "error": f"Anthropic API Error (Status {r.status_code}): {r.text}"
                }

            data = r.json()
            content_list = data.get("content", [])
            content = ""
            if content_list:
                content = "".join([c.get("text", "") for c in content_list if c.get("type") == "text"])

            usage = data.get("usage", {})
            input_tokens = usage.get("input_tokens", 0)
            output_tokens = usage.get("output_tokens", 0)

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
                "error": f"Anthropic API Exception: {str(e)}"
            }

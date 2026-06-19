import os
import requests
from core.providers.base import BaseLLMProvider

class GeminiProvider(BaseLLMProvider):
    """Google Gemini API provider via REST."""

    def invoke(self, prompt: str, model: str, messages: list, temperature: float = 0.7) -> dict:
        api_key = os.environ.get("GEMINI_API_KEY", "").strip()
        if not api_key:
            return {
                "success": False,
                "content": "",
                "input_tokens": 0,
                "output_tokens": 0,
                "error": "GEMINI_API_KEY tidak dikonfigurasi di environment."
            }

        # Convert messages to Gemini format: roles must be 'user' or 'model'
        contents = []
        for msg in messages:
            role = msg.get("role", "user")
            if role == "assistant":
                role = "model"
            elif role not in ("user", "model"):
                role = "user"
            
            contents.append({
                "role": role,
                "parts": [{"text": msg.get("content", "")}]
            })

        # Gemini model name
        gemini_model = model or "gemini-2.0-flash-lite"
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{gemini_model}:generateContent?key={api_key}"

        payload = {
            "contents": contents,
            "generationConfig": {
                "temperature": temperature
            }
        }

        if prompt:
            payload["systemInstruction"] = {
                "parts": [{"text": prompt}]
            }

        try:
            r = requests.post(
                url,
                headers={"Content-Type": "application/json"},
                json=payload,
                timeout=60
            )

            if r.status_code != 200:
                return {
                    "success": False,
                    "content": "",
                    "input_tokens": 0,
                    "output_tokens": 0,
                    "error": f"Gemini API Error (Status {r.status_code}): {r.text}"
                }

            data = r.json()
            candidates = data.get("candidates", [])
            if not candidates:
                return {
                    "success": False,
                    "content": "",
                    "input_tokens": 0,
                    "output_tokens": 0,
                    "error": "Gemini API response empty candidates."
                }

            parts = candidates[0].get("content", {}).get("parts", [])
            content = parts[0].get("text", "") if parts else ""
            
            usage = data.get("usageMetadata", {})
            input_tokens = usage.get("promptTokenCount", 0)
            output_tokens = usage.get("candidatesTokenCount", 0)

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
                "error": f"Gemini API Exception: {str(e)}"
            }

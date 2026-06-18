"""Damz Agent — Ollama API Client.

Handles all communication with Ollama server:
- Health check and connection testing
- Model listing with auto-tagging
- Model pulling and deletion
- Chat completion
- Embedding generation
- Base URL switching for remote mode
"""

import json
import requests
from dataclasses import dataclass
from typing import Optional

# Model family → tag mapping
MODEL_TAGS = {
    "llama": ["FAST"],
    "mistral": ["SMART"],
    "phi": ["FAST"],
    "gemma": ["SMART"],
    "qwen": ["SMART"],
    "deepseek": ["SMART"],
    "llava": ["VISION"],
    "bakllava": ["VISION"],
    "nomic": ["EMBEDDING"],
    "mxbai": ["EMBEDDING"],
    "all-minilm": ["EMBEDDING"],
}


@dataclass
class ModelInfo:
    """Information about an Ollama model."""
    name: str
    size_gb: float
    family: str
    parameter_size: str
    quantization: str
    tags: list
    is_active: bool = False


class OllamaClient:
    """Client for interacting with the Ollama API."""

    def __init__(self, base_url: str = "http://localhost:11434"):
        self.base_url = base_url.rstrip("/")

    def test_connection(self, timeout: int = 5) -> dict:
        """Test connection to Ollama server.

        Returns:
            dict with keys:
                success (bool): Whether connection was successful
                version (str): Ollama version (if success)
                model_count (int): Number of models (if success)
                error (str): Error message (if failed)
        """
        try:
            r = requests.get(f"{self.base_url}/api/version", timeout=timeout)
            r.raise_for_status()
            version_data = r.json()

            r2 = requests.get(f"{self.base_url}/api/tags", timeout=timeout)
            r2.raise_for_status()
            models = r2.json().get("models", [])

            return {
                "success": True,
                "version": version_data.get("version", "unknown"),
                "model_count": len(models),
            }
        except requests.exceptions.ConnectionError:
            return {"success": False, "error": "Connection refused — Ollama tidak jalan"}
        except requests.exceptions.Timeout:
            return {"success": False, "error": "Timeout — server lambat atau firewall"}
        except requests.exceptions.RequestException as e:
            return {"success": False, "error": f"Network error: {str(e)}"}

    def get_models(self, active_model: Optional[str] = None) -> list:
        """Fetch list of installed models with auto-tagging.

        Args:
            active_model: Name of the currently active model.

        Returns:
            List of ModelInfo objects.
        """
        try:
            r = requests.get(f"{self.base_url}/api/tags", timeout=10)
            r.raise_for_status()
            models_data = r.json().get("models", [])
        except requests.exceptions.RequestException:
            return []

        models = []
        for m in models_data:
            name = m.get("name", "")
            size_bytes = m.get("size", 0)
            details = m.get("details", {})
            family = details.get("family", "unknown")
            param_size = details.get("parameter_size", "")
            quant = details.get("quantization_level", "")

            # Auto-tag based on family
            tags = []
            base_name = name.split(":")[0].lower()
            for key, tag_list in MODEL_TAGS.items():
                if key in base_name:
                    tags.extend(tag_list)
                    break
            if not tags:
                tags = ["GENERAL"]

            models.append(ModelInfo(
                name=name,
                size_gb=round(size_bytes / (1024 ** 3), 2),
                family=family,
                parameter_size=param_size,
                quantization=quant,
                tags=tags,
                is_active=(name == active_model),
            ))

        return models

    def pull_model(self, model_name: str, progress_callback=None) -> dict:
        """Pull (download) a model from Ollama registry.

        Args:
            model_name: Name of model to pull (e.g. 'llama3.2:3b')
            progress_callback: Optional callback(status, completed, total)

        Returns:
            dict with success status and details.
        """
        try:
            r = requests.post(
                f"{self.base_url}/api/pull",
                json={"name": model_name, "stream": True},
                stream=True,
                timeout=300,
            )
            r.raise_for_status()

            for line in r.iter_lines():
                if line:
                    data = json.loads(line)
                    status = data.get("status", "")
                    if progress_callback:
                        progress_callback(
                            status,
                            data.get("completed", 0),
                            data.get("total", 0),
                        )

            return {"success": True, "model": model_name}
        except requests.exceptions.RequestException as e:
            return {"success": False, "error": str(e)}

    def delete_model(self, model_name: str) -> dict:
        """Delete a model from Ollama.

        Args:
            model_name: Name of the model to delete.

        Returns:
            dict with success status.
        """
        try:
            r = requests.delete(
                f"{self.base_url}/api/delete",
                json={"name": model_name},
                timeout=30,
            )
            if r.status_code == 200:
                return {"success": True, "model": model_name}
            return {"success": False, "error": f"Status {r.status_code}"}
        except requests.exceptions.RequestException as e:
            return {"success": False, "error": str(e)}

    def chat(self, model: str, messages: list, temperature: float = 0.7, stream: bool = False) -> dict:
        """Send a chat completion request to Ollama.

        Args:
            model: Model name to use.
            messages: List of message dicts [{role, content}].
            temperature: Sampling temperature.
            stream: Whether to stream the response.

        Returns:
            dict with response content.
        """
        try:
            r = requests.post(
                f"{self.base_url}/api/chat",
                json={
                    "model": model,
                    "messages": messages,
                    "options": {"temperature": temperature},
                    "stream": stream,
                },
                timeout=120,
            )
            r.raise_for_status()
            data = r.json()
            return {
                "success": True,
                "content": data.get("message", {}).get("content", ""),
                "done": data.get("done", True),
            }
        except requests.exceptions.RequestException as e:
            return {"success": False, "error": str(e)}

    def generate_embedding(self, text: str, model: str = "nomic-embed-text") -> dict:
        """Generate embedding for text.

        Args:
            text: Text to embed.
            model: Embedding model name.

        Returns:
            dict with embedding vector.
        """
        try:
            r = requests.post(
                f"{self.base_url}/api/embeddings",
                json={"model": model, "prompt": text},
                timeout=30,
            )
            r.raise_for_status()
            return {"success": True, "embedding": r.json().get("embedding", [])}
        except requests.exceptions.RequestException as e:
            return {"success": False, "error": str(e)}

    def set_base_url(self, url: str):
        """Switch Ollama server URL (for remote mode)."""
        self.base_url = url.rstrip("/")
        print(f"[OLLAMA] Base URL changed to: {self.base_url}")

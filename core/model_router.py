import os
from typing import Optional
from core.agent_registry import AgentRegistry, AgentSpec
from core.providers import get_provider

class ModelRouter:
    """Routes LLM requests to primary or fallback providers based on status, budget, and health."""

    def __init__(self, registry: AgentRegistry, cost_tracker=None, ollama_url="http://localhost:11434"):
        self.registry = registry
        self.cost_tracker = cost_tracker
        self.ollama_url = ollama_url

    def get_provider_status(self) -> dict:
        """Returns API key configuration status for all providers."""
        status = {}
        for p in ["deepseek", "gemini", "anthropic"]:
            env_var = f"{p.upper()}_API_KEY"
            key = os.environ.get(env_var, "").strip()
            status[p] = {
                "configured": bool(key),
                "key_env": env_var
            }
        status["ollama"] = {
            "configured": True,
            "url": self.ollama_url
        }
        return status

    def invoke(self, agent_id: str, messages: list, temperature: float = 0.7) -> dict:
        """Invokes the appropriate model provider for the given agent.
        
        Falls back to local/alternative model if primary is unavailable or budget is exceeded.
        """
        agent_spec = self.registry.get_agent(agent_id)
        if not agent_spec:
            raise ValueError(f"Agent spec tidak ditemukan untuk ID: {agent_id}")

        # Check budget limits first
        budget_exceeded = False
        if self.cost_tracker:
            budget_config = self.registry.get_budget()
            budget_status = self.cost_tracker.check_budget(budget_config)
            if not budget_status["within_budget"]:
                budget_exceeded = True
                print(f"[MODEL ROUTER] Anggaran terlampaui! ({budget_status['used_usd']:.4f}$ / {budget_status['limit_usd']:.2f}$). Mengalihkan ke lokal.")

        # Determine if we must force local fallback due to budget
        force_local = budget_exceeded and self.registry.get_budget().on_exceed == "fallback_local"

        # Determine provider configuration to use
        primary_config = agent_spec.primary
        
        # Check if primary provider's API key is available (if not Ollama)
        primary_available = True
        if primary_config.provider != "ollama":
            env_var = f"{primary_config.provider.upper()}_API_KEY"
            if not os.environ.get(env_var, "").strip():
                primary_available = False

        if force_local or not primary_available:
            provider_config = agent_spec.fallback
            is_fallback = True
        else:
            provider_config = primary_config
            is_fallback = False

        provider_name = provider_config.provider
        model_name = provider_config.model

        def try_invoke(p_name: str, m_name: str) -> dict:
            try:
                kwargs = {}
                if p_name == "ollama":
                    kwargs["base_url"] = self.ollama_url
                
                provider = get_provider(p_name, **kwargs)
                return provider.invoke(agent_spec.system_prompt, m_name, messages, temperature)
            except Exception as e:
                return {"success": False, "error": str(e)}

        print(f"[MODEL ROUTER] Mengirim ke agent '{agent_id}' menggunakan {provider_name} ({model_name})...")
        res = try_invoke(provider_name, model_name)
        
        # Fallback to secondary if primary failed and we started with primary
        if not res["success"] and not is_fallback:
            fallback_config = agent_spec.fallback
            print(f"[MODEL ROUTER] Provider utama '{provider_name}' gagal: {res.get('error')}. Mencoba fallback '{fallback_config.provider}'...")
            
            res = try_invoke(fallback_config.provider, fallback_config.model)
            if res["success"]:
                provider_name = fallback_config.provider
                model_name = fallback_config.model
                is_fallback = True

        # Last resort absolute fallback to local Ollama
        if not res["success"] and provider_name != "ollama":
            local_model = "qwen2.5:7b"
            print(f"[MODEL ROUTER] Fallback gagal. Mencoba local Ollama ({local_model}) sebagai upaya terakhir...")
            res = try_invoke("ollama", local_model)
            if res["success"]:
                provider_name = "ollama"
                model_name = local_model
                is_fallback = True

        return {
            "success": res.get("success", False),
            "content": res.get("content", ""),
            "agent_id": agent_id,
            "provider_used": provider_name,
            "model_used": model_name,
            "input_tokens": res.get("input_tokens", 0),
            "output_tokens": res.get("output_tokens", 0),
            "is_fallback": is_fallback,
            "error": res.get("error", None)
        }

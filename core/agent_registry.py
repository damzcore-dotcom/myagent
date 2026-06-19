import yaml
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional, List, Dict

@dataclass
class ProviderConfig:
    provider: str
    model: str

@dataclass
class AgentSpec:
    id: str
    name: str
    icon: str
    description: str
    system_prompt: str
    primary: ProviderConfig
    fallback: ProviderConfig
    keywords: List[str] = field(default_factory=list)
    is_default: bool = False

@dataclass
class BudgetConfig:
    monthly_limit_usd: float = 5.0
    alert_threshold_pct: float = 80.0
    on_exceed: str = "fallback_local"

class AgentRegistry:
    """Registry to load and access agent specs from config_agents.yaml."""

    def __init__(self, config_path: Optional[Path] = None):
        if config_path is None:
            config_path = Path(__file__).parent.parent / "config_agents.yaml"
        self.config_path = config_path
        self.agents: Dict[str, AgentSpec] = {}
        self.budget = BudgetConfig()
        self.load()

    def load(self):
        if not self.config_path.exists():
            return
        try:
            with open(self.config_path, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f) or {}
            
            agents_data = data.get("agents", {})
            for agent_id, a_data in agents_data.items():
                primary_data = a_data.get("primary", {})
                fallback_data = a_data.get("fallback", {})
                
                primary = ProviderConfig(
                    provider=primary_data.get("provider", "ollama"),
                    model=primary_data.get("model", "")
                )
                fallback = ProviderConfig(
                    provider=fallback_data.get("provider", "ollama"),
                    model=fallback_data.get("model", "")
                )
                
                self.agents[agent_id] = AgentSpec(
                    id=agent_id,
                    name=a_data.get("name", agent_id),
                    icon=a_data.get("icon", "🤖"),
                    description=a_data.get("description", ""),
                    system_prompt=a_data.get("system_prompt", ""),
                    primary=primary,
                    fallback=fallback,
                    keywords=a_data.get("keywords", []),
                    is_default=a_data.get("is_default", False)
                )
                
            budget_data = data.get("budget", {})
            self.budget = BudgetConfig(
                monthly_limit_usd=float(budget_data.get("monthly_limit_usd", 5.0)),
                alert_threshold_pct=float(budget_data.get("alert_threshold_pct", 80.0)),
                on_exceed=budget_data.get("on_exceed", "fallback_local")
            )
        except Exception as e:
            print(f"[AGENT REGISTRY] Error loading configuration: {e}")

    def get_agent(self, agent_id: str) -> Optional[AgentSpec]:
        return self.agents.get(agent_id)

    def get_default_agent(self) -> Optional[AgentSpec]:
        for agent in self.agents.values():
            if agent.is_default:
                return agent
        if self.agents:
            return list(self.agents.values())[0]
        return None

    def list_agents(self) -> List[AgentSpec]:
        return list(self.agents.values())

    def get_budget(self) -> BudgetConfig:
        return self.budget

import sys
import json
import time
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent))

from core.config import load_config
from core.agent_registry import AgentRegistry
from core.ollama_client import OllamaClient
from core.orchestrator import Orchestrator
from core.model_router import ModelRouter
from core.cost_tracker import CostTracker
from core.shared_memory import SharedMemory
from core.agent import DamzAgent

def main():
    try:
        # Read request JSON from stdin
        input_data = sys.stdin.read().strip()
        if not input_data:
            print(json.dumps({"success": False, "error": "No input JSON received on stdin."}))
            return
            
        req = json.loads(input_data)
        messages = req.get("messages", [])
        temperature = req.get("temperature", 0.7)
        
        # Get the last user message to route
        user_input = ""
        for msg in reversed(messages):
            if msg.get("role") == "user":
                user_input = msg.get("content", "")
                break
                
        if not user_input:
            print(json.dumps({"success": False, "error": "No user message found in history."}))
            return
            
        # Load configs and tools
        config = load_config()
        registry = AgentRegistry()
        ollama = OllamaClient(config.llm.base_url)
        
        # Init multi-agent components
        orchestrator = Orchestrator(registry, ollama)
        cost_tracker = CostTracker()
        shared_memory = SharedMemory()
        model_router = ModelRouter(registry, cost_tracker, ollama.base_url)
        
        # Route the input to find the right agent
        agent_id = orchestrator.route(user_input)
        agent_spec = registry.get_agent(agent_id)
        
        # Init the agent
        agent = DamzAgent(
            config,
            tools=[],
            memory=None,
            retriever=None,
            agent_spec=agent_spec,
            model_router=model_router,
            shared_memory=shared_memory,
            cost_tracker=cost_tracker
        )
        
        start_time = time.time()
        
        # Invoke the agent. It returns "response \n__METADATA__:json"
        result_str = agent.invoke(user_input)
        
        # Parse output and metadata
        content = result_str
        metadata = {}
        if "__METADATA__:" in result_str:
            parts = result_str.rsplit("__METADATA__:", 1)
            content = parts[0].strip()
            try:
                metadata = json.loads(parts[1])
            except Exception:
                pass
                
        # Get stats
        cost = cost_tracker.calculate_cost(
            metadata.get("provider_used", "ollama"),
            metadata.get("input_tokens", 0),
            metadata.get("output_tokens", 0)
        )
        
        response = {
            "success": True,
            "content": content,
            "agent_id": agent_id,
            "agent_name": agent_spec.name if agent_spec else "Agent Penjawab",
            "icon": agent_spec.icon if agent_spec else "💬",
            "provider_used": metadata.get("provider_used", "ollama"),
            "model_used": metadata.get("model_used", "qwen2.5:7b"),
            "response_time_ms": metadata.get("response_time_ms", int((time.time() - start_time) * 1000)),
            "cost_usd": cost,
            "is_fallback": metadata.get("is_fallback", False)
        }
        
        print(json.dumps(response))
        
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": f"Bridge error: {str(e)}"
        }))

if __name__ == "__main__":
    main()

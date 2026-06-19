import re
from typing import Optional
from core.agent_registry import AgentRegistry, AgentSpec
from core.ollama_client import OllamaClient

class Orchestrator:
    """Orchestrates intent routing to direct user queries to the correct specialized agent."""

    def __init__(self, registry: AgentRegistry, ollama_client: Optional[OllamaClient] = None):
        self.registry = registry
        self.ollama = ollama_client or OllamaClient()

    def route(self, user_input: str) -> str:
        """Determines the best agent ID for the given user input.
        
        Args:
            user_input: Raw text input from user.
            
        Returns:
            agent_id (str): The ID of the chosen agent.
        """
        if not user_input.strip():
            default_agent = self.registry.get_default_agent()
            return default_agent.id if default_agent else "answer"

        # Layer 1: Keyword Matching
        agent_scores = {}
        input_lower = user_input.lower()
        
        for agent in self.registry.list_agents():
            score = 0
            for kw in agent.keywords:
                # Use regex word boundaries to avoid partial matches (e.g. "cari" matching "carita")
                pattern = r'\b' + re.escape(kw.lower()) + r'\b'
                if re.search(pattern, input_lower):
                    score += 1
            if score > 0:
                agent_scores[agent.id] = score

        if agent_scores:
            # Sort by score descending
            sorted_agents = sorted(agent_scores.items(), key=lambda x: x[1], reverse=True)
            # If there's a clear winner, use it
            if len(sorted_agents) == 1 or sorted_agents[0][1] > sorted_agents[1][1]:
                print(f"[ORCHESTRATOR] Routed via Keyword Match -> {sorted_agents[0][0]} (score: {sorted_agents[0][1]})")
                return sorted_agents[0][0]

        # Layer 2: LLM Classifier
        classified_id = self.classify_with_llm(user_input)
        if classified_id and self.registry.get_agent(classified_id):
            print(f"[ORCHESTRATOR] Routed via LLM Classifier -> {classified_id}")
            return classified_id

        # Layer 3: Default Agent Fallback
        default_agent = self.registry.get_default_agent()
        fallback_id = default_agent.id if default_agent else "answer"
        print(f"[ORCHESTRATOR] Routed via Default Fallback -> {fallback_id}")
        return fallback_id

    def classify_with_llm(self, user_input: str) -> str:
        """Uses local LLM to classify user input when keywords are ambiguous."""
        prompt = (
            "Tentukan kategori asisten AI terbaik untuk pertanyaan pengguna berikut:\n"
            f"Pertanyaan: \"{user_input}\"\n\n"
            "Kategori yang tersedia:\n"
            "- research: Untuk mencari informasi mendalam, menganalisis data/tren, melakukan perbandingan, atau riset pasar.\n"
            "- schedule: Untuk mengatur jadwal, membuat reminder/pengingat, alarm, rapat/meeting, atau manajemen waktu.\n"
            "- design: Untuk masalah estetika, desain UI/UX, warna, tata letak (layout), copywriting kreatif, pembuatan logo, dan konten kreatif.\n"
            "- answer: Untuk percakapan umum, sapaan, tanya jawab santai, penjelasan dasar, atau topik harian umum lainnya.\n\n"
            "Jawab HANYA dengan satu kata kunci kategori dari list di atas: research, schedule, design, atau answer. Jangan ada penjelasan lain.\n"
            "Kategori: "
        )

        messages = [
            {"role": "user", "content": prompt}
        ]

        # Get default model name or a lightweight fallback
        model_name = "llama3.2:3b"
        # We can verify if this model exists, otherwise use whatever is installed
        models = self.ollama.get_models()
        installed_names = [m.name for m in models]
        if installed_names:
            # Prefer llama3.2:3b or qwen2.5:7b or similar fast models if present
            preferred = ["llama3.2:3b", "qwen2.5:7b", "llama3.2", "qwen2.5"]
            chosen = None
            for p in preferred:
                for inst in installed_names:
                    if p in inst.lower():
                        chosen = inst
                        break
                if chosen:
                    break
            model_name = chosen or installed_names[0]

        try:
            res = self.ollama.chat(model=model_name, messages=messages, temperature=0.1)
            if res["success"]:
                content = res["content"].strip().lower()
                # Extract any word that matches our categories
                for category in ["research", "schedule", "design", "answer"]:
                    if category in content:
                        return category
        except Exception as e:
            print(f"[ORCHESTRATOR] LLM Classification failed: {e}")
        
        return "answer"

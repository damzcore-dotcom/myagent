"""Damz Agent — Main Agent Logic.

LangChain ReAct Agent integrating LLM, memory, and tools.
Can switch models on-the-fly and integrates RAG context.
"""

import time
from core.config import save_config
from core.ollama_client import OllamaClient


class DamzAgent:
    """Main agent class coordinating LLM, memory, and tools."""

    def __init__(self, config, tools: list = None, memory=None, retriever=None):
        self.config = config
        self.tools = tools or []
        self.memory = memory
        self.retriever = retriever
        self.ollama = OllamaClient(config.llm.base_url)
        self._executor = None
        self._use_langchain = False

        self._init_agent()

    def _init_agent(self):
        """Initialize the agent — try LangChain first, fall back to direct."""
        try:
            from langchain_ollama import ChatOllama
            from langchain.agents import AgentExecutor, create_react_agent
            from langchain_core.prompts import PromptTemplate

            llm = ChatOllama(
                model=self.config.llm.model,
                base_url=self.config.llm.base_url,
                temperature=self.config.llm.temperature,
            )

            if self.tools:
                prompt = PromptTemplate.from_template("""
Kamu adalah {agent_name}, asisten AI pribadi yang berjalan 100% lokal.
Jawab singkat dan jelas — responsmu akan diucapkan via speaker.
Hindari markdown, bullet point, atau format panjang.

Tools tersedia:
{tools}

Riwayat percakapan:
{chat_history}

Format:
Thought: ...
Action: nama_tool
Action Input: ...
Observation: ...
Final Answer: ...

Tool names: {tool_names}
Input: {input}
{agent_scratchpad}
""")
                agent = create_react_agent(llm, self.tools, prompt)
                self._executor = AgentExecutor(
                    agent=agent,
                    tools=self.tools,
                    verbose=True,
                    max_iterations=5,
                    handle_parsing_errors=True,
                )
                self._use_langchain = True
                print(f"[AGENT] LangChain ReAct agent initialized with {len(self.tools)} tools")
            else:
                self._llm = llm
                self._use_langchain = False
                print("[AGENT] Direct LLM mode (no tools registered)")

        except ImportError as e:
            print(f"[AGENT] LangChain not available ({e}), using direct Ollama API")
            self._use_langchain = False

    def invoke(self, user_input: str) -> str:
        """Process user input and return agent response.

        Args:
            user_input: The user's text input.

        Returns:
            Agent's text response.
        """
        start = time.time()

        # Get RAG context if available
        rag_context = ""
        if self.retriever:
            try:
                rag_context = self.retriever.build_context(user_input)
            except Exception as e:
                print(f"[AGENT] RAG error: {e}")

        # Build augmented input
        augmented_input = user_input
        if rag_context:
            augmented_input = f"{rag_context}\n\nPertanyaan: {user_input}"

        # Get chat history
        chat_history = ""
        if self.memory:
            chat_history = self.memory.short.get_formatted()

        try:
            if self._use_langchain and self._executor:
                result = self._executor.invoke({
                    "input": augmented_input,
                    "agent_name": self.config.agent.name,
                    "chat_history": chat_history,
                })
                answer = result.get("output", "Maaf, saya tidak bisa menjawab.")
            else:
                answer = self._direct_chat(augmented_input, chat_history)
        except Exception as e:
            print(f"[AGENT] Error: {e}")
            answer = f"Maaf, terjadi error: {str(e)}"

        # Save to memory
        if self.memory:
            self.memory.add_turn(user_input, answer)

        elapsed = time.time() - start
        print(f"[AGENT] Response in {elapsed:.1f}s")
        return answer

    def _direct_chat(self, user_input: str, chat_history: str) -> str:
        """Direct chat using Ollama API (fallback when LangChain unavailable)."""
        messages = []

        messages.append({
            "role": "system",
            "content": self.config.agent.system_prompt,
        })

        if self.memory:
            messages.extend(self.memory.short.get())

        messages.append({"role": "user", "content": user_input})

        result = self.ollama.chat(
            model=self.config.llm.model,
            messages=messages,
            temperature=self.config.llm.temperature,
        )

        if result["success"]:
            return result["content"]
        return f"Error: {result.get('error', 'Unknown error')}"

    def switch_model(self, model_name: str) -> dict:
        """Switch the active LLM model without restart.

        Args:
            model_name: Name of the model to switch to.

        Returns:
            dict with success status.
        """
        models = self.ollama.get_models()
        available = [m.name for m in models]

        if model_name not in available:
            return {"success": False, "error": f"Model '{model_name}' not found. Available: {available}"}

        self.config.llm.model = model_name
        self._init_agent()

        try:
            save_config(self.config)
        except Exception as e:
            print(f"[AGENT] Warning: Could not save config: {e}")

        return {"success": True, "model": model_name}

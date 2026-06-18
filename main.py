"""Damz Agent — Main Entry Point.

Integrates all components: config, Ollama, TTS, STT, wake word,
agent, memory, tools, and RAG into a single voice loop.
"""

import sys
import time
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent))

from core.config import load_config
from core.ollama_client import OllamaClient
from core.memory import MemoryManager


def main():
    """Main entry point — start the Damz Agent."""
    print()
    print("  ╔══════════════════════════════════════════╗")
    print("  ║         DAMZ AGENT — v2.0                ║")
    print("  ║    100% Local AI Personal Assistant       ║")
    print("  ╚══════════════════════════════════════════╝")
    print()

    # ── 1. Load Config ────────────────────────────────
    config = load_config()
    print(f"[MAIN] Config loaded: model={config.llm.model}, output={config.output_mode}")

    # ── 2. Health Check Ollama ────────────────────────
    ollama = OllamaClient(config.llm.base_url)
    result = ollama.test_connection()
    if not result["success"]:
        print(f"[ERROR] Ollama tidak bisa dihubungi: {result['error']}")
        print("[ERROR] Pastikan Ollama sudah jalan: ollama serve")
        print("[ERROR] Atau cek base_url di config.yaml")
        return
    print(f"[MAIN] Ollama connected: v{result['version']}, {result['model_count']} models")

    # ── 3. Init Memory ────────────────────────────────
    memory = MemoryManager(max_turns=config.agent.memory_max_turns)

    # ── 4. Load Tools ─────────────────────────────────
    tools = []
    try:
        from tools import ALL_TOOLS
        tools = ALL_TOOLS
    except Exception as e:
        print(f"[MAIN] Tools not loaded: {e}")

    # ── 5. Init RAG (optional) ────────────────────────
    retriever = None
    watcher = None
    try:
        from rag.ingestor import RAGIngestor
        from rag.retriever import RAGRetriever
        from rag.watcher import DocumentWatcher

        ingestor = RAGIngestor(config)
        retriever = RAGRetriever(config)
        watcher = DocumentWatcher(ingestor, config.rag.watch_dir)
        watcher.start()
    except Exception as e:
        print(f"[MAIN] RAG not loaded: {e}")

    # ── 6. Init Agent ─────────────────────────────────
    from core.agent import DamzAgent
    agent = DamzAgent(config, tools=tools, memory=memory, retriever=retriever)

    # ── 7. Init TTS ───────────────────────────────────
    tts = None
    if config.output_mode != "text_only":
        try:
            from core.tts import TTSEngine
            tts = TTSEngine(config.tts)
        except Exception as e:
            print(f"[MAIN] TTS not available: {e}")

    # ── 8. State Machine ──────────────────────────────
    state = {"listening_for_command": False}

    def on_wake_word():
        """Callback when wake word is detected."""
        state["listening_for_command"] = True
        if tts:
            tts.stop()
        print("\n[WAKE] Wake word terdeteksi! Mendengarkan perintah...")

    def on_transcription(text: str):
        """Callback when STT produces transcription."""
        if not state["listening_for_command"]:
            return
        state["listening_for_command"] = False
        print(f"\n[USER] {text}")

        # Pause STT while processing
        if stt:
            stt.pause()

        # Get agent response
        response = agent.invoke(text)
        print(f"[DAMZ] {response}")

        # Speak response
        if tts and config.output_mode != "text_only":
            tts.speak(response)

        # Resume STT
        if stt:
            stt.resume()

    # ── 9. Init STT + Wake Word ───────────────────────
    stt = None
    wake = None
    try:
        from core.stt import STTEngine
        stt = STTEngine(config.stt, on_transcription)
        stt.start()
    except Exception as e:
        print(f"[MAIN] STT not available: {e}")

    try:
        from core.wake_word import WakeWordDetector
        wake = WakeWordDetector(config, on_wake_word)
        wake.start()
    except Exception as e:
        print(f"[MAIN] Wake word not available: {e}")

    # ── 10. Startup Greeting ──────────────────────────
    greeting = f"Halo! Saya {config.agent.name}. Sistem siap."
    print(f"\n[DAMZ] {greeting}")
    if tts:
        tts.speak(greeting)

    # ── 11. Main Loop ─────────────────────────────────
    print()
    print("  Mode: Voice + Terminal Input")
    print("  Ketik perintah atau gunakan wake word.")
    print("  Ketik 'quit' atau Ctrl+C untuk keluar.")
    print()

    try:
        while True:
            try:
                user_input = input("You > ").strip()
                if not user_input:
                    continue
                if user_input.lower() in ("quit", "exit", "q"):
                    break

                # Process through agent
                if stt:
                    stt.pause()
                response = agent.invoke(user_input)
                print(f"Damz > {response}")
                if tts and config.output_mode != "text_only":
                    tts.speak(response)
                if stt:
                    stt.resume()

            except EOFError:
                break
    except KeyboardInterrupt:
        pass

    # ── 12. Cleanup ───────────────────────────────────
    print("\n[MAIN] Shutting down...")
    if wake:
        wake.stop()
    if stt:
        stt.stop()
    if tts:
        tts.shutdown()
    if watcher:
        watcher.stop()
    memory.close()
    print("[MAIN] Damz Agent dihentikan. Sampai jumpa!")


if __name__ == "__main__":
    main()

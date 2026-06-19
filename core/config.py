"""Damz Agent — Configuration loader and saver.

Loads config.yaml and provides typed dataclass access to all settings.
Single source of truth for all configuration.
"""

import yaml
from pathlib import Path
from dataclasses import dataclass, field, asdict
from typing import Optional

# Load environment variables from .env
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent.parent / ".env")
except ImportError:
    pass

# Default config path — relative to project root
CONFIG_PATH = Path(__file__).parent.parent / "config.yaml"



@dataclass
class LLMConfig:
    model: str = "llama3.2:3b"
    base_url: str = "http://localhost:11434"
    temperature: float = 0.7


@dataclass
class STTConfig:
    model: str = "base"          # tiny | base | small | medium
    language: str = "id"         # id | en


@dataclass
class TTSConfig:
    piper_exe: str = "C:/DamzAgent/piper/piper.exe"
    voice_id: str = "id"
    voices: dict = field(default_factory=lambda: {
        "id": "C:/DamzAgent/piper/voices/id_ID-salma-medium.onnx",
        "en": "C:/DamzAgent/piper/voices/en_US-lessac-medium.onnx",
    })


@dataclass
class AgentConfig:
    name: str = "Damz"
    system_prompt: str = (
        "Kamu adalah Damz, asisten AI pribadi yang berjalan 100% lokal. "
        "Jawab singkat dan jelas — responsmu akan diucapkan via speaker. "
        "Hindari markdown, bullet point, atau format panjang."
    )
    memory_max_turns: int = 10
    allowed_emails: str = ""



@dataclass
class RAGConfig:
    watch_dir: str = "c:/ADAM/myagent/rag/documents"
    chroma_db_path: str = "c:/ADAM/myagent/data/chroma_db"
    chunk_size: int = 512
    chunk_overlap: int = 64
    embedding_model: str = "nomic-embed-text"


@dataclass
class AppConfig:
    llm: LLMConfig = field(default_factory=LLMConfig)
    stt: STTConfig = field(default_factory=STTConfig)
    tts: TTSConfig = field(default_factory=TTSConfig)
    agent: AgentConfig = field(default_factory=AgentConfig)
    rag: RAGConfig = field(default_factory=RAGConfig)
    hotkey: str = "ctrl+space"
    output_mode: str = "voice_and_text"  # voice_and_text | text_only | voice_only
    multi_agent_enabled: bool = False


def load_config(path: Optional[Path] = None) -> AppConfig:
    """Load configuration from YAML file.

    Args:
        path: Path to config file. Defaults to CONFIG_PATH.

    Returns:
        AppConfig instance with all settings loaded.
    """
    config_path = path or CONFIG_PATH

    if not config_path.exists():
        print(f"[CONFIG] File not found: {config_path}, using defaults")
        return AppConfig()

    with open(config_path, encoding="utf-8") as f:
        raw = yaml.safe_load(f) or {}

    llm = LLMConfig(**raw.get("llm", {}))
    stt = STTConfig(**raw.get("stt", {}))
    tts_raw = raw.get("tts", {})
    tts = TTSConfig(
        piper_exe=tts_raw.get("piper_exe", TTSConfig.piper_exe),
        voice_id=tts_raw.get("voice_id", TTSConfig.voice_id),
        voices=tts_raw.get("voices", TTSConfig().voices),
    )
    agent = AgentConfig(**raw.get("agent", {}))
    rag = RAGConfig(**raw.get("rag", {}))
    
    # Check if multi-agent config file exists in the same parent directory
    agents_config_path = config_path.parent / "config_agents.yaml"
    multi_agent_enabled = agents_config_path.exists()

    return AppConfig(
        llm=llm,
        stt=stt,
        tts=tts,
        agent=agent,
        rag=rag,
        hotkey=raw.get("hotkey", "ctrl+space"),
        output_mode=raw.get("output_mode", "voice_and_text"),
        multi_agent_enabled=multi_agent_enabled,
    )



def save_config(config: AppConfig, path: Optional[Path] = None):
    """Save configuration to YAML file.

    Args:
        config: AppConfig instance to save.
        path: Path to save to. Defaults to CONFIG_PATH.
    """
    config_path = path or CONFIG_PATH

    data = {
        "agent": asdict(config.agent),
        "llm": asdict(config.llm),
        "stt": asdict(config.stt),
        "tts": asdict(config.tts),
        "rag": asdict(config.rag),
        "hotkey": config.hotkey,
        "output_mode": config.output_mode,
    }

    with open(config_path, "w", encoding="utf-8") as f:
        yaml.dump(data, f, default_flow_style=False, allow_unicode=True, sort_keys=False)

    print(f"[CONFIG] Saved to {config_path}")

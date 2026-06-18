"""Damz Agent — Memory System.

Short-term memory (in-session conversation buffer) and
long-term memory (cross-session SQLite persistence).
"""

import sqlite3
from datetime import datetime
from pathlib import Path


class ShortTermMemory:
    """In-session conversation buffer.

    Keeps the last N turns of conversation for LLM context.
    """

    def __init__(self, max_turns: int = 10):
        self.max_turns = max_turns
        self._history = []  # List of {"role": ..., "content": ...}

    def add(self, human: str, ai: str):
        """Add a conversation turn."""
        self._history.append({"role": "user", "content": human})
        self._history.append({"role": "assistant", "content": ai})
        max_messages = self.max_turns * 2
        if len(self._history) > max_messages:
            self._history = self._history[-max_messages:]

    def get(self) -> list:
        """Get conversation history as list of message dicts."""
        return self._history.copy()

    def get_formatted(self) -> str:
        """Get conversation history as formatted string."""
        lines = []
        for msg in self._history:
            prefix = "User" if msg["role"] == "user" else "Damz"
            lines.append(f"{prefix}: {msg['content']}")
        return "\n".join(lines)

    def clear(self):
        """Clear all conversation history."""
        self._history = []
        print("[MEMORY] Short-term memory cleared")


class LongTermMemory:
    """Cross-session persistent memory using SQLite."""

    def __init__(self, db_path: str = None):
        if db_path is None:
            db_path = str(Path(__file__).parent.parent / "data" / "damz_memory.db")

        Path(db_path).parent.mkdir(parents=True, exist_ok=True)

        self.conn = sqlite3.connect(db_path, check_same_thread=False)
        self._init_db()
        print(f"[MEMORY] Long-term memory initialized: {db_path}")

    def _init_db(self):
        """Create tables if they don't exist."""
        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS memories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT,
                content TEXT,
                created_at TEXT,
                session_id TEXT
            )
        """)
        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS conversations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT,
                role TEXT,
                content TEXT,
                created_at TEXT
            )
        """)
        self.conn.commit()

    def save(self, content: str, type: str = "fact", session_id: str = ""):
        """Save a memory entry."""
        self.conn.execute(
            "INSERT INTO memories (type, content, created_at, session_id) VALUES (?,?,?,?)",
            (type, content, datetime.now().isoformat(), session_id)
        )
        self.conn.commit()

    def save_conversation(self, role: str, content: str, session_id: str = ""):
        """Save a conversation message for long-term storage."""
        self.conn.execute(
            "INSERT INTO conversations (session_id, role, content, created_at) VALUES (?,?,?,?)",
            (session_id, role, content, datetime.now().isoformat())
        )
        self.conn.commit()

    def search(self, query: str, limit: int = 5) -> list:
        """Simple keyword search in memories."""
        cursor = self.conn.execute(
            "SELECT content FROM memories WHERE content LIKE ? ORDER BY created_at DESC LIMIT ?",
            (f"%{query}%", limit)
        )
        return [row[0] for row in cursor.fetchall()]

    def get_recent(self, limit: int = 10) -> list:
        """Get recent memories."""
        cursor = self.conn.execute(
            "SELECT type, content, created_at FROM memories ORDER BY created_at DESC LIMIT ?",
            (limit,)
        )
        return [{"type": r[0], "content": r[1], "at": r[2]} for r in cursor.fetchall()]

    def get_recent_conversations(self, limit: int = 20) -> list:
        """Get recent conversation messages."""
        cursor = self.conn.execute(
            "SELECT role, content, created_at FROM conversations ORDER BY created_at DESC LIMIT ?",
            (limit,)
        )
        return [{"role": r[0], "content": r[1], "at": r[2]} for r in cursor.fetchall()]

    def close(self):
        """Close the database connection."""
        self.conn.close()


class MemoryManager:
    """Unified memory manager combining short-term and long-term memory."""

    def __init__(self, max_turns: int = 10, db_path: str = None):
        self.short = ShortTermMemory(max_turns=max_turns)
        self.long = LongTermMemory(db_path=db_path)
        self._session_id = datetime.now().strftime("%Y%m%d_%H%M%S")

    def add_turn(self, human: str, ai: str):
        """Add a conversation turn to both memories."""
        self.short.add(human, ai)
        self.long.save_conversation("user", human, self._session_id)
        self.long.save_conversation("assistant", ai, self._session_id)

    def save_fact(self, content: str):
        """Save an important fact to long-term memory."""
        self.long.save(content, type="fact", session_id=self._session_id)

    def close(self):
        """Clean shutdown."""
        self.long.close()

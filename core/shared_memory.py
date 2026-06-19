import sqlite3
import json
from datetime import datetime
from pathlib import Path
from typing import List, Dict

class SharedMemory:
    """Provides cross-agent conversation history and aggregates usage statistics."""

    def __init__(self, db_path: str = None):
        if db_path is None:
            db_path = str(Path(__file__).parent.parent / "data" / "shared_memory.db")
        
        self.db_path = db_path
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
        self._init_db()
        self.export_interaction_stats()

    def _init_db(self):
        """Initializes the database schema."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS shared_turns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                agent_id TEXT,
                user_input TEXT,
                agent_output TEXT,
                provider TEXT,
                model TEXT,
                response_time_ms INTEGER,
                timestamp TEXT
            )
        """)
        conn.commit()
        conn.close()

    def add_turn(self, agent_id: str, user_input: str, agent_output: str, 
                 provider: str = "", model: str = "", response_time_ms: int = 0):
        """Saves a single conversation turn and updates stats."""
        timestamp = datetime.now().isoformat()
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO shared_turns (agent_id, user_input, agent_output, provider, model, response_time_ms, timestamp) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (agent_id, user_input, agent_output, provider, model, response_time_ms, timestamp)
        )
        conn.commit()
        conn.close()
        
        self.export_interaction_stats()

    def get_recent_context(self, limit: int = 10) -> List[dict]:
        """Retrieves last N turns of conversations across all agents."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute(
            "SELECT agent_id, user_input, agent_output, timestamp FROM shared_turns "
            "ORDER BY timestamp DESC LIMIT ?", (limit,)
        )
        rows = cursor.fetchall()
        conn.close()
        
        # Return in chronological order
        return [{"agent_id": r[0], "user": r[1], "assistant": r[2], "timestamp": r[3]} for r in reversed(rows)]

    def get_agent_history(self, agent_id: str, limit: int = 10) -> List[dict]:
        """Retrieves last N turns for a specific agent."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute(
            "SELECT user_input, agent_output, timestamp FROM shared_turns "
            "WHERE agent_id = ? ORDER BY timestamp DESC LIMIT ?", (agent_id, limit)
        )
        rows = cursor.fetchall()
        conn.close()
        
        return [{"user": r[0], "assistant": r[1], "timestamp": r[2]} for r in reversed(rows)]

    def get_agent_stats(self) -> Dict[str, dict]:
        """Aggregates turn counts and average latency for each agent."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT agent_id, COUNT(*), AVG(response_time_ms) 
            FROM shared_turns 
            GROUP BY agent_id
        """)
        rows = cursor.fetchall()
        conn.close()
        
        stats = {}
        for r in rows:
            stats[r[0]] = {
                "call_count": r[1],
                "avg_response_time_ms": round(r[2], 2) if r[2] is not None else 0
            }
        return stats

    def export_interaction_stats(self):
        """Exports interaction stats to data/agent_interaction_stats.json for fast frontend reads."""
        try:
            stats = self.get_agent_stats()
            export_path = Path(self.db_path).parent / "agent_interaction_stats.json"
            export_path.parent.mkdir(parents=True, exist_ok=True)
            with open(export_path, "w", encoding="utf-8") as f:
                json.dump(stats, f, indent=2)
        except Exception as e:
            print(f"[SHARED MEMORY] Warning: Failed to export interaction stats: {e}")

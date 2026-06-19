import sqlite3
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, List

# Pricing per 1,000,000 tokens
PRICING = {
    "deepseek": {
        "input": 0.07,   # $0.07 per 1M input tokens
        "output": 0.28,  # $0.28 per 1M output tokens
    },
    "gemini": {
        "input": 0.02,   # $0.02 per 1M input tokens
        "output": 0.08,  # $0.08 per 1M output tokens
    },
    "anthropic": {
        "input": 0.80,   # $0.80 per 1M input tokens
        "output": 4.00,  # $4.00 per 1M output tokens
    },
    "ollama": {
        "input": 0.0,
        "output": 0.0,
    }
}

class CostTracker:
    """Tracks LLM API token consumption, computes pricing, and enforces budgets."""

    def __init__(self, db_path: str = None):
        if db_path is None:
            db_path = str(Path(__file__).parent.parent / "data" / "cost_tracker.db")
        
        self.db_path = db_path
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
        self._init_db()
        self.export_stats_json()

    def _init_db(self):
        """Initializes the cost database and table."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS api_usage (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                agent_id TEXT,
                provider TEXT,
                model TEXT,
                input_tokens INTEGER,
                output_tokens INTEGER,
                cost_usd REAL,
                timestamp TEXT
            )
        """)
        conn.commit()
        conn.close()

    def calculate_cost(self, provider: str, input_tokens: int, output_tokens: int) -> float:
        """Computes cost in USD for a given provider based on token counts."""
        provider_key = provider.lower().strip()
        prices = PRICING.get(provider_key, PRICING["ollama"])
        
        cost_in = (input_tokens / 1_000_000.0) * prices["input"]
        cost_out = (output_tokens / 1_000_000.0) * prices["output"]
        return round(cost_in + cost_out, 6)

    def record(self, agent_id: str, provider: str, model: str, input_tokens: int, output_tokens: int) -> float:
        """Records API invocation details to database and updates JSON stats export."""
        cost = self.calculate_cost(provider, input_tokens, output_tokens)
        timestamp = datetime.now().isoformat()

        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO api_usage (agent_id, provider, model, input_tokens, output_tokens, cost_usd, timestamp) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (agent_id, provider, model, input_tokens, output_tokens, cost, timestamp)
        )
        conn.commit()
        conn.close()

        # Update JSON stats export for Node.js backend
        self.export_stats_json()
        return cost

    def get_monthly_total(self) -> float:
        """Computes total cost in USD for the current calendar month."""
        current_month = datetime.now().strftime("%Y-%m")
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute(
            "SELECT SUM(cost_usd) FROM api_usage WHERE timestamp LIKE ?", 
            (f"{current_month}%",)
        )
        row = cursor.fetchone()
        conn.close()
        return float(row[0]) if row[0] is not None else 0.0

    def get_breakdown(self) -> Dict[str, Dict[str, float]]:
        """Returns monthly cost breakdown by agent and provider."""
        current_month = datetime.now().strftime("%Y-%m")
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Breakdown by agent
        cursor.execute(
            "SELECT agent_id, SUM(cost_usd) FROM api_usage WHERE timestamp LIKE ? GROUP BY agent_id",
            (f"{current_month}%",)
        )
        by_agent = {row[0]: round(row[1], 4) for row in cursor.fetchall()}
        
        # Breakdown by provider
        cursor.execute(
            "SELECT provider, SUM(cost_usd) FROM api_usage WHERE timestamp LIKE ? GROUP BY provider",
            (f"{current_month}%",)
        )
        by_provider = {row[0]: round(row[1], 4) for row in cursor.fetchall()}
        
        conn.close()
        return {
            "by_agent": by_agent,
            "by_provider": by_provider
        }

    def check_budget(self, budget_config) -> dict:
        """Determines if the current monthly cost is within budget limit."""
        used = self.get_monthly_total()
        limit = budget_config.monthly_limit_usd
        pct = (used / limit) * 100 if limit > 0 else 0
        return {
            "within_budget": used < limit,
            "used_usd": used,
            "limit_usd": limit,
            "pct": round(pct, 2)
        }

    def export_stats_json(self):
        """Exports aggregated cost summaries to data/agent_stats.json for fast frontend reads."""
        try:
            total = self.get_monthly_total()
            breakdown = self.get_breakdown()
            
            stats = {
                "total_usd": round(total, 6),
                "by_agent": breakdown["by_agent"],
                "by_provider": breakdown["by_provider"]
            }
            
            export_path = Path(self.db_path).parent / "agent_stats.json"
            export_path.parent.mkdir(parents=True, exist_ok=True)
            
            with open(export_path, "w", encoding="utf-8") as f:
                json.dump(stats, f, indent=2)
        except Exception as e:
            print(f"[COST TRACKER] Warning: Failed to export agent stats: {e}")

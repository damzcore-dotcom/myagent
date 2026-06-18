"""Damz Agent — RAG Retriever.

Queries ChromaDB for semantically relevant document chunks
and builds context for LLM injection.
"""

from pathlib import Path


class RAGRetriever:
    """Semantic search retriever for the RAG pipeline."""

    def __init__(self, config):
        self.config = config
        self._client = None
        self._collection = None
        self._initialized = False
        self._init()

    def _init(self):
        """Initialize ChromaDB connection."""
        try:
            import chromadb
            from chromadb.utils.embedding_functions import OllamaEmbeddingFunction

            db_path = str(Path(__file__).parent.parent / "data" / "chroma_db")
            if hasattr(self.config, 'rag'):
                db_path = self.config.rag.chroma_db_path

            base_url = "http://localhost:11434"
            if hasattr(self.config, 'llm'):
                base_url = self.config.llm.base_url

            embed_model = "nomic-embed-text"
            if hasattr(self.config, 'rag') and hasattr(self.config.rag, 'embedding_model'):
                embed_model = self.config.rag.embedding_model

            self._client = chromadb.PersistentClient(path=db_path)
            embed_fn = OllamaEmbeddingFunction(
                url=f"{base_url}/api/embeddings",
                model_name=embed_model,
            )
            self._collection = self._client.get_or_create_collection(
                name="damz_docs",
                embedding_function=embed_fn,
            )
            self._initialized = True
            print("[RAG] Retriever initialized")
        except ImportError as e:
            print(f"[RAG] Retriever dependencies not installed: {e}")
        except Exception as e:
            print(f"[RAG] Retriever init error: {e}")

    def query(self, text: str, top_k: int = 3) -> list:
        """Semantic search for relevant chunks.

        Args:
            text: Query text.
            top_k: Number of results to return.

        Returns:
            List of dicts with content, filename, and score.
        """
        if not self._initialized:
            return []

        try:
            results = self._collection.query(
                query_texts=[text],
                n_results=top_k,
                include=["documents", "metadatas", "distances"],
            )

            output = []
            if results and results.get("documents") and results["documents"][0]:
                for doc, meta, dist in zip(
                    results["documents"][0],
                    results["metadatas"][0],
                    results["distances"][0],
                ):
                    output.append({
                        "content": doc,
                        "filename": meta.get("filename", ""),
                        "score": round(1 - dist, 3),
                    })
            return output
        except Exception as e:
            print(f"[RAG] Query error: {e}")
            return []

    def build_context(self, query: str) -> str:
        """Build context string from relevant chunks for LLM injection.

        Args:
            query: The user's question.

        Returns:
            Formatted context string, or empty string if no results.
        """
        chunks = self.query(query)
        if not chunks:
            return ""

        lines = ["Informasi dari dokumen yang relevan:"]
        for c in chunks:
            lines.append(f"[{c['filename']}] {c['content']}")
        return "\n\n".join(lines)

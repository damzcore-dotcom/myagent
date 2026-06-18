"""Damz Agent — RAG Document Ingestor.

Reads PDF/TXT/DOCX files, chunks text, generates embeddings,
and stores in ChromaDB for semantic retrieval.
"""

import hashlib
from pathlib import Path

CHUNK_SIZE = 512
CHUNK_OVERLAP = 64
COLLECTION = "damz_docs"


class RAGIngestor:
    """Document ingestor for the RAG pipeline."""

    def __init__(self, config):
        self.config = config
        self._client = None
        self._collection = None
        self._splitter = None
        self._initialized = False
        self._init()

    def _init(self):
        """Initialize ChromaDB and text splitter."""
        try:
            import chromadb
            from chromadb.utils.embedding_functions import OllamaEmbeddingFunction
            from langchain.text_splitter import RecursiveCharacterTextSplitter

            db_path = None
            if hasattr(self.config, 'rag'):
                db_path = self.config.rag.chroma_db_path
            if not db_path:
                db_path = str(Path(__file__).parent.parent / "data" / "chroma_db")

            Path(db_path).mkdir(parents=True, exist_ok=True)

            self._client = chromadb.PersistentClient(path=db_path)

            base_url = "http://localhost:11434"
            if hasattr(self.config, 'llm'):
                base_url = self.config.llm.base_url

            embed_model = "nomic-embed-text"
            if hasattr(self.config, 'rag') and hasattr(self.config.rag, 'embedding_model'):
                embed_model = self.config.rag.embedding_model

            embed_fn = OllamaEmbeddingFunction(
                url=f"{base_url}/api/embeddings",
                model_name=embed_model,
            )

            self._collection = self._client.get_or_create_collection(
                name=COLLECTION,
                embedding_function=embed_fn,
            )

            chunk_size = CHUNK_SIZE
            chunk_overlap = CHUNK_OVERLAP
            if hasattr(self.config, 'rag'):
                chunk_size = getattr(self.config.rag, 'chunk_size', CHUNK_SIZE)
                chunk_overlap = getattr(self.config.rag, 'chunk_overlap', CHUNK_OVERLAP)

            self._splitter = RecursiveCharacterTextSplitter(
                chunk_size=chunk_size,
                chunk_overlap=chunk_overlap,
            )

            self._initialized = True
            print(f"[RAG] Ingestor initialized (ChromaDB: {db_path})")
        except ImportError as e:
            print(f"[RAG] Dependencies not installed: {e}")
            print("[RAG] Run: pip install chromadb langchain")
        except Exception as e:
            print(f"[RAG] Init error: {e}")

    def ingest(self, file_path: str) -> dict:
        """Process a single file: read → chunk → embed → store.

        Args:
            file_path: Path to the document file.

        Returns:
            dict with success status, chunks_added, and file_hash.
        """
        if not self._initialized:
            return {"success": False, "error": "Ingestor not initialized"}

        path = Path(file_path)
        if not path.exists():
            return {"success": False, "error": f"File not found: {file_path}"}

        text = self._extract_text(path)
        if not text:
            return {"success": False, "error": f"Could not extract text from {path.name}"}

        file_hash = hashlib.md5(path.read_bytes()).hexdigest()

        # Check if already indexed with same hash
        try:
            existing = self._collection.get(where={"file_hash": file_hash})
            if existing and existing.get("ids"):
                return {"success": True, "chunks_added": 0, "note": "Already indexed (same hash)"}
        except Exception:
            pass

        # Delete old index if file was modified
        try:
            old = self._collection.get(where={"filename": path.name})
            if old and old.get("ids"):
                self._collection.delete(ids=old["ids"])
        except Exception:
            pass

        # Chunk and index
        chunks = self._splitter.split_text(text)
        if not chunks:
            return {"success": False, "error": "No chunks generated"}

        ids = [f"{path.stem}_{i}" for i in range(len(chunks))]
        metadatas = [
            {"filename": path.name, "file_hash": file_hash, "chunk": i}
            for i in range(len(chunks))
        ]

        self._collection.add(documents=chunks, ids=ids, metadatas=metadatas)
        print(f"[RAG] Indexed: {path.name} ({len(chunks)} chunks)")
        return {"success": True, "chunks_added": len(chunks), "file_hash": file_hash}

    def delete(self, filename: str) -> bool:
        """Delete all chunks for a document."""
        if not self._initialized:
            return False
        try:
            result = self._collection.get(where={"filename": filename})
            if result and result.get("ids"):
                self._collection.delete(ids=result["ids"])
                print(f"[RAG] Deleted: {filename}")
                return True
        except Exception as e:
            print(f"[RAG] Delete error: {e}")
        return False

    def reindex(self, file_path: str) -> dict:
        """Force re-index a file (delete old + ingest new)."""
        path = Path(file_path)
        self.delete(path.name)
        return self.ingest(file_path)

    def get_stats(self) -> dict:
        """Get indexing statistics."""
        if not self._initialized:
            return {"total_chunks": 0, "initialized": False}
        try:
            count = self._collection.count()
            return {"total_chunks": count, "initialized": True}
        except Exception:
            return {"total_chunks": 0, "initialized": True}

    def get_indexed_files(self) -> list:
        """Get list of indexed filenames."""
        if not self._initialized:
            return []
        try:
            all_data = self._collection.get(include=["metadatas"])
            filenames = set()
            if all_data and all_data.get("metadatas"):
                for meta in all_data["metadatas"]:
                    if meta and meta.get("filename"):
                        filenames.add(meta["filename"])
            return sorted(filenames)
        except Exception:
            return []

    def _extract_text(self, path: Path) -> str:
        """Extract text from PDF, TXT, or DOCX."""
        suffix = path.suffix.lower()
        try:
            if suffix == ".pdf":
                return self._read_pdf(path)
            elif suffix in (".txt", ".md"):
                return path.read_text(encoding="utf-8", errors="ignore")
            elif suffix == ".docx":
                return self._read_docx(path)
            else:
                print(f"[RAG] Unsupported format: {suffix}")
                return ""
        except Exception as e:
            print(f"[RAG] Extract error ({path.name}): {e}")
            return ""

    def _read_pdf(self, path: Path) -> str:
        """Extract text from PDF."""
        from pypdf import PdfReader
        reader = PdfReader(str(path))
        return "\n".join(p.extract_text() or "" for p in reader.pages)

    def _read_docx(self, path: Path) -> str:
        """Extract text from DOCX."""
        from docx import Document as DocxDocument
        doc = DocxDocument(str(path))
        return "\n".join(p.text for p in doc.paragraphs)

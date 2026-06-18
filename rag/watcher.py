"""Damz Agent — Document Folder Watcher.

Automatically watches a folder for new/modified documents
and triggers indexing via the RAG ingestor.
"""

import time
from pathlib import Path

SUPPORTED_EXTENSIONS = {".pdf", ".txt", ".docx", ".md"}


class DocumentWatcher:
    """Watches a folder for document changes and auto-indexes."""

    def __init__(self, ingestor, watch_dir: str = None):
        self.ingestor = ingestor
        self.watch_dir = Path(watch_dir) if watch_dir else Path(__file__).parent / "documents"
        self._observer = None
        self._running = False

    def start(self):
        """Start watching the documents folder."""
        self.watch_dir.mkdir(parents=True, exist_ok=True)

        try:
            from watchdog.observers import Observer
            from watchdog.events import FileSystemEventHandler

            class _Handler(FileSystemEventHandler):
                def __init__(self, ingestor):
                    self.ingestor = ingestor

                def on_created(self, event):
                    if not event.is_directory:
                        path = Path(event.src_path)
                        if path.suffix.lower() in SUPPORTED_EXTENSIONS:
                            print(f"[RAG WATCHER] New file: {path.name}")
                            time.sleep(1)
                            result = self.ingestor.ingest(str(path))
                            print(f"[RAG WATCHER] {path.name}: {result}")

                def on_modified(self, event):
                    if not event.is_directory:
                        path = Path(event.src_path)
                        if path.suffix.lower() in SUPPORTED_EXTENSIONS:
                            print(f"[RAG WATCHER] Modified: {path.name}")
                            time.sleep(1)
                            result = self.ingestor.reindex(str(path))
                            print(f"[RAG WATCHER] Re-indexed {path.name}: {result}")

            self._observer = Observer()
            self._observer.schedule(_Handler(self.ingestor), str(self.watch_dir), recursive=False)
            self._observer.start()
            self._running = True
            print(f"[RAG WATCHER] Watching: {self.watch_dir}")

            self._index_existing()

        except ImportError:
            print("[RAG WATCHER] watchdog not installed. Run: pip install watchdog")
            print("[RAG WATCHER] Auto-watch disabled, manual indexing still works.")

    def stop(self):
        """Stop watching."""
        if self._observer:
            self._observer.stop()
            self._observer.join()
            self._running = False
            print("[RAG WATCHER] Stopped")

    def _index_existing(self):
        """Index all existing supported files in the watch directory."""
        count = 0
        for ext in SUPPORTED_EXTENSIONS:
            for file_path in self.watch_dir.glob(f"*{ext}"):
                result = self.ingestor.ingest(str(file_path))
                if result.get("success"):
                    count += 1
        if count:
            print(f"[RAG WATCHER] Indexed {count} existing files")

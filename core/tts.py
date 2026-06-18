"""Damz Agent — Text-to-Speech Engine.

Uses Piper TTS for offline voice synthesis with a queue system
to prevent overlapping speech.
"""

import subprocess
import threading
import queue
import tempfile
import os
from pathlib import Path


class TTSEngine:
    """Text-to-Speech engine using Piper TTS with queue management."""

    def __init__(self, config):
        self.config = config
        self._queue = queue.Queue()
        self._current_proc = None
        self._running = True
        self._paused = False
        self._worker = threading.Thread(target=self._process_queue, daemon=True)
        self._worker.start()
        self._audio_initialized = False
        self._init_audio()

    def _init_audio(self):
        """Initialize pygame mixer for audio playback."""
        try:
            import pygame
            pygame.mixer.init(frequency=22050, size=-16, channels=1)
            self._audio_initialized = True
            print("[TTS] Audio initialized (pygame mixer)")
        except Exception as e:
            print(f"[TTS] Warning: Audio init failed: {e}")
            self._audio_initialized = False

    def speak(self, text: str, priority: bool = False):
        """Add text to the TTS queue.

        Args:
            text: Text to synthesize and speak.
            priority: If True, interrupt current speech and clear queue.
        """
        if not text or not text.strip():
            return

        if priority:
            self.stop()

        self._queue.put(text)
        display = text[:50] + "..." if len(text) > 50 else text
        print(f"[TTS] Queued: {display}")

    def stop(self):
        """Stop current speech and clear the queue."""
        while not self._queue.empty():
            try:
                self._queue.get_nowait()
            except queue.Empty:
                break

        if self._audio_initialized:
            try:
                import pygame
                if pygame.mixer.get_init():
                    pygame.mixer.stop()
            except Exception:
                pass

        if self._current_proc and self._current_proc.poll() is None:
            try:
                self._current_proc.terminate()
            except Exception:
                pass

    def pause(self):
        """Pause TTS playback."""
        self._paused = True
        if self._audio_initialized:
            try:
                import pygame
                if pygame.mixer.get_init():
                    pygame.mixer.pause()
            except Exception:
                pass

    def resume(self):
        """Resume TTS playback."""
        self._paused = False
        if self._audio_initialized:
            try:
                import pygame
                if pygame.mixer.get_init():
                    pygame.mixer.unpause()
            except Exception:
                pass

    def shutdown(self):
        """Shutdown the TTS engine."""
        self._running = False
        self.stop()
        self._queue.put(None)  # Sentinel to unblock worker

    def _process_queue(self):
        """Worker thread — process text from queue."""
        while self._running:
            try:
                text = self._queue.get(timeout=1)
                if text is None:  # Shutdown sentinel
                    break
                if not self._paused:
                    self._render_and_play(text)
            except queue.Empty:
                continue
            except Exception as e:
                print(f"[TTS] Error in queue processing: {e}")

    def _render_and_play(self, text: str):
        """Render text with Piper and play the resulting audio."""
        voice_path = self.config.voices.get(
            self.config.voice_id,
            list(self.config.voices.values())[0] if self.config.voices else None
        )

        if not voice_path:
            print("[TTS] No voice file configured")
            return

        piper_exe = self.config.piper_exe
        if not Path(piper_exe).exists():
            print(f"[TTS] Piper not found: {piper_exe}")
            print(f"[TTS] (Simulating speech): {text}")
            return

        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            wav_path = tmp.name

        try:
            self._current_proc = subprocess.Popen(
                [
                    piper_exe,
                    "--model", voice_path,
                    "--output_file", wav_path,
                ],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )
            self._current_proc.communicate(input=text.encode("utf-8"), timeout=30)

            if Path(wav_path).exists() and self._audio_initialized:
                import pygame
                sound = pygame.mixer.Sound(wav_path)
                sound.play()
                while pygame.mixer.get_busy() and self._running and not self._paused:
                    pygame.time.wait(100)
        except subprocess.TimeoutExpired:
            if self._current_proc:
                self._current_proc.kill()
            print("[TTS] Piper timed out")
        except Exception as e:
            print(f"[TTS] Error: {e}")
        finally:
            self._current_proc = None
            try:
                os.unlink(wav_path)
            except Exception:
                pass

"""Damz Agent — Speech-to-Text Engine.

Uses Faster-Whisper via RealtimeSTT for real-time transcription.
Includes pause/resume for avoiding transcribing agent's own speech.
"""

import threading


class STTEngine:
    """Speech-to-Text engine using Faster-Whisper."""

    def __init__(self, config, on_text_callback):
        """Initialize STT engine.

        Args:
            config: STTConfig instance.
            on_text_callback: Function(text: str) called when transcription is ready.
        """
        self.config = config
        self.on_text = on_text_callback
        self._recorder = None
        self._active = False
        self._paused = False
        self._thread = None

    def start(self):
        """Start the STT listening loop in a separate thread."""
        if self._active:
            print("[STT] Already running")
            return

        self._active = True
        self._thread = threading.Thread(target=self._listen_loop, daemon=True)
        self._thread.start()
        print(f"[STT] Started (model: {self.config.model}, lang: {self.config.language})")

    def stop(self):
        """Stop the STT engine."""
        self._active = False
        if self._recorder:
            try:
                self._recorder.stop()
            except Exception:
                pass
            self._recorder = None
        print("[STT] Stopped")

    def pause(self):
        """Pause transcription (e.g., while TTS is speaking)."""
        self._paused = True
        print("[STT] Paused")

    def resume(self):
        """Resume transcription after pause."""
        self._paused = False
        print("[STT] Resumed")

    def _listen_loop(self):
        """Main listening loop — runs in background thread."""
        try:
            from RealtimeSTT import AudioToTextRecorder

            self._recorder = AudioToTextRecorder(
                model=self.config.model,
                language=self.config.language,
                spinner=False,
                silero_sensitivity=0.4,
                webrtc_sensitivity=2,
                post_speech_silence_duration=0.4,
                min_length_of_recording=0.5,
                min_gap_between_recordings=0.3,
                enable_realtime_transcription=False,
            )

            print("[STT] Recorder initialized, listening...")

            while self._active:
                try:
                    text = self._recorder.text()
                    if text and not self._paused:
                        # Noise gate: ignore very short transcriptions
                        cleaned = text.strip()
                        if len(cleaned) >= 2:
                            print(f"[STT] Transcribed: {cleaned}")
                            self.on_text(cleaned)
                except Exception as e:
                    if self._active:
                        print(f"[STT] Transcription error: {e}")
        except ImportError:
            print("[STT] RealtimeSTT not installed. Run: pip install RealtimeSTT")
        except Exception as e:
            print(f"[STT] Failed to initialize: {e}")

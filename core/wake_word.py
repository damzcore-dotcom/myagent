"""Damz Agent — Wake Word Detector.

Background listener for wake word detection using openWakeWord.
Triggers STT activation when wake word is detected.
"""

import threading
import time


class WakeWordDetector:
    """Wake word detector using openWakeWord."""

    def __init__(self, config, on_detected_callback):
        """Initialize wake word detector.

        Args:
            config: AppConfig instance.
            on_detected_callback: Function called (no args) when wake word detected.
        """
        self.config = config
        self.on_detected = on_detected_callback
        self._model = None
        self._running = False
        self._thread = None
        self._sensitivity = 0.5

    def start(self):
        """Start wake word detection in background thread."""
        if self._running:
            print("[WAKE] Already running")
            return

        self._running = True
        self._thread = threading.Thread(target=self._detection_loop, daemon=True)
        self._thread.start()
        print("[WAKE] Wake word detector started")

    def stop(self):
        """Stop wake word detection."""
        self._running = False
        if self._thread:
            self._thread.join(timeout=2)
        print("[WAKE] Wake word detector stopped")

    def set_sensitivity(self, value: float):
        """Set detection sensitivity (0.0 to 1.0)."""
        self._sensitivity = max(0.0, min(1.0, value))

    def _detection_loop(self):
        """Main detection loop — runs in background thread."""
        try:
            import openwakeword
            from openwakeword.model import Model
            import sounddevice as sd
            import numpy as np

            # Load pre-trained model (use hey_jarvis as placeholder)
            # TODO: Train custom "Halo Damz" model
            self._model = Model(
                wakeword_models=["hey_jarvis"],
                inference_framework="onnx",
            )

            print("[WAKE] Model loaded (using 'hey_jarvis' as placeholder)")
            print("[WAKE] Say 'Hey Jarvis' to activate (will be 'Halo Damz' later)")

            SAMPLE_RATE = 16000
            CHUNK_SIZE = 1280  # 80ms at 16kHz

            def audio_callback(indata, frames, time_info, status):
                if status:
                    print(f"[WAKE] Audio status: {status}")
                if not self._running:
                    return

                audio_data = np.frombuffer(indata, dtype=np.int16)
                prediction = self._model.predict(audio_data)

                for model_name, score in prediction.items():
                    if score > self._sensitivity:
                        print(f"[WAKE] Detected! (score: {score:.3f})")
                        self._model.reset()
                        self.on_detected()

            with sd.InputStream(
                samplerate=SAMPLE_RATE,
                channels=1,
                dtype="int16",
                blocksize=CHUNK_SIZE,
                callback=audio_callback,
            ):
                while self._running:
                    time.sleep(0.1)

        except ImportError as e:
            print(f"[WAKE] Dependencies not installed: {e}")
            print("[WAKE] Run: pip install openwakeword sounddevice")
            while self._running:
                time.sleep(1)
        except Exception as e:
            print(f"[WAKE] Error: {e}")
            while self._running:
                time.sleep(1)

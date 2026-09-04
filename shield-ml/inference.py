"""Model loading and inference helpers for the SHIELD ML service.

Both models are pretrained, used exactly as published (no fine-tuning), and
are loaded once at process startup — see PRD-1-SHIELD.md and ML-SPEC.md.
"""

from __future__ import annotations

import io
import logging
from dataclasses import dataclass, field
from typing import Optional

import librosa
import soundfile as sf
from PIL import Image
from transformers import Pipeline, pipeline

logger = logging.getLogger("shield_ml.inference")

FACE_MODEL_ID = "prithivMLmods/Deep-Fake-Detector-v2-Model"
VOICE_MODEL_ID = "MelodyMachine/Deepfake-audio-detection-V2"

VOICE_TARGET_SAMPLE_RATE = 16000

# HF checkpoints label classes differently (e.g. "Deepfake"/"Realism" vs
# "spoof"/"bonafide"). Normalize by keyword rather than assuming label text.
_FAKE_KEYWORDS = ("fake", "deepfake", "spoof", "synthetic", "ai-generated", "generated")
_REAL_KEYWORDS = ("real", "bonafide", "bona-fide", "genuine", "authentic", "human")


@dataclass
class ModelState:
    """Holds the loaded pipelines (or the error explaining why one is missing)."""

    face_pipeline: Optional[Pipeline] = field(default=None)
    voice_pipeline: Optional[Pipeline] = field(default=None)
    face_error: Optional[str] = field(default=None)
    voice_error: Optional[str] = field(default=None)

    @property
    def face_ready(self) -> bool:
        return self.face_pipeline is not None

    @property
    def voice_ready(self) -> bool:
        return self.voice_pipeline is not None


state = ModelState()


def load_face_model() -> None:
    """Load the face deepfake classifier. Never raises — records the error instead."""
    try:
        logger.info("Loading face model %s ...", FACE_MODEL_ID)
        state.face_pipeline = pipeline(
            task="image-classification",
            model=FACE_MODEL_ID,
            device=-1,  # CPU only, no GPU assumed at the venue
        )
        logger.info("Face model loaded successfully.")
    except Exception as exc:  # noqa: BLE001 - must not crash the process
        state.face_error = f"{type(exc).__name__}: {exc}"
        logger.error("Failed to load face model: %s", state.face_error)


def load_voice_model() -> None:
    """Load the voice deepfake classifier. Never raises — records the error instead."""
    try:
        logger.info("Loading voice model %s ...", VOICE_MODEL_ID)
        state.voice_pipeline = pipeline(
            task="audio-classification",
            model=VOICE_MODEL_ID,
            device=-1,  # CPU only, no GPU assumed at the venue
        )
        logger.info("Voice model loaded successfully.")
    except Exception as exc:  # noqa: BLE001 - must not crash the process
        state.voice_error = f"{type(exc).__name__}: {exc}"
        logger.error("Failed to load voice model: %s", state.voice_error)


def _label_to_verdict(label: str) -> str:
    normalized = label.lower()
    if any(keyword in normalized for keyword in _FAKE_KEYWORDS):
        return "fake"
    if any(keyword in normalized for keyword in _REAL_KEYWORDS):
        return "real"
    # Unrecognized label convention (e.g. raw "LABEL_1"): default to treating
    # it as the reported class name rather than guessing silently.
    logger.warning("Unrecognized classifier label %r, defaulting to 'fake'.", label)
    return "fake"


def predict_face(image_bytes: bytes) -> tuple[str, float]:
    """Run the face classifier on raw image bytes. Returns (verdict, confidence)."""
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    assert state.face_pipeline is not None  # caller checks state.face_ready first
    results = state.face_pipeline(image)
    top = results[0]
    return _label_to_verdict(top["label"]), float(top["score"])


def predict_voice(audio_bytes: bytes) -> tuple[str, float]:
    """Run the voice classifier on raw audio bytes. Returns (verdict, confidence)."""
    data, sample_rate = sf.read(io.BytesIO(audio_bytes), dtype="float32", always_2d=False)
    if data.ndim > 1:
        data = data.mean(axis=1)  # downmix to mono
    if sample_rate != VOICE_TARGET_SAMPLE_RATE:
        data = librosa.resample(data, orig_sr=sample_rate, target_sr=VOICE_TARGET_SAMPLE_RATE)
    assert state.voice_pipeline is not None  # caller checks state.voice_ready first
    results = state.voice_pipeline(data, sampling_rate=VOICE_TARGET_SAMPLE_RATE)
    top = results[0]
    return _label_to_verdict(top["label"]), float(top["score"])

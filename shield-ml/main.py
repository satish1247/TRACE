"""SHIELD ML service — pretrained deepfake/clone detection over HTTP.

Two endpoints backing PRD-1-SHIELD.md S6/S7, exact contract in
.claude/project/API.md. Both models are loaded once at startup (see
inference.py) so requests only pay inference cost, not load cost.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from typing import Optional

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse

import inference

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("shield_ml.main")

FACE_CONTENT_TYPES = {"image/jpeg", "image/png"}
FACE_EXTENSIONS = (".jpg", ".jpeg", ".png")
FACE_MAX_BYTES = 10 * 1024 * 1024

VOICE_CONTENT_TYPES = {"audio/wav", "audio/x-wav", "audio/wave", "audio/mpeg", "audio/mp3"}
VOICE_EXTENSIONS = (".wav", ".mp3")
VOICE_MAX_BYTES = 15 * 1024 * 1024


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load both models independently — one failing to load must not stop the
    # other from serving, and must not crash the process (PRD requirement).
    inference.load_face_model()
    inference.load_voice_model()
    yield


app = FastAPI(title="SHIELD ML service", lifespan=lifespan)


async def _read_upload(
    file: Optional[UploadFile],
    allowed_types: set[str],
    allowed_extensions: tuple[str, ...],
    max_bytes: int,
) -> bytes:
    """Validate content-type/extension and size, returning the file bytes.

    Raises HTTPException(400) for a missing file, 415 for an unsupported type.
    """
    if file is None or not file.filename:
        raise HTTPException(status_code=400, detail="Missing file upload in field 'file'.")

    content_type = (file.content_type or "").lower()
    filename = file.filename.lower()
    type_ok = content_type in allowed_types
    extension_ok = filename.endswith(allowed_extensions)
    if not (type_ok or extension_ok):
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported content type '{file.content_type}'. Expected one of {sorted(allowed_types)}.",
        )

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(data) > max_bytes:
        raise HTTPException(
            status_code=400,
            detail=f"File too large: {len(data)} bytes exceeds limit of {max_bytes} bytes.",
        )
    return data


@app.get("/health")
async def health() -> JSONResponse:
    body = {
        "status": "ok" if (inference.state.face_ready and inference.state.voice_ready) else "degraded",
        "face_model_loaded": inference.state.face_ready,
        "voice_model_loaded": inference.state.voice_ready,
        "face_model": inference.FACE_MODEL_ID,
        "voice_model": inference.VOICE_MODEL_ID,
        "face_error": inference.state.face_error,
        "voice_error": inference.state.voice_error,
    }
    return JSONResponse(status_code=200, content=body)


@app.post("/detect/face")
async def detect_face(file: Optional[UploadFile] = File(default=None)) -> JSONResponse:
    if not inference.state.face_ready:
        raise HTTPException(
            status_code=503,
            detail=f"Face model unavailable: {inference.state.face_error or 'not loaded'}.",
        )

    data = await _read_upload(file, FACE_CONTENT_TYPES, FACE_EXTENSIONS, FACE_MAX_BYTES)

    try:
        verdict, confidence = inference.predict_face(data)
    except Exception as exc:  # noqa: BLE001 - surface as a clean 400, don't crash
        logger.error("Face inference failed: %s", exc)
        raise HTTPException(status_code=400, detail=f"Could not process image: {exc}") from exc

    return JSONResponse(
        status_code=200,
        content={"verdict": verdict, "confidence": confidence, "model": inference.FACE_MODEL_ID},
    )


@app.post("/detect/voice")
async def detect_voice(file: Optional[UploadFile] = File(default=None)) -> JSONResponse:
    if not inference.state.voice_ready:
        raise HTTPException(
            status_code=503,
            detail=f"Voice model unavailable: {inference.state.voice_error or 'not loaded'}.",
        )

    data = await _read_upload(file, VOICE_CONTENT_TYPES, VOICE_EXTENSIONS, VOICE_MAX_BYTES)

    try:
        verdict, confidence = inference.predict_voice(data)
    except Exception as exc:  # noqa: BLE001 - surface as a clean 400, don't crash
        logger.error("Voice inference failed: %s", exc)
        raise HTTPException(status_code=400, detail=f"Could not process audio: {exc}") from exc

    return JSONResponse(
        status_code=200,
        content={"verdict": verdict, "confidence": confidence, "model": inference.VOICE_MODEL_ID},
    )

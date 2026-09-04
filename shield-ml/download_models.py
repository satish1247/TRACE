"""Pre-download and cache both SHIELD ML checkpoints.

Run this ONCE, ahead of time, with a working network connection:

    python download_models.py

It populates the local Hugging Face cache (huggingface_hub's default cache
dir, typically ~/.cache/huggingface) so that `main.py` can start later with
NO network access — required because venue wifi may fail (see
PRD-1-SHIELD.md, "Download the weights before the venue and cache them.").
"""

from __future__ import annotations

import sys
import time

from huggingface_hub import snapshot_download

FACE_MODEL_ID = "prithivMLmods/Deep-Fake-Detector-v2-Model"
VOICE_MODEL_ID = "MelodyMachine/Deepfake-audio-detection-V2"


def _download(model_id: str) -> bool:
    print(f"\n=== Downloading {model_id} ===")
    started = time.monotonic()
    try:
        path = snapshot_download(repo_id=model_id)
    except Exception as exc:  # noqa: BLE001 - report and continue to the next model
        print(f"FAILED to download {model_id}: {type(exc).__name__}: {exc}")
        return False
    elapsed = time.monotonic() - started
    print(f"OK: {model_id} cached at {path} ({elapsed:.1f}s)")
    return True


def main() -> None:
    print("SHIELD ML — pre-downloading pretrained model weights (~700MB combined).")
    print("This needs network access. Run it once, before the venue.\n")

    face_ok = _download(FACE_MODEL_ID)
    voice_ok = _download(VOICE_MODEL_ID)

    print("\n=== Summary ===")
    print(f"Face model  ({FACE_MODEL_ID}): {'OK' if face_ok else 'FAILED'}")
    print(f"Voice model ({VOICE_MODEL_ID}): {'OK' if voice_ok else 'FAILED'}")

    if face_ok and voice_ok:
        print("\nBoth models cached successfully. main.py can now start offline.")
        sys.exit(0)
    else:
        print("\nOne or more models failed to download. Fix network/access issues and re-run.")
        sys.exit(1)


if __name__ == "__main__":
    main()

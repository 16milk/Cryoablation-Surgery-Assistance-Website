"""MedSAM2 lung-segmentation HTTP service.

Endpoints (consumed by the lung-ct-compare frontend via the /medsam2 dev proxy):
  GET  /health   -> { status, modelLoaded, device }
  POST /segment  -> { width, height, maskBase64, device, model }

The request carries one CT slice's HU values (base64 little-endian int16) plus a
bounding-box prompt. The response carries a base64 uint8 {0,1} mask of the same
size. On any model problem the service returns 503 so the browser falls back to
its built-in threshold segmentation.
"""

from __future__ import annotations

import base64
from typing import List, Optional

import numpy as np
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from runner import MedSam2Runner, ModelUnavailable

app = FastAPI(title="MedSAM2 Lung Segmentation Service")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

runner = MedSam2Runner()


class SegmentRequest(BaseModel):
    width: int
    height: int
    huBase64: str
    structure: Optional[str] = None
    box: Optional[List[float]] = None
    points: Optional[List[List[float]]] = None
    window: Optional[List[float]] = None


@app.get("/health")
def health():
    return {"status": "ok", "modelLoaded": runner.is_loaded(), "device": runner.device}


@app.post("/segment")
def segment(req: SegmentRequest):
    expected = req.width * req.height
    if expected <= 0:
        return JSONResponse(status_code=400, content={"error": "invalid dimensions"})

    try:
        raw = base64.b64decode(req.huBase64)
        hu = np.frombuffer(raw, dtype="<i2").astype(np.float32)
    except Exception as exc:  # noqa: BLE001
        return JSONResponse(status_code=400, content={"error": f"bad huBase64: {exc}"})

    if hu.size != expected:
        return JSONResponse(
            status_code=400,
            content={"error": f"hu length {hu.size} != width*height {expected}"},
        )

    hu = hu.reshape((req.height, req.width))
    window = tuple(req.window) if req.window and len(req.window) == 2 else None

    try:
        mask = runner.segment(hu, req.box, window, req.points)
    except ModelUnavailable as exc:
        return JSONResponse(status_code=503, content={"error": str(exc)})
    except Exception as exc:  # noqa: BLE001
        return JSONResponse(status_code=500, content={"error": str(exc)})

    mask_bytes = np.ascontiguousarray(mask, dtype=np.uint8).tobytes()
    return {
        "width": req.width,
        "height": req.height,
        "maskBase64": base64.b64encode(mask_bytes).decode("ascii"),
        "device": runner.device,
        "model": "medsam2",
    }


if __name__ == "__main__":
    import os

    import uvicorn

    port = int(os.environ.get("MEDSAM2_PORT", "5200"))
    uvicorn.run(app, host="127.0.0.1", port=port)

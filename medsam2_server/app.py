"""MedSAM2 lung-segmentation HTTP service.

Endpoints (consumed by the lung-ct-compare frontend via the /medsam2 dev proxy):
  GET  /health              -> { status, modelLoaded, vxmLoaded, device, vxmDevice }
  POST /segment             -> { width, height, maskBase64, device, model }
  POST /registration/field  -> { dimensions, spacing, direction, flowBase64, device, model }

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
from vxm_runner import VxmRegistrationRunner, VolumeGeometry

app = FastAPI(title="MedSAM2 Lung Segmentation Service")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

runner = MedSam2Runner()
vxm_runner = VxmRegistrationRunner()


class SegmentRequest(BaseModel):
    width: int
    height: int
    huBase64: str
    structure: Optional[str] = None
    box: Optional[List[float]] = None
    points: Optional[List[List[float]]] = None
    window: Optional[List[float]] = None


class RegistrationVolume(BaseModel):
    dimensions: List[int]
    spacing: List[float]
    origin: List[float]
    direction: List[float]
    huBase64: str


class RegistrationFieldRequest(BaseModel):
    baseline: RegistrationVolume
    compare: RegistrationVolume


@app.get("/health")
def health():
    return {
        "status": "ok",
        "modelLoaded": runner.is_loaded(),
        "device": runner.device,
        "vxmLoaded": vxm_runner.is_loaded(),
        "vxmDevice": vxm_runner.device,
    }


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


def _decode_registration_volume(vol: RegistrationVolume) -> np.ndarray:
    if len(vol.dimensions) != 3:
        raise ValueError("dimensions must be [width, height, depth]")
    width, height, depth = [int(v) for v in vol.dimensions]
    expected = width * height * depth
    if expected <= 0:
        raise ValueError("invalid registration volume dimensions")

    raw = base64.b64decode(vol.huBase64)
    hu = np.frombuffer(raw, dtype="<i2").astype(np.float32)
    if hu.size != expected:
        raise ValueError(f"registration HU length {hu.size} != width*height*depth {expected}")
    return hu.reshape((depth, height, width))


@app.post("/registration/field")
def registration_field(req: RegistrationFieldRequest):
    try:
        baseline = _decode_registration_volume(req.baseline)
        compare = _decode_registration_volume(req.compare)
        geometry = VolumeGeometry(
            dimensions=tuple(int(v) for v in req.baseline.dimensions),
            spacing=tuple(float(v) for v in req.baseline.spacing),
            direction=tuple(float(v) for v in req.baseline.direction),
        )
    except Exception as exc:  # noqa: BLE001
        return JSONResponse(status_code=400, content={"error": str(exc)})

    try:
        flow = vxm_runner.register(baseline, compare, geometry)
    except ModelUnavailable as exc:
        return JSONResponse(status_code=503, content={"error": str(exc)})
    except Exception as exc:  # noqa: BLE001
        return JSONResponse(status_code=500, content={"error": str(exc)})

    flow_bytes = np.ascontiguousarray(flow, dtype=np.float32).tobytes()
    return {
        "dimensions": req.baseline.dimensions,
        "spacing": req.baseline.spacing,
        "origin": req.baseline.origin,
        "direction": req.baseline.direction,
        "flowBase64": base64.b64encode(flow_bytes).decode("ascii"),
        "device": vxm_runner.device,
        "model": "cryo_lung_vxm_epoch_200",
    }


if __name__ == "__main__":
    import os

    import uvicorn

    port = int(os.environ.get("MEDSAM2_PORT", "5200"))
    uvicorn.run(app, host="127.0.0.1", port=port)

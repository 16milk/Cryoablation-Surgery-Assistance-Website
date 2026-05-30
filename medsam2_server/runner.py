"""MedSAM2 inference wrapper.

Loads a MedSAM2 (SAM2-based) image predictor lazily and segments a single CT
slice given a bounding-box prompt. The model, weights and config are provided by
the operator via environment variables; if anything required is missing, a
``ModelUnavailable`` error is raised so the HTTP layer can return 503 and the
browser can fall back to its built-in HU-threshold segmentation.

Environment variables:
    MEDSAM2_CHECKPOINT  Path to the MedSAM2 .pt checkpoint (required).
    MEDSAM2_CONFIG      SAM2 model config, e.g. configs/sam2.1/sam2.1_hiera_t.yaml (required).
    MEDSAM2_DEVICE      Optional device override: cuda | mps | cpu (auto-detected otherwise).
"""

from __future__ import annotations

import os
import threading
from typing import List, Optional, Tuple

import numpy as np


class ModelUnavailable(RuntimeError):
    """Raised when the model cannot be loaded (missing weights/deps/config)."""


class MedSam2Runner:
    def __init__(self) -> None:
        self._predictor = None
        self._device: Optional[str] = None
        self._lock = threading.Lock()

    @property
    def device(self) -> str:
        return self._device or self._pick_device_name()

    def is_loaded(self) -> bool:
        return self._predictor is not None

    @staticmethod
    def _pick_device_name() -> str:
        try:
            import torch

            if torch.cuda.is_available():
                return "cuda"
            mps = getattr(torch.backends, "mps", None)
            if mps is not None and mps.is_available():
                return "mps"
        except Exception:
            pass
        return "cpu"

    def ensure_loaded(self) -> None:
        if self._predictor is not None:
            return
        with self._lock:
            if self._predictor is not None:
                return
            self._load()

    def _load(self) -> None:
        checkpoint = os.environ.get("MEDSAM2_CHECKPOINT")
        config = os.environ.get("MEDSAM2_CONFIG")

        if not checkpoint or not os.path.exists(checkpoint):
            raise ModelUnavailable(
                f"MEDSAM2_CHECKPOINT not set or file missing: {checkpoint!r}. "
                "Download the MedSAM2 weights and set MEDSAM2_CHECKPOINT."
            )
        if not config:
            raise ModelUnavailable(
                "MEDSAM2_CONFIG not set (e.g. configs/sam2.1/sam2.1_hiera_t.yaml)."
            )

        try:
            from sam2.build_sam import build_sam2
            from sam2.sam2_image_predictor import SAM2ImagePredictor
        except Exception as exc:  # noqa: BLE001 - surface the real cause to the client
            raise ModelUnavailable(
                f"Could not import sam2/torch: {exc}. Install PyTorch and SAM2/MedSAM2 "
                "(see medsam2_server/README.md)."
            ) from exc

        device = os.environ.get("MEDSAM2_DEVICE") or self._pick_device_name()
        model = build_sam2(config, checkpoint, device=device)
        self._predictor = SAM2ImagePredictor(model)
        self._device = device

    def segment(
        self,
        hu: np.ndarray,
        box: Optional[List[float]],
        window: Optional[Tuple[float, float]],
        points: Optional[List[List[float]]] = None,
    ) -> np.ndarray:
        """Return a uint8 HxW {0,1} mask for the given slice and prompt(s).

        Supports a box prompt, point prompts ([[x, y, label], ...]), or both.
        With point prompts we let the model produce multiple candidates and keep
        the highest-scoring one (best for a single clicked object).
        """
        self.ensure_loaded()

        rgb = self._hu_to_rgb(hu, window)
        self._predictor.set_image(rgb)

        box_arr = None
        if box is not None and len(box) == 4:
            box_arr = np.asarray(box, dtype=np.float32)[None, :]

        point_coords = None
        point_labels = None
        if points:
            point_coords = np.asarray([[p[0], p[1]] for p in points], dtype=np.float32)
            point_labels = np.asarray(
                [int(p[2]) if len(p) > 2 else 1 for p in points], dtype=np.int32
            )

        multimask = point_coords is not None
        masks, scores, _ = self._predictor.predict(
            point_coords=point_coords,
            point_labels=point_labels,
            box=box_arr,
            multimask_output=multimask,
        )
        masks = np.asarray(masks)
        if masks.ndim == 3:
            idx = int(np.argmax(np.asarray(scores))) if multimask and masks.shape[0] > 1 else 0
            mask = masks[idx]
        else:
            mask = masks
        return (mask > 0).astype(np.uint8)

    @staticmethod
    def _hu_to_rgb(hu: np.ndarray, window: Optional[Tuple[float, float]]) -> np.ndarray:
        center, width = window if window else (-500.0, 1400.0)
        low = center - width / 2.0
        high = center + width / 2.0
        span = max(high - low, 1e-6)
        norm = np.clip((hu.astype(np.float32) - low) / span, 0.0, 1.0)
        u8 = (norm * 255.0).astype(np.uint8)
        return np.stack([u8, u8, u8], axis=-1)

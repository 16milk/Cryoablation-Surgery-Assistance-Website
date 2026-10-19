"""MedSAM2 inference wrapper for single CT slices and 3D CT volumes.

One video predictor is shared by both routes so the checkpoint is loaded only
once. Volume inference propagates a prompt from the key slice in both
directions and merges the two masks in the original cropped-volume grid.
"""

from __future__ import annotations

import hashlib
import os
import threading
from contextlib import nullcontext
from typing import List, Optional, Tuple

import numpy as np


class ModelUnavailable(RuntimeError):
    """Raised when the model cannot be loaded (missing weights/deps/config)."""


class InferenceCancelled(RuntimeError):
    """Raised when an active volume job is cancelled between predictor frames."""


class MedSam2Runner:
    IMAGE_SIZE = 512

    def __init__(self) -> None:
        self._predictor = None
        self._device: Optional[str] = None
        self._load_lock = threading.Lock()
        self._inference_lock = threading.Lock()
        self._load_error: Optional[str] = None

    @property
    def device(self) -> str:
        return self._device or self._pick_device_name()

    @property
    def model_state(self) -> str:
        if self._predictor is not None:
            return "ready"
        return "error" if self._load_error else "uninitialized"

    @property
    def model_error(self) -> Optional[str]:
        return self._load_error

    @property
    def model_revision(self) -> str:
        """Stable opaque identity for the configured checkpoint and model config."""
        explicit = os.environ.get("MEDSAM2_MODEL_REVISION")
        if explicit:
            return explicit
        fingerprint = []
        for name in ("MEDSAM2_CONFIG", "MEDSAM2_CHECKPOINT"):
            configured = os.environ.get(name, "")
            if not configured:
                fingerprint.append(f"{name}:unset")
                continue
            try:
                stat = os.stat(configured)
                fingerprint.append(
                    f"{name}:{os.path.abspath(configured)}:{stat.st_size}:{stat.st_mtime_ns}"
                )
            except OSError:
                fingerprint.append(f"{name}:{os.path.abspath(configured)}:missing")
        return hashlib.sha256("|".join(fingerprint).encode("utf-8")).hexdigest()[:24]

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
        with self._load_lock:
            if self._predictor is not None:
                return
            try:
                self._load()
                self._load_error = None
            except Exception as exc:
                self._load_error = str(exc)
                if isinstance(exc, ModelUnavailable):
                    raise
                raise ModelUnavailable(str(exc)) from exc

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
                "MEDSAM2_CONFIG not set (for MedSAM2 Tiny 512, use "
                "configs/sam2.1_hiera_t512.yaml from the MedSAM2 repository)."
            )

        try:
            import torch
            from sam2.build_sam import build_sam2_video_predictor_npz
        except Exception as exc:  # noqa: BLE001
            raise ModelUnavailable(
                f"Could not import the MedSAM2 video predictor: {exc}. Install the "
                "MedSAM2 repository and compatible PyTorch dependencies."
            ) from exc

        device = os.environ.get("MEDSAM2_DEVICE") or self._pick_device_name()
        try:
            self._predictor = build_sam2_video_predictor_npz(config, checkpoint, device=device)
        except Exception as exc:  # noqa: BLE001
            raise ModelUnavailable(
                f"Could not build MedSAM2 with config {config!r} and checkpoint "
                f"{checkpoint!r}: {exc}"
            ) from exc
        self._device = device
        self.IMAGE_SIZE = int(getattr(self._predictor, "image_size", self.IMAGE_SIZE))

    @staticmethod
    def _normalize_hu(
        hu: np.ndarray, window: Optional[Tuple[float, float]]
    ) -> np.ndarray:
        center, width = window if window else (-500.0, 1400.0)
        if not np.isfinite(center) or not np.isfinite(width) or width <= 0:
            raise ValueError("window must contain a finite center and positive width")
        low = center - width / 2.0
        high = center + width / 2.0
        clipped = np.clip(hu.astype(np.float32), low, high)
        # Match the official MedSAM2 CT inference preprocessing: clip with the
        # case window, then scale the whole volume by its observed min/max.
        # A single volume-wide range keeps every axial frame on the same scale.
        observed_low = float(np.min(clipped))
        observed_high = float(np.max(clipped))
        if observed_high <= observed_low:
            return np.zeros_like(clipped, dtype=np.uint8)
        normalized = (clipped - observed_low) / (observed_high - observed_low)
        return (normalized * 255.0).astype(np.uint8)

    def _prepare_frames(self, hu: np.ndarray, window: Optional[Tuple[float, float]]):
        import torch
        import torch.nn.functional as F

        gray = self._normalize_hu(hu, window)
        frames = torch.from_numpy(gray).to(torch.float32).unsqueeze(1)
        frames = F.interpolate(
            frames,
            size=(self.IMAGE_SIZE, self.IMAGE_SIZE),
            mode="bilinear",
            align_corners=False,
        )
        frames = frames.expand(-1, 3, -1, -1).div_(255.0)
        mean = torch.tensor([0.485, 0.456, 0.406], dtype=frames.dtype).view(1, 3, 1, 1)
        std = torch.tensor([0.229, 0.224, 0.225], dtype=frames.dtype).view(1, 3, 1, 1)
        return ((frames - mean) / std).contiguous()

    @staticmethod
    def _inference_context():
        """Disable autograd during prediction, matching the upstream CT runner."""
        try:
            import torch
        except ImportError:
            # Only useful for dependency-free fake-predictor tests. A real
            # predictor cannot be loaded without torch.
            return nullcontext()
        return torch.inference_mode()

    @staticmethod
    def _check_cancelled(cancel_event) -> None:
        if cancel_event is not None and cancel_event.is_set():
            raise InferenceCancelled("segmentation job cancelled")

    def _add_prompt(
        self,
        state,
        frame_idx: int,
        box: Optional[List[float]],
        points: Optional[List[List[float]]],
    ):
        point_coords = None
        point_labels = None
        if points:
            point_coords = [[float(point[0]), float(point[1])] for point in points]
            point_labels = [int(point[2]) if len(point) > 2 else 1 for point in points]
        return self._predictor.add_new_points_or_box(
            inference_state=state,
            frame_idx=frame_idx,
            obj_id=1,
            points=point_coords,
            labels=point_labels,
            box=box,
        )

    @staticmethod
    def _store_frame_mask(output, masks: np.ndarray, width: int, height: int) -> None:
        frame_idx, _object_ids, logits = output
        mask = (logits[0, 0] > 0).detach().to("cpu").numpy().astype(np.uint8)
        if mask.shape != (height, width):
            raise RuntimeError(
                f"predictor returned frame mask {mask.shape}, expected {(height, width)}"
            )
        masks[frame_idx] |= mask

    @staticmethod
    def _retain_prompt_component(
        mask: np.ndarray, key_frame: int, points: Optional[List[List[float]]]
    ) -> np.ndarray:
        """Drop disconnected 3D islands unrelated to the positive key-frame prompt."""
        if not np.any(mask):
            return mask
        try:
            from scipy.ndimage import label
        except ImportError as exc:
            raise ModelUnavailable(
                "3D connected-component postprocessing requires scipy; "
                "install medsam2_server requirements"
            ) from exc

        labels, component_count = label(
            mask.astype(bool, copy=False), structure=np.ones((3, 3, 3), dtype=np.uint8)
        )
        if component_count <= 1:
            return mask

        sizes = np.bincount(labels.reshape(-1), minlength=component_count + 1)
        sizes[0] = 0
        seed_scores = np.zeros(component_count + 1, dtype=np.int64)
        if points:
            depth, height, width = mask.shape
            for point in points:
                if len(point) < 2 or (len(point) > 2 and int(point[2]) != 1):
                    continue
                x, y = int(round(float(point[0]))), int(round(float(point[1])))
                if not (0 <= x < width and 0 <= y < height):
                    continue
                # A small key-slice neighborhood handles rasterization and
                # prompt-to-mask boundary differences without seeding remote islands.
                local = labels[
                    key_frame,
                    max(0, y - 2) : min(height, y + 3),
                    max(0, x - 2) : min(width, x + 3),
                ]
                seed_scores += np.bincount(
                    local.reshape(-1), minlength=component_count + 1
                )

        seeded = np.flatnonzero(seed_scores[1:] > 0) + 1
        if seeded.size:
            selected = max(seeded.tolist(), key=lambda component: (seed_scores[component], sizes[component]))
        else:
            # Box-only prompts (or a prompt point missed by the predicted mask)
            # retain the largest component instead of producing an empty result.
            selected = int(np.argmax(sizes))
        return (labels == selected).astype(np.uint8)

    def _predict_direction(
        self,
        frames,
        key_frame: int,
        height: int,
        width: int,
        box: Optional[List[float]],
        points: Optional[List[List[float]]],
        reverse: bool,
        cancel_event=None,
        on_frame=None,
    ) -> np.ndarray:
        self._check_cancelled(cancel_event)
        state = self._predictor.init_state(
            frames,
            height,
            width,
            offload_video_to_cpu=True,
            offload_state_to_cpu=True,
        )
        try:
            prompt_output = self._add_prompt(state, key_frame, box, points)
            masks = np.zeros((len(frames), height, width), dtype=np.uint8)
            self._store_frame_mask(prompt_output, masks, width, height)
            seen_frames = {prompt_output[0]}
            if on_frame is not None:
                on_frame(prompt_output[0], reverse)
            for output in self._predictor.propagate_in_video(state, reverse=reverse):
                if cancel_event is not None and cancel_event.is_set():
                    raise InferenceCancelled("segmentation job cancelled")
                self._store_frame_mask(output, masks, width, height)
                if on_frame is not None and output[0] not in seen_frames:
                    seen_frames.add(output[0])
                    on_frame(output[0], reverse)
            return masks
        finally:
            self._predictor.reset_state(state)

    def segment(
        self,
        hu: np.ndarray,
        box: Optional[List[float]],
        window: Optional[Tuple[float, float]],
        points: Optional[List[List[float]]] = None,
    ) -> np.ndarray:
        """Segment one 2D frame through the same video predictor used for 3D."""
        if hu.ndim != 2:
            raise ValueError("single-slice HU input must have shape [height, width]")
        self.ensure_loaded()
        height, width = hu.shape
        with self._inference_lock, self._inference_context():
            frames = self._prepare_frames(hu[None, ...], window)
            result = self._predict_direction(
                frames, 0, height, width, box, points, reverse=False
            )
            return result[0]

    def segment_volume(
        self,
        hu: np.ndarray,
        key_frame: int,
        box: Optional[List[float]],
        window: Optional[Tuple[float, float]],
        points: Optional[List[List[float]]] = None,
        cancel_event=None,
        progress_callback=None,
    ) -> np.ndarray:
        """Propagate one prompt forward and backward over a cropped CT volume."""
        if hu.ndim != 3:
            raise ValueError("volume HU input must have shape [depth, height, width]")
        depth, height, width = hu.shape
        if depth < 1 or height < 1 or width < 1:
            raise ValueError("volume dimensions must be positive")
        if key_frame < 0 or key_frame >= depth:
            raise ValueError("key_frame is outside the volume")
        self._check_cancelled(cancel_event)
        self.ensure_loaded()
        self._check_cancelled(cancel_event)

        with self._inference_lock, self._inference_context():
            self._check_cancelled(cancel_event)
            frames = self._prepare_frames(hu, window)
            self._check_cancelled(cancel_event)
            completed_frames = set()

            def on_frame(frame_idx: int, reverse: bool) -> None:
                if progress_callback is None:
                    return
                key = ("reverse" if reverse else "forward", frame_idx)
                if key not in completed_frames:
                    completed_frames.add(key)
                    # Both passes visit the prompt frame; all other frames
                    # belong to exactly one direction, so total work is N + 1.
                    progress_callback(len(completed_frames), depth + 1)

            forward = self._predict_direction(
                frames,
                key_frame,
                height,
                width,
                box,
                points,
                reverse=False,
                cancel_event=cancel_event,
                on_frame=on_frame,
            )
            if cancel_event is not None and cancel_event.is_set():
                raise InferenceCancelled("segmentation job cancelled")
            backward = self._predict_direction(
                frames,
                key_frame,
                height,
                width,
                box,
                points,
                reverse=True,
                cancel_event=cancel_event,
                on_frame=on_frame,
            )
            merged = np.logical_or(forward, backward).astype(np.uint8)
            return self._retain_prompt_component(merged, key_frame, points)

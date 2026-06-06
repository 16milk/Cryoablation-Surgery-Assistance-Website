"""VoxelMorph lung registration runner.

The viewer sends two CT volumes resampled to the network grid. This runner loads
the cryo lung VXM checkpoint lazily, predicts a dense displacement field, and
returns patient-space millimetre offsets that the browser can sample
synchronously while scrolling.
"""

from __future__ import annotations

import os
import threading
from dataclasses import dataclass
from typing import List, Optional, Tuple

import numpy as np

from runner import ModelUnavailable


DEFAULT_CHECKPOINT = "/Users/ykxcai/Desktop/cryo_lung_vxm_epoch_200.pth"
DEFAULT_GRID_SIZE = (160, 160, 160)


@dataclass
class VolumeGeometry:
    dimensions: Tuple[int, int, int]
    spacing: Tuple[float, float, float]
    direction: Tuple[float, float, float, float, float, float, float, float, float]


class VxmRegistrationRunner:
    def __init__(self) -> None:
        self._model = None
        self._device: Optional[str] = None
        self._lock = threading.Lock()

    @property
    def device(self) -> str:
        return self._device or self._pick_device_name()

    def is_loaded(self) -> bool:
        return self._model is not None

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
        if self._model is not None:
            return
        with self._lock:
            if self._model is not None:
                return
            self._load()

    def _load(self) -> None:
        checkpoint = os.environ.get("VXM_CHECKPOINT") or DEFAULT_CHECKPOINT
        if not checkpoint or not os.path.exists(checkpoint):
            raise ModelUnavailable(
                f"VXM_CHECKPOINT not set or file missing: {checkpoint!r}. "
                "Set VXM_CHECKPOINT or put cryo_lung_vxm_epoch_200.pth on the Desktop."
            )

        try:
            import torch
            from torch import nn
        except Exception as exc:  # noqa: BLE001
            raise ModelUnavailable(
                f"Could not import torch for VXM registration: {exc}. Install PyTorch "
                "(see medsam2_server/README.md)."
            ) from exc

        class ConvBlock(nn.Module):
            def __init__(self, in_channels: int, out_channels: int) -> None:
                super().__init__()
                self.main = nn.Conv3d(in_channels, out_channels, 3, padding=1)
                self.activation = nn.LeakyReLU(0.2, inplace=True)

            def forward(self, x):  # noqa: ANN001
                return self.activation(self.main(x))

        class VxmUnet(nn.Module):
            def __init__(self) -> None:
                super().__init__()
                self.encoder = nn.ModuleList(
                    [
                        nn.Sequential(ConvBlock(2, 16)),
                        nn.Sequential(ConvBlock(16, 32)),
                        nn.Sequential(ConvBlock(32, 32)),
                        nn.Sequential(ConvBlock(32, 32)),
                    ]
                )
                self.decoder = nn.ModuleList(
                    [
                        nn.Sequential(ConvBlock(32, 32)),
                        nn.Sequential(ConvBlock(64, 32)),
                        nn.Sequential(ConvBlock(64, 32)),
                        nn.Sequential(ConvBlock(64, 32)),
                    ]
                )
                self.remaining = nn.ModuleList(
                    [ConvBlock(48, 32), ConvBlock(32, 16), ConvBlock(16, 16)]
                )

            def forward(self, x):  # noqa: ANN001
                import torch.nn.functional as F

                skips = []
                for layer in self.encoder:
                    x = layer(x)
                    skips.append(x)
                    x = F.avg_pool3d(x, kernel_size=2, stride=2)

                for i, layer in enumerate(self.decoder):
                    x = layer(x)
                    x = F.interpolate(x, scale_factor=2, mode="nearest")
                    x = torch.cat([x, skips[-(i + 1)]], dim=1)

                for layer in self.remaining:
                    x = layer(x)
                return x

        class VxmDense(nn.Module):
            def __init__(self) -> None:
                super().__init__()
                self.unet_model = VxmUnet()
                self.flow = nn.Conv3d(16, 3, 3, padding=1)

            def forward(self, moving, fixed):  # noqa: ANN001
                x = torch.cat([moving, fixed], dim=1)
                return self.flow(self.unet_model(x))

        device = os.environ.get("VXM_DEVICE") or self._pick_device_name()
        model = VxmDense().to(device)
        state = torch.load(checkpoint, map_location=device)
        if isinstance(state, dict) and "state_dict" in state:
            state = state["state_dict"]
        if not isinstance(state, dict):
            raise ModelUnavailable(f"Unsupported VXM checkpoint format: {type(state)!r}")

        cleaned = {k.removeprefix("module."): v for k, v in state.items() if not k.endswith(".grid")}
        missing, unexpected = model.load_state_dict(cleaned, strict=False)
        critical_missing = [k for k in missing if not k.endswith(".grid")]
        if critical_missing or unexpected:
            raise ModelUnavailable(
                "VXM checkpoint does not match the built-in lung VXM architecture "
                f"(missing={critical_missing}, unexpected={unexpected})."
            )

        model.eval()
        self._model = model
        self._device = device

    def register(
        self,
        baseline_hu: np.ndarray,
        compare_hu: np.ndarray,
        geometry: VolumeGeometry,
    ) -> np.ndarray:
        """Return dense patient-space displacement, shape (D, H, W, 3), float32 mm."""
        self.ensure_loaded()

        if baseline_hu.shape != compare_hu.shape:
            raise ValueError(f"baseline shape {baseline_hu.shape} != compare shape {compare_hu.shape}")
        if baseline_hu.shape != DEFAULT_GRID_SIZE:
            raise ValueError(f"VXM grid must be {DEFAULT_GRID_SIZE}, got {baseline_hu.shape}")

        import torch

        moving = self._normalize_hu(baseline_hu)
        fixed = self._normalize_hu(compare_hu)

        with torch.no_grad():
            moving_t = torch.from_numpy(moving)[None, None].to(self.device)
            fixed_t = torch.from_numpy(fixed)[None, None].to(self.device)
            flow_voxel = self._model(moving_t, fixed_t)[0].detach().cpu().numpy()

        # VXM Conv3d output channels are interpreted as (z, y, x) voxel offsets.
        order = os.environ.get("VXM_FLOW_CHANNEL_ORDER", "zyx").lower()
        if sorted(order) != ["x", "y", "z"]:
            order = "zyx"
        channel = {axis: flow_voxel[i] for i, axis in enumerate(order)}
        dz = channel["z"]
        dy = channel["y"]
        dx = channel["x"]

        row = np.asarray(geometry.direction[0:3], dtype=np.float32)
        col = np.asarray(geometry.direction[3:6], dtype=np.float32)
        normal = np.asarray(geometry.direction[6:9], dtype=np.float32)
        sx, sy, sz = geometry.spacing

        disp = (
            dx[..., None] * float(sx) * row
            + dy[..., None] * float(sy) * col
            + dz[..., None] * float(sz) * normal
        )

        scale = float(os.environ.get("VXM_FLOW_SCALE", "1.0"))
        return np.ascontiguousarray(disp * scale, dtype=np.float32)

    @staticmethod
    def _normalize_hu(hu: np.ndarray) -> np.ndarray:
        center = float(os.environ.get("VXM_WINDOW_CENTER", "-500"))
        width = float(os.environ.get("VXM_WINDOW_WIDTH", "1400"))
        low = center - width / 2.0
        high = center + width / 2.0
        out = np.clip((hu.astype(np.float32) - low) / max(high - low, 1e-6), 0.0, 1.0)
        return out.astype(np.float32)


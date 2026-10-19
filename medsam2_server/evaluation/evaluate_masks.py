#!/usr/bin/env python3
"""Evaluate per-nodule masks from JSON manifest; masks are [z,y,x] NumPy arrays."""
from __future__ import annotations
import argparse
import json
from pathlib import Path
from typing import Any
import numpy as np


def _load_mask(path: Path) -> np.ndarray:
    mask = np.load(path, allow_pickle=False)
    if mask.ndim != 3:
        raise ValueError(f"{path}: expected a 3D [z,y,x] mask, got {mask.shape}")
    return mask.astype(bool, copy=False)


def _diameter_group(diameter_mm: Any) -> str:
    if diameter_mm is None:
        return "unspecified"
    diameter = float(diameter_mm)
    if not np.isfinite(diameter) or diameter <= 0:
        raise ValueError("diameter_mm must be positive and finite when provided")
    if diameter < 6:
        return "under_6mm"
    if diameter < 10:
        return "6_to_under_10mm"
    return "10mm_or_more"


def _slice_spacing_group(spacing_mm: float) -> str:
    if spacing_mm <= 1:
        return "1mm_or_less"
    if spacing_mm <= 3:
        return "over_1_to_3mm"
    return "over_3mm"


def _hd95(pred: np.ndarray, ref: np.ndarray, spacing: tuple[float, ...]) -> float | None:
    try:
        from scipy.ndimage import binary_erosion, distance_transform_edt
    except ImportError as exc:
        raise RuntimeError("HD95 requires scipy; install evaluation/requirements.txt") from exc
    structure = np.zeros((3, 3, 3), dtype=bool)
    structure[1, 1, 1] = True
    structure[0, 1, 1] = structure[2, 1, 1] = True
    structure[1, 0, 1] = structure[1, 2, 1] = True
    structure[1, 1, 0] = structure[1, 1, 2] = True
    ps = pred & ~binary_erosion(pred, structure=structure, border_value=0)
    rs = ref & ~binary_erosion(ref, structure=structure, border_value=0)
    if not ps.any() or not rs.any():
        return None
    a = distance_transform_edt(~rs, sampling=spacing)[ps]
    b = distance_transform_edt(~ps, sampling=spacing)[rs]
    return float(np.percentile(np.concatenate((a, b)), 95))


def evaluate_case(row: dict[str, Any], base: Path) -> dict[str, Any]:
    pred, ref = _load_mask(base / row["prediction"]), _load_mask(base / row["reference"])
    if pred.shape != ref.shape:
        raise ValueError(f"{row['case_id']}: mask shapes differ: {pred.shape} vs {ref.shape}")
    spacing = tuple(float(v) for v in row["spacing_zyx_mm"])
    if len(spacing) != 3 or any(not np.isfinite(v) or v <= 0 for v in spacing):
        raise ValueError(f"{row['case_id']}: spacing_zyx_mm must have 3 positive values")
    p, r = int(pred.sum()), int(ref.sum())
    dice = 1.0 if p + r == 0 else 2 * int(np.count_nonzero(pred & ref)) / (p + r)
    diameter_mm = row.get("diameter_mm")
    slice_spacing_mm = spacing[0]
    return {
        "case_id": row["case_id"], "patient_id": row["patient_id"],
        "nodule_type": row.get("nodule_type", "unspecified"),
        "diameter_mm": diameter_mm,
        "diameter_group": _diameter_group(diameter_mm),
        "slice_spacing_mm": slice_spacing_mm,
        "slice_spacing_group": _slice_spacing_group(slice_spacing_mm),
        "dice_3d": float(dice),
        "hd95_mm": _hd95(pred, ref, spacing),
        "volume_relative_error": None if r == 0 else abs(p - r) / r,
        "empty_prediction": p == 0, "empty_reference": r == 0,
    }


def _summary(values: list[float]) -> dict[str, float | int | None]:
    if not values:
        return {"n": 0, "median": None, "q1": None, "q3": None}
    q1, median, q3 = np.percentile(values, [25, 50, 75])
    return {"n": len(values), "median": float(median), "q1": float(q1), "q3": float(q3)}


def build_report(rows: list[dict[str, Any]], base: Path) -> dict[str, Any]:
    cases = [evaluate_case(row, base) for row in rows]
    groups: dict[str, dict[str, list[dict[str, Any]]]] = {
        "nodule_type": {}, "diameter": {}, "slice_spacing": {}
    }
    for case in cases:
        for dimension, value in (
            ("nodule_type", case["nodule_type"]),
            ("diameter", case["diameter_group"]),
            ("slice_spacing", case["slice_spacing_group"]),
        ):
            groups[dimension].setdefault(value, []).append(case)

    def stats(items: list[dict[str, Any]]) -> dict[str, Any]:
        return {
            "n_nodules": len(items), "n_patients": len({c["patient_id"] for c in items}),
            "dice_3d": _summary([c["dice_3d"] for c in items]),
            "hd95_mm": _summary([c["hd95_mm"] for c in items if c["hd95_mm"] is not None]),
            "volume_relative_error": _summary([c["volume_relative_error"] for c in items if c["volume_relative_error"] is not None]),
            "empty_prediction_count": sum(c["empty_prediction"] for c in items),
            "empty_reference_count": sum(c["empty_reference"] for c in items),
        }
    return {
        "cases": cases,
        "overall": stats(cases),
        "by_nodule_type": {k: stats(v) for k, v in sorted(groups["nodule_type"].items())},
        "by_diameter": {k: stats(v) for k, v in sorted(groups["diameter"].items())},
        "by_slice_spacing": {k: stats(v) for k, v in sorted(groups["slice_spacing"].items())},
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", type=Path)
    parser.add_argument("--output", type=Path, help="report JSON (default: stdout)")
    args = parser.parse_args()
    rows = json.loads(args.manifest.read_text(encoding="utf-8"))
    rendered = json.dumps(build_report(rows, args.manifest.parent), ensure_ascii=False, indent=2, allow_nan=False)
    if args.output:
        args.output.write_text(rendered + "\n", encoding="utf-8")
    else:
        print(rendered)


if __name__ == "__main__":
    main()

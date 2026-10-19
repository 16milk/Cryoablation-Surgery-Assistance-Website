import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np

from evaluate_masks import build_report


class EvaluateMasksTest(unittest.TestCase):
    def test_case_metrics_and_type_summary(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            ref = np.zeros((4, 5, 6), dtype=np.uint8)
            pred = ref.copy()
            ref[1:3, 1:3, 1:3] = 1
            pred[1:3, 1:3, 1:2] = 1
            np.save(base / "ref.npy", ref)
            np.save(base / "pred.npy", pred)
            row = {"case_id": "n1", "patient_id": "p1", "nodule_type": "solid", "diameter_mm": 8.2,
                   "spacing_zyx_mm": [2, 1, 1], "prediction": "pred.npy", "reference": "ref.npy"}
            with patch("evaluate_masks._hd95", return_value=1.0):
                report = build_report([row], base)
            case = report["cases"][0]
            self.assertEqual(case["dice_3d"], 2 / 3)
            self.assertEqual(case["volume_relative_error"], 0.5)
            self.assertEqual(report["by_nodule_type"]["solid"]["n_patients"], 1)
            self.assertEqual(report["by_diameter"]["6_to_under_10mm"]["n_nodules"], 1)
            self.assertEqual(report["by_slice_spacing"]["over_1_to_3mm"]["n_nodules"], 1)

    def test_shape_mismatch_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            np.save(base / "a.npy", np.zeros((2, 2, 2)))
            np.save(base / "b.npy", np.zeros((2, 2, 3)))
            row = {"case_id": "n1", "patient_id": "p1", "spacing_zyx_mm": [1, 1, 1],
                   "prediction": "a.npy", "reference": "b.npy"}
            with self.assertRaisesRegex(ValueError, "shapes differ"):
                build_report([row], base)


if __name__ == "__main__":
    unittest.main()

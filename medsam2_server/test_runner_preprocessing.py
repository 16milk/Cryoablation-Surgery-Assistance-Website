"""Tests for the CT intensity transform before MedSAM2 video inference."""

import unittest

import numpy as np

from runner import MedSam2Runner


class RunnerPreprocessingTests(unittest.TestCase):
    def test_clips_then_scales_using_one_volume_wide_range(self):
        hu = np.array(
            [[[-1000, -800], [-400, 400]], [[-1000, -800], [-400, 400]]],
            dtype=np.float32,
        )

        actual = MedSam2Runner._normalize_hu(hu, (-500, 1400))

        np.testing.assert_array_equal(
            actual,
            np.array(
                [[[0, 42], [127, 255]], [[0, 42], [127, 255]]], dtype=np.uint8
            ),
        )
        self.assertEqual(actual[0, 0, 1], actual[1, 0, 1])

    def test_constant_volume_maps_to_zero_without_division_error(self):
        hu = np.full((2, 3, 4), -700, dtype=np.float32)

        actual = MedSam2Runner._normalize_hu(hu, (-500, 1400))

        self.assertEqual(actual.dtype, np.uint8)
        self.assertFalse(np.any(actual))

    def test_rejects_invalid_window_width(self):
        with self.assertRaisesRegex(ValueError, "finite center and positive width"):
            MedSam2Runner._normalize_hu(np.zeros((1, 2, 2)), (-500, 0))


if __name__ == "__main__":
    unittest.main()

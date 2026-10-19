"""Model loading state and lazy predictor construction tests."""
import os
import sys
import tempfile
import unittest
from types import ModuleType, SimpleNamespace
from unittest.mock import Mock, patch

from runner import MedSam2Runner, ModelUnavailable


class RunnerLoadingTests(unittest.TestCase):
    def test_model_revision_changes_when_configured_artifacts_change(self):
        with tempfile.TemporaryDirectory() as directory:
            config = os.path.join(directory, "model.yaml")
            checkpoint = os.path.join(directory, "model.pt")
            with open(config, "w", encoding="utf-8") as stream:
                stream.write("tiny")
            with open(checkpoint, "wb") as stream:
                stream.write(b"weights")
            env = {
                "MEDSAM2_CONFIG": config,
                "MEDSAM2_CHECKPOINT": checkpoint,
            }
            with patch.dict(os.environ, env, clear=False):
                runner = MedSam2Runner()
                first = runner.model_revision
                self.assertEqual(first, runner.model_revision)
                with open(config, "w", encoding="utf-8") as stream:
                    stream.write("updated config")
                self.assertNotEqual(first, runner.model_revision)

    def test_explicit_model_revision_overrides_file_fingerprint(self):
        with patch.dict(os.environ, {"MEDSAM2_MODEL_REVISION": "deployment-42"}, clear=False):
            self.assertEqual(MedSam2Runner().model_revision, "deployment-42")

    def test_missing_checkpoint_is_reported_as_model_error(self):
        runner = MedSam2Runner()
        with patch.dict(
            os.environ,
            {"MEDSAM2_CHECKPOINT": "/path/that/does/not/exist.pt", "MEDSAM2_CONFIG": "tiny.yaml"},
            clear=False,
        ):
            with self.assertRaisesRegex(ModelUnavailable, "MEDSAM2_CHECKPOINT"):
                runner.ensure_loaded()

        self.assertEqual(runner.model_state, "error")
        self.assertIn("does/not/exist.pt", runner.model_error)

    def test_builds_predictor_lazily_once_and_uses_predictor_image_size(self):
        predictor = SimpleNamespace(image_size=768)
        build = Mock(return_value=predictor)
        sam2 = ModuleType("sam2")
        build_module = ModuleType("sam2.build_sam")
        build_module.build_sam2_video_predictor_npz = build
        fake_torch = ModuleType("torch")
        with tempfile.NamedTemporaryFile(suffix=".pt") as checkpoint:
            with patch.dict(
                os.environ,
                {
                    "MEDSAM2_CHECKPOINT": checkpoint.name,
                    "MEDSAM2_CONFIG": "configs/sam2.1_hiera_t512.yaml",
                    "MEDSAM2_DEVICE": "cpu",
                },
                clear=False,
            ), patch.dict(
                sys.modules,
                {"torch": fake_torch, "sam2": sam2, "sam2.build_sam": build_module},
            ):
                runner = MedSam2Runner()
                runner.ensure_loaded()
                runner.ensure_loaded()

        self.assertTrue(runner.is_loaded())
        self.assertEqual(runner.model_state, "ready")
        self.assertEqual(runner.device, "cpu")
        self.assertEqual(runner.IMAGE_SIZE, 768)
        build.assert_called_once_with(
            "configs/sam2.1_hiera_t512.yaml", checkpoint.name, device="cpu"
        )


if __name__ == "__main__":
    unittest.main()

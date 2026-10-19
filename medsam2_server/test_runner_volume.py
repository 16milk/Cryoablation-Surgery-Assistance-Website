"""Exercise runner control flow with a deterministic fake video predictor."""
import threading
import sys
import unittest
from collections import deque
from contextlib import contextmanager, nullcontext
from types import SimpleNamespace
from unittest.mock import Mock, patch

import numpy as np

from runner import InferenceCancelled, MedSam2Runner


def fake_label(mask, structure=None):
    del structure
    foreground = np.asarray(mask, dtype=bool)
    labels = np.zeros(foreground.shape, dtype=np.int32)
    depth, height, width = foreground.shape
    component = 0
    for z, y, x in np.argwhere(foreground):
        if labels[z, y, x]:
            continue
        component += 1
        labels[z, y, x] = component
        queue = deque([(int(z), int(y), int(x))])
        while queue:
            cz, cy, cx = queue.popleft()
            for nz in range(max(0, cz - 1), min(depth, cz + 2)):
                for ny in range(max(0, cy - 1), min(height, cy + 2)):
                    for nx in range(max(0, cx - 1), min(width, cx + 2)):
                        if foreground[nz, ny, nx] and not labels[nz, ny, nx]:
                            labels[nz, ny, nx] = component
                            queue.append((nz, ny, nx))
    return labels, component


@contextmanager
def fake_scipy():
    ndimage = SimpleNamespace(label=fake_label)
    scipy = SimpleNamespace(ndimage=ndimage)
    with patch.dict(sys.modules, {"scipy": scipy, "scipy.ndimage": ndimage}):
        yield


class FakeTensor:
    def __init__(self, array):
        self.array = np.asarray(array)

    def __getitem__(self, item):
        return FakeTensor(self.array[item])

    def __gt__(self, other):
        return FakeTensor(self.array > other)

    def detach(self):
        return self

    def to(self, _device):
        return self

    def numpy(self):
        return self.array


class FakePredictor:
    def __init__(self, cancel_event=None, cancel_after_first_frame=False):
        self.init_calls = []
        self.prompt_calls = []
        self.propagation_directions = []
        self.reset_calls = []
        self.cancel_event = cancel_event
        self.cancel_after_first_frame = cancel_after_first_frame

    def init_state(self, frames, height, width, **kwargs):
        state = {"frames": frames, "height": height, "width": width}
        self.init_calls.append((state, kwargs))
        return state

    @staticmethod
    def _output(frame_idx, height, width, point):
        mask = np.zeros((1, 1, height, width), dtype=np.float32)
        mask[0, 0, point[1], point[0]] = 1
        return frame_idx, [1], FakeTensor(mask)

    def add_new_points_or_box(self, inference_state, **kwargs):
        self.prompt_calls.append(kwargs)
        return self._output(
            kwargs["frame_idx"], inference_state["height"], inference_state["width"], (0, 0)
        )

    def propagate_in_video(self, state, reverse=False):
        self.propagation_directions.append(reverse)
        key_frame = self.prompt_calls[-1]["frame_idx"]
        order = range(key_frame - 1, -1, -1) if reverse else range(key_frame + 1, len(state["frames"]))
        indices = list(order)
        for ordinal, frame_idx in enumerate(indices):
            point = (0, 1) if reverse else (1, 0)
            yield self._output(frame_idx, state["height"], state["width"], point)
            if ordinal == 0 and self.cancel_after_first_frame and self.cancel_event:
                self.cancel_event.set()

    def reset_state(self, state):
        self.reset_calls.append(state)


class RunnerVolumeTests(unittest.TestCase):
    def _runner(self, predictor):
        runner = MedSam2Runner()
        runner._predictor = predictor
        runner.ensure_loaded = lambda: None
        runner._prepare_frames = lambda hu, _window: [None] * len(hu)
        runner.inference_context_calls = 0

        def inference_context():
            runner.inference_context_calls += 1
            return nullcontext()

        runner._inference_context = inference_context
        return runner

    def test_inference_context_uses_torch_inference_mode(self):
        expected_context = object()
        fake_torch = SimpleNamespace(inference_mode=lambda: expected_context)
        with patch.dict(sys.modules, {"torch": fake_torch}):
            actual = MedSam2Runner._inference_context()
        self.assertIs(actual, expected_context)

    def test_runs_both_directions_resets_states_and_unions_masks(self):
        predictor = FakePredictor()
        runner = self._runner(predictor)
        progress = []
        with fake_scipy():
            mask = runner.segment_volume(
                np.zeros((3, 2, 2), dtype=np.float32),
                key_frame=1,
                box=[0, 0, 1, 1],
                window=(-500, 1400),
                points=[[0, 0, 1]],
                progress_callback=lambda done, total: progress.append((done, total)),
            )

        expected = np.zeros((3, 2, 2), dtype=np.uint8)
        expected[0, 1, 0] = 1
        expected[1, 0, 0] = 1
        expected[2, 0, 1] = 1
        np.testing.assert_array_equal(mask, expected)
        self.assertEqual(predictor.propagation_directions, [False, True])
        self.assertEqual(len(predictor.init_calls), 2)
        self.assertEqual(len(predictor.reset_calls), 2)
        self.assertEqual(predictor.prompt_calls[0]["points"], [[0.0, 0.0]])
        self.assertEqual(predictor.prompt_calls[0]["labels"], [1])
        self.assertEqual(progress[-1], (4, 4))
        self.assertEqual(runner.inference_context_calls, 1)

    def test_removes_disconnected_island_unrelated_to_positive_prompt(self):
        mask = np.zeros((3, 8, 8), dtype=np.uint8)
        mask[0, 2, 2] = 1
        mask[1, 2, 2] = 1
        mask[2, 2, 2] = 1
        mask[2, 5:8, 5:8] = 1

        with fake_scipy():
            actual = MedSam2Runner._retain_prompt_component(mask, 1, [[2, 2, 1]])

        self.assertEqual(int(actual.sum()), 3)
        self.assertEqual(actual[1, 2, 2], 1)
        self.assertEqual(actual[2, 6, 6], 0)

    def test_cancellation_between_frames_resets_the_active_predictor_state(self):
        cancel_event = threading.Event()
        predictor = FakePredictor(cancel_event, cancel_after_first_frame=True)
        runner = self._runner(predictor)

        with self.assertRaises(InferenceCancelled):
            runner.segment_volume(
                np.zeros((4, 2, 2), dtype=np.float32),
                key_frame=1,
                box=None,
                window=None,
                cancel_event=cancel_event,
            )

        self.assertEqual(len(predictor.init_calls), 1)
        self.assertEqual(len(predictor.reset_calls), 1)
        self.assertEqual(runner.inference_context_calls, 1)

    def test_pre_cancelled_volume_does_not_load_model(self):
        runner = MedSam2Runner()
        runner.ensure_loaded = Mock(side_effect=AssertionError("model load should be skipped"))
        cancel_event = threading.Event()
        cancel_event.set()

        with self.assertRaises(InferenceCancelled):
            runner.segment_volume(
                np.zeros((2, 2, 2), dtype=np.float32),
                key_frame=0,
                box=None,
                window=None,
                cancel_event=cancel_event,
            )

        runner.ensure_loaded.assert_not_called()

    def test_cancellation_during_preprocessing_skips_predictor_initialization(self):
        cancel_event = threading.Event()
        predictor = FakePredictor()
        runner = self._runner(predictor)

        def prepare(hu, _window):
            cancel_event.set()
            return [None] * len(hu)

        runner._prepare_frames = prepare
        with self.assertRaises(InferenceCancelled):
            runner.segment_volume(
                np.zeros((2, 2, 2), dtype=np.float32),
                key_frame=0,
                box=None,
                window=None,
                cancel_event=cancel_event,
            )

        self.assertEqual(predictor.init_calls, [])
        self.assertEqual(predictor.reset_calls, [])


if __name__ == "__main__":
    unittest.main()

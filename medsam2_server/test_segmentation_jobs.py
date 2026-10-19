"""Unit tests for bounded MedSAM2 job queue behavior."""

import threading
import unittest

import numpy as np

from segmentation_jobs import JobQueueFull, SegmentationJobQueue


class FakeRunner:
    def __init__(self):
        self.started = threading.Event()
        self.release = threading.Event()
        self.block = False

    def segment_volume(
        self, hu, key_frame, box, window, points, cancel_event=None, progress_callback=None
    ):
        self.started.set()
        if self.block:
            self.release.wait(timeout=2)
        if cancel_event and cancel_event.is_set():
            from runner import InferenceCancelled

            raise InferenceCancelled("cancelled")
        if progress_callback:
            progress_callback(4, 4)
        return np.ones_like(hu, dtype=np.uint8)


class SegmentationJobQueueTests(unittest.TestCase):
    def setUp(self):
        self.runner = FakeRunner()
        self.queue = SegmentationJobQueue(self.runner)
        self.hu = np.zeros((2, 3, 4), dtype=np.float32)

    def test_job_completes_with_progress_and_mask(self):
        job = self.queue.submit(self.hu, 0, None, None, None)
        self.assertTrue(self.runner.started.wait(timeout=1))
        self.assertTrue(job.future)
        job.future.result(timeout=1)
        snapshot = self.queue.snapshot(job, include_result=True)
        self.assertEqual(snapshot["status"], "completed")
        self.assertEqual(snapshot["progress"], 4)
        np.testing.assert_array_equal(snapshot["mask"], np.ones_like(self.hu, dtype=np.uint8))

    def test_cancelled_queued_job_releases_its_volume(self):
        self.runner.block = True
        active = self.queue.submit(self.hu.copy(), 0, None, None, None)
        self.assertTrue(self.runner.started.wait(timeout=1))
        queued = self.queue.submit(self.hu.copy(), 0, None, None, None)
        cancelled = self.queue.cancel(queued.job_id)
        self.assertEqual(cancelled.status, "cancelled")
        self.assertEqual(cancelled.hu.size, 0)
        self.runner.release.set()
        active.future.result(timeout=2)
        self.assertEqual(active.status, "completed")

    def test_pending_queue_is_bounded(self):
        self.runner.block = True
        active = self.queue.submit(self.hu.copy(), 0, None, None, None)
        self.assertTrue(self.runner.started.wait(timeout=1))
        self.queue.submit(self.hu.copy(), 0, None, None, None)
        self.queue.submit(self.hu.copy(), 0, None, None, None)
        with self.assertRaises(JobQueueFull):
            self.queue.submit(self.hu.copy(), 0, None, None, None)
        self.runner.release.set()
        active.future.result(timeout=2)

    def test_old_result_is_expired_when_result_memory_budget_is_exceeded(self):
        self.queue.MAX_RETAINED_RESULT_BYTES = 1
        first = self.queue.submit(self.hu.copy(), 0, None, None, None)
        first.future.result(timeout=1)
        second = self.queue.submit(self.hu.copy(), 0, None, None, None)
        second.future.result(timeout=1)

        self.assertEqual(first.status, "expired")
        self.assertIsNone(first.result)
        self.assertIn("rerun", first.error)
        self.assertEqual(second.status, "completed")
        np.testing.assert_array_equal(second.result, np.ones_like(self.hu, dtype=np.uint8))


if __name__ == "__main__":
    unittest.main()

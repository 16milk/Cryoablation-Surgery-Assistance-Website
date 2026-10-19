"""Bounded, single-worker job queue for stateful MedSAM2 volume inference."""

from __future__ import annotations

import threading
import time
import uuid
from concurrent.futures import Future, ThreadPoolExecutor
from dataclasses import dataclass, field
from typing import Any, Dict, Optional

import numpy as np

from runner import InferenceCancelled, MedSam2Runner


class JobQueueFull(RuntimeError):
    """Raised when the active inference and bounded waiting queue are full."""


@dataclass
class SegmentationJob:
    job_id: str
    hu: np.ndarray
    key_frame: int
    box: Optional[list[float]]
    points: Optional[list[list[float]]]
    window: Optional[tuple[float, float]]
    created_at: float = field(default_factory=time.time)
    status: str = "queued"
    progress: int = 0
    total: int = 0
    error: Optional[str] = None
    result: Optional[np.ndarray] = None
    cancel_event: threading.Event = field(default_factory=threading.Event)
    future: Optional[Future] = None


class SegmentationJobQueue:
    MAX_PENDING = 3  # One active inference and at most two queued volumes.
    MAX_RETAINED_RESULT_BYTES = 128 * 1024 * 1024
    TERMINAL_TTL_SECONDS = 15 * 60

    def __init__(self, runner: MedSam2Runner) -> None:
        self._runner = runner
        self._executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="medsam2-volume")
        self._lock = threading.RLock()
        self._jobs: Dict[str, SegmentationJob] = {}

    def submit(
        self,
        hu: np.ndarray,
        key_frame: int,
        box: Optional[list[float]],
        points: Optional[list[list[float]]],
        window: Optional[tuple[float, float]],
    ) -> SegmentationJob:
        with self._lock:
            self._remove_expired_locked()
            pending = sum(job.status in {"queued", "running", "cancel_requested"} for job in self._jobs.values())
            if pending >= self.MAX_PENDING:
                raise JobQueueFull("MedSAM2 volume queue is full; retry after an active job finishes")
            job = SegmentationJob(
                job_id=uuid.uuid4().hex,
                hu=hu,
                key_frame=key_frame,
                box=box,
                points=points,
                window=window,
            )
            self._jobs[job.job_id] = job
            job.future = self._executor.submit(self._run_job, job)
            return job

    def _run_job(self, job: SegmentationJob) -> None:
        with self._lock:
            if job.cancel_event.is_set():
                job.status = "cancelled"
                job.hu = np.empty((0,), dtype=np.float32)
                return
            job.status = "running"
            job.total = int(job.hu.shape[0] + 1)
        try:
            result = self._runner.segment_volume(
                job.hu,
                job.key_frame,
                job.box,
                job.window,
                job.points,
                cancel_event=job.cancel_event,
                progress_callback=lambda done, total: self._set_progress(job, done, total),
            )
            with self._lock:
                if job.cancel_event.is_set():
                    job.status = "cancelled"
                else:
                    job.result = result
                    job.progress = job.total
                    job.status = "completed"
                    self._prune_result_memory_locked(job.job_id)
        except InferenceCancelled:
            with self._lock:
                job.status = "cancelled"
        except Exception as exc:  # noqa: BLE001
            with self._lock:
                job.error = str(exc)
                job.status = "failed"
        finally:
            with self._lock:
                # Release a potentially large CT volume once inference is done.
                job.hu = np.empty((0,), dtype=np.float32)

    def _set_progress(self, job: SegmentationJob, done: int, total: int) -> None:
        with self._lock:
            job.progress = max(job.progress, int(done))
            job.total = int(total)

    def _prune_result_memory_locked(self, keep_job_id: str) -> None:
        retained = [
            candidate
            for candidate in self._jobs.values()
            if candidate.result is not None and candidate.job_id != keep_job_id
        ]
        total_bytes = sum(candidate.result.nbytes for candidate in retained)
        while total_bytes > self.MAX_RETAINED_RESULT_BYTES and retained:
            expired = min(retained, key=lambda candidate: candidate.created_at)
            retained.remove(expired)
            total_bytes -= expired.result.nbytes
            expired.result = None
            expired.status = "expired"
            expired.error = "Segmentation result expired to free server memory; rerun the job"

    def cancel(self, job_id: str) -> Optional[SegmentationJob]:
        with self._lock:
            self._remove_expired_locked()
            job = self._jobs.get(job_id)
            if job is None:
                return None
            if job.status in {"completed", "failed", "cancelled", "expired"}:
                return job
            job.cancel_event.set()
            if job.status == "queued" and job.future is not None and job.future.cancel():
                job.status = "cancelled"
                job.hu = np.empty((0,), dtype=np.float32)
            elif job.status == "running":
                job.status = "cancel_requested"
            return job

    def get(self, job_id: str) -> Optional[SegmentationJob]:
        with self._lock:
            self._remove_expired_locked()
            return self._jobs.get(job_id)

    def snapshot(self, job: SegmentationJob, include_result: bool = False) -> Dict[str, Any]:
        with self._lock:
            result = {
                "jobId": job.job_id,
                "status": job.status,
                "progress": job.progress,
                "total": job.total,
                "error": job.error,
            }
            if include_result and job.status == "completed" and job.result is not None:
                result["mask"] = job.result
            return result

    def _remove_expired_locked(self) -> None:
        cutoff = time.time() - self.TERMINAL_TTL_SECONDS
        expired = [
            job_id
            for job_id, job in self._jobs.items()
            if job.status in {"completed", "failed", "cancelled", "expired"}
            and job.created_at < cutoff
        ]
        for job_id in expired:
            del self._jobs[job_id]

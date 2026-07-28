"""Jobs module - manages long-running background tasks."""

from __future__ import annotations

import enum
import logging
import threading
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Callable

logger = logging.getLogger(__name__)


class JobState(enum.Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


TERMINAL_STATES = frozenset({JobState.COMPLETED, JobState.FAILED, JobState.CANCELLED})


@dataclass
class Job:
    id: str
    state: JobState = JobState.QUEUED
    progress: float = 0.0
    message: str = ""
    created_at: float = field(default_factory=datetime.now().timestamp)
    started_at: float | None = None
    finished_at: float | None = None
    result: Any = None
    error: BaseException | None = None
    metadata: dict[str, Any] = field(default_factory=dict)
    _cancel_event: threading.Event = field(default_factory=threading.Event, repr=False)

    @property
    def cancelled(self) -> bool:
        return self._cancel_event.is_set()

    def is_cancelled(self) -> bool:
        return self._cancel_event.is_set()

    def set_progress(self, progress: float, message: str | None = None) -> None:
        self.progress = max(0.0, min(100.0, progress))
        if message is not None:
            self.message = message

    def update_metadata(self, metadata: dict[str, Any]) -> None:
        self.metadata.update(metadata)

    def _request_cancel(self) -> None:
        self._cancel_event.set()


class JobManager:
    """Generic manager for background jobs."""

    def __init__(self, *, max_finished: int = 100, max_age_seconds: float | None = None) -> None:
        self._jobs: dict[str, Job] = {}
        self._lock = threading.Lock()
        self._max_finished = max_finished
        self._max_age_seconds = max_age_seconds

    def create(self) -> Job:
        job_id = uuid.uuid4().hex
        job = Job(id=job_id)
        with self._lock:
            self._jobs[job_id] = job
        logger.info("job.created id=%s", job_id)
        return job

    def start(
        self,
        job: Job,
        fn: Callable[..., Any] | None = None,
        *args: Any,
        **kwargs: Any,
    ) -> None:
        if job.state in TERMINAL_STATES:
            raise RuntimeError(f"Cannot start job {job.id}: already in terminal state {job.state.value}")

        thread = threading.Thread(
            target=self._run,
            args=(job, fn, args, kwargs),
            daemon=True,
        )
        thread.start()

    def get(self, job_id: str) -> Job | None:
        with self._lock:
            return self._jobs.get(job_id)

    def list_jobs(self, state: JobState | None = None) -> list[Job]:
        with self._lock:
            jobs = list(self._jobs.values())
        if state is not None:
            jobs = [j for j in jobs if j.state == state]
        return jobs

    def cancel(self, job: Job) -> bool:
        with self._lock:
            if job.state in TERMINAL_STATES:
                return False
            job._request_cancel()
        logger.info("job.cancel_requested id=%s", job.id)
        return True

    def remove(self, job: Job) -> bool:
        with self._lock:
            if job.state not in TERMINAL_STATES:
                return False
            del self._jobs[job.id]
        logger.info("job.removed id=%s", job.id)
        return True

    def cleanup(
        self,
        *,
        max_age: float | None = None,
        max_count: int | None = None,
    ) -> int:
        age_limit = max_age or self._max_age_seconds
        count_limit = max_count or self._max_finished
        removed = 0
        now = datetime.now().timestamp()

        with self._lock:
            finished = [
                j for j in self._jobs.values()
                if j.state in TERMINAL_STATES and j.finished_at is not None
            ]

            if age_limit is not None:
                cutoff = now - age_limit
                expired = [j for j in finished if (t := j.finished_at) is not None and t <= cutoff]
                for job in expired:
                    del self._jobs[job.id]
                    removed += 1

            finished = [
                j for j in self._jobs.values()
                if j.state in TERMINAL_STATES
            ]
            if count_limit is not None and len(finished) > count_limit:
                finished.sort(key=lambda j: j.finished_at or 0)
                excess = len(finished) - count_limit
                for job in finished[:excess]:
                    del self._jobs[job.id]
                    removed += 1

        if removed > 0:
            logger.info("job.cleanup removed=%d", removed)
        return removed

    def _run(
        self,
        job: Job,
        fn: Callable[..., Any] | None,
        args: tuple[Any, ...],
        kwargs: dict[str, Any],
    ) -> None:
        with self._lock:
            job.state = JobState.RUNNING
            job.started_at = datetime.now().timestamp()
        logger.info("job.started id=%s", job.id)

        try:
            if fn is not None:
                result = fn(job, *args, **kwargs)
            else:
                result = None
            with self._lock:
                if job.is_cancelled():
                    job.state = JobState.CANCELLED
                    logger.info("job.cancelled id=%s", job.id)
                else:
                    job.state = JobState.COMPLETED
                    job.result = result
                    logger.info("job.completed id=%s", job.id)
        except BaseException as exc:
            with self._lock:
                if job.is_cancelled():
                    job.state = JobState.CANCELLED
                    logger.info("job.cancelled id=%s", job.id)
                else:
                    job.state = JobState.FAILED
                    job.error = exc
                    logger.error("job.failed id=%s error=%s", job.id, exc, exc_info=True)
        finally:
            with self._lock:
                job.finished_at = datetime.now().timestamp()

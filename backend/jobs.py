"""Jobs module - manages long-running background tasks."""

from __future__ import annotations

import asyncio
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
    PAUSED = "paused"
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
    _pause_event: threading.Event = field(default_factory=threading.Event, repr=False)
    # List of per-subscriber callbacks; each SSE connection adds one entry.
    _subscribers: list[Callable[[dict[str, Any]], None]] = field(default_factory=list, repr=False)

    # --- Snapshot & push helpers ---

    def _snapshot(self) -> dict[str, Any]:
        """Return a JSON-serialisable snapshot of the current job state."""
        return {
            "id": self.id,
            "state": self.state.value,
            "progress": self.progress,
            "message": self.message,
            "metadata": dict(self.metadata),
            "error": str(self.error) if self.error else None,
        }

    def _notify_all(self) -> None:
        """Push current snapshot to every SSE subscriber. Safe to call from any thread."""
        if not self._subscribers:
            return
        snapshot = self._snapshot()
        for notify in list(self._subscribers):  # copy → safe against concurrent mutation
            try:
                notify(snapshot)
            except Exception:
                pass

    def subscribe(
        self,
        loop: asyncio.AbstractEventLoop,
    ) -> tuple[asyncio.Queue[dict[str, Any]], Callable[[], None]]:
        """Register an SSE subscriber.

        Must be called from the async (event-loop) thread.
        Returns (queue, unsubscribe_fn).
        The queue receives a snapshot dict every time the job changes.
        Call unsubscribe_fn when the SSE connection closes.
        """
        q: asyncio.Queue[dict[str, Any]] = asyncio.Queue()

        def _notify(snapshot: dict[str, Any]) -> None:
            # Called from a background (download) thread — bridge to the event loop.
            try:
                loop.call_soon_threadsafe(q.put_nowait, snapshot)
            except RuntimeError:
                pass  # event loop already closed

        self._subscribers.append(_notify)

        def _unsubscribe() -> None:
            try:
                self._subscribers.remove(_notify)
            except ValueError:
                pass  # already removed

        return q, _unsubscribe

    # --- State / metadata mutators (auto-notify on change) ---

    @property
    def cancelled(self) -> bool:
        return self._cancel_event.is_set()

    def is_cancelled(self) -> bool:
        return self._cancel_event.is_set()

    def is_paused(self) -> bool:
        return self._pause_event.is_set()

    def pause(self) -> None:
        """Pause the job. The download loop must check is_paused() and wait."""
        self._pause_event.set()
        self._notify_all()

    def resume(self) -> None:
        """Resume a paused job."""
        self._pause_event.clear()
        self._notify_all()

    def wait_if_paused(self) -> None:
        """Block until the job is resumed. Returns immediately if not paused."""
        while self._pause_event.is_set():
            self._pause_event.wait(timeout=0.5)

    def set_progress(self, progress: float, message: str | None = None) -> None:
        self.progress = max(0.0, min(100.0, progress))
        if message is not None:
            self.message = message
        self._notify_all()

    def update_metadata(self, metadata: dict[str, Any]) -> None:
        self.metadata.update(metadata)
        self._notify_all()

    def set_metadata(self, metadata: dict[str, Any]) -> None:
        """Replace metadata entirely (no merge) to avoid stale fields."""
        self.metadata = metadata
        self._notify_all()

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

    def pause(self, job: Job) -> bool:
        with self._lock:
            if job.state not in (JobState.RUNNING, JobState.PAUSED):
                return False
            if job.state == JobState.PAUSED:
                return False  # already paused
            job.state = JobState.PAUSED
            job.pause()
        logger.info("job.paused id=%s", job.id)
        return True

    def resume(self, job: Job) -> bool:
        with self._lock:
            if job.state != JobState.PAUSED:
                return False
            job.state = JobState.RUNNING
            job.resume()
        logger.info("job.resumed id=%s", job.id)
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
        job._notify_all()  # push RUNNING state to any early subscribers

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
            job._notify_all()  # push terminal state — SSE generator will close the stream


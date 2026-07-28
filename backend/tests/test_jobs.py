"""Development test for jobs.py module."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import asyncio
import time

from jobs import JobManager, JobState


def _sync_task(job, duration: float = 0.1) -> str:
    for i in range(10):
        if job.is_cancelled():
            return "cancelled"
        job.set_progress((i + 1) * 10.0, f"Step {i + 1}/10")
        time.sleep(duration / 10)
    return "done"


def _failing_task(job) -> None:
    raise ValueError("Simulated failure")


def _cancel_task(job, delay: float = 0.05) -> None:
    for i in range(100):
        if job.is_cancelled():
            job.set_progress(float(i), "Cancelled early")
            return
        time.sleep(delay)
    job.set_progress(100.0, "Finished without cancelling")


def _async_task(job, duration: float = 0.01) -> str:
    async def _inner():
        for i in range(5):
            job.set_progress((i + 1) * 20.0, f"Async step {i + 1}")
            await asyncio.sleep(duration / 5)
        return "async done"

    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(_inner())
    finally:
        loop.close()


def main() -> None:
    mgr = JobManager(max_finished=5, max_age_seconds=2.0)
    passed = 0
    failed = 0

    # --- Test 1: Create job ---
    print("Test 1: Create job")
    job = mgr.create()
    assert job.state == JobState.QUEUED, f"Expected QUEUED, got {job.state}"
    assert job.progress == 0.0
    print(f"  Created job {job.id[:8]}... state={job.state.value}")
    passed += 1

    # --- Test 2: Run sync task to completion ---
    print("Test 2: Sync task completion")
    mgr.start(job, _sync_task, 0.1)
    time.sleep(0.2)
    assert job.state == JobState.COMPLETED, f"Expected COMPLETED, got {job.state}"
    assert job.result == "done", f"Expected 'done', got {job.result}"
    assert job.progress == 100.0
    assert job.message == "Step 10/10"
    assert job.started_at is not None
    assert job.finished_at is not None
    print(f"  State={job.state.value}, result={job.result}, progress={job.progress}")
    passed += 1

    # --- Test 3: Running task returns async callable ---
    print("Test 3: Async-like task")
    job2 = mgr.create()
    mgr.start(job2, _async_task, 0.01)
    time.sleep(0.1)
    assert job2.state == JobState.COMPLETED, f"Expected COMPLETED, got {job2.state}"
    assert job2.result == "async done"
    print(f"  State={job2.state.value}, result={job2.result}")
    passed += 1

    # --- Test 4: Failing task ---
    print("Test 4: Failing task")
    job3 = mgr.create()
    mgr.start(job3, _failing_task)
    time.sleep(0.1)
    assert job3.state == JobState.FAILED, f"Expected FAILED, got {job3.state}"
    assert job3.error is not None
    assert isinstance(job3.error, ValueError)
    print(f"  State={job3.state.value}, error={job3.error}")
    passed += 1

    # --- Test 5: Cancellation ---
    print("Test 5: Cancellation")
    job4 = mgr.create()
    mgr.start(job4, _cancel_task, 0.05)
    time.sleep(0.1)
    cancelled = mgr.cancel(job4)
    time.sleep(0.1)
    assert cancelled, "Expected cancel to return True"
    assert job4.state == JobState.CANCELLED, f"Expected CANCELLED, got {job4.state}"
    assert job4.is_cancelled()
    assert job4.finished_at is not None
    print(f"  State={job4.state.value}, cancelled={job4.is_cancelled()}")
    passed += 1

    # --- Test 6: Terminal state prevents restart ---
    print("Test 6: Cannot start terminal job")
    try:
        mgr.start(job4, _sync_task)
        print("  ERROR: Expected RuntimeError")
        failed += 1
    except RuntimeError as e:
        print(f"  Correctly raised RuntimeError: {e}")
        passed += 1

    # --- Test 7: Progress clamping ---
    print("Test 7: Progress clamping")
    job5 = mgr.create()
    job5.set_progress(-10.0, "below")
    assert job5.progress == 0.0, f"Expected 0.0, got {job5.progress}"
    job5.set_progress(150.0, "above")
    assert job5.progress == 100.0, f"Expected 100.0, got {job5.progress}"
    job5.set_progress(50.0, "normal")
    assert job5.progress == 50.0
    print(f"  Clamping works: -10->0, 150->100, 50->50")
    passed += 1

    # --- Test 8: Remove terminal job ---
    print("Test 8: Remove terminal job")
    removed = mgr.remove(job3)
    assert removed, "Expected remove to return True"
    assert mgr.get(job3.id) is None
    print(f"  Job removed successfully")
    passed += 1

    # --- Test 9: Cannot remove non-terminal job ---
    print("Test 9: Cannot remove running job")
    job6 = mgr.create()
    mgr.start(job6, _cancel_task, 0.1)
    time.sleep(0.02)
    removed = mgr.remove(job6)
    assert not removed, "Expected remove to return False"
    print(f"  Correctly returned False for running job")
    mgr.cancel(job6)
    time.sleep(0.05)
    passed += 1

    # --- Test 10: Metadata updates ---
    print("Test 10: Metadata updates")
    job7 = mgr.create()
    job7.update_metadata({"song": "test.mp3", "index": 1})
    job7.update_metadata({"song": "test.mp3", "progress_text": "50%"})
    assert job7.metadata["song"] == "test.mp3"
    assert job7.metadata["progress_text"] == "50%"
    assert job7.metadata["index"] == 1
    print(f"  Metadata: {job7.metadata}")
    passed += 1

    # --- Test 11: Cleanup ---
    print("Test 11: Cleanup")
    for _ in range(3):
        j = mgr.create()
        j.state = JobState.COMPLETED
        j.finished_at = time.time() - 100
        with mgr._lock:
            mgr._jobs[j.id] = j
    before = len(mgr.list_jobs())
    mgr.cleanup(max_age=5.0)
    after = len(mgr.list_jobs())
    print(f"  Before cleanup: {before} jobs, after: {after} jobs")
    assert after < before
    passed += 1

    # --- Test 12: Concurrent access ---
    print("Test 12: Concurrent access")
    jobs = [mgr.create() for _ in range(10)]
    for j in jobs:
        mgr.start(j, _sync_task, 0.01)
    time.sleep(0.3)
    all_done = all(j.state == JobState.COMPLETED for j in jobs)
    assert all_done, f"Not all jobs completed: {[j.state.value for j in jobs]}"
    print(f"  All {len(jobs)} concurrent jobs completed")
    passed += 1

    # --- Test 13: list_jobs by state ---
    print("Test 13: list_jobs filtering")
    completed = mgr.list_jobs(state=JobState.COMPLETED)
    failed_jobs = mgr.list_jobs(state=JobState.FAILED)
    cancelled_jobs = mgr.list_jobs(state=JobState.CANCELLED)
    print(f"  Completed: {len(completed)}, Failed: {len(failed_jobs)}, Cancelled: {len(cancelled_jobs)}")
    assert len(completed) >= 1
    passed += 1

    print(f"\n{'='*40}")
    print(f"Results: {passed} passed, {failed} failed")
    if failed == 0:
        print("All tests passed!")
    else:
        print("Some tests failed!")


if __name__ == "__main__":
    main()

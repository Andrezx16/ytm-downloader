"""Shared test fixtures."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest
from starlette.testclient import TestClient

from api import app
from jobs import Job, JobManager


@pytest.fixture()
def client() -> TestClient:
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def job_manager() -> JobManager:
    return JobManager(max_finished=5, max_age_seconds=2.0)


@pytest.fixture()
def job(job_manager: JobManager) -> Job:
    return job_manager.create()


@pytest.fixture()
def job_id(client: TestClient) -> str:
    r = client.post("/download", json={
        "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "output_dir": "downloads_test",
    })
    return r.json()["id"]

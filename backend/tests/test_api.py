"""Development test for api.py."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import time

from starlette.testclient import TestClient

from api import app


def test_search(client: TestClient) -> None:
    print("1. Search")
    r = client.post("/api/search", json={"query": "imagine dragons believer", "limit": 3})
    print(f"   Status: {r.status_code}")
    if r.status_code == 200:
        results = r.json()
        print(f"   Results: {len(results)}")
        for item in results[:3]:
            print(f"     {item.get('title')} - {item.get('artist')}")
    else:
        print(f"   Error: {r.json()}")


def test_download(client: TestClient) -> str | None:
    print("2. Download (creates job)")
    r = client.post("/api/download", json={
        "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "output_dir": "test_downloads",
    })
    print(f"   Status: {r.status_code}")
    if r.status_code == 200:
        job = r.json()
        print(f"   Job ID: {job['id']}, State: {job['state']}")
        return job["id"]
    print(f"   Error: {r.json()}")
    return None


def test_job_status(client: TestClient, job_id: str) -> None:
    print("3. Job status")
    r = client.get(f"/api/jobs/{job_id}")
    print(f"   Status: {r.status_code}")
    if r.status_code == 200:
        job = r.json()
        print(f"   State: {job['state']}, Progress: {job['progress']}")


def test_playlist(client: TestClient) -> None:
    print("4. Playlist info")
    r = client.post("/api/playlist", json={
        "url": "https://www.youtube.com/playlist?list=PL-osiE80TeTsWmV9i9c58mdDCSskIFdDS",
    })
    print(f"   Status: {r.status_code}")
    if r.status_code == 200:
        data = r.json()
        print(f"   Title: {data.get('title')}, Tracks: {data.get('total_tracks')}")
    else:
        print(f"   Error: {r.json()}")


def test_pipeline_analyze(client: TestClient) -> None:
    print("5. Pipeline analyze (404 expected)")
    r = client.post("/api/pipeline/analyze", json={"path": "nonexistent.mp3"})
    print(f"   Status: {r.status_code} (expected 404)")


def test_cancel(client: TestClient) -> None:
    print("6. Cancel job")
    r = client.post("/api/download", json={
        "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "output_dir": "test_downloads",
    })
    if r.status_code != 200:
        print("   Could not create job")
        return
    job_id = r.json()["id"]

    r = client.post(f"/api/jobs/{job_id}/cancel")
    print(f"   Status: {r.status_code}")
    if r.status_code == 200:
        print(f"   State: {r.json()['state']}")
    elif r.status_code == 409:
        print("   Job already finished")


def test_error_handling(client: TestClient) -> None:
    print("7. Error handling")
    r = client.get("/api/jobs/nonexistent")
    print(f"   404 test: {r.status_code} (expected 404)")

    r = client.post("/api/search", json={})
    print(f"   Validation test: {r.status_code} (expected 422)")


def test_sse(client: TestClient, job_id: str) -> None:
    print("8. SSE events")
    with client.stream("GET", f"/api/jobs/{job_id}/events") as r:
        print(f"   Status: {r.status_code}")
        count = 0
        for line in r.iter_lines():
            if line:
                print(f"   {line}")
                count += 1
                if count >= 5:
                    break


def main() -> None:
    with TestClient(app) as client:
        test_search(client)
        print()

        job_id = test_download(client)
        print()

        if job_id:
            test_job_status(client, job_id)
            print()

            for _ in range(30):
                time.sleep(1)
                status = client.get(f"/api/jobs/{job_id}").json()
                if status["state"] in ("completed", "failed", "cancelled"):
                    break

            test_sse(client, job_id)
            print()

        test_playlist(client)
        print()

        test_pipeline_analyze(client)
        print()

        test_cancel(client)
        print()

        test_error_handling(client)


if __name__ == "__main__":
    main()

"""API module - exposes backend functionality through HTTP endpoints."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import asyncio
import json
import logging
from contextlib import asynccontextmanager
from typing import Any, Literal

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse, Response, StreamingResponse
from pydantic import BaseModel

from downloader import AudioDownloadOptions, YoutubeDownloader
from jobs import Job, JobManager, JobState, TERMINAL_STATES
from pipeline import MetadataPipeline
from playlist_downloader import PlaylistDownloader, PlaylistDownloadOptions

logger = logging.getLogger(__name__)


# --- Request Models ---


class SearchRequest(BaseModel):
    query: str
    limit: int = 5
    filter: Literal["songs", "videos", "all"] = "songs"


class DownloadRequest(BaseModel):
    url: str
    output_dir: str = "."
    quality: Literal["best", "high", "medium", "low"] = "best"
    container: Literal["auto", "m4a", "opus", "original"] = "auto"
    embed_thumbnail: bool = True
    embed_metadata: bool = True


class PlaylistRequest(BaseModel):
    url: str


class PlaylistDownloadRequest(BaseModel):
    url: str
    selected: list[int] | None = None
    output_dir: str = "."
    quality: Literal["best", "high", "medium", "low"] = "best"
    container: Literal["auto", "m4a", "opus", "original"] = "auto"
    embed_thumbnail: bool = True
    embed_metadata: bool = True


class PipelineAnalyzeRequest(BaseModel):
    path: str


class PipelineEnrichRequest(BaseModel):
    path: str
    selected_index: int | None = None
    write: bool = False


class PipelineWriteRequest(BaseModel):
    path: str
    metadata: dict[str, Any]


# --- Response Models ---


class JobResponse(BaseModel):
    id: str
    state: str
    progress: float
    message: str
    result: Any = None
    error: str | None = None
    metadata: dict[str, Any] = {}


# --- App ---


@asynccontextmanager
async def lifespan(app: FastAPI):
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    app.state.job_manager = JobManager()
    app.state.pipeline = MetadataPipeline()
    logger.info("Application started")
    yield
    await app.state.pipeline.aclose()
    logger.info("Application shut down")


app = FastAPI(title="ytm-downloader", lifespan=lifespan)


# --- Exception handlers ---


@app.exception_handler(ValueError)
async def _value_error_handler(request: Any, exc: ValueError) -> JSONResponse:
    return JSONResponse(status_code=400, content={"detail": str(exc)})


@app.exception_handler(FileNotFoundError)
async def _not_found_error_handler(request: Any, exc: FileNotFoundError) -> JSONResponse:
    return JSONResponse(status_code=404, content={"detail": str(exc)})


@app.exception_handler(IndexError)
async def _index_error_handler(request: Any, exc: IndexError) -> JSONResponse:
    return JSONResponse(status_code=422, content={"detail": str(exc)})


@app.exception_handler(RuntimeError)
async def _runtime_error_handler(request: Any, exc: RuntimeError) -> JSONResponse:
    return JSONResponse(status_code=409, content={"detail": str(exc)})


@app.exception_handler(Exception)
async def _general_error_handler(request: Any, exc: Exception) -> JSONResponse:
    logger.exception("Unexpected error")
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


# --- Helpers ---


def _job_response(job: Job) -> JobResponse:
    return JobResponse(
        id=job.id,
        state=job.state.value,
        progress=job.progress,
        message=job.message,
        result=job.result,
        error=str(job.error) if job.error else None,
        metadata=job.metadata,
    )


# --- Job functions ---


def _run_download(
    job: Job,
    url: str,
    output_dir: str,
    quality: Literal["best", "high", "medium", "low"],
    container: Literal["auto", "m4a", "opus", "original"],
    embed_thumbnail: bool,
    embed_metadata: bool,
) -> None:
    def _progress(progress: Any) -> None:
        if job.is_cancelled():
            return
        status = progress.status
        if status == "downloading":
            percent = progress.percent
            if percent is not None:
                job.set_progress(percent, f"Downloading {progress.title or ''}")
            else:
                job.message = f"Downloading {progress.title or ''}"
            speed = progress.speed_bytes_per_second
            eta = progress.eta_seconds
            extras: dict[str, Any] = {}
            if speed is not None:
                extras["speed_bytes_per_second"] = round(speed)
            if eta is not None:
                extras["eta_seconds"] = eta
            if progress.video_id:
                extras["video_id"] = progress.video_id
            if extras:
                job.update_metadata(extras)
        elif status == "finished":
            job.set_progress(100.0, f"Finished {progress.title or ''}")
            job.update_metadata({"filepath": progress.filename})

    downloader = YoutubeDownloader()
    result = downloader.download(
        url,
        output_dir=output_dir,
        progress_callback=_progress,
        audio_options=AudioDownloadOptions(
            quality=quality,
            container=container,
            embed_thumbnail=embed_thumbnail,
            embed_metadata=embed_metadata,
        ),
    )
    job.result = {
        "filepath": result.filepath,
        "title": result.title,
        "video_id": result.video_id,
    }


def _run_playlist_download(
    job: Job,
    url: str,
    selected: list[int] | None,
    output_dir: str,
    quality: Literal["best", "high", "medium", "low"],
    container: Literal["auto", "m4a", "opus", "original"],
    embed_thumbnail: bool,
    embed_metadata: bool,
) -> None:
    playlist_dl = PlaylistDownloader()
    playlist = playlist_dl.get_playlist(url)

    def _progress(progress: Any) -> None:
        if job.is_cancelled():
            playlist_dl.cancel()
            return
        total = progress.selected_tracks or progress.total_tracks
        completed = progress.completed_tracks
        if total > 0:
            job.set_progress(
                round((completed / total) * 100.0, 1),
                progress.message or f"Track {completed}/{total}",
            )
        else:
            job.message = progress.message or ""
        extras: dict[str, Any] = {
            "completed": completed,
            "selected_tracks": progress.selected_tracks,
            "total_tracks": progress.total_tracks,
            "successful": progress.successful,
            "failed": progress.failed,
            "skipped": progress.skipped,
        }
        if progress.current_entry is not None:
            extras["current_track"] = {
                "title": progress.current_entry.title,
                "artist": progress.current_entry.artist,
            }
        song = progress.current_song_progress
        if song is not None:
            if song.speed_bytes_per_second is not None:
                extras["speed_bytes_per_second"] = round(song.speed_bytes_per_second)
            if song.eta_seconds is not None:
                extras["eta_seconds"] = song.eta_seconds
        job.update_metadata(extras)

    options = PlaylistDownloadOptions(
        output_directory=output_dir,
        audio_options=AudioDownloadOptions(
            quality=quality,
            container=container,
            embed_thumbnail=embed_thumbnail,
            embed_metadata=embed_metadata,
        ),
        progress_callback=_progress,
    )
    result = playlist_dl.download(playlist, selected=selected, options=options)
    job.result = {
        "successful": result.successful,
        "failed": result.failed,
        "skipped": result.skipped,
        "cancelled": result.cancelled,
        "elapsed_time": result.elapsed_time,
        "output_directory": result.output_directory,
    }


def _run_enrich(job: Job, path: str, selected_index: int | None, write: bool) -> None:
    async def _do() -> Any:
        shared_pipeline: MetadataPipeline = app.state.pipeline
        async with MetadataPipeline(providers=shared_pipeline.providers) as pipeline:
            return await pipeline.enrich_file(path, selected_index=selected_index, write=write)

    result = asyncio.run(_do())
    job.result = {
        "success": result.success,
        "source_file": result.source_file,
        "metadata": result.metadata,
        "lyrics": result.lyrics,
        "warnings": result.warnings,
        "errors": result.errors,
        "elapsed_time": result.elapsed_time,
        "wrote_metadata": result.wrote_metadata,
    }


# --- Endpoints ---


@app.post("/search")
async def search(request: SearchRequest) -> Any:
    logger.info("search query=%s limit=%d", request.query, request.limit)
    downloader = YoutubeDownloader()
    results = await asyncio.to_thread(downloader.search, request.query, request.limit, request.filter)
    return results


@app.post("/download")
async def download(request: DownloadRequest) -> JobResponse:
    logger.info("download url=%s", request.url)
    jm: JobManager = app.state.job_manager
    job = jm.create()
    jm.start(
        job,
        _run_download,
        request.url,
        request.output_dir,
        request.quality,
        request.container,
        request.embed_thumbnail,
        request.embed_metadata,
    )
    logger.info("download job_created id=%s", job.id)
    return _job_response(job)


@app.post("/playlist")
async def get_playlist(request: PlaylistRequest) -> Any:
    logger.info("playlist url=%s", request.url)
    playlist_dl = PlaylistDownloader()
    playlist = await asyncio.to_thread(playlist_dl.get_playlist, request.url)
    return playlist.to_dict()


@app.post("/playlist/download")
async def download_playlist(request: PlaylistDownloadRequest) -> JobResponse:
    logger.info("playlist_download url=%s", request.url)
    jm: JobManager = app.state.job_manager
    job = jm.create()
    jm.start(
        job,
        _run_playlist_download,
        request.url,
        request.selected,
        request.output_dir,
        request.quality,
        request.container,
        request.embed_thumbnail,
        request.embed_metadata,
    )
    logger.info("playlist_download job_created id=%s", job.id)
    return _job_response(job)


@app.post("/pipeline/analyze")
async def analyze(request: PipelineAnalyzeRequest) -> Any:
    logger.info("pipeline_analyze path=%s", request.path)
    try:
        result = await app.state.pipeline.analyze_file(request.path)
    except Exception as exc:
        msg = str(exc)
        if isinstance(exc, (FileNotFoundError, OSError)) or "No such file or directory" in msg or "Permission denied" in msg:
            raise HTTPException(status_code=404, detail=f"File not accessible: {request.path}") from exc
        raise
    return result


@app.post("/pipeline/enrich")
async def enrich(request: PipelineEnrichRequest) -> JobResponse:
    logger.info("pipeline_enrich path=%s", request.path)
    jm: JobManager = app.state.job_manager
    job = jm.create()
    jm.start(job, _run_enrich, request.path, request.selected_index, request.write)
    logger.info("pipeline_enrich job_created id=%s", job.id)
    return _job_response(job)


@app.post("/pipeline/write")
async def write_metadata(request: PipelineWriteRequest) -> Response:
    logger.info("pipeline_write path=%s", request.path)
    await app.state.pipeline.write_metadata(request.path, request.metadata)
    return Response(status_code=204)


@app.get("/jobs/{job_id}")
async def get_job(job_id: str) -> JobResponse:
    job = app.state.job_manager.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return _job_response(job)


@app.post("/jobs/{job_id}/cancel")
async def cancel_job(job_id: str) -> JobResponse:
    jm: JobManager = app.state.job_manager
    job = jm.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    if not jm.cancel(job):
        raise HTTPException(status_code=409, detail="Job already in terminal state")
    logger.info("job_cancelled id=%s", job_id)
    return _job_response(job)


@app.get("/jobs/{job_id}/events")
async def job_events(job_id: str) -> StreamingResponse:
    jm: JobManager = app.state.job_manager
    job = jm.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")

    async def _event_generator():  # type: ignore[no-untyped-def]
        while True:
            current = jm.get(job_id)
            if current is None:
                break
            data = json.dumps({
                "id": current.id,
                "state": current.state.value,
                "progress": current.progress,
                "message": current.message,
                "metadata": current.metadata,
                "error": str(current.error) if current.error else None,
            })
            yield f"data: {data}\n\n"
            if current.state in TERMINAL_STATES:
                break
            await asyncio.sleep(0.5)

    return StreamingResponse(
        _event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )

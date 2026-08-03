"""API module - exposes backend functionality through HTTP endpoints."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

import asyncio
import json
import logging
import platform
import shutil
import subprocess
from contextlib import asynccontextmanager
from typing import Any, Literal

from fastapi import FastAPI, HTTPException, APIRouter
from fastapi.responses import JSONResponse, Response, StreamingResponse
from pydantic import BaseModel
from downloader import AudioDownloadOptions, DownloaderAuth, YoutubeDownloader, classify_download_error, friendly_download_error
from jobs import Job, JobManager, JobState, TERMINAL_STATES
from pipeline import MetadataPipeline
from playlist_downloader import PlaylistDownloader, PlaylistDownloadOptions


logger = logging.getLogger(__name__)


def _make_downloader() -> YoutubeDownloader:
    """Create a YoutubeDownloader with resolved authentication."""
    from auth import has_cookies, cookies_path
    if has_cookies():
        return YoutubeDownloader(auth=DownloaderAuth(cookies_file=str(cookies_path())))
    return YoutubeDownloader()


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


class PipelineScanRequest(BaseModel):
    path: str


class PipelineSelectRequest(BaseModel):
    path: str
    matches: list[dict[str, Any]]
    selected_index: int


class PipelineWriteRequest(BaseModel):
    path: str
    metadata: dict[str, Any]


class OpenFolderRequest(BaseModel):
    path: str


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

router = APIRouter(prefix="/api")


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
    logger.info("Download: url=%s", url)

    def _progress(progress: Any) -> None:
        if job.is_cancelled():
            return
        job.wait_if_paused()
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

    downloader = _make_downloader()
    try:
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
    except Exception as exc:
        classification = classify_download_error(exc)
        logger.warning(
            "Download failed: url=%s error=%s classification=%s",
            url, exc, classification,
        )
        job.error = friendly_download_error(exc)
        raise

    job.update_metadata({
        "filepath": result.filepath,
        "artist": result.video.artist,
        "thumbnail_url": result.video.thumbnail_url,
        "duration_seconds": result.video.duration_seconds,
    })
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
    downloader = _make_downloader()
    playlist_dl = PlaylistDownloader(downloader=downloader)
    playlist = playlist_dl.get_playlist(url)

    # Accumulate completed/failed songs across all SSE polls — never overwrite these lists.
    completed_songs: list[dict[str, Any]] = []
    failed_songs: list[dict[str, Any]] = []
    _seen_failed: set[str] = set()  # track video_ids already added to failed_songs

    def _progress(progress: Any) -> None:
        if job.is_cancelled():
            playlist_dl.cancel()
            return
        job.wait_if_paused()
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

        # Build metadata from scratch each time (no merge) to avoid stale fields
        # from a previous song bleeding into the next one via the SSE poller.
        extras: dict[str, Any] = {
            "completed": completed,
            "selected_tracks": progress.selected_tracks,
            "total_tracks": progress.total_tracks,
            "successful": progress.successful,
            "failed": progress.failed,
            "skipped": progress.skipped,
            # Reset per-song fields explicitly
            "filepath": "",
            "output_directory": "",
            "speed_bytes_per_second": None,
            "eta_seconds": None,
            "song_percent": None,
            "current_track": None,
            "completed_track": None,
        }

        if progress.current_entry is not None:
            extras["current_track"] = {
                "title": progress.current_entry.title,
                "artist": progress.current_entry.artist,
                "thumbnail_url": progress.current_entry.thumbnail_url,
                "duration_seconds": progress.current_entry.duration_seconds,
                "video_id": progress.current_entry.video_id,
            }

        song = progress.current_song_progress
        if song is not None:
            if song.speed_bytes_per_second is not None:
                extras["speed_bytes_per_second"] = round(song.speed_bytes_per_second)
            if song.eta_seconds is not None:
                extras["eta_seconds"] = song.eta_seconds
            if song.percent is not None:
                extras["song_percent"] = song.percent

        if progress.filepath is not None and progress.current_entry is not None:
            # Song just finished — append to the persistent completed_songs list.
            # This list is never cleared, so SSE polling will always see all finished songs
            # regardless of timing (eliminates the race condition).
            completed_songs.append({
                "title": progress.current_entry.title,
                "artist": progress.current_entry.artist,
                "thumbnail_url": progress.current_entry.thumbnail_url,
                "duration_seconds": progress.current_entry.duration_seconds,
                "video_id": progress.current_entry.video_id,
                "filepath": progress.filepath,
                "output_directory": output_dir,
            })

        # Detect failed songs: no filepath, has current_entry, and message starts with "Failed"
        if (
            progress.filepath is None
            and progress.current_entry is not None
            and progress.message
            and progress.message.startswith("Failed")
            and progress.current_entry.video_id not in _seen_failed
        ):
            _seen_failed.add(progress.current_entry.video_id)
            failed_songs.append({
                "title": progress.current_entry.title,
                "artist": progress.current_entry.artist,
                "thumbnail_url": progress.current_entry.thumbnail_url,
                "duration_seconds": progress.current_entry.duration_seconds,
                "video_id": progress.current_entry.video_id,
                "url": progress.current_entry.url,
                "output_directory": output_dir,
                "error_message": progress.message,
            })

        # Always include the full accumulated lists in metadata.
        extras["completed_songs"] = list(completed_songs)
        extras["failed_songs"] = list(failed_songs)

        # Full replace (not merge) — no stale fields between songs.
        job.set_metadata(extras)

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


@router.post("/search")
async def search(request: SearchRequest) -> Any:
    logger.info("search query=%s limit=%d", request.query, request.limit)
    downloader = _make_downloader()
    results = await asyncio.to_thread(downloader.search, request.query, request.limit, request.filter)
    return results


@router.post("/download")
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


@router.post("/playlist")
async def get_playlist(request: PlaylistRequest) -> Any:
    logger.info("playlist url=%s", request.url)
    downloader = _make_downloader()
    playlist_dl = PlaylistDownloader(downloader=downloader)
    playlist = await asyncio.to_thread(playlist_dl.get_playlist, request.url)
    return playlist.to_dict()


@router.post("/playlist/download")
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


@router.post("/pipeline/analyze")
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


@router.post("/pipeline/analyze-stream")
async def analyze_stream(request: PipelineAnalyzeRequest) -> StreamingResponse:
    logger.info("pipeline_analyze_stream path=%s", request.path)

    async def _event_generator():
        try:
            async for event in app.state.pipeline.analyze_stream(request.path):
                yield json.dumps(event) + "\n"
        except Exception as exc:
            msg = str(exc)
            if isinstance(exc, (FileNotFoundError, OSError)) or "No such file" in msg or "Permission denied" in msg:
                yield json.dumps({"event": "error", "detail": f"File not accessible: {request.path}"}) + "\n"
            else:
                yield json.dumps({"event": "error", "detail": msg}) + "\n"

    return StreamingResponse(
        _event_generator(),
        media_type="application/x-ndjson",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/pipeline/select")
async def select_match(request: PipelineSelectRequest) -> Any:
    logger.info("pipeline_select path=%s index=%d", request.path, request.selected_index)
    result = await app.state.pipeline.select_match(request.path, request.matches, request.selected_index)  # type: ignore[arg-type]
    if result.errors:
        raise HTTPException(status_code=400, detail=result.errors[0])
    return result


_AUDIO_EXTENSIONS = {".mp3", ".m4a", ".flac", ".ogg", ".wav", ".wma", ".aac"}


@router.post("/pipeline/scan")
async def scan_folder(request: PipelineScanRequest) -> list[dict[str, Any]]:
    logger.info("pipeline_scan path=%s", request.path)
    folder = Path(request.path)
    if not folder.is_dir():
        raise HTTPException(status_code=404, detail=f"Folder not found: {request.path}")
    files: list[dict[str, Any]] = []
    for f in sorted(folder.iterdir()):
        if f.is_file() and f.suffix.lower() in _AUDIO_EXTENSIONS:
            stat = f.stat()
            files.append({
                "path": str(f),
                "name": f.name,
                "size": stat.st_size,
                "mtime": stat.st_mtime,
                "ctime": stat.st_ctime,
            })
    return files


@router.post("/pipeline/enrich")
async def enrich(request: PipelineEnrichRequest) -> JobResponse:
    logger.info("pipeline_enrich path=%s", request.path)
    jm: JobManager = app.state.job_manager
    job = jm.create()
    jm.start(job, _run_enrich, request.path, request.selected_index, request.write)
    logger.info("pipeline_enrich job_created id=%s", job.id)
    return _job_response(job)


@router.post("/pipeline/write")
async def write_metadata(request: PipelineWriteRequest) -> Response:
    logger.info("pipeline_write path=%s", request.path)
    await app.state.pipeline.write_metadata(request.path, request.metadata)
    return Response(status_code=204)


class ReadTagsRequest(BaseModel):
    path: str


@router.post("/pipeline/read-tags")
async def read_tags(request: ReadTagsRequest) -> dict[str, str]:
    from extractor import read_all_tags
    return read_all_tags(request.path)


@router.get("/jobs/{job_id}")
async def get_job(job_id: str) -> JobResponse:
    job = app.state.job_manager.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return _job_response(job)


@router.post("/jobs/{job_id}/cancel")
async def cancel_job(job_id: str) -> JobResponse:
    jm: JobManager = app.state.job_manager
    job = jm.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    if not jm.cancel(job):
        raise HTTPException(status_code=409, detail="Job already in terminal state")
    logger.info("job_cancelled id=%s", job_id)
    return _job_response(job)


@router.post("/jobs/{job_id}/pause")
async def pause_job(job_id: str) -> JobResponse:
    jm: JobManager = app.state.job_manager
    job = jm.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    if not jm.pause(job):
        raise HTTPException(status_code=409, detail="Job cannot be paused")
    logger.info("job_paused id=%s", job_id)
    return _job_response(job)


@router.post("/jobs/{job_id}/resume")
async def resume_job(job_id: str) -> JobResponse:
    jm: JobManager = app.state.job_manager
    job = jm.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    if not jm.resume(job):
        raise HTTPException(status_code=409, detail="Job is not paused")
    logger.info("job_resumed id=%s", job_id)
    return _job_response(job)


@router.get("/jobs/{job_id}/events")
async def job_events(job_id: str) -> StreamingResponse:
    jm: JobManager = app.state.job_manager
    job = jm.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")

    async def _event_generator():  # type: ignore[no-untyped-def]
        loop = asyncio.get_running_loop()
        queue, unsubscribe = job.subscribe(loop)
        terminal_values = {s.value for s in TERMINAL_STATES}
        
        try:
            # Yield initial state immediately
            initial = json.dumps(job._snapshot())
            yield f"data: {initial}\n\n"
            
            if job.state in TERMINAL_STATES:
                return

            while True:
                snapshot = await queue.get()
                data = json.dumps(snapshot)
                yield f"data: {data}\n\n"
                
                # Terminate stream if job is in a terminal state
                if snapshot["state"] in terminal_values:
                    break
        finally:
            unsubscribe()

    return StreamingResponse(
        _event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/folders")
async def list_folders(path: str = "") -> dict[str, Any]:
    logger.info("list_folders path=%s", path)
    if not path:
        if platform.system() == "Windows":
            import string
            drives = []
            for letter in string.ascii_uppercase:
                drive = Path(f"{letter}:\\")
                if drive.exists():
                    drives.append({"name": f"{letter}:\\", "path": str(drive)})
            return {"path": "", "parent": None, "folders": drives}
        root = Path("/")
        return {"path": "/", "parent": None, "folders": [{"name": "/", "path": "/"}]}

    target = Path(path)
    if not target.is_dir():
        raise HTTPException(status_code=400, detail=f"Not a directory: {path}")

    parent = str(target.parent) if str(target.parent) != str(target) else None
    folders = []
    try:
        for item in sorted(target.iterdir()):
            if item.is_dir() and not item.name.startswith("."):
                folders.append({"name": item.name, "path": str(item)})
    except PermissionError:
        raise HTTPException(status_code=403, detail=f"Permission denied: {path}")

    return {"path": str(target), "parent": parent, "folders": folders}


@router.post("/open-folder")
async def open_folder(request: OpenFolderRequest) -> Response:
    logger.info("open_folder path=%s", request.path)
    target = Path(request.path).resolve()
    folder = target if target.is_dir() else target.parent
    if not folder.exists():
        raise HTTPException(status_code=404, detail=f"Folder not found: {folder}")
    try:
        p = platform.system()
        if p == "Windows":
            subprocess.Popen(["explorer.exe", str(folder)])
        elif p == "Darwin":
            subprocess.Popen(["open", str(folder)])
        else:
            subprocess.Popen(["xdg-open", str(folder)])
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to open folder: {exc}") from exc
    return Response(status_code=204)


# --- Auth Endpoints ---


from auth import has_cookies, cookies_path, save_cookies, remove_cookies
from fastapi import UploadFile


class AuthStatusResponse(BaseModel):
    configured: bool
    imported_at: str | None = None


@router.get("/auth/status")
async def auth_status() -> AuthStatusResponse:
    from datetime import datetime
    path = cookies_path()
    if path.is_file():
        stat = path.stat()
        imported = datetime.fromtimestamp(stat.st_mtime).isoformat()
        return AuthStatusResponse(configured=True, imported_at=imported)
    return AuthStatusResponse(configured=False, imported_at=None)


@router.post("/auth/cookies", status_code=201)
async def import_cookies(file: UploadFile) -> dict[str, str]:
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided.")
    if not file.filename.lower().endswith(".txt"):
        raise HTTPException(status_code=400, detail="Only .txt files are accepted.")

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="The file is empty.")

    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        text = raw.decode("latin-1")

    try:
        save_cookies(text)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"message": "Cookies imported successfully."}


@router.delete("/auth/cookies")
async def delete_cookies() -> Response:
    remove_cookies()
    return Response(status_code=204)


app.include_router(router)

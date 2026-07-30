"""Cookies.txt authentication management for YTM Downloader.

Stores imported cookies.txt in a platform-specific application data directory.
Never modifies the user's original file.
"""

import logging
import platform
from pathlib import Path

logger = logging.getLogger(__name__)

_APP_NAME = "YTMDownloader"
_AUTH_DIR = "auth"
_COOKIES_FILENAME = "cookies.txt"

_NETSCAPE_PREFIXES = ("# netscape http cookie file", "# http cookie file")
_YOUTUBE_DOMAINS = ("youtube.com", "music.youtube.com")


def _get_app_data_dir() -> Path:
    """Return platform-specific application data directory."""
    system = platform.system()
    if system == "Windows":
        base = Path.home() / "AppData" / "Local"
    elif system == "Darwin":
        base = Path.home() / "Library" / "Application Support"
    else:
        import os
        xdg = os.environ.get("XDG_DATA_HOME", "")
        if xdg:
            base = Path(xdg)
        else:
            base = Path.home() / ".local" / "share"
    return base / _APP_NAME


def cookies_path() -> Path:
    """Return the internal path where cookies.txt is stored."""
    return _get_app_data_dir() / _AUTH_DIR / _COOKIES_FILENAME


def has_cookies() -> bool:
    """Return True if a valid cookies.txt file exists."""
    return cookies_path().is_file()


def save_cookies(text: str) -> None:
    """Validate and save cookies.txt content to internal storage.

    Uses atomic write: writes to cookies.txt.new, then replaces the original.
    If validation fails, the existing cookies.txt is preserved unchanged.

    Raises:
        ValueError: If the content is empty, not valid Netscape cookies format,
                    or does not contain YouTube cookies.
    """
    lines = text.splitlines()

    if not lines or not any(line.strip() for line in lines):
        raise ValueError("The file is empty.")

    # Validate Netscape cookie format
    first_line = lines[0].strip().lower()
    if not any(first_line.startswith(prefix) for prefix in _NETSCAPE_PREFIXES):
        raise ValueError(
            "Invalid file format. Expected a Netscape cookies.txt file.\n"
            "The file must start with '# Netscape HTTP Cookie File'."
        )

    # Validate contains YouTube cookies
    content_lower = text.lower()
    has_youtube = any(domain in content_lower for domain in _YOUTUBE_DOMAINS)
    if not has_youtube:
        raise ValueError(
            "The cookies file does not contain YouTube cookies.\n"
            "Make sure the file contains cookies for youtube.com or music.youtube.com."
        )

    # Atomic write: write to .new, then replace
    dest = cookies_path()
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".new")
    try:
        tmp.write_text(text, encoding="utf-8")
        tmp.replace(dest)
    except Exception:
        tmp.unlink(missing_ok=True)
        raise
    logger.info("Cookies saved to %s", dest)


def remove_cookies() -> None:
    """Remove the stored cookies.txt file. No-op if not present."""
    path = cookies_path()
    if path.is_file():
        path.unlink()
        logger.info("Cookies removed: %s", path)

"""Tests for cookies.txt authentication module."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from unittest.mock import patch
import shutil

import pytest

import auth


VALID_COOKIES = """# Netscape HTTP Cookie File
.youtube.com	TRUE	/	FALSE	0	CONSENT	PENDING+999
.youtube.com	TRUE	/	TRUE	0	SIDW	SID_VALUE_HERE
.youtube.com	TRUE	/	TRUE	0	HSID	HSID_VALUE_HERE
.youtube.com	TRUE	/	TRUE	0	SSID	SSID_VALUE_HERE
.youtube.com	TRUE	/	TRUE	0	APISID	APISID_VALUE_HERE
.youtube.com	TRUE	/	TRUE	0	SAPISID	SAPISID_VALUE_HERE
.music.youtube.com	TRUE	/	FALSE	0	__Secure-YEC	YEC_VALUE_HERE
"""

INVALID_FORMAT = """# Just some random text
cookie1	value1
cookie2	value2
"""

NO_YOUTUBE_COOKIES = """# Netscape HTTP Cookie File
.example.com	TRUE	/	FALSE	0	session_id	abc123
.example.com	TRUE	/	FALSE	0	csrf_token	xyz789
"""


@pytest.fixture(autouse=True)
def _cleanup_internal_storage(tmp_path: Path):
    """Redirect auth storage to a temp directory and clean up after."""
    auth_dir = tmp_path / "auth"
    auth_dir.mkdir(parents=True, exist_ok=True)
    with patch.object(auth, "_get_app_data_dir", return_value=tmp_path):
        yield
    if auth_dir.exists():
        shutil.rmtree(auth_dir)


class TestCookiesPath:
    def test_returns_path(self):
        result = auth.cookies_path()
        assert isinstance(result, Path)
        assert result.name == "cookies.txt"

    def test_parent_dir_is_auth(self):
        result = auth.cookies_path()
        assert result.parent.name == "auth"


class TestHasCookies:
    def test_returns_false_when_no_file(self):
        assert auth.has_cookies() is False

    def test_returns_true_when_file_exists(self):
        path = auth.cookies_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(VALID_COOKIES, encoding="utf-8")
        assert auth.has_cookies() is True


class TestSaveCookies:
    def test_saves_valid_text(self):
        auth.save_cookies(VALID_COOKIES)

        assert auth.has_cookies() is True
        saved = auth.cookies_path()
        assert saved.read_text(encoding="utf-8") == VALID_COOKIES

    def test_rejects_empty_text(self):
        with pytest.raises(ValueError, match="empty"):
            auth.save_cookies("")

    def test_rejects_whitespace_only(self):
        with pytest.raises(ValueError, match="empty"):
            auth.save_cookies("   \n  \n  ")

    def test_rejects_invalid_format(self):
        with pytest.raises(ValueError, match="Invalid file format"):
            auth.save_cookies(INVALID_FORMAT)

    def test_rejects_no_youtube_cookies(self):
        with pytest.raises(ValueError, match="does not contain YouTube cookies"):
            auth.save_cookies(NO_YOUTUBE_COOKIES)

    def test_overwrites_existing_cookies(self):
        auth.save_cookies(VALID_COOKIES)

        new_cookies = "# Netscape HTTP Cookie File\nyoutube.com\tTRUE\t/\tFALSE\t0\tNEW\tVALUE\n"
        auth.save_cookies(new_cookies)

        content = auth.cookies_path().read_text(encoding="utf-8")
        assert "NEW" in content

    def test_atomic_write_preserves_old_on_failure(self):
        auth.save_cookies(VALID_COOKIES)
        original = auth.cookies_path().read_text(encoding="utf-8")

        with pytest.raises(ValueError):
            auth.save_cookies("bad content")

        assert auth.cookies_path().read_text(encoding="utf-8") == original

    def test_no_temp_files_left_after_success(self, tmp_path: Path):
        auth.save_cookies(VALID_COOKIES)
        auth_dir = auth.cookies_path().parent
        assert list(auth_dir.glob("*.new")) == []

    def test_no_temp_files_left_after_failure(self, tmp_path: Path):
        with pytest.raises(ValueError):
            auth.save_cookies("bad content")
        auth_dir = auth.cookies_path().parent
        assert list(auth_dir.glob("*.new")) == []


class TestRemoveCookies:
    def test_removes_existing_file(self):
        auth.save_cookies(VALID_COOKIES)
        assert auth.has_cookies() is True

        auth.remove_cookies()
        assert auth.has_cookies() is False

    def test_noop_when_no_file(self):
        auth.remove_cookies()
        assert auth.has_cookies() is False

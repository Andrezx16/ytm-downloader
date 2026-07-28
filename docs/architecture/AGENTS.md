# Agent Guide — ytm-downloader

## Structure
- `backend/` — all Python source, tests, docs, config
- `frontend/` — placeholder for future React + Tauri frontend
- Entry points: `api.py`, `matcher.py`, `extractor.py` (inside `backend/`)

## Setup
```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
export LASTFM_API_KEY=your_key
# providers/musicbrainz.py: USER_AGENT = "YourApp/1.0 (contact@you.com)"
```

## Tests (from `backend/`)
- `python test.py path/to/file.mp3` — end-to-end pipeline
- `python test_api.py` — API integration
- `python test_jobs.py` — jobs module
- Matcher quick-check:
```bash
python3 -c "
from matcher import FileInfo, score_candidate
f = FileInfo(title='believer', artist='unknown', duration_ms=204000)
c = {'source':'deezer','title':'Believer','artist':'Imagine Dragons','album':'Evolve',
     'album_artist':None,'year':2017,'genre':None,'track_number':4,'disc_number':1,
     'isrc':None,'composer':None,'duration_ms':204346,'cover_url':None,'confidence':None}
print(score_candidate(f, c))
"
```

## Providers
| Provider | Notes |
|----------|-------|
| Deezer | No API key needed. /search returns title/artist/album/cover/duration. |
| Apple | iTunes Search API (free). |
| MusicBrainz | 1 req/s internal limit. **Set USER_AGENT or risk IP ban.** |
| Last.fm | Two-step (search + getInfo). Requires `LASTFM_API_KEY`. Best for genre/tags. |
| YTMusic | High-confidence shortcut (~0.97) when video_id available. |
| Spotify | Excluded — requires Premium after Feb 2026 API changes. |

## Critical Behavior
- `matcher.py:152` — fill missing fields from *already-found* candidates, not extra API calls
- `matcher.py:165` — Deezer-only fetch for track_number/disc_number/isrc/year when missing
- Call `providers.aclose()` after finishing all provider work
- `providers/musicbrainz.py:23` — missing USER_AGENT = IP ban
- Providers must never raise exceptions — log and return `[]`
- All providers share the same `MatchCandidate` TypedDict

## Architecture
- Core flow: extractor → matcher (concurrent) → merge_missing_fields → write_metadata
- 6 providers, each independent, no cross-dependencies
- Rate limits: MusicBrainz 1/s, Last.fm 5/s, Apple ~20/min
- `syncedlyrics` uses `asyncio.to_thread` internally (blocking)
- Backend/frontend separation preserved

## Roadmap
1. ✅ downloader.py (yt-dlp wrapper, video_id extraction)
2. ✅ api.py (FastAPI HTTP layer)
3. rate limiter global — control concurrent API access
4. frontend Tauri — candidate selection UI
5. folder watcher — automatic file detection


## Documentation is optimized for LLM consumption.

Requirements:
- Preserve technical accuracy.
- Minimize token usage.
- Avoid redundant prose.
- Avoid repeated explanations.
- Prefer concise wording.
- Keep Markdown readable.
- Preserve code blocks, signatures, file trees and architectural decisions.
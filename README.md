# Gestor inteligente de metadatos musicales

## Estado actual

```
├── backend/          # Python backend (source, tests, docs, config)
├── frontend/         # Placeholder for React + Tauri
├── .gitignore
├── README.md
└── venv/
```

### Backend

| Módulo | Estado |
|---|---|
| `providers/base.py` | Interfaz común (`MusicProvider`, `MatchCandidate`) — listo |
| `providers/deezer.py` | Funcional, sin API key requerida |
| `providers/spotify.py` | Funcional pero **no incluido en la lista de providers activos** — desde feb. 2026 Spotify exige cuenta Premium para Development Mode |
| `providers/musicbrainz.py` | Funcional, sin API key (respeta rate limit 1 req/s) |
| `providers/apple.py` | Funcional — usa iTunes Search API (gratis, sin auth) |
| `providers/lastfm.py` | Funcional, requiere `LASTFM_API_KEY` (gratis, solo registro) |
| `providers/ytmusic.py` | Funcional — atajo de alta confianza (0.97) por `videoId` |
| `matcher.py` | Listo — fórmula de confianza ponderada |
| `extractor.py` | Listo — lee metadata actual con mutagen |
| `writer.py` | Listo — escribe MP3/M4A/FLAC + portada + letras |
| `lyrics.py` | Listo — wrapper sobre `syncedlyrics` |
| `downloader.py` | Listo — wrapper sobre `yt-dlp` con progress hooks |
| `api.py` | Listo — FastAPI local que expone todo al frontend |
| `jobs.py` | Listo — gestión genérica de tareas en background |
| `pipeline.py` | Listo — orquestador del pipeline de metadata |

## Setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Credenciales necesarias

1. **MusicBrainz**: editar `USER_AGENT` en `providers/musicbrainz.py` con datos
   reales (obligatorio por su política de uso, o pueden banear tu IP).
2. **Deezer**: no requiere nada.
3. **Apple (iTunes Search API)**: no requiere nada.
4. **Last.fm**: crear cuenta gratis en https://www.last.fm/api/account/create
   y exportar `LASTFM_API_KEY`.
5. **Spotify**: no usado por defecto (exige cuenta Premium desde feb. 2026,
   ver docstring de `providers/spotify.py`).

### Providers activos por defecto

Deezer + MusicBrainz + Apple (iTunes) + Last.fm — los cuatro gratis y
sin restricciones. Spotify queda disponible en el código pero excluido
hasta que tengas Premium (ver más abajo por qué).

### Flujo de matching recomendado

Usar `matcher.find_matches_for_file()` en vez de `find_matches()` directo:
si el archivo trae un `video_id` de YT Music (yt-dlp lo expone), primero
intenta el atajo canónico vía `YTMusicProvider.get_canonical()` — si YT
Music confirma que es una "Song" oficial, devuelve un único candidato con
confianza ~0.97 sin gastar llamadas a las demás APIs. Si no hay video_id
o no es un track oficial, cae automáticamente al matching fuzzy normal
cruzando Deezer/MusicBrainz/Apple/Last.fm.

### Probar el matcher sin conexión a las APIs

```bash
cd backend
python3 -c "
from matcher import FileInfo, score_candidate
f = FileInfo(title='believer', artist='unknown', duration_ms=204000)
c = {'source':'deezer','title':'Believer','artist':'Imagine Dragons','album':'Evolve',
     'album_artist':None,'year':2017,'genre':None,'track_number':4,'disc_number':1,
     'isrc':None,'composer':None,'duration_ms':204346,'cover_url':None,'confidence':None}
print(score_candidate(f, c))
"
```

## Siguientes pasos sugeridos

1. Frontend Tauri: `CurrentFile.tsx`, `CandidateCard.tsx`, `MetadataForm.tsx`.
2. Probar `writer.py` contra un MP3/M4A/FLAC real (no se probó escritura
   real todavía, solo que el módulo importa sin errores).
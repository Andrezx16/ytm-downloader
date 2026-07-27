# Gestor inteligente de metadatos musicales

## Estado actual

Backend funcional en `backend/`:

| Módulo | Estado |
|---|---|
| `providers/base.py` | Interfaz común (`MusicProvider`, `MatchCandidate`) — listo |
| `providers/deezer.py` | Funcional, sin API key requerida |
| `providers/spotify.py` | Funcional pero **no incluido en la lista de providers activos** — desde feb. 2026 Spotify exige cuenta Premium para Development Mode. Activar solo si en algún momento tenés Premium |
| `providers/musicbrainz.py` | Funcional, sin API key (respeta rate limit 1 req/s) |
| `providers/apple.py` | Funcional — usa iTunes Search API (gratis, sin auth), no la Apple Music API paga |
| `providers/lastfm.py` | Funcional, requiere `LASTFM_API_KEY` (gratis, solo registro). Mejor fuente de género/tags del set |
| `providers/ytmusic.py` | Funcional — atajo de alta confianza (0.97) por `videoId` cuando el archivo viene de YT Music. No es fuzzy, usa `ytmusicapi` (no oficial) |
| `matcher.py` | Listo — fórmula de confianza ponderada (título 0.4, artista 0.3, duración 0.2, álbum 0.1), probado |
| `extractor.py` | Listo — lee metadata actual con mutagen |
| `writer.py` | Listo — escribe MP3/M4A/FLAC + portada + letras |
| `lyrics.py` | Listo — wrapper sobre `syncedlyrics` (LRCLIB → NetEase → Musixmatch → Megalobiz) |
| `downloader.py` | Pendiente — wrapper sobre `yt-dlp` |
| `api.py` | Pendiente — FastAPI local que expone todo al frontend Tauri |
| `frontend/` | Pendiente — React + Tauri |

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
   ver docstring de `providers/spotify.py`). Si en algún momento tenés
   Premium, crear app en https://developer.spotify.com/dashboard y exportar
   `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET`.

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

### Por qué no usamos Spotify

Desde el 11 de febrero de 2026, Spotify exige que el dueño de la app
tenga cuenta Premium para usar la Web API en Developer Mode — incluso
para simple búsqueda de metadata, no solo playback. Existe un workaround
no oficial (`spotAPI`, usado por spotDL) que envuelve el API interno del
reproductor web, pero es ingeniería inversa frágil que puede romperse
sin aviso — no la usamos por eso. El código de `spotify.py` queda listo
por si en algún momento hay cuenta Premium disponible.

### Probar el matcher sin conexión a las APIs

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

## Siguientes pasos sugeridos

1. `downloader.py` — wrapper de `yt-dlp` con progress hooks.
2. `api.py` — FastAPI con endpoints: `POST /scan`, `GET /matches/{file_id}`,
   `POST /apply/{file_id}`.
3. Frontend Tauri: `CurrentFile.tsx`, `CandidateCard.tsx`, `MetadataForm.tsx`.
4. Probar `writer.py` contra un MP3/M4A/FLAC real (no se probó escritura
   real todavía, solo que el módulo importa sin errores).
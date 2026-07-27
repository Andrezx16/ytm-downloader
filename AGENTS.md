# OpenCode Agent Guide for ytm-downloader

## Project Structure
- Backend code is at repository root (contrary to README's `cd backend` instruction)
- Py project with single Python package
- `test.py` is end-to-end integration test script
- Entry point: `matcher.py` and `extractor.py`

## Setup Commands
Run this exact sequence:
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python -c "from extractor import read_file_info; print('✓ extractor importado')"

# Configurar credenciales de APIs
export LASTFM_API_KEY=your_lastfm_key
# Editar providers/musicbrainz.py:
#   USER_AGENT = "YourApp/1.0 (contacto@tuapp.com)"
```

## Running Tests
- `python test.py ruta/al/archivo.mp3` - flujo completo validado por integración
- Para probar matcher sin APIs:
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

## Architecture Notes
- 6_providers access external APIs independently, no provider dependencies
- Provider rate limits: MusicBrainz (1 req/s), Last.fm (5 req/s), Apple/iTunes (~20 req/min)
- Future-proof design: isolated provider layer, backend/frontend separation
- Core flow: extractor → matcher (concurrently) → merge_missing_fields → write_metadata

## Provider Ecosystem
- **Deezer**: sin API key, /search trae título/artista/álbum/portada/duración
- **Apple**: usando iTunes Search API (gratis)
- **MusicBrainz**: rate limit interno de 1 req/s, NECEditar USER_AGENT réelle
- **Last.fm**: división en dos pasos (search + getInfo), mejor fuente de género/tags
- **YTMusic**: atajo de alta confianza (confianza ~0.97) vía videoId cuando está disponible
- **Spotify**: excluido - requiere cuenta Premium para acceso a API después de febrero 2026

## Critical Project-Specific Behavior
- `matcher.py:152` - completar campos faltantes de candidatos *ya encontrados*, no de/apis extra
- `matcher.py:165` - Buscar SOLO a Deezer para track_number/disc_number/isrc/ year (campos que missing)
- Proveedores tienen aclose() - llame a todos los providers.aclose() después de terminar
- `providers/musicbrainz.py:23` - sin USER_AGENT REAL => banear IP por MusicBrainz
- `providers/spotify.py:10-20` - Spotify desactivado por defecto, activar solo con Premium

## Development Quirks
- Los providers nunca deben lanzar excepciones hacia afuera - simplemente logueen y devuelvan []
- syncedlyrics usa asyncio.to_thread (bloqueante) internamente
- Generacion de codigo/conbinacion: Todos los providers usan el mismo MatchCandidate TypedDict
- Extraer metadata de YouTube: video_id preciso cuando archivo viene de yt-dlp
- Probar escritor contra MP3/M4A/FLAC real (no hecho todavía, solo importaciones)

## Architecture Future Roadmap
1. downloader.py (wrapper yt-dlp) - punto de extraccion de metadatos para videoId
2. api.py (FastAPI local) - exposición HTTP del pipeline
3. rate limiter global - controlar APIs concurrentes
4. frontend Tauri - capa de eleccion de candidatos
5. watcher de carpeta - deteccion automatica de archivos

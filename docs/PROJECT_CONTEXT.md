# Contexto operativo del proyecto

## Qué es este proyecto

Este repositorio implementa un backend de Python para enriquecer metadatos musicales de archivos locales como MP3, M4A y FLAC. La idea principal es extraer información básica del archivo, consultar varias fuentes de metadata en paralelo, rankear candidatos, permitir elegir uno manualmente y escribir la metadata final de vuelta al archivo.

El objetivo final es servir de motor central para una app de escritorio, y luego poder reutilizar ese mismo backend desde otros clientes como Tauri, Android o web.

## Estado actual del repositorio

El backend ya está funcionando en la raíz del workspace, no dentro de una subcarpeta adicional.

### Módulos ya implementados

- extractor.py: lee metadata existente del archivo local con mutagen.
- matcher.py: orquesta los providers y calcula la confianza de cada candidato.
- writer.py: escribe tags para MP3, M4A/AAC y FLAC, incluyendo portada y letras.
- lyrics.py: busca letras mediante syncedlyrics con fallback entre múltiples servicios.
- providers/base.py: interfaz común que deben cumplir todos los providers.
- providers/deezer.py: provider funcional, sin API key.
- providers/apple.py: provider funcional con iTunes Search API.
- providers/musicbrainz.py: provider funcional, con rate limit interno.
- providers/lastfm.py: provider funcional, requiere LASTFM_API_KEY.
- providers/ytmusic.py: provider funcional, útil cuando se dispone de videoId de YouTube Music.
- test.py: script end-to-end que ya fue probado con un archivo real.

### Lo que todavía falta

- downloader.py (En progreso): Wrapper de yt-dlp. Arquitectura de 2 fases (fetch metadata, luego descargar). Extrae playlists sin límite, guarda como `{titulo} [{id}].m4a` por defecto e incrusta metadatos básicos iniciales.
- api.py: FastAPI para exponer el pipeline al frontend.
- rate limiter global: importante si se procesan carpetas completas.
- frontend Tauri/React: pendiente.
- watcher de carpeta: opcional en una segunda etapa.

## Flujo actual del pipeline

1. Se lee la metadata existente del archivo local.
2. Se consultan los providers disponibles en paralelo.
3. El matcher calcula una puntuación de confianza usando similitud de título, artista, duración y álbum.
4. Se devuelve una lista de candidatos ordenada por confianza.
5. El usuario selecciona el candidato más adecuado.
6. Se completan campos faltantes con datos de los otros candidatos ya encontrados.
7. Si siguen faltando campos sensibles (track number, disc number, ISRC, year), se puede hacer un detalle extra a Deezer.
8. Se buscan letras.
9. Se escribe la metadata al archivo.

## Providers activos por defecto

Los providers activos son:

- Deezer
- Apple (iTunes Search API)
- MusicBrainz
- Last.fm

YT Music queda disponible, pero su uso depende de contar con un videoId válido y de la disponibilidad del servicio.

Spotify no está activo por defecto. Se descartó por restricciones de acceso y cambios de política de la API.

## Decisiones técnicas importantes

Estas decisiones ya fueron tomadas y no conviene volver a discutirlas:

- No usar AcoustID.
- No usar la Apple Music API real por costo y complejidad.
- No usar BetterLyrics como fuente principal.
- No reintroducir Spotify como provider activo por defecto.

## Reglas de arquitectura que conviene mantener

- El backend debe permanecer independiente del frontend.
- Los providers deben ser aislados y no conocerse entre sí.
- La lógica de negocio debe residir en el pipeline del backend, no en la UI.
- El backend debe trabajar sobre un archivo a la vez.
- El frontend debe delegar la lógica a la API, no hablar directamente con los providers.
- Los fallos de red deben registrarse y no romper el flujo completo.

## Notas importantes para la próxima sesión

- No reescribir módulos ya funcionando si no hace falta.
- Mantener el diseño actual de providers y matcher.
- Priorizar los pasos en este orden: downloader, API, rate limiter, frontend.
- Si se comparte esta carpeta en otra sesión, conviene conservar los archivos actuales del workspace y no regenerar el proyecto desde cero.

## Cómo probar el flujo hoy

Se puede ejecutar:

```bash
python test.py "ruta/al/archivo.mp3"
```

Ese script ya valida el pipeline completo, desde lectura del archivo hasta escritura de metadata.
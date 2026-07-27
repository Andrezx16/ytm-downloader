# Arquitectura del proyecto

## Visión general

El proyecto sigue una arquitectura en capas orientada a separar responsabilidades claras:

- Capas de entrada: cliente local o futuro frontend Tauri.
- Capa de aplicación: pipeline de metadata y reglas de negocio.
- Capa de integración: providers externos y utilidades de archivo.
- Capa de persistencia: escritura de tags sobre archivos locales.

La idea central es que el backend sea la fuente de verdad y que el frontend solo consuma resultados, sin implementar lógica de matching ni de enriquecimiento.

## Diagrama conceptual

```text
Cliente / Frontend
    │
    ▼
FastAPI (futuro)
    │
    ▼
Pipeline de metadata
    ├─ Extractor
    ├─ Matcher
    ├─ Lyrics
    ├─ Writer
    └─ Providers
```

## Responsabilidades por módulo

### 1. Extractor

Responsable de leer los metadatos actuales del archivo local.

- Usa mutagen para detectar el formato.
- Extrae título, artista, álbum y duración.
- Sirve como entrada para el matching.

### 2. Matcher

Responsable de coordinar la búsqueda entre providers y calcular la confianza.

- Ejecuta las búsquedas de forma concurrente.
- Calcula una puntuación ponderada con RapidFuzz.
- Ordena candidatos por relevancia.
- Puede completar campos faltantes usando los resultados obtenidos en la misma búsqueda.

### 3. Providers

Cada provider implementa una interfaz común.

- Debe devolver candidatos con un formato uniforme.
- No debe depender de otros providers.
- No debe conocer la lógica del matching ni del flujo completo.

### 4. Lyrics

Responsable de buscar letras para el candidato elegido.

- Usa syncedlyrics.
- Opera de forma asíncrona para no bloquear el event loop.

### 5. Writer

Responsable de escribir la metadata final en el archivo.

- Soporta MP3, M4A/AAC y FLAC.
- Escribe tags estándar y, cuando aplica, portada y letras.
- Recibe un diccionario simple con los campos finales que deben persistirse.

## Modelo de datos principal

### FileInfo

Representa la información que se extrae del archivo local y se usa para comparar con los candidatos externos.

Campos principales:

- title
- artist
- album
- duration_ms

### MatchCandidate

Representa un candidato devuelto por un provider.

Campos principales:

- source
- source_id
- title
- artist
- album
- album_artist
- year
- genre
- track_number
- disc_number
- isrc
- composer
- duration_ms
- cover_url
- confidence

### FinalMetadata

Representa la metadata final que se va a escribir en el archivo.

Incluye campos como:

- title
- artist
- album
- album_artist
- year
- genre
- track_number
- disc_number
- isrc
- composer
- publisher
- cover_url
- lyrics

## Flujo de ejecución

1. Se lee el archivo desde disco.
2. Se construye un objeto FileInfo.
3. Se lanzan búsquedas sobre los providers disponibles.
4. Se calculan confianzas y se ordenan los candidatos.
5. Se selecciona el mejor candidato o se permite una elección manual.
6. Se completan campos faltantes con información ya disponible.
7. Se obtiene la letra asociada.
8. Se escribe la metadata al archivo.

## Principios de diseño

- Mantener los providers aislados y reemplazables.
- Evitar dependencias entre proveedores.
- Loggear errores y fallos de red en lugar de fallar en silencio.
- Usar tipado y estructuras de datos claras.
- Mantener el backend independiente de cualquier frontend.
- Preferir un diseño incremental y no reescribir módulos ya funcionales.

## Extensiones futuras

Las siguientes piezas encajan naturalmente en esta arquitectura:

- downloader.py: obtención de metadatos y videoId desde YouTube/YouTube Music.
- api.py: exposición del pipeline vía HTTP.
- rate limiter global: para controlar acceso a APIs externas.
- frontend Tauri: capa de interacción para elegir candidatos y revisar resultados.
- watcher: detección automática de archivos nuevos en una carpeta.

## Resumen ejecutivo

Esta arquitectura está pensada para que el backend sea simple, testeable y reutilizable. El flujo actual ya demuestra que el núcleo funciona: extraer metadata, buscar en múltiples fuentes, combinar resultados y escribir la información en el archivo de audio.
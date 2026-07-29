# metadata.md

## Objetivo

Crear la página Metadata para escribir o editar metadatos de archivos existentes utilizando el backend.

---

## Debe implementar

src/features/metadata/

- types.ts
- hooks.ts
- MetadataPage.tsx
- MetadataForm.tsx
- FilePicker.tsx
- CoverPicker.tsx
- index.ts

---

## Flujo

Usuario

↓

Selecciona archivo de audio

↓

(opcional) selecciona portada

↓

Edita

- title
- artist
- album
- album_artist
- genre
- year
- track
- disc
- lyrics

↓

POST /api/pipeline/write

↓

Mostrar éxito o error

---

## Reglas

- Todo acceso HTTP mediante src/api/.
- Usar TanStack Query.
- Sin lógica de negocio.
- Validación mínima.
- Mostrar ApiError.message.
- Componentes pequeños.
- Accesible.
- Responsive.

---

## No implementar

- Batch editing.
- Drag & drop.
- Historial.
- Autocompletar.
- Búsqueda online.
- Extracción automática.
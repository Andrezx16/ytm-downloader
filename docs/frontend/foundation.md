# Frontend Foundation

Establishes frontend architecture: tooling, structure, routing, providers, theming, shared infrastructure. No application business logic. All future frontend modules depend on it.

## Stack
React 19, TypeScript, Vite, Tailwind CSS v4, React Router, TanStack Query, Zod, shadcn/ui, Lucide React. No additional UI frameworks.

## Structure
```text
frontend/
├── public/
├── src/
│   ├── api/
│   ├── assets/
│   ├── components/ (common/, layout/, ui/)
│   ├── hooks/
│   ├── lib/
│   ├── pages/
│   ├── providers/
│   ├── router/
│   ├── styles/
│   ├── types/
│   ├── utils/
│   ├── App.tsx
│   └── main.tsx
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Entry
- `main.tsx` — mount React, register providers, load global styles, mount router
- `App.tsx` — render layout + routes. No business logic.

## Providers
```text
AppProviders → ThemeProvider, QueryClientProvider, RouterProvider
```
Centralize in `providers/`.

## Routing
`/` → Home, Search, Playlist, Downloads, Metadata, Settings. Pages may be placeholders initially.

## Layout
`components/layout/` — Layout, Sidebar, Header, Content. Presentation only.

## UI
Use shadcn/ui: Button, Card, Dialog, Input, Select, Table, Tabs, Progress, Badge. Avoid custom implementations.

## Icons
Lucide React only.

## Styling
Tailwind CSS v4 + CSS variables. No inline styles. Shared styles in `styles/`.

## Theme
Light/Dark/System. Persist preference. Logic in `providers/`.

## API
Structure only (no endpoint implementations):
```text
api/ → client.ts, search.ts, download.ts, playlist.ts, pipeline.ts, jobs.ts
```

## Hooks
Reusable only: `useTheme`, `useDebounce`, `useLocalStorage`. No feature hooks.

## Types
Shared TypeScript types only. Don't duplicate backend models.

## State
Server state: TanStack Query. Component state: local. No Redux.

## Notifications
Global toast provider only.

## Error Handling
Global Error Boundary.

## Accessibility
Keyboard navigation, semantic HTML, accessible labels, focus preservation.

## Performance
Lazy routes, minimal global state, avoid unnecessary renders.

## Compatibility
Foundation must not depend on backend internals. Communication only through API modules.

## Principles
Modular, typed, accessible, reusable, lightweight, scalable.

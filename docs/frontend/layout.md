# Frontend Layout

Defines the application's persistent UI. No feature or backend logic.

## Responsibilities

- App shell
- Navigation
- Responsive layout
- Active route
- Page container

Never:
- perform API calls
- contain business logic
- manage feature state

## Structure

```text
src/components/layout/
├── AppLayout.tsx
├── Sidebar.tsx
├── Header.tsx
├── Navigation.tsx
├── Page.tsx
└── index.ts
```

## Layout

```text
AppLayout
├── Sidebar
├── Header
└── <Outlet/>
```

All pages render inside `<Outlet/>`.

## Sidebar

Contains primary navigation.

Sections:

- Search
- Downloads
- Playlist
- Metadata
- Settings

Highlight active route.

Support collapse on small screens.

## Header

Contains:

- page title
- theme toggle

No feature controls.

## Navigation

Owns navigation items only.

Each item contains:

- label
- icon
- route

No routing logic outside React Router.

## Page

Shared page container.

Provides:

- spacing
- max width
- responsive padding

No business logic.

## Responsive

Desktop:

```text
Sidebar | Content
```

Mobile:

```text
Header
Content
Bottom/Drawer Navigation
```

Navigation must remain accessible.

## Accessibility

- semantic landmarks
- keyboard navigation
- visible focus
- aria-current for active route

## Compatibility

Depends only on Foundation.

No API imports.

## Principles

Presentational • Reusable • Responsive • Accessible
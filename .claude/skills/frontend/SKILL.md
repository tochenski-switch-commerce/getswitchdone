---
name: frontend
description: Frontend development for this Next.js / React / Supabase / Capacitor project. Use when working on UI components, styling, hooks, pages, or mobile (iOS) concerns.
---

# Frontend Skill — Lumio (gsd-boards)

## Stack
- **Next.js 15** (App Router, Turbopack)
- **React 19**
- **Supabase** (auth, database, realtime)
- **Capacitor 8** (iOS native wrapper)
- **TypeScript 5**
- No CSS framework — custom styles (see `kanban-styles.ts`)

## Project structure
- `src/app/` — Next.js App Router pages and API routes
- `src/components/` — React components (flat + `board-detail/` subfolder)
- `src/hooks/` — Custom React hooks (e.g. `useProjectBoard`, `useTemplates`)
- `src/types/` — Shared TypeScript types (`board-types.ts`)

## Conventions
- Components are functional with TypeScript interfaces for props.
- Styles are co-located in `kanban-styles.ts` using inline style objects — no CSS modules or Tailwind.
- Supabase calls live in hooks, not directly in components.
- API routes are in `src/app/api/` using Next.js Route Handlers.
- Mobile-specific concerns (safe areas, FAB, bottom sheets) are handled with Capacitor platform detection.
- Brand color: Lumio orange (`#FF6B35` or similar — check existing components for the exact value).

## When helping with frontend tasks
1. Read the relevant component/hook before suggesting changes.
2. Follow existing style patterns (inline style objects, not className-based CSS).
3. Keep Capacitor/iOS compatibility in mind for any interactive UI.
4. Supabase realtime subscriptions are used for live board updates — don't break subscription cleanup.

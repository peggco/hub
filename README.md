# Pegg Skill Hub

A fast, static skill directory for the Pegg ecosystem. Browse the full Skills
API, search by name or source, copy a one-line install command, and open a
detail page with the source repository README.

Built with [Astro](https://astro.build) and deployed on Cloudflare Pages. No
server, no database, no auth: the browser talks directly to the public Skills
API at `https://hub-api.pegg.dev/v1`.

## Features

- Dark and light themes with a persisted toggle
- Live search, official/community filters, and cursor pagination
- Copyable install command on every card
- Detail pages at `/skills/<source>/<skill>` with metadata, install command,
  and the source repository README
- Repository README rendering with Markdown sanitization
- Responsive layout, keyboard shortcut (`/`) for search, reduced-motion support
- Animated 3D ASCII infinity backdrop, ported from the Pegg frontend

## Stack

- Astro 5 (static output)
- pnpm 11 (`pnpm-lock.yaml`)
- `marked` for README rendering
- `dompurify` for sanitizing rendered Markdown
- Plain CSS with design tokens (no CSS framework)

## Getting started

Requires Node 20+ and pnpm 11+.

```bash
pnpm install
pnpm dev
```

The site runs at `http://localhost:4321`.

```bash
pnpm build     # production build to dist/
pnpm preview   # preview the production build
pnpm check     # Astro + TypeScript checks
```

### API configuration

The default API base is hardcoded to the public API. To point the site at a
different deployment, create a `.env` file:

```bash
cp .env.example .env
```

```env
PUBLIC_API_BASE=https://hub-api.pegg.dev/v1
```

`PUBLIC_API_BASE` must include the `/v1` prefix.

## Install command

Every skill uses this format:

```bash
pegg skills add <source>/<skill-id>
```

For example:

```bash
pegg skills add vercel-labs/skills/find-skills
```

The same command is shown on each card and on the detail page, with a copy
button.

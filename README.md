# Stadium Idaho

Lot Studio (3D lot + builder homes) lives at `/studio`.

**Live preview (always up after each push):**  
https://amyporter25.github.io/stadiumidaho/studio?lot=46/3

First time only: GitHub repo **Settings → Pages → Source → GitHub Actions**, then re-run the Preview workflow. Details: [docs/preview.md](docs/preview.md)

# Video Hotel Fullstack Template


A fullstack landing page for a luxury seaside hotel named **LUNAMARE**. Full-viewport video hero, a rooms & residences gallery with per-room detail pages, a services section on a second video, and a split shader / booking-form finale. Fullstack-wired reservation flow, Kimi auth, and a relational database.

## Features

- Full-viewport video hero with left-aligned headline, subtitle, and CTAs; transparent nav overlays the video until scroll
- Rooms & Residences gallery with 6 16:9 cards driven by a scroll-reactive canvas glitch effect
- Per-room detail pages (`/room/:id`) rendered from `src/data/rooms.ts` with a sticky price & booking panel
- Services section on a second video with a bullet grid of eight offerings
- Bottom split section: a GLSL rainbow shader on the left (three.js) and an inquiry form on the right
- Reservation requests (inquiry form + "Reserve This Room") persist to MySQL via tRPC
- Kimi OAuth sign-in; reservations associate with the signed-in user when available

## Tech Stack

- React 19 + TypeScript + Vite
- Tailwind CSS v3 + shadcn/ui
- GSAP + ScrollTrigger for parallax and fade-ins
- three.js for the bottom-section shader
- tRPC 11 + Hono + Drizzle ORM + MySQL
- Kimi OAuth 2.0
- React Router v7

## Quick Start

1. Clone / extract this template
2. Install dependencies: `npm install`
3. Place the two background videos in `public/videos/` (see **Required Assets** below)
4. Copy `.env.example` to `.env` and fill in `DATABASE_URL` and Kimi OAuth credentials
5. Run database migrations: `npx drizzle-kit push`
6. Run the dev server: `npm run dev`
7. Build for production: `npm run build`

## Configuration

This template does not use `src/config.ts`. Display content lives inline in sections and in `src/data/rooms.ts`; only reservation writes are persisted. Edit the following to re-skin for a different hotel:

- **`src/sections/Spatial.tsx`** — top hero: eyebrow, big title, subtitle, `Reserve Your Stay` / `Explore Rooms →` CTAs. Background: `/videos/sea-hotel.mp4`
- **`src/sections/Header.tsx`** — brand wordmark (`LUNAMARE`) and nav (`Rooms`, `Experiences`, `Contact`)
- **`src/sections/Philosophy.tsx`** — large quote and three uppercase tags
- **`src/sections/Works.tsx`** — heading `Rooms & Residences` and eyebrow `Featured Stays`; cards rendered from `src/data/rooms.ts`
- **`src/sections/Capabilities.tsx`** — services heading `Hotel Services`, intro paragraph, 8-item bullet grid. Background: `/videos/spatial.mp4`
- **`src/sections/Hero.tsx`** — bottom split section: left heading, form heading, and inquiry form (writes to `reservation_requests` via tRPC)
- **`src/sections/Footer.tsx`** — three office columns and contact block
- **`src/sections/Preloader.tsx`** — intro splash with the brand wordmark
- **`src/pages/RoomDetail.tsx`** — per-room page; "Reserve This Room" button writes to `reservation_requests` via tRPC
- **`src/data/rooms.ts`** — **source of truth for all six rooms** (id, title, client, img, tagline, description, features, price, priceNote, sqm, occupancy, bed)
- **`index.html`** — `<title>`
- **`api/reservation-router.ts`** — tRPC router that persists submissions

See `info.md` (outer folder) for layout character limits per field.

## Database Schema

Two tables, defined in `db/schema.ts`:

- **`users`** — Kimi OAuth-managed (id, unionId, name, email, avatar, role)
- **`reservation_requests`** — guest booking + inquiry submissions (id, userId nullable, checkInDate, checkOutDate, guests, roomType, roomId nullable, fullName, email, message, status enum, createdAt)

Room content lives on the frontend in `src/data/rooms.ts` — do not duplicate it into the database.

## Required Assets

### Videos (place in `public/videos/`)

- `/videos/sea-hotel.mp4` — full-viewport top hero. Recommended: ~10s loop, 1920×1080, coastal / seascape / luxury architecture
- `/videos/spatial.mp4` — services section background. Recommended: ~10s loop, 1920×1080, dark architectural interior

Either can be omitted — the section falls back to plain `#0b0b0b`.

### Images

Room photos come from Unsplash URLs declared in `src/data/rooms.ts`. No local images required. To use curated files, drop them in `public/images/` and edit each `room.img`.

## Project Structure

```
.
├── api/                # tRPC routers: auth, reservation. Hono server. Kimi OAuth
├── contracts/          # Shared tRPC types
├── db/                 # Drizzle schema, migrations, seed
├── public/
│   ├── images/
│   └── videos/         # sea-hotel.mp4, spatial.mp4
├── src/
│   ├── sections/       # Header, Spatial, Philosophy, Works, Capabilities, Hero, Footer, Preloader
│   ├── pages/          # RoomDetail, Login, NotFound
│   ├── data/           # rooms.ts (source of truth for rooms)
│   ├── hooks/
│   ├── providers/
│   └── App.tsx
├── Dockerfile
├── drizzle.config.ts
├── .backend-features.json  # Declares ["auth", "db"]
└── .env.example
```

## Design

- Alternating backgrounds: `#0b0b0b` (hero / services / bottom split) and `#ffffff` / `#f4f4f5` (Philosophy / Works)
- Top hero uses a vertical 0.55 → 0.25 → 0.55 black gradient; services uses a flat 60% black overlay
- Fonts: system sans-serif stack, Helvetica Neue display
- Motion: GSAP ScrollTrigger parallax, canvas glitch on the Works cards (tied to scroll speed), a rotating SVG orbital badge in the services header, a GLSL rainbow shader in the bottom section

## Notes

- **Do not duplicate `src/data/rooms.ts` into the database** — it is the single source of truth for displayed rooms; only reservation writes are persisted
- The inquiry form and each room's "Reserve This Room" button are the only frontend controls wired to the backend; header nav items are in-page scroll anchors
- The signature canvas glitch effect in `Works.tsx` reacts to scroll speed — keep it; it is the repo's identity interaction
- Do not remove `api/kimi/` — it handles OAuth

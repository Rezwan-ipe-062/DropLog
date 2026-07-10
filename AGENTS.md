# DropLog - Agents Instructions

## Project Overview
DropLog is a route delivery tracking system with 3 portals:
- **SO App** (`so-app/index.html` + `so-app/js/` + `so-app/css/`) — Mobile-first PWA for supply officers
- **Admin Panel** (`admin/` directory) — Desktop management dashboard
- **Distributor Portal** (`portal.html` + `portal/js/` + `portal/css/`) — Distributor-facing dashboard

## Tech Stack
- Vanilla HTML/CSS/JS (no frameworks)
- Supabase (PostgreSQL + REST API)
- Service Worker for offline support (SO App only)
- SheetJS/XLSX for Excel export (Admin only)

## Code Conventions
- No comments in code
- Consistent 2-space/4-space indentation (follow existing pattern per file)
- Always escape output with `escapeHtml()` (strings) and `escFilter()` (filters)
- Use `WAREHOUSE_MAP` for warehouse name-to-ID resolution
- All new features must be well-tested and backward-compatible
- CSS variable naming: `--kebab-case`

## Security Rules
- All user-supplied data must be HTML-escaped before rendering
- SQL queries must use Supabase parameterized queries (never string interpolation)
- PINs: SHA-256 hashed with salt `droplog_salt_v1`
- All data operations scoped by `warehouse_id`
- Never expose internal IDs to users

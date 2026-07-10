# Session Log 002 — Feature Builds: Auto-Refresh, Error Isolation, GPS, WhatsApp Infra

**Date:** 2026-07-10

## Summary

Completed all remaining issues from session-001 (5 items). Built WhatsApp notification infrastructure using Supabase Edge Functions + pg_net triggers (free tier). Fixed SO portal header alignment. Prepared customer confirmation tracking.

## Fixed Issues

### SO Header Layout Alignment (new)
- **File:** `so-app/css/so.css`, `so-app/index.html`
- **Problem:** Header elements wrapped to 2 rows on narrow screens (leaf icon + moon toggle stacked)
- **Fix:** Changed `.header-left` from `flex-shrink: 0` to `min-width: 0; flex: 1`; added `overflow: hidden; text-overflow: ellipsis; max-width: 180px` to `.so-badge`
- **Cache:** CSS bumped to `?v=4`
- **Commit:** `2bdc95b`

### Portal Auto-Refresh (M-06)
- **File:** `portal/js/portal.js`
- **Problem:** Distributors had to manually reload to see new routes
- **Fix:** Added `startAutoRefresh(bpId)` / `stopAutoRefresh()` / `pollRefresh()` — polls every 30s, updates stats/dispatch/exceptions/POD silently (no loading screen, no map re-render), shows toast when new data arrives
- **Integration:** `handleSearch()` starts polling; `showBpModal()` stops it
- **Commit:** `24ae896`

### Portal Error Isolation (M-05)
- **File:** `portal/js/portal.js`, `portal/index.html`, `portal/css/portal.css`
- **Problem:** One crashing section (e.g. map) blocked all other sections from rendering
- **Fix:** Each `render*()` call wrapped in individual try/catch with fallback UI; defense-in-depth try/catch inside `renderGlassCard`, `renderMap`, `renderPod`; added `productsByStop` null guard
- **Commit:** `0bcc179`

### SO Silent Query Errors (M5/M6)
- **Files:** `so-app/js/delivery.js`, `so-app/js/route.js`
- **Problem:** `delivery_events`, `routes.update`, `stop_products` queries had no error checks — silent failures
- **Fix:** Added `{ error: ... }` destructuring + error handlers on ALL Supabase calls:
  - `handleDelivered()`: events + routes errors now logged
  - `handlePartial()`: main `route_stops.update` checks error → toast + return; secondary queries log errors
  - `handleFailed()`: same pattern as partial
  - `handleStartRoute()`: stops query shows error toast; products query logs error
- **Commit:** `aa9a7db`

### SO GPS Debounce (M11)
- **File:** `so-app/js/gps.js`
- **Problem:** Fresh GPS acquisition on every action (8-15s timeout) — slow for rapid actions
- **Fix:** Added 60s cache (`lastGPSTime` + `GPS_DEBOUNCE_MS`). Returns cached position if < 60s old. Fresh acquisition only when cache is stale
- **Commit:** `c0fb976`

### Portal Support Section
- **Files:** `portal/index.html`, `portal/js/portal.js`, `portal/css/portal.css`
- **Problem:** "Coming soon" toast on Support nav click
- **Fix:** Added full support section with Phone, Email, Operating Hours, Warehouse name (dynamic from route data). Both `navigate()` and click handler updated to show section instead of toast. CSS added for support cards + dark mode support
- **Commit:** `e104116`

### Customer Confirmation Prep
- **Files:** `supabase/06_customer_confirmation.sql`, `admin/index.html`, `admin/js/contacts.js`, `admin/js/config.js`, `admin/js/dashboard.js`, `admin/css/admin.css`
- **Changes:**
  1. **SQL:** Added `customer_confirmed_at` + `customer_remark` columns to `route_stops`
  2. **Admin Contacts:** Added "Portal Link" column with `Open` link + `Copy` button; `copyToClipboard()` helper with clipboard API + fallback
  3. **Admin Route Detail:** Added "Confirmed" column in stops table — green "Yes" badge with tooltip when confirmed, gray "--" when not
- **Note:** Customer confirmation is informational, NOT a gate on delivery completion
- **Commit:** `dba7b24`

### WhatsApp Notification Infrastructure
- **Files:**
  - `supabase/functions/send-eta/index.ts` — Edge Function: route started → WhatsApp to all customers with tracking link
  - `supabase/functions/delivery-notify/index.ts` — Edge Function: stop delivered → WhatsApp asking for confirmation + `/reply` webhook for Meta callbacks
  - `supabase/functions/import_map.json` — Deno import map
  - `supabase/07_triggers_notifications.sql` — pg_net extension + DB triggers for both functions
  - `supabase/config.toml` — Supabase project config for Edge Function deployment
- **Architecture:**
  - `routes.status → 'in_transit'` → pg_net trigger → `send-eta` Edge Function → WhatsApp to each customer
  - `route_stops.status → 'delivered'` → pg_net trigger → `delivery-notify` Edge Function → WhatsApp asking for confirmation
  - Customer replies → Meta webhook → `/reply` handler → updates `customer_confirmed_at` + `customer_remark`
- **Free tier:** Edge Functions (500k/mo), pg_net (1M/mo), WhatsApp Cloud (1,000 conversations/mo)
- **Commit:** `90608c4`

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| **No QR codes** | Distributors ignore QR codes. n8n/WhatsApp pushes link directly |
| **Customer confirmation informational** | 90% won't reply. Delivery is always complete when SO marks it. Confirmation is for early dispute detection, not a gate |
| **WhatsApp Cloud API over whatsapp-web.js** | Personal WhatsApp automation risks bans, session expiry, no reply handling. Meta Business API is free for testing and reliable |
| **pg_net over Database Webhooks** | Webhooks require Pro plan ($25/mo). pg_net triggers + Edge Functions are free |

## Active / Blocked

### WhatsApp Meta Setup (pending — user will complete later)
1. Create Meta Business App at developers.facebook.com (App Type: Business)
2. Add WhatsApp product → copy Phone Number ID + Access Token
3. Set Supabase secrets: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`
4. Configure webhook URL → `https://afovfoaraolalebvookx.functions.supabase.co/delivery-notify`
5. Subscribe to `messages` webhook field
6. Run `07_triggers_notifications.sql` in SQL Editor

## Planned Next

1. **WhatsApp Meta setup** (user side — Meta account configuration)
2. **Deploy Edge Functions** — `supabase functions deploy send-eta delivery-notify`
3. **Run DB triggers migration** — enable pg_net + create triggers
4. **Test end-to-end flow** — start a route → verify WhatsApp sent → mark delivered → verify confirmation WhatsApp
5. **Admin reporting** — add customer confirmation filter/metrics to dashboard
6. **Portal per-section error isolation** — (already done in this session)
7. **SO auto-refresh** — route list refresh without manual reload

## Commits This Session
```
2bdc95b fix(so): header layout alignment - flex shrink + badge truncation
24ae896 feat(portal): auto-refresh routes every 30s
0bcc179 fix(portal): per-section error isolation - try/catch each render independently
aa9a7db fix(so): silent query errors - add error checks on all Supabase calls
c0fb976 fix(so): GPS debounce - cache location for 60s
e104116 feat(portal): support section with contact info + warehouse name
dba7b24 feat: customer confirmation prep - portal links + DB columns + admin badges
90608c4 feat: WhatsApp notification Edge Functions + pg_net triggers
```

## Files Modified / Created
```
so-app/css/so.css
so-app/index.html
so-app/js/delivery.js
so-app/js/route.js
so-app/js/gps.js
portal/index.html
portal/js/portal.js
portal/css/portal.css
admin/index.html
admin/js/contacts.js
admin/js/config.js
admin/js/dashboard.js
admin/css/admin.css
supabase/06_customer_confirmation.sql
supabase/07_triggers_notifications.sql
supabase/config.toml
supabase/functions/send-eta/index.ts
supabase/functions/delivery-notify/index.ts
supabase/functions/import_map.json
logs/session-002.md
```

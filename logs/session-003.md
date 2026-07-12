# Session Log 003 — Bug Fixes: Partial Delivery, GD Fulfillment, Completed Routes + Cost Distribution Features

**Date:** 2026-07-12

## Summary

Fixed 4 bugs and implemented 4 features across the SO app, Admin panel, and Supabase. All changes deployed to GitHub Pages.

## Bug Fixes

### Bug #1 — Partial Delivery Quantity Validation (new — was missing from initial plan)
- **File:** `so-app/js/delivery.js`
- **Problem:** SO could enter any number in Quantity Delivered field — no check against the stop's total order quantity
- **Fix:** Added `validatePartialQuantity(stop, partialQty)` function that sums `productsData[stop.id].quantity` and rejects entries exceeding the total. Called before confirm dialog in `handlePartial()`
- **Changed:** Lines 32-38 (new function), line 142 (validation call)

### Bug #2 — GD Partial Fulfillment
- **File:** `admin/js/route-builder.js`
- **Problem:** When a GD had multiple stops, all were consumed at once. Route builder couldn't cherry-pick individual stops
- **Fix:**
  1. `loadAvailableGDs()` loads stops with `.eq('status', 'available')` — only non-assigned stops shown (line 46)
  2. Route creation marks each stop individually as `'assigned'` in `parsed_stops` (lines 664-666)
  3. After marking stops, checks if any `available` stops remain for the GD; if none, marks the GD as `'assigned'` (lines 669-679)
- **Changed:** Lines 42-46, 664-679

### Bug #3 — Completed Routes Non-Interactive
- **Files:** `so-app/js/route.js`, `so-app/js/delivery.js`
- **Problem:** Completed routes were hidden from the SO route list; SOs could not view them, CSO edits were blocked
- **Fix (route.js):**
  - `loadMyRoutes()`: includes `'completed'` in status filter (line 21)
  - `handleRouteSelect()`: detects completed status → hides FAB + Save Order button, shows "view only" toast (lines 169-174)
  - `renderStopList()`: sets `isReadOnly` for completed routes — stop indicators non-clickable, drag handles hidden, SortableJS disabled (lines 388, 408-425)
  - `handleStartRoute()`: blocks completed routes with warning toast (lines 229-233)
- **Fix (delivery.js):**
  - `openDelivery()`: returns early with "read only" toast if route is completed (line 9)
- **Changed:** route.js lines 21, 29, 87, 110-188, 217-223, 367-430; delivery.js line 9

### Bug #4 — GD Selection (Select All)
- **File:** `admin/js/route-builder.js`
- **Fix:** Same as Bug #2 — GDs are now stop-level. Each stop has its own checkbox. `toggleAllStopsForGD()` only affects the clicked GD's stops; per-stop checks allow cherry-picking
- **Changed:** route-builder.js — per-stop checkbox rendering and toggle logic

## Features

### Feature 1 — Route Sales Value
- **Files:** `admin/js/route-builder.js`
- **What:** New "Route Sales Value (BDT)" input in the route creation form
- **Persistence:** Saved to `routes.sales_value` column (NUMERIC) on route creation
- **Changed:** route-builder.js — `renderRouteForm()` adds input field; `createRoute()` includes `sales_value` in insert payload

### Feature 2 — Carrying / Loading Costs (SO App)
- **Files:** `so-app/index.html`, `so-app/js/complete.js`
- **What:** Two new input fields on the route completion screen — "Carrying Cost (BDT)" and "Loading/Unloading Cost (BDT)"
- **Persistence:** `handleFinish()` reads these fields and saves to `routes.carrying_cost` and `routes.loading_unloading_cost` columns (NUMERIC)
- **Changed:** complete.js — `handleFinish()` reads + saves cost fields; index.html — added input fields to complete screen

### Feature 3 — Warehouse Per KM Cost (Admin Settings)
- **Files:** `admin/js/settings.js` (new), `admin/index.html`
- **What:** New Settings tab in admin sidebar with a "Per KM Cost (BDT)" field per warehouse
- **Persistence:** Loads/saves `warehouses.per_km_cost` column (NUMERIC)
- **JS:** `loadSettings()`, `saveWarehouseSettings()`, `Warehouse Settings` panel in `index.html`

### Feature 4 — Cost Distribution in Report (Admin)
- **File:** `admin/js/report.js`
- **What:** Cost Distribution section on Report Page 2 showing:
  - Driven KM × Per KM Cost
  - SO Travelling Expense
  - Carrying Cost
  - Loading/Unloading Cost
  - **Total Cost** (sum of all above)
  - **Route Sales Value**
  - **Cost Ratio %** (Total Cost / Sales Value × 100)
- **Changed:** report.js — loads `per_km_cost` from warehouse, calculates costs, renders cost section on Page 2

### Feature 5 — Admin Cost Editing
- **File:** `admin/js/dashboard.js`
- **What:** Completed route detail view shows editable cost fields (Sales Value, Carrying Cost, Loading Cost) with `saveRouteCosts()` function
- **Changed:** dashboard.js lines 389-402, 455-470

## SQL Migration

### `supabase/11_cost_distribution.sql` (new)
- Adds `status` column to `parsed_stops` (default `'available'`, CHECK constraint for `'available'`/`'assigned'`)
- Adds `carrying_cost`, `loading_unloading_cost`, `sales_value` to `routes`
- Adds `per_km_cost` to `warehouses`
- Fixes `vendor_settlements` FK constraint with `ON DELETE CASCADE` (drops old constraint, recreates with cascade)

## SQL Audit (post-migration)
- Ran comprehensive task agent audit across all 11 SQL migration files
- **Fixed 6 issues:**
  1. `01_tables.sql:409` — Added `ON DELETE CASCADE` to `vendor_settlements.route_id` FK
  2. `02_alter_indexes_rls.sql:46` — Added CHECK constraint to `notifications.channel`
  3. `03_seed_data.sql:32-35` — Changed `warehouses.name` from title-case to all-caps (matches `users.warehouse` convention)
  4. `04_reset_data.sql:41` — Fixed misleading comment
  5. `09_rename_capacity_mt.sql` — Wrapped in DO block with `information_schema.columns` check for idempotent re-runs
  6. `11_cost_distribution.sql:12` — Fixed comment wording

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| **Cost Ratio % over Net Profit** | User requested cost ratio (total cost / sales value × 100) instead of net profit. More useful metric for transport cost optimization |
| **Single partial qty field** | Products are shown but only one aggregate partial qty field. Per-product partials would require significant UI rework; current approach captures total delivered vs total ordered for validation |
| **Warehouse name all-caps** | JS `WAREHOUSE_MAP` already uses all-caps for filtering. Seed data now consistent — warehouse names match `users.warehouse` values |

## Commits This Session
```
0876a3c Bug fixes: partial delivery validation, GD partial fulfillment, completed routes guard, cost distribution features
```

## Files Modified / Created
```
M  admin/index.html
M  admin/js/config.js
M  admin/js/contacts.js
M  admin/js/dashboard.js
M  admin/js/fleet.js
M  admin/js/report.js
M  admin/js/route-builder.js
M  admin/js/users.js
M  admin/js/vendors.js
M  so-app/css/so.css
M  so-app/index.html
M  so-app/js/complete.js
M  so-app/js/config.js
M  so-app/js/delivery.js
M  so-app/js/route.js
M  so-app/js/sw.js
M  supabase/01_tables.sql
M  supabase/02_alter_indexes_rls.sql
M  supabase/03_seed_data.sql
M  supabase/04_reset_data.sql
M  supabase/09_rename_capacity_mt.sql
A  admin/js/settings.js
A  so-app/js/db.js
A  supabase/11_cost_distribution.sql
A  logs/session-003.md
```

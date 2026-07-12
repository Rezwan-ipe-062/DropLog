-- ============================================================================
-- DROPLOG — COST DISTRIBUTION & GD PARTIAL FULFILLMENT
-- Name this SQL tab:  "11 - Cost Distribution"
-- ============================================================================
-- WHAT THIS SCRIPT DOES:
--   1. Adds status column to parsed_stops for per-stop assignment tracking
--      (supports partial GD fulfillment in route builder)
--   2. Adds cost columns to routes (carrying_cost, loading_unloading_cost,
--      sales_value) for cost distribution reporting
--   3. Adds per_km_cost to warehouses for KM-based cost calculation
--
-- SAFETY: All ALTER statements use IF NOT EXISTS checks,
--   so running this multiple times is harmless.
-- ============================================================================

-- parsed_stops: per-stop status for partial GD fulfillment
ALTER TABLE parsed_stops
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'available'
  CHECK (status IN ('available', 'assigned'));

-- routes: cost tracking columns
ALTER TABLE routes
  ADD COLUMN IF NOT EXISTS carrying_cost NUMERIC DEFAULT 0;
ALTER TABLE routes
  ADD COLUMN IF NOT EXISTS loading_unloading_cost NUMERIC DEFAULT 0;
ALTER TABLE routes
  ADD COLUMN IF NOT EXISTS sales_value NUMERIC DEFAULT 0;

-- warehouses: per-km cost for cost distribution calculation
ALTER TABLE warehouses
  ADD COLUMN IF NOT EXISTS per_km_cost NUMERIC DEFAULT 0;

-- Fix: vendor_settlements FK missing ON DELETE CASCADE (blocks route deletion)
ALTER TABLE vendor_settlements
  DROP CONSTRAINT IF EXISTS vendor_settlements_route_id_fkey,
  ADD CONSTRAINT vendor_settlements_route_id_fkey
    FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE;

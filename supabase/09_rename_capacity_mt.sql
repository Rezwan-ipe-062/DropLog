-- ============================================================================
-- Migration 09: Rename fleet_vehicles.capacity_kg to capacity_mt
-- PURPOSE:  The admin now enters vehicle capacity directly in MT (metric
--           tonnes). Existing kg values are converted to MT by dividing by 1000.
-- ============================================================================

ALTER TABLE fleet_vehicles RENAME COLUMN capacity_kg TO capacity_mt;

UPDATE fleet_vehicles SET capacity_mt = capacity_mt / 1000 WHERE capacity_mt IS NOT NULL;

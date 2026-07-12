-- ============================================================================
-- Migration 09: Rename fleet_vehicles.capacity_kg to capacity_mt
-- PURPOSE:  The admin now enters vehicle capacity directly in MT (metric
--           tonnes). Existing kg values (>100) are converted to MT by dividing
--           by 1000. Uses a DO block with column-existence check so re-runs
--           are safe — already-renamed tables skip the ALTER entirely.
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'fleet_vehicles' AND column_name = 'capacity_kg'
    ) THEN
        ALTER TABLE fleet_vehicles RENAME COLUMN capacity_kg TO capacity_mt;
        UPDATE fleet_vehicles SET capacity_mt = capacity_mt / 1000
        WHERE capacity_mt IS NOT NULL AND capacity_mt > 100;
    END IF;
END;
$$;
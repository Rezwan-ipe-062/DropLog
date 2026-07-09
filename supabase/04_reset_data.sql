-- ============================================================================
-- DROPLOG — 04: RESET DATA (Wipe Transactional Data)
-- Name this SQL tab:  "04 - Reset Data"
-- ============================================================================
-- WHAT THIS SCRIPT DOES:
--   Deletes ALL transactional data while preserving table structure and
--   master data. Use this to start fresh without dropping and recreating
--   tables.
--
-- DELETED (transactional):
--   stop_products, route_stops, delivery_events, issues, notifications,
--   vendor_settlements, routes, parsed_products, parsed_stops,
--   available_gds, raw_deliveries, activity_log, fleet_vehicles
--
-- PRESERVED (master data):
--   users, contacts, warehouses, issue_types, vendors, route_templates
--
-- WHEN TO USE:
--   • Monthly cleanup at end of season
--   • Testing/reset before go-live
--   • Clearing erroneous test data
--   • Any time you want to start with empty transactional tables
--
-- DELETE ORDER MATTERS:
--   Records are deleted in dependency order (child tables first)
--   to avoid foreign key constraint violations.
--
-- VERIFICATION:
--   The final SELECT statement shows row counts for all deleted tables.
--   All should return 0 after running this script.
-- ============================================================================


-- ============================================================================
-- STEP 1: Delete route-related data (deepest children first)
-- ============================================================================
DELETE FROM stop_products;          -- Products within route stops
DELETE FROM route_stops;            -- Delivery stops (FK to routes)
DELETE FROM delivery_events;        -- Audit log entries (FK to routes)
DELETE FROM issues;                 -- Issue reports (FK to routes)
DELETE FROM notifications;          -- Notification log (FK to routes)
DELETE FROM vendor_settlements;     -- Settlement records (FK to routes)
DELETE FROM routes;                 -- Core route records


-- ============================================================================
-- STEP 2: Delete parsed SAP upload data
-- ============================================================================
DELETE FROM parsed_products;        -- Product lines within stops
DELETE FROM parsed_stops;           -- Stops within GDs
DELETE FROM available_gds;          -- Available Group Deliveries
DELETE FROM raw_deliveries;         -- Raw SAP export rows


-- ============================================================================
-- STEP 3: Delete other transactional data
-- ============================================================================
DELETE FROM activity_log;           -- System audit trail
DELETE FROM fleet_vehicles;         -- Vehicle registry (if no longer needed)


-- ============================================================================
-- STEP 4: VERIFICATION
-- PURPOSE:  Confirms all transactional tables are empty.
--           Returns a table showing table name and row count.
--           Every row should show 0 after a successful reset.
-- ============================================================================
SELECT 'stop_products' AS tbl, COUNT(*) AS cnt FROM stop_products
UNION ALL SELECT 'route_stops', COUNT(*) FROM route_stops
UNION ALL SELECT 'delivery_events', COUNT(*) FROM delivery_events
UNION ALL SELECT 'issues', COUNT(*) FROM issues
UNION ALL SELECT 'notifications', COUNT(*) FROM notifications
UNION ALL SELECT 'vendor_settlements', COUNT(*) FROM vendor_settlements
UNION ALL SELECT 'routes', COUNT(*) FROM routes
UNION ALL SELECT 'parsed_products', COUNT(*) FROM parsed_products
UNION ALL SELECT 'parsed_stops', COUNT(*) FROM parsed_stops
UNION ALL SELECT 'available_gds', COUNT(*) FROM available_gds
UNION ALL SELECT 'raw_deliveries', COUNT(*) FROM raw_deliveries
UNION ALL SELECT 'activity_log', COUNT(*) FROM activity_log
UNION ALL SELECT 'fleet_vehicles', COUNT(*) FROM fleet_vehicles
ORDER BY tbl;

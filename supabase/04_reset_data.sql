-- =====================================================
-- DROPLOG — 04: RESET DATA (Hard Cleanup)
-- Name this tab:  "04 - Reset Data"
-- =====================================================
-- WARNING: Deletes ALL transactional data while
-- preserving table structure and master data
-- (users, contacts, warehouses, issue_types).
-- Use this to start fresh without dropping tables.
-- =====================================================

-- 1. Delete route data (child tables first)
DELETE FROM stop_products;
DELETE FROM route_stops;
DELETE FROM delivery_events;
DELETE FROM issues;
DELETE FROM notifications;
DELETE FROM vendor_settlements;
DELETE FROM routes;

-- 2. Delete parsed SAP data
DELETE FROM parsed_products;
DELETE FROM parsed_stops;
DELETE FROM available_gds;
DELETE FROM raw_deliveries;

-- 3. Delete activity log
DELETE FROM activity_log;

-- 4. Fleet & vendor transactional data (keep master vendors)
DELETE FROM fleet_vehicles;

-- 5. Verify: Should return 0 for all transactional tables
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

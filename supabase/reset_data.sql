-- =====================================================
-- DROPLOG — HARD DATA RESET
-- Run this in Supabase SQL Editor
-- Name the tab: "DropLog - Reset Data"
-- =====================================================
-- WARNING: Deletes ALL transactional data while
-- preserving master data (users, contacts, issue_types).
-- Routes and their child records are deleted.
-- GDs, stops, and products are deleted.
-- =====================================================

-- 1. Delete transactional data (child tables first)
DELETE FROM stop_products;
DELETE FROM delivery_events;
DELETE FROM issues;
DELETE FROM notifications;
DELETE FROM vendor_settlements;
DELETE FROM route_stops;
DELETE FROM routes;

-- 2. Delete parsed SAP data
DELETE FROM parsed_products;
DELETE FROM parsed_stops;
DELETE FROM raw_deliveries;

-- 3. Reset available_gds
DELETE FROM available_gds;

-- 4. Reset sequences (if any)
-- Note: UUIDs don't have sequences, so this is just for cleanup

-- 5. Verify emptiness
SELECT 'routes' AS tbl, COUNT(*) AS cnt FROM routes
UNION ALL SELECT 'route_stops', COUNT(*) FROM route_stops
UNION ALL SELECT 'stop_products', COUNT(*) FROM stop_products
UNION ALL SELECT 'delivery_events', COUNT(*) FROM delivery_events
UNION ALL SELECT 'issues', COUNT(*) FROM issues
UNION ALL SELECT 'notifications', COUNT(*) FROM notifications
UNION ALL SELECT 'vendor_settlements', COUNT(*) FROM vendor_settlements
UNION ALL SELECT 'available_gds', COUNT(*) FROM available_gds
UNION ALL SELECT 'parsed_stops', COUNT(*) FROM parsed_stops
UNION ALL SELECT 'parsed_products', COUNT(*) FROM parsed_products
UNION ALL SELECT 'raw_deliveries', COUNT(*) FROM raw_deliveries
ORDER BY tbl;

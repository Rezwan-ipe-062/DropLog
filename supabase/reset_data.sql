-- ============================================================
-- DropLog — Hard Reset: Deletes ALL data, keeps table structure
-- ============================================================
-- Run this in Supabase SQL Editor after test runs to get a
-- clean slate for production deployment.
-- Run all sections in order (FK dependencies respected).

-- 1. Transactional data (routes, deliveries, issues, notifications)
DELETE FROM stop_products;
DELETE FROM route_stops;
DELETE FROM delivery_events;
DELETE FROM issues;
DELETE FROM notifications;
DELETE FROM routes;

-- 2. Parsed SAP data
DELETE FROM parsed_products;
DELETE FROM parsed_stops;
DELETE FROM available_gds;
DELETE FROM raw_deliveries;

-- 3. Activity log
DELETE FROM activity_log;

-- 4. Optional: Master data (uncomment if you want to clear these too)
-- DELETE FROM fleet_vehicles;
-- DELETE FROM vendors;
-- DELETE FROM route_templates;
-- DELETE FROM contacts;
-- DELETE FROM users WHERE role = 'so';

-- 5. Seed data reset (uncomment to re-seed after clearing)
-- INSERT INTO warehouses (code, name, location) VALUES
--     ('CTG', 'Chittagong', 'Chittagong'),
--     ('GAZ', 'Gazipur', 'Gazipur'),
--     ('JSR', 'Jessore', 'Jessore'),
--     ('BGR', 'Bogra', 'Bogra')
-- ON CONFLICT (code) DO NOTHING;
--
-- INSERT INTO issue_types (type_name, icon) VALUES
--     ('Vehicle Breakdown', '🔧'),
--     ('Road Blocked / Flooded', '🚧'),
--     ('Accident', '🚨'),
--     ('Customer Dispute', '⚖'),
--     ('Product Damage in Transit', '📦'),
--     ('Loading Error / Shortage', '📋'),
--     ('Customer Not Available', '🚪'),
--     ('Security / Theft', '🔒'),
--     ('Driver / Staff Issue', '👤'),
--     ('Other', '❓')
-- ON CONFLICT (type_name) DO NOTHING;

-- 6. Verify: Should return 0 for all
SELECT 'stop_products' AS tbl, COUNT(*) FROM stop_products
UNION ALL SELECT 'route_stops', COUNT(*) FROM route_stops
UNION ALL SELECT 'delivery_events', COUNT(*) FROM delivery_events
UNION ALL SELECT 'issues', COUNT(*) FROM issues
UNION ALL SELECT 'notifications', COUNT(*) FROM notifications
UNION ALL SELECT 'routes', COUNT(*) FROM routes
UNION ALL SELECT 'parsed_products', COUNT(*) FROM parsed_products
UNION ALL SELECT 'parsed_stops', COUNT(*) FROM parsed_stops
UNION ALL SELECT 'available_gds', COUNT(*) FROM available_gds
UNION ALL SELECT 'activity_log', COUNT(*) FROM activity_log;

-- ============================================================================
-- DROPLOG — 03: SEED DATA (Master Data Insert)
-- Name this SQL tab:  "03 - Seed Data"
-- ============================================================================
-- WHAT THIS SCRIPT DOES:
--   Populates all master/reference data needed for the system to function:
--     1. WAREHOUSES — 4 warehouses (CTG/GAZ/JSR/BGR)
--     2. ISSUE TYPES — 10 predefined issue categories for SO app
--     3. ADMIN USERS — 5 admin accounts (one per warehouse + legacy)
--
-- HOW TO USE:
--   Run this AFTER "01 - Tables" and "02 - Alter, Indexes & RLS".
--   Run ONLY ONCE when setting up a fresh Supabase project.
--
-- SAFETY: All INSERT statements use ON CONFLICT DO NOTHING,
--   so running this multiple times will NOT create duplicate records.
-- ============================================================================


-- ============================================================================
-- 1. WAREHOUSES
-- PURPOSE:  Defines the 4 operating warehouses. The code column (CTG/GAZ/etc)
--           is used as a foreign key by fleet_vehicles, vendors, and
--           route_tables. The admin panel uses ?wh=CODE URL parameter
--           to switch between warehouses.
--
-- NOTE:     Spelling:
--           JSR = Jessore (also spelled Jashore in some datasets)
--           BGR = Bogra  (also spelled Bogura in some datasets)
-- ============================================================================
INSERT INTO warehouses (code, name, location) VALUES
    ('CTG', 'Chittagong', 'Chittagong'),
    ('GAZ', 'Gazipur',    'Gazipur'),
    ('JSR', 'Jessore',    'Jessore'),
    ('BGR', 'Bogra',      'Bogra')
ON CONFLICT (code) DO NOTHING;


-- ============================================================================
-- 2. ISSUE TYPES
-- PURPOSE:  Predefined list of issue categories used by the SO mobile app's
--           issue reporting screen (dropdown selection). Also used as master
--           reference in the admin panel's settings section.
--
-- Icon column stores emoji characters for visual display in the app.
-- ============================================================================
INSERT INTO issue_types (type_name, icon) VALUES
    ('Vehicle Breakdown',          '🔧'),
    ('Road Blocked / Flooded',     '🚧'),
    ('Accident',                   '🚨'),
    ('Customer Dispute',           '⚖'),
    ('Product Damage in Transit',  '📦'),
    ('Loading Error / Shortage',   '📋'),
    ('Customer Not Available',     '🚪'),
    ('Security / Theft',           '🔒'),
    ('Driver / Staff Issue',       '👤'),
    ('Other',                      '❓')
ON CONFLICT (type_name) DO NOTHING;


-- ============================================================================
-- 3. ADMIN USERS
-- PURPOSE:  Login accounts for admin panel access.
--
-- ACCESS BY WAREHOUSE:
--   Use the ?wh= URL parameter to select a warehouse, then log in with the
--   matching admin credentials. The auth.js code validates that the user's
--   warehouse matches the ?wh= parameter.
--
-- ADMIN-01 is the legacy account (backward compatible).
-- PINs are all 4-digit numeric strings.
-- ============================================================================
INSERT INTO users (user_id, name, pin, role, warehouse) VALUES
    ('ADMIN-01',  'CSO Admin',  '0000', 'admin', 'CHITTAGONG'),
    ('ADMIN-CTG', 'CTG Admin',  '0001', 'admin', 'CHITTAGONG'),
    ('ADMIN-GAZ', 'GAZ Admin',  '0002', 'admin', 'GAZIPUR'),
    ('ADMIN-JSR', 'JSR Admin',  '0003', 'admin', 'JASHORE'),
    ('ADMIN-BGR', 'BGR Admin',  '0004', 'admin', 'BOGURA')
ON CONFLICT (user_id) DO NOTHING;

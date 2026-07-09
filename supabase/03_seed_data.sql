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
-- NOTE: PINs are SHA-256 hashes (not plaintext).
-- Plain equivalents: 0000, 0001, 0002, 0003, 0004
INSERT INTO users (user_id, name, pin, role, warehouse) VALUES
    ('ADMIN-01',  'CSO Admin',  '3ff50b28d046067d598730a0ac3f9f38b4d03710ce330f199fd9f43bc0ae43bf', 'admin', 'CHITTAGONG'),
    ('ADMIN-CTG', 'CTG Admin',  '276af56a3cb21a3c19c569141151882cb395e1d34cd130e64df286635670effa', 'admin', 'CHITTAGONG'),
    ('ADMIN-GAZ', 'GAZ Admin',  'ba1a4ae480d59ad3d5dfc91361390a37650bcb5d1045d95ea34fad5d26712f3c', 'admin', 'GAZIPUR'),
    ('ADMIN-JSR', 'JSR Admin',  'a05f3804e977702e6ce7c943e0e1c4009c51b2a4a0febc2218379e24a63f4174', 'admin', 'JASHORE'),
    ('ADMIN-BGR', 'BGR Admin',  'f2324234378b4b9ec2670a278a25c2122844076c0024fea25bfca568aa4b344e', 'admin', 'BOGURA')
ON CONFLICT (user_id) DO NOTHING;

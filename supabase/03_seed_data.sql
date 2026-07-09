-- =====================================================
-- DROPLOG — 03: SEED DATA
-- Name this tab:  "03 - Seed Data"
-- =====================================================
-- Inserts all master/reference data.
-- Safe to re-run (all use ON CONFLICT DO NOTHING).
-- =====================================================

-- 1. WAREHOUSES
INSERT INTO warehouses (code, name, location) VALUES
    ('CTG', 'Chittagong', 'Chittagong'),
    ('GAZ', 'Gazipur',    'Gazipur'),
    ('JSR', 'Jessore',    'Jessore'),
    ('BGR', 'Bogra',      'Bogra')
ON CONFLICT (code) DO NOTHING;

-- 2. ISSUE TYPES (for SO app dropdown)
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

-- 3. ADMIN USERS (one per warehouse + legacy)
INSERT INTO users (user_id, name, pin, role, warehouse) VALUES
    ('ADMIN-01',  'CSO Admin',  '0000', 'admin', 'CHITTAGONG'),
    ('ADMIN-CTG', 'CTG Admin',  '0001', 'admin', 'CHITTAGONG'),
    ('ADMIN-GAZ', 'GAZ Admin',  '0002', 'admin', 'GAZIPUR'),
    ('ADMIN-JSR', 'JSR Admin',  '0003', 'admin', 'JASHORE'),
    ('ADMIN-BGR', 'BGR Admin',  '0004', 'admin', 'BOGURA')
ON CONFLICT (user_id) DO NOTHING;

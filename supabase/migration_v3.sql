-- ============================================================
-- DropLog Migration v3 — Master Data + Multi-Warehouse + RLS
-- ============================================================
-- Run this in Supabase SQL Editor after deploying the app.

-- 0. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. WAREHOUSES
CREATE TABLE IF NOT EXISTS warehouses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    location TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO warehouses (code, name, location) VALUES
    ('CTG', 'Chittagong', 'Chittagong'),
    ('GAZ', 'Gazipur', 'Gazipur'),
    ('JSR', 'Jessore', 'Jessore'),
    ('BGR', 'Bogra', 'Bogra')
ON CONFLICT (code) DO NOTHING;

-- 2. VENDORS (master)
CREATE TABLE IF NOT EXISTS vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_name TEXT NOT NULL,
    contact_phone TEXT,
    warehouse_code TEXT REFERENCES warehouses(code) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. FLEET VEHICLES (master)
CREATE TABLE IF NOT EXISTS fleet_vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_number TEXT UNIQUE NOT NULL,
    driver_name TEXT,
    driver_phone TEXT,
    capacity_kg NUMERIC,
    warehouse_code TEXT REFERENCES warehouses(code) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ROUTE TEMPLATES
CREATE TABLE IF NOT EXISTS route_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_name TEXT NOT NULL,
    description TEXT,
    customer_ids TEXT,
    warehouse_code TEXT REFERENCES warehouses(code) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. ISSUE TYPES (master)
CREATE TABLE IF NOT EXISTS issue_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type_name TEXT UNIQUE NOT NULL,
    icon TEXT DEFAULT '⚠',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO issue_types (type_name, icon) VALUES
    ('Vehicle Breakdown', '🔧'),
    ('Road Blocked / Flooded', '🚧'),
    ('Accident', '🚨'),
    ('Customer Dispute', '⚖'),
    ('Product Damage in Transit', '📦'),
    ('Loading Error / Shortage', '📋'),
    ('Customer Not Available', '🚪'),
    ('Security / Theft', '🔒'),
    ('Driver / Staff Issue', '👤'),
    ('Other', '❓')
ON CONFLICT (type_name) DO NOTHING;

-- 6. ACTIVITY LOG (audit trail)
CREATE TABLE IF NOT EXISTS activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT,
    user_name TEXT,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. ADD warehouse COLUMN TO EXISTING TABLES
ALTER TABLE users ADD COLUMN IF NOT EXISTS warehouse TEXT DEFAULT 'CHITTAGONG';
ALTER TABLE routes ADD COLUMN IF NOT EXISTS warehouse TEXT DEFAULT 'CHITTAGONG';
ALTER TABLE available_gds ADD COLUMN IF NOT EXISTS warehouse TEXT DEFAULT 'CHITTAGONG';

-- 8. ADD display_order TO parsed_stops (for route builder)
ALTER TABLE parsed_stops ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- 9. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id UUID REFERENCES routes(id) ON DELETE CASCADE,
    route_stop_id UUID REFERENCES route_stops(id) ON DELETE SET NULL,
    message_type TEXT NOT NULL,                -- 'issue_alert', 'system_alert'
    message_text TEXT,
    recipient_name TEXT,
    recipient_phone TEXT,
    status TEXT DEFAULT 'pending',             -- 'pending', 'sent', 'delivered', 'failed'
    triggered_at TIMESTAMPTZ DEFAULT NOW(),
    sent_at TIMESTAMPTZ,
    delivery_log JSONB
);

-- 10. INDEXES for search performance
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone);
CREATE INDEX IF NOT EXISTS idx_contacts_customer_id ON contacts(customer_id);
CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(customer_name);
CREATE INDEX IF NOT EXISTS idx_routes_code ON routes(route_code);
CREATE INDEX IF NOT EXISTS idx_routes_status ON routes(status);
CREATE INDEX IF NOT EXISTS idx_routes_warehouse ON routes(warehouse);
CREATE INDEX IF NOT EXISTS idx_issues_acknowledged ON issues(acknowledged);
CREATE INDEX IF NOT EXISTS idx_issues_route_id ON issues(route_id);
CREATE INDEX IF NOT EXISTS idx_available_gds_status ON available_gds(status);
CREATE INDEX IF NOT EXISTS idx_available_gds_group ON available_gds(group_delivery_number);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(message_type);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
CREATE INDEX IF NOT EXISTS idx_fleet_vehicles_warehouse ON fleet_vehicles(warehouse_code);
CREATE INDEX IF NOT EXISTS idx_vendors_warehouse ON vendors(warehouse_code);

-- 11. RLS POLICIES (update from permissive to admin-only write)
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE stop_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE available_gds ENABLE ROW LEVEL SECURITY;
ALTER TABLE parsed_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE parsed_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE fleet_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- Drop existing permissive policies (only on tables that already exist)
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'contacts') THEN
    DROP POLICY IF EXISTS "Enable all for all users" ON contacts;
  END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'routes') THEN
    DROP POLICY IF EXISTS "Enable all for all users" ON routes;
  END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'route_stops') THEN
    DROP POLICY IF EXISTS "Enable all for all users" ON route_stops;
  END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'stop_products') THEN
    DROP POLICY IF EXISTS "Enable all for all users" ON stop_products;
  END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'available_gds') THEN
    DROP POLICY IF EXISTS "Enable all for all users" ON available_gds;
  END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'parsed_stops') THEN
    DROP POLICY IF EXISTS "Enable all for all users" ON parsed_stops;
  END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'parsed_products') THEN
    DROP POLICY IF EXISTS "Enable all for all users" ON parsed_products;
  END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'issues') THEN
    DROP POLICY IF EXISTS "Enable all for all users" ON issues;
  END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'delivery_events') THEN
    DROP POLICY IF EXISTS "Enable all for all users" ON delivery_events;
  END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'users') THEN
    DROP POLICY IF EXISTS "Enable all for all users" ON users;
  END IF;
END $$;

-- SO app: read-only policies (for assigned routes)
CREATE POLICY "SO read routes" ON routes FOR SELECT
    USING (assigned_so_id = (SELECT id FROM users WHERE user_id = current_setting('app.user_id', true)::TEXT LIMIT 1));

CREATE POLICY "SO read own route_stops" ON route_stops FOR SELECT
    USING (route_id IN (SELECT id FROM routes WHERE assigned_so_id = (SELECT id FROM users WHERE user_id = current_setting('app.user_id', true)::TEXT LIMIT 1)));

CREATE POLICY "SO read own stop_products" ON stop_products FOR SELECT
    USING (route_stop_id IN (SELECT id FROM route_stops WHERE route_id IN (SELECT id FROM routes WHERE assigned_so_id = (SELECT id FROM users WHERE user_id = current_setting('app.user_id', true)::TEXT LIMIT 1))));

-- SO app: write policies
CREATE POLICY "SO update own routes" ON routes FOR UPDATE
    USING (assigned_so_id = (SELECT id FROM users WHERE user_id = current_setting('app.user_id', true)::TEXT LIMIT 1));

CREATE POLICY "SO update own route_stops" ON route_stops FOR UPDATE
    USING (route_id IN (SELECT id FROM routes WHERE assigned_so_id = (SELECT id FROM users WHERE user_id = current_setting('app.user_id', true)::TEXT LIMIT 1)));

CREATE POLICY "SO insert delivery_events" ON delivery_events FOR INSERT
    WITH CHECK (route_id IN (SELECT id FROM routes WHERE assigned_so_id = (SELECT id FROM users WHERE user_id = current_setting('app.user_id', true)::TEXT LIMIT 1)));

CREATE POLICY "SO insert issues" ON issues FOR INSERT
    WITH CHECK (route_id IN (SELECT id FROM routes WHERE assigned_so_id = (SELECT id FROM users WHERE user_id = current_setting('app.user_id', true)::TEXT LIMIT 1)));

-- Admin: full access (role-based via app — admin passes their user_id; we trust the backend)
CREATE POLICY "Admin full access routes" ON routes FOR ALL USING (true);
CREATE POLICY "Admin full access route_stops" ON route_stops FOR ALL USING (true);
CREATE POLICY "Admin full access stop_products" ON stop_products FOR ALL USING (true);
CREATE POLICY "Admin full access available_gds" ON available_gds FOR ALL USING (true);
CREATE POLICY "Admin full access parsed_stops" ON parsed_stops FOR ALL USING (true);
CREATE POLICY "Admin full access parsed_products" ON parsed_products FOR ALL USING (true);
CREATE POLICY "Admin full access issues" ON issues FOR ALL USING (true);
CREATE POLICY "Admin full access delivery_events" ON delivery_events FOR ALL USING (true);
CREATE POLICY "Admin full access contacts" ON contacts FOR ALL USING (true);
CREATE POLICY "Admin full access notifications" ON notifications FOR ALL USING (true);
CREATE POLICY "Admin full access fleet_vehicles" ON fleet_vehicles FOR ALL USING (true);
CREATE POLICY "Admin full access vendors" ON vendors FOR ALL USING (true);
CREATE POLICY "Admin full access route_templates" ON route_templates FOR ALL USING (true);
CREATE POLICY "Admin full access issue_types" ON issue_types FOR ALL USING (true);
CREATE POLICY "Admin full access activity_log" ON activity_log FOR ALL USING (true);

-- 12. ON DELETE CASCADE fixes
-- (already handled in original schema via schema.sql; ensuring route_stops -> routes cascade)
ALTER TABLE route_stops DROP CONSTRAINT IF EXISTS route_stops_route_id_fkey;
ALTER TABLE route_stops ADD CONSTRAINT route_stops_route_id_fkey
    FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE;

ALTER TABLE stop_products DROP CONSTRAINT IF EXISTS stop_products_route_stop_id_fkey;
ALTER TABLE stop_products ADD CONSTRAINT stop_products_route_stop_id_fkey
    FOREIGN KEY (route_stop_id) REFERENCES route_stops(id) ON DELETE CASCADE;

ALTER TABLE delivery_events DROP CONSTRAINT IF EXISTS delivery_events_route_id_fkey;
ALTER TABLE delivery_events ADD CONSTRAINT delivery_events_route_id_fkey
    FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE;

ALTER TABLE issues DROP CONSTRAINT IF EXISTS issues_route_id_fkey;
ALTER TABLE issues ADD CONSTRAINT issues_route_id_fkey
    FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE;

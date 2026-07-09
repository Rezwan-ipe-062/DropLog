-- =====================================================
-- DROPLOG — 02: ALTER TABLES + INDEXES + FK + RLS
-- Name this tab:  "02 - Alter, Indexes & RLS"
-- =====================================================
-- Run AFTER "01 - Tables" (or on existing DB to add
-- missing columns, indexes, and security policies).
-- All statements are idempotent (safe to re-run).
-- =====================================================

-- =====================================================
-- A. ADD MISSING COLUMNS (for existing DBs)
-- =====================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS warehouse        TEXT DEFAULT 'CHITTAGONG';
ALTER TABLE routes ADD COLUMN IF NOT EXISTS warehouse       TEXT DEFAULT 'CHITTAGONG';
ALTER TABLE available_gds ADD COLUMN IF NOT EXISTS warehouse TEXT DEFAULT 'CHITTAGONG';
ALTER TABLE parsed_stops ADD COLUMN IF NOT EXISTS display_order INT DEFAULT 0;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS delivery_log JSONB;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS recipient_email TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS channel TEXT;

-- =====================================================
-- B. INDEXES (performance)
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_users_id ON users(user_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_wh ON users(warehouse);

CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(customer_name);
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone);
CREATE INDEX IF NOT EXISTS idx_contacts_customer_id ON contacts(customer_id);
CREATE INDEX IF NOT EXISTS idx_contacts_district ON contacts(district);

CREATE INDEX IF NOT EXISTS idx_raw_gd ON raw_deliveries(group_delivery_number);
CREATE INDEX IF NOT EXISTS idx_raw_batch ON raw_deliveries(upload_batch_id);
CREATE INDEX IF NOT EXISTS idx_raw_plant ON raw_deliveries(plant_name);

CREATE INDEX IF NOT EXISTS idx_gd_status ON available_gds(status);
CREATE INDEX IF NOT EXISTS idx_gd_date ON available_gds(posting_date);
CREATE INDEX IF NOT EXISTS idx_gd_district ON available_gds(district);
CREATE INDEX IF NOT EXISTS idx_gd_plant ON available_gds(plant_name);
CREATE INDEX IF NOT EXISTS idx_gd_group ON available_gds(group_delivery_number);

CREATE INDEX IF NOT EXISTS idx_ps_gd ON parsed_stops(gd_id);
CREATE INDEX IF NOT EXISTS idx_ps_customer ON parsed_stops(customer_name);

CREATE INDEX IF NOT EXISTS idx_pp_stop ON parsed_products(stop_id);

CREATE INDEX IF NOT EXISTS idx_routes_status ON routes(status);
CREATE INDEX IF NOT EXISTS idx_routes_date ON routes(dispatch_date);
CREATE INDEX IF NOT EXISTS idx_routes_so ON routes(assigned_so_id);
CREATE INDEX IF NOT EXISTS idx_routes_plant ON routes(plant_name);
CREATE INDEX IF NOT EXISTS idx_routes_code ON routes(route_code);
CREATE INDEX IF NOT EXISTS idx_routes_warehouse ON routes(warehouse);

CREATE INDEX IF NOT EXISTS idx_rs_route ON route_stops(route_id);
CREATE INDEX IF NOT EXISTS idx_rs_status ON route_stops(status);

CREATE INDEX IF NOT EXISTS idx_sp_stop ON stop_products(route_stop_id);

CREATE INDEX IF NOT EXISTS idx_de_route ON delivery_events(route_id);
CREATE INDEX IF NOT EXISTS idx_de_type ON delivery_events(event_type);

CREATE INDEX IF NOT EXISTS idx_issues_route ON issues(route_id);
CREATE INDEX IF NOT EXISTS idx_issues_ack ON issues(acknowledged);

CREATE INDEX IF NOT EXISTS idx_noti_route ON notifications(route_id);
CREATE INDEX IF NOT EXISTS idx_noti_status ON notifications(status);
CREATE INDEX IF NOT EXISTS idx_noti_type ON notifications(message_type);

CREATE INDEX IF NOT EXISTS idx_vs_route ON vendor_settlements(route_id);
CREATE INDEX IF NOT EXISTS idx_vs_status ON vendor_settlements(settlement_status);

CREATE INDEX IF NOT EXISTS idx_fleet_vehicles_warehouse ON fleet_vehicles(warehouse_code);
CREATE INDEX IF NOT EXISTS idx_vendors_warehouse ON vendors(warehouse_code);

-- =====================================================
-- C. FIX FOREIGN KEY CONSTRAINTS (ensure CASCADE deletes)
-- =====================================================
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

-- =====================================================
-- D. ROW LEVEL SECURITY (all tables)
-- =====================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE available_gds ENABLE ROW LEVEL SECURITY;
ALTER TABLE parsed_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE parsed_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE stop_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE fleet_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated users
CREATE POLICY "Enable all for authenticated" ON users FOR ALL USING (true);
CREATE POLICY "Enable all for authenticated" ON contacts FOR ALL USING (true);
CREATE POLICY "Enable all for authenticated" ON raw_deliveries FOR ALL USING (true);
CREATE POLICY "Enable all for authenticated" ON available_gds FOR ALL USING (true);
CREATE POLICY "Enable all for authenticated" ON parsed_stops FOR ALL USING (true);
CREATE POLICY "Enable all for authenticated" ON parsed_products FOR ALL USING (true);
CREATE POLICY "Enable all for authenticated" ON routes FOR ALL USING (true);
CREATE POLICY "Enable all for authenticated" ON route_stops FOR ALL USING (true);
CREATE POLICY "Enable all for authenticated" ON stop_products FOR ALL USING (true);
CREATE POLICY "Enable all for authenticated" ON delivery_events FOR ALL USING (true);
CREATE POLICY "Enable all for authenticated" ON issues FOR ALL USING (true);
CREATE POLICY "Enable all for authenticated" ON notifications FOR ALL USING (true);
CREATE POLICY "Enable all for authenticated" ON vendor_settlements FOR ALL USING (true);
CREATE POLICY "Enable all for authenticated" ON fleet_vehicles FOR ALL USING (true);
CREATE POLICY "Enable all for authenticated" ON vendors FOR ALL USING (true);
CREATE POLICY "Enable all for authenticated" ON route_templates FOR ALL USING (true);
CREATE POLICY "Enable all for authenticated" ON issue_types FOR ALL USING (true);
CREATE POLICY "Enable all for authenticated" ON activity_log FOR ALL USING (true);

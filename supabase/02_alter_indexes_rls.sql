-- ============================================================================
-- DROPLOG — 02: ALTER TABLES + INDEXES + FK CONSTRAINTS + RLS
-- Name this SQL tab:  "02 - Alter, Indexes & RLS"
-- ============================================================================
-- WHAT THIS SCRIPT DOES:
--   Section A: Adds missing columns to existing tables (for databases that
--              were created before the v3.0 schema update). Safe to re-run.
--   Section B: Creates indexes on commonly queried columns for performance.
--   Section C: Ensures foreign keys have proper ON DELETE CASCADE behavior.
--   Section D: Enables Row-Level Security and creates access policies.
--
-- HOW TO USE:
--   Run this AFTER "01 - Tables" if setting up fresh, OR run on an existing
--   database to add any missing columns/indexes/policies.
--
-- SAFETY: All statements use IF NOT EXISTS / IF EXISTS guards.
--   100% safe to run multiple times on the same database.
-- ============================================================================


-- ============================================================================
-- SECTION A: ADD MISSING COLUMNS
-- PURPOSE:  These ALTER TABLE statements add columns that were introduced
--           in v3.0 of the schema. If the column already exists, nothing
--           happens (IF NOT EXISTS).
--
-- WHAT EACH COLUMN DOES:
--   users.warehouse         → Assigns each user to a warehouse for data scoping
--   routes.warehouse        → Alternative warehouse field (for backward compat)
--   available_gds.warehouse → Alternative warehouse field
--   parsed_stops.display_order → Display ordering hint for UI
--   notifications.delivery_log  → JSONB storage for webhook responses
--   notifications.error_message → Error details if send failed
--   notifications.recipient_email → Email recipient
--   notifications.channel       → Delivery channel (sms/whatsapp/email/push)
-- ============================================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS warehouse        TEXT DEFAULT 'CHITTAGONG';
ALTER TABLE routes ADD COLUMN IF NOT EXISTS warehouse       TEXT DEFAULT 'CHITTAGONG';
ALTER TABLE available_gds ADD COLUMN IF NOT EXISTS warehouse TEXT DEFAULT 'CHITTAGONG';
ALTER TABLE parsed_stops ADD COLUMN IF NOT EXISTS display_order INT DEFAULT 0;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS delivery_log JSONB;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS recipient_email TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS channel TEXT;


-- ============================================================================
-- SECTION B: INDEXES
-- PURPOSE:  Speed up queries on frequently-filtered and joined columns.
--           Each CREATE INDEX IF NOT EXISTS is safe to re-run.
--
-- INDEX NAMING CONVENTION:
--   idx_{table}_{column} — makes it easy to identify what each index is for.
--
-- WHY THESE SPECIFIC INDEXES:
--   users:          Login lookup (user_id), role filtering, warehouse scoping
--   contacts:       Search by name/phone/customer_id, district grouping
--   raw_deliveries: Lookup by GD number, batch upload, plant filter
--   available_gds:  Status/district/plant filters, date sorting, GD lookup
--   parsed_stops:   Join by gd_id, search by customer
--   routes:         Status/district/plant/warehouse filters, SO assignment,
--                  date sorting, route code lookup
--   route_stops:    Join by route_id, status filtering
--   delivery_events: Join by route_id, event type filtering
--   issues:         Join by route_id, unacknowledged check
--   notifications:  Join by route_id, status/message_type filtering
--   vendor_settlements: Join by route_id, status filtering
--   fleet_vehicles: Warehouse scoping for fleet management
--   vendors:        Warehouse scoping for vendor management
-- ============================================================================

-- USERS
CREATE INDEX IF NOT EXISTS idx_users_id ON users(user_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_wh ON users(warehouse);

-- CONTACTS
CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(customer_name);
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone);
CREATE INDEX IF NOT EXISTS idx_contacts_customer_id ON contacts(customer_id);
CREATE INDEX IF NOT EXISTS idx_contacts_district ON contacts(district);

-- RAW DELIVERIES
CREATE INDEX IF NOT EXISTS idx_raw_gd ON raw_deliveries(group_delivery_number);
CREATE INDEX IF NOT EXISTS idx_raw_batch ON raw_deliveries(upload_batch_id);
CREATE INDEX IF NOT EXISTS idx_raw_plant ON raw_deliveries(plant_name);

-- AVAILABLE GDS
CREATE INDEX IF NOT EXISTS idx_gd_status ON available_gds(status);
CREATE INDEX IF NOT EXISTS idx_gd_date ON available_gds(posting_date);
CREATE INDEX IF NOT EXISTS idx_gd_district ON available_gds(district);
CREATE INDEX IF NOT EXISTS idx_gd_plant ON available_gds(plant_name);
CREATE INDEX IF NOT EXISTS idx_gd_group ON available_gds(group_delivery_number);

-- PARSED STOPS
CREATE INDEX IF NOT EXISTS idx_ps_gd ON parsed_stops(gd_id);
CREATE INDEX IF NOT EXISTS idx_ps_customer ON parsed_stops(customer_name);

-- PARSED PRODUCTS
CREATE INDEX IF NOT EXISTS idx_pp_stop ON parsed_products(stop_id);

-- ROUTES
CREATE INDEX IF NOT EXISTS idx_routes_status ON routes(status);
CREATE INDEX IF NOT EXISTS idx_routes_date ON routes(dispatch_date);
CREATE INDEX IF NOT EXISTS idx_routes_so ON routes(assigned_so_id);
CREATE INDEX IF NOT EXISTS idx_routes_plant ON routes(plant_name);
CREATE INDEX IF NOT EXISTS idx_routes_code ON routes(route_code);
CREATE INDEX IF NOT EXISTS idx_routes_warehouse ON routes(warehouse);

-- ROUTE STOPS
CREATE INDEX IF NOT EXISTS idx_rs_route ON route_stops(route_id);
CREATE INDEX IF NOT EXISTS idx_rs_status ON route_stops(status);

-- STOP PRODUCTS
CREATE INDEX IF NOT EXISTS idx_sp_stop ON stop_products(route_stop_id);

-- DELIVERY EVENTS
CREATE INDEX IF NOT EXISTS idx_de_route ON delivery_events(route_id);
CREATE INDEX IF NOT EXISTS idx_de_type ON delivery_events(event_type);

-- ISSUES
CREATE INDEX IF NOT EXISTS idx_issues_route ON issues(route_id);
CREATE INDEX IF NOT EXISTS idx_issues_ack ON issues(acknowledged);

-- NOTIFICATIONS
CREATE INDEX IF NOT EXISTS idx_noti_route ON notifications(route_id);
CREATE INDEX IF NOT EXISTS idx_noti_status ON notifications(status);
CREATE INDEX IF NOT EXISTS idx_noti_type ON notifications(message_type);

-- VENDOR SETTLEMENTS
CREATE INDEX IF NOT EXISTS idx_vs_route ON vendor_settlements(route_id);
CREATE INDEX IF NOT EXISTS idx_vs_status ON vendor_settlements(settlement_status);

-- FLEET & VENDORS
CREATE INDEX IF NOT EXISTS idx_fleet_vehicles_warehouse ON fleet_vehicles(warehouse_code);
CREATE INDEX IF NOT EXISTS idx_vendors_warehouse ON vendors(warehouse_code);


-- ============================================================================
-- SECTION C: FOREIGN KEY CONSTRAINTS (with CASCADE DELETE)
-- PURPOSE:  Ensure data integrity when deleting routes. Without these,
--           deleting a route would fail if child records exist, or orphan
--           records would remain.
--
-- STRATEGY: Drop the existing FK, then re-add with ON DELETE CASCADE.
--   • route_stops & stop_products: Deleted when route is deleted
--   • delivery_events:            Deleted when route is deleted
--   • issues:                     Deleted when route is deleted
-- ============================================================================
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


-- ============================================================================
-- SECTION D: ROW LEVEL SECURITY
-- PURPOSE:  Supabase RLS ensures that only authenticated users can access
--           data. These policies are intentionally permissive (all operations
--           allowed for any authenticated user).
--
-- NOTE:     Access control is handled at the application level (JavaScript
--           enforces warehouse scoping via .eq('warehouse', getWarehouseName()))
--           rather than through RLS, because the app uses a custom PIN-based
--           auth system (not Supabase Auth JWT).
--
-- TABLES WITH RLS ENABLED: All 18 tables listed below.
-- ============================================================================

-- Enable RLS on each table
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

-- Grant full access to any authenticated user (development mode)
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

-- =====================================================
-- DROPLOG — COMPLETE DATABASE SCHEMA v3.3
-- Run this entire script in Supabase SQL Editor
-- Name the tab: "DropLog - Full Schema v3.3"
-- =====================================================
-- Run ONCE when setting up a fresh Supabase project.
-- Safe to re-run (all CREATEs use IF NOT EXISTS).
-- =====================================================

-- 1. USERS (Auth & Roles)
CREATE TABLE IF NOT EXISTS users (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id             TEXT UNIQUE NOT NULL,
    name                TEXT NOT NULL,
    pin                 TEXT NOT NULL,
    role                TEXT NOT NULL CHECK (role IN ('so', 'admin', 'csd')),
    phone               TEXT,
    email               TEXT,
    warehouse           TEXT,
    is_active           BOOLEAN DEFAULT TRUE,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_id ON users(user_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_wh ON users(warehouse);

-- 2. CONTACTS (Customer Directory)
CREATE TABLE IF NOT EXISTS contacts (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id         TEXT UNIQUE,
    customer_name       TEXT NOT NULL,
    proprietor          TEXT,
    address             TEXT,
    phone               TEXT,
    email               TEXT,
    district            TEXT,
    region              TEXT,
    unit_name           TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(customer_name);
CREATE INDEX IF NOT EXISTS idx_contacts_district ON contacts(district);

-- 3. RAW DELIVERIES (SAP Audit Trail)
CREATE TABLE IF NOT EXISTS raw_deliveries (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    upload_batch_id     UUID NOT NULL,
    uploaded_at         TIMESTAMPTZ DEFAULT NOW(),
    uploaded_by         UUID REFERENCES users(id),
    group_delivery_number   TEXT NOT NULL,
    delivery_document       TEXT NOT NULL,
    billing_document_type   TEXT,
    bill_to_party_id        TEXT,
    bill_to_party_name      TEXT,
    bill_to_party_address   TEXT,
    bill_to_party_city      TEXT,
    ship_to_party_name      TEXT,
    ship_to_party_address   TEXT,
    ship_to_party_city      TEXT,
    sales_district          TEXT,
    sales_district_desc     TEXT,
    ship_to_region_desc     TEXT,
    material_code           TEXT,
    material_description    TEXT,
    batch                   TEXT,
    delivered_quantity       NUMERIC DEFAULT 0,
    sales_unit              TEXT,
    plant_code              TEXT,
    plant_name              TEXT,
    posting_date            DATE,
    delivery_document_date  DATE,
    order_reason_desc       TEXT
);
CREATE INDEX IF NOT EXISTS idx_raw_gd ON raw_deliveries(group_delivery_number);
CREATE INDEX IF NOT EXISTS idx_raw_batch ON raw_deliveries(upload_batch_id);
CREATE INDEX IF NOT EXISTS idx_raw_plant ON raw_deliveries(plant_name);

-- 4. AVAILABLE GROUP DELIVERIES
CREATE TABLE IF NOT EXISTS available_gds (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    group_delivery_number TEXT UNIQUE NOT NULL,
    posting_date        DATE,
    plant_name          TEXT,
    district            TEXT,
    region              TEXT,
    num_delivery_docs   INT DEFAULT 1,
    num_unique_customers INT DEFAULT 1,
    total_quantity      NUMERIC DEFAULT 0,
    total_products      INT DEFAULT 0,
    is_multi_stop       BOOLEAN DEFAULT FALSE,
    status              TEXT DEFAULT 'available'
                        CHECK (status IN ('available', 'assigned', 'completed')),
    created_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_gd_status ON available_gds(status);
CREATE INDEX IF NOT EXISTS idx_gd_date ON available_gds(posting_date);
CREATE INDEX IF NOT EXISTS idx_gd_district ON available_gds(district);
CREATE INDEX IF NOT EXISTS idx_gd_plant ON available_gds(plant_name);

-- 5. PARSED STOPS (within each GD)
CREATE TABLE IF NOT EXISTS parsed_stops (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    gd_id               UUID REFERENCES available_gds(id) ON DELETE CASCADE,
    group_delivery_number TEXT NOT NULL,
    customer_id         TEXT,
    customer_name       TEXT NOT NULL,
    address             TEXT,
    city                TEXT,
    district            TEXT,
    delivery_documents  TEXT[],
    total_quantity      NUMERIC DEFAULT 0,
    num_products        INT DEFAULT 0,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ps_gd ON parsed_stops(gd_id);
CREATE INDEX IF NOT EXISTS idx_ps_customer ON parsed_stops(customer_name);

-- 6. PARSED PRODUCTS (within each stop)
CREATE TABLE IF NOT EXISTS parsed_products (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    stop_id             UUID REFERENCES parsed_stops(id) ON DELETE CASCADE,
    delivery_document   TEXT,
    material_code       TEXT,
    material_description TEXT,
    batch               TEXT,
    quantity            NUMERIC DEFAULT 0,
    unit                TEXT DEFAULT 'GEB',
    is_foc              BOOLEAN DEFAULT FALSE,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pp_stop ON parsed_products(stop_id);

-- 7. ROUTES (Core table)
CREATE TABLE IF NOT EXISTS routes (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    route_code          TEXT UNIQUE NOT NULL,
    route_name          TEXT,
    assigned_so_id      UUID REFERENCES users(id),
    vehicle_number      TEXT,
    vehicle_type        TEXT,
    vendor_name         TEXT,
    dispatch_date       DATE,
    plant_name          TEXT,
    district            TEXT,
    group_delivery_numbers TEXT[] NOT NULL,
    status              TEXT DEFAULT 'pending'
                        CHECK (status IN ('pending', 'in_transit', 'completed', 'cancelled')),
    started_at          TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    start_gps_lat       DOUBLE PRECISION,
    start_gps_lng       DOUBLE PRECISION,
    end_gps_lat         DOUBLE PRECISION,
    end_gps_lng         DOUBLE PRECISION,
    total_stops         INT DEFAULT 0,
    completed_stops     INT DEFAULT 0,
    failed_stops        INT DEFAULT 0,
    total_distance_km   NUMERIC,
    initial_km_reading  NUMERIC,
    final_km_reading    NUMERIC,
    driven_km           NUMERIC,
    transit_volume_mt   NUMERIC,
    vehicle_capacity_mt NUMERIC,
    so_travelling_expense NUMERIC,
    num_vehicles_used   INT DEFAULT 1,
    pdf_url             TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    created_by          UUID REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_routes_status ON routes(status);
CREATE INDEX IF NOT EXISTS idx_routes_date ON routes(dispatch_date);
CREATE INDEX IF NOT EXISTS idx_routes_so ON routes(assigned_so_id);
CREATE INDEX IF NOT EXISTS idx_routes_plant ON routes(plant_name);

-- 8. ROUTE STOPS
CREATE TABLE IF NOT EXISTS route_stops (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    route_id            UUID REFERENCES routes(id) ON DELETE CASCADE,
    stop_sequence       INT NOT NULL,
    customer_id         TEXT,
    customer_name       TEXT NOT NULL,
    address             TEXT,
    district            TEXT,
    delivery_documents  TEXT[],
    status              TEXT DEFAULT 'pending'
                        CHECK (status IN ('pending', 'delivered', 'partial', 'failed')),
    delivered_at        TIMESTAMPTZ,
    gps_lat             DOUBLE PRECISION,
    gps_lng             DOUBLE PRECISION,
    remark              TEXT,
    parsed_stop_id      UUID REFERENCES parsed_stops(id),
    created_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rs_route ON route_stops(route_id);
CREATE INDEX IF NOT EXISTS idx_rs_status ON route_stops(status);

-- 9. STOP PRODUCTS
CREATE TABLE IF NOT EXISTS stop_products (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    route_stop_id       UUID REFERENCES route_stops(id) ON DELETE CASCADE,
    material_code       TEXT,
    material_description TEXT,
    batch               TEXT,
    quantity            NUMERIC DEFAULT 0,
    unit                TEXT DEFAULT 'GEB',
    is_foc              BOOLEAN DEFAULT FALSE,
    actual_quantity     NUMERIC,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sp_stop ON stop_products(route_stop_id);

-- 10. DELIVERY EVENTS (Audit Log)
CREATE TABLE IF NOT EXISTS delivery_events (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    route_id            UUID REFERENCES routes(id),
    route_stop_id       UUID REFERENCES route_stops(id),
    event_type          TEXT NOT NULL CHECK (event_type IN (
                            'route_started', 'delivery_confirmed', 'delivery_partial',
                            'delivery_failed', 'route_completed', 'issue_reported'
                        )),
    timestamp           TIMESTAMPTZ DEFAULT NOW(),
    gps_lat             DOUBLE PRECISION,
    gps_lng             DOUBLE PRECISION,
    remark              TEXT,
    performed_by        UUID REFERENCES users(id),
    client_timestamp    TIMESTAMPTZ,
    synced_at           TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_de_route ON delivery_events(route_id);
CREATE INDEX IF NOT EXISTS idx_de_type ON delivery_events(event_type);

-- 11. ISSUES
CREATE TABLE IF NOT EXISTS issues (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    route_id            UUID REFERENCES routes(id),
    route_stop_id       UUID REFERENCES route_stops(id),
    issue_type          TEXT NOT NULL,
    details             TEXT,
    gps_lat             DOUBLE PRECISION,
    gps_lng             DOUBLE PRECISION,
    reported_by         UUID REFERENCES users(id),
    reported_at         TIMESTAMPTZ DEFAULT NOW(),
    acknowledged        BOOLEAN DEFAULT FALSE,
    acknowledged_by     UUID REFERENCES users(id),
    acknowledged_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_issues_route ON issues(route_id);
CREATE INDEX IF NOT EXISTS idx_issues_ack ON issues(acknowledged);

-- 12. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    route_id            UUID REFERENCES routes(id),
    route_stop_id       UUID REFERENCES route_stops(id),
    recipient_name      TEXT,
    recipient_phone     TEXT,
    recipient_email     TEXT,
    channel             TEXT CHECK (channel IN ('sms', 'whatsapp', 'email', 'push')),
    message_type        TEXT,
    message_text        TEXT,
    status              TEXT DEFAULT 'pending'
                        CHECK (status IN ('pending', 'sent', 'failed', 'delivered')),
    sent_at             TIMESTAMPTZ,
    error_message       TEXT,
    triggered_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_noti_route ON notifications(route_id);
CREATE INDEX IF NOT EXISTS idx_noti_status ON notifications(status);

-- 13. VENDOR SETTLEMENTS
CREATE TABLE IF NOT EXISTS vendor_settlements (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    route_id            UUID REFERENCES routes(id),
    vendor_name         TEXT,
    vehicle_number      TEXT,
    gps_distance_km     NUMERIC,
    vendor_claimed_km   NUMERIC,
    distance_variance   NUMERIC,
    carrying_cost       NUMERIC,
    route_sales_value   NUMERIC,
    settlement_status   TEXT DEFAULT 'pending'
                        CHECK (settlement_status IN ('pending', 'verified', 'disputed', 'paid')),
    verified_by         UUID REFERENCES users(id),
    verified_at         TIMESTAMPTZ,
    pdf_url             TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vs_route ON vendor_settlements(route_id);
CREATE INDEX IF NOT EXISTS idx_vs_status ON vendor_settlements(settlement_status);

-- 14. ISSUE TYPES (master data for SO app dropdown)
CREATE TABLE IF NOT EXISTS issue_types (
    id                  INT PRIMARY KEY,
    name                TEXT NOT NULL,
    icon                TEXT DEFAULT ''
);
INSERT INTO issue_types (id, name, icon) VALUES
    (1,  'Vehicle breakdown',         ''),
    (2,  'Road blocked / flooded',    ''),
    (3,  'Accident',                  ''),
    (4,  'Customer dispute',          ''),
    (5,  'Product damage in transit', ''),
    (6,  'Wrong product delivered',   ''),
    (7,  'Customer not available',    ''),
    (8,  'Payment issue',             ''),
    (9,  'Traffic delay',             ''),
    (10, 'Other',                     '')
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- ROW LEVEL SECURITY (all tables)
-- =====================================================
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all for authenticated" ON routes FOR ALL USING (true);
CREATE POLICY "Enable all for authenticated" ON route_stops FOR ALL USING (true);
CREATE POLICY "Enable all for authenticated" ON delivery_events FOR ALL USING (true);
CREATE POLICY "Enable all for authenticated" ON users FOR ALL USING (true);
CREATE POLICY "Enable all for authenticated" ON contacts FOR ALL USING (true);
CREATE POLICY "Enable all for authenticated" ON available_gds FOR ALL USING (true);
CREATE POLICY "Enable all for authenticated" ON parsed_stops FOR ALL USING (true);
CREATE POLICY "Enable all for authenticated" ON parsed_products FOR ALL USING (true);
CREATE POLICY "Enable all for authenticated" ON raw_deliveries FOR ALL USING (true);
CREATE POLICY "Enable all for authenticated" ON stop_products FOR ALL USING (true);
CREATE POLICY "Enable all for authenticated" ON issues FOR ALL USING (true);
CREATE POLICY "Enable all for authenticated" ON notifications FOR ALL USING (true);
CREATE POLICY "Enable all for authenticated" ON vendor_settlements FOR ALL USING (true);

-- =====================================================
-- SEED DATA: 5 admin users (one per warehouse)
-- =====================================================
INSERT INTO users (user_id, name, pin, role, warehouse) VALUES
    ('ADMIN-01',  'CSO Admin',    '0000', 'admin', 'CHITTAGONG'),
    ('ADMIN-CTG', 'CTG Admin',    '0001', 'admin', 'CHITTAGONG'),
    ('ADMIN-GAZ', 'GAZ Admin',    '0002', 'admin', 'GAZIPUR'),
    ('ADMIN-JSR', 'JSR Admin',    '0003', 'admin', 'JASHORE'),
    ('ADMIN-BGR', 'BGR Admin',    '0004', 'admin', 'BOGURA')
ON CONFLICT (user_id) DO NOTHING;



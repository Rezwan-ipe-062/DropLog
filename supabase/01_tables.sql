-- =====================================================
-- DROPLOG — 01: ALL TABLES (20 tables)
-- Name this tab:  "01 - Tables"
-- =====================================================
-- Run this FIRST when setting up a fresh Supabase project.
-- Safe to re-run (all use CREATE TABLE IF NOT EXISTS).
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
    warehouse           TEXT DEFAULT 'CHITTAGONG',
    is_active           BOOLEAN DEFAULT TRUE,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

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
    delivered_quantity      NUMERIC DEFAULT 0,
    sales_unit              TEXT,
    plant_code              TEXT,
    plant_name              TEXT,
    posting_date            DATE,
    delivery_document_date  DATE,
    order_reason_desc       TEXT
);

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
    display_order       INT DEFAULT 0,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

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

-- 10. DELIVERY EVENTS (Audit Log)
CREATE TABLE IF NOT EXISTS delivery_events (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    route_id            UUID REFERENCES routes(id) ON DELETE CASCADE,
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

-- 11. ISSUES
CREATE TABLE IF NOT EXISTS issues (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    route_id            UUID REFERENCES routes(id) ON DELETE CASCADE,
    route_stop_id       UUID REFERENCES route_stops(id) ON DELETE SET NULL,
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

-- 12. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    route_id            UUID REFERENCES routes(id) ON DELETE CASCADE,
    route_stop_id       UUID REFERENCES route_stops(id) ON DELETE SET NULL,
    message_type        TEXT NOT NULL,
    message_text        TEXT,
    recipient_name      TEXT,
    recipient_phone     TEXT,
    recipient_email     TEXT,
    channel             TEXT CHECK (channel IN ('sms', 'whatsapp', 'email', 'push')),
    status              TEXT DEFAULT 'pending'
                        CHECK (status IN ('pending', 'sent', 'failed', 'delivered')),
    triggered_at        TIMESTAMPTZ DEFAULT NOW(),
    sent_at             TIMESTAMPTZ,
    error_message       TEXT,
    delivery_log        JSONB
);

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

-- =====================================================
-- NEW TABLES (v3+)
-- =====================================================

-- 14. WAREHOUSES (master reference)
CREATE TABLE IF NOT EXISTS warehouses (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code                TEXT UNIQUE NOT NULL,
    name                TEXT NOT NULL,
    location            TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- 15. VENDORS (transport vendors)
CREATE TABLE IF NOT EXISTS vendors (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    vendor_name         TEXT NOT NULL,
    contact_phone       TEXT,
    warehouse_code      TEXT REFERENCES warehouses(code) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- 16. FLEET VEHICLES
CREATE TABLE IF NOT EXISTS fleet_vehicles (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    vehicle_number      TEXT UNIQUE NOT NULL,
    driver_name         TEXT,
    driver_phone        TEXT,
    capacity_kg         NUMERIC,
    warehouse_code      TEXT REFERENCES warehouses(code) ON DELETE SET NULL,
    is_active           BOOLEAN DEFAULT TRUE,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- 17. ROUTE TEMPLATES (predefined patterns)
CREATE TABLE IF NOT EXISTS route_templates (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    template_name       TEXT NOT NULL,
    description         TEXT,
    customer_ids        TEXT,
    warehouse_code      TEXT REFERENCES warehouses(code) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- 18. ISSUE TYPES (master data)
CREATE TABLE IF NOT EXISTS issue_types (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    type_name           TEXT UNIQUE NOT NULL,
    icon                TEXT DEFAULT '⚠',
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- 19. ACTIVITY LOG
CREATE TABLE IF NOT EXISTS activity_log (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id             TEXT,
    user_name           TEXT,
    action              TEXT NOT NULL,
    entity_type         TEXT,
    entity_id           TEXT,
    details             JSONB,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

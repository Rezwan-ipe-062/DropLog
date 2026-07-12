-- ============================================================================
-- DROPLOG — TABLE CREATION (20 tables)
-- Name this SQL tab:  "01 - Tables"
-- ============================================================================
-- WHAT THIS SCRIPT DOES:
--   Creates all 20 database tables for the DropLog route delivery tracking
--   system. Tables are listed in dependency order (a table that REFERENCES
--   another table comes AFTER it).
--
-- HOW TO USE:
--   1. Open Supabase SQL Editor
--   2. Create a NEW tab (click "New query")
--   3. Rename the tab to:  01 - Tables
--   4. Paste this entire script and click RUN
--
--   5. Then run script "02 - Alter, Indexes & RLS" next
--   6. Then run script "03 - Seed Data" to populate master data
--
-- SAFETY: All CREATE TABLE statements use IF NOT EXISTS,
--   so running this multiple times is harmless.
--
-- TABLE LIST (20 tables total):
--    1. users             — Login accounts (Admin, SO, CSD roles)
--    2. contacts          — Customer phone/email directory
--    3. raw_deliveries    — Raw SAP export rows (audit trail)
--    4. available_gds     — Group Deliveries ready for route assignment
--    5. parsed_stops      — Customer stops extracted from each GD
--    6. parsed_products   — Product lines within each stop
--    7. routes            — Core route record (the main table)
--    8. route_stops       — Ordered delivery stops within a route
--    9. stop_products     — Actual products delivered per stop
--   10. delivery_events   — Audit log of every action taken
--   11. issues            — Issue/problem reports from field SOs
--   12. notifications     — Log of SMS/WhatsApp/Email notifications sent
--   13. vendor_settlements — Vendor payment calculation records
--   14. warehouses         — Master list of 4 warehouses (CTG/GAZ/JSR/BGR)
--   15. vendors            — Transport vendor/contractor registry
--   16. fleet_vehicles     — Vehicle & driver registry per warehouse
--   17. route_templates    — Predefined route patterns for quick creation
--   18. issue_types        — Predefined issue categories (dropdown source)
--   19. activity_log       — System-wide audit trail
--   20. (reserved for future use)
-- ============================================================================


-- ============================================================================
-- TABLE 1: users
-- PURPOSE:  All system user accounts across all roles.
-- ROLES:    'so'    = Supply Officer (field staff, uses mobile app)
--           'admin' = CSO Admin (uses admin panel to build routes)
--           'csd'   = CSD Manager (view-only reports & settlements)
--
-- LOGIN:    Admins log in via admin panel with user_id + pin.
--           SOs log in via mobile app with user_id + pin.
--
-- WAREHOUSE: Each user is assigned to one warehouse, which controls which
--            data they can see (filtered by the admin panel JS code).
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id             TEXT UNIQUE NOT NULL,       -- Login ID (e.g. 'ADMIN-CTG', 'SBL-1042')
    name                TEXT NOT NULL,              -- Display name
    pin                 TEXT NOT NULL,              -- 4-digit numeric PIN for login
    role                TEXT NOT NULL CHECK (role IN ('so', 'admin', 'csd')),  -- Access level
    phone               TEXT,                       -- Contact number (optional)
    email               TEXT,                       -- Email address (optional)
    warehouse           TEXT DEFAULT 'CHITTAGONG',  -- Assigned warehouse for data scoping
    is_active           BOOLEAN DEFAULT TRUE,       -- FALSE = disabled, cannot log in
    created_at          TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================================
-- TABLE 2: contacts
-- PURPOSE:  Customer directory used for delivery notifications (SMS/WhatsApp).
--           Uploaded by admin from Excel (BP ID, Name, Phone, Email, etc.).
--           The customer_id is the SAP Business Partner ID (unique).
--
-- RELATIONS: Not directly FK-linked to other tables (used as reference data).
-- ============================================================================
CREATE TABLE IF NOT EXISTS contacts (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id         TEXT UNIQUE,               -- SAP Business Partner ID (unique)
    customer_name       TEXT NOT NULL,              -- Customer/stockist name
    proprietor          TEXT,                       -- Owner/proprietor name
    address             TEXT,                       -- Full street address
    phone               TEXT,                       -- Primary phone number
    email               TEXT,                       -- Email address
    district            TEXT,                       -- Sales district
    region              TEXT,                       -- Sales region
    unit_name           TEXT,                       -- Business unit name
    created_at          TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================================
-- TABLE 3: raw_deliveries
-- PURPOSE:  Raw SAP export data stored exactly as received (audit trail).
--           Each row is one line from the SAP "Data" sheet.
--           Grouped later into GDs > Stops > Products by the upload parser.
--
-- upload_batch_id: A UUID generated per upload session, groups all rows from
--                  one file together.
-- ============================================================================
CREATE TABLE IF NOT EXISTS raw_deliveries (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    upload_batch_id     UUID NOT NULL,              -- Groups rows from one upload session
    uploaded_at         TIMESTAMPTZ DEFAULT NOW(),  -- When this row was uploaded
    uploaded_by         UUID REFERENCES users(id),  -- Which admin uploaded it
    group_delivery_number   TEXT NOT NULL,           -- SAP GD number (e.g. '0080042154')
    delivery_document       TEXT NOT NULL,           -- SAP delivery document number
    billing_document_type   TEXT,                    -- Billing type (ZY70 = FOC)
    bill_to_party_id        TEXT,                    -- Bill-To customer BP ID
    bill_to_party_name      TEXT,                    -- Bill-To customer name
    bill_to_party_address   TEXT,                    -- Bill-To address
    bill_to_party_city      TEXT,                    -- Bill-To city
    ship_to_party_name      TEXT,                    -- Ship-To party name
    ship_to_party_address   TEXT,                    -- Ship-To address
    ship_to_party_city      TEXT,                    -- Ship-To city
    sales_district          TEXT,                    -- District code
    sales_district_desc     TEXT,                    -- District description
    ship_to_region_desc     TEXT,                    -- Region description
    material_code           TEXT,                    -- SAP material code
    material_description    TEXT,                    -- Material/product name
    batch                   TEXT,                    -- Batch/lot number
    delivered_quantity      NUMERIC DEFAULT 0,       -- Quantity delivered
    sales_unit              TEXT,                    -- Unit of measure (e.g. 'GEB')
    plant_code              TEXT,                    -- Plant code
    plant_name              TEXT,                    -- Plant/warehouse name (used for filtering)
    posting_date            DATE,                    -- SAP posting date
    delivery_document_date  DATE,                    -- Document date
    order_reason_desc       TEXT                     -- Order reason (contains 'FOC' for free items)
);


-- ============================================================================
-- TABLE 4: available_gds
-- PURPOSE:  Group Deliveries available for route building. Each GD represents
--           a batch of deliveries to one or more customers on the same date.
--           When an admin creates a route, selected GDs are marked 'assigned'.
--
-- STATUSES: 'available' = not yet assigned to any route
--           'assigned'  = added to a route (pending or in_transit)
--           'completed' = route finished (all stops delivered)
--
-- plant_name: Used by the multi-warehouse system to scope GDs by warehouse.
-- ============================================================================
CREATE TABLE IF NOT EXISTS available_gds (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    group_delivery_number TEXT UNIQUE NOT NULL,       -- SAP GD number
    posting_date        DATE,                         -- Dispatch/posting date
    plant_name          TEXT,                         -- Plant/warehouse name for scoping
    district            TEXT,                         -- Sales district
    region              TEXT,                         -- Sales region
    num_delivery_docs   INT DEFAULT 1,                -- Number of delivery documents
    num_unique_customers INT DEFAULT 1,               -- Number of unique customers (stops)
    total_quantity      NUMERIC DEFAULT 0,            -- Total quantity across all stops
    total_products      INT DEFAULT 0,                -- Total product lines
    is_multi_stop       BOOLEAN DEFAULT FALSE,        -- TRUE if >1 customer (auto-route candidate)
    status              TEXT DEFAULT 'available'
                        CHECK (status IN ('available', 'assigned', 'completed')),
    created_at          TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================================
-- TABLE 5: parsed_stops
-- PURPOSE:  Individual customer stops within a Group Delivery.
--           Created by the upload parser when it breaks a GD into stops
--           (grouping rows by bill_to_party_id).
--
-- display_order: Optional ordering hint for the route builder UI.
-- ============================================================================
CREATE TABLE IF NOT EXISTS parsed_stops (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    gd_id               UUID REFERENCES available_gds(id) ON DELETE CASCADE,  -- Parent GD
    group_delivery_number TEXT NOT NULL,               -- GD number (denormalized for speed)
    customer_id         TEXT,                          -- Customer BP ID
    customer_name       TEXT NOT NULL,                 -- Customer name
    address             TEXT,                          -- Delivery address
    city                TEXT,                          -- City
    district            TEXT,                          -- District
    delivery_documents  TEXT[],                        -- Array of delivery document numbers
    total_quantity      NUMERIC DEFAULT 0,             -- Sum of all product quantities
    num_products        INT DEFAULT 0,                 -- Number of product lines
    display_order       INT DEFAULT 0,                 -- Display sequence hint
    created_at          TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================================
-- TABLE 6: parsed_products
-- PURPOSE:  Individual product lines within a parsed stop.
--           Contains material info, quantities, and FOC flag.
--
-- is_foc: TRUE for Free of Charge items (detected by billing type ZY70
--         or order reason containing "FOC"). These are separated in reports.
-- ============================================================================
CREATE TABLE IF NOT EXISTS parsed_products (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    stop_id             UUID REFERENCES parsed_stops(id) ON DELETE CASCADE,  -- Parent stop
    delivery_document   TEXT,                          -- Delivery document number
    material_code       TEXT,                          -- SAP material code
    material_description TEXT,                         -- Material/product name
    batch               TEXT,                          -- Batch number
    quantity            NUMERIC DEFAULT 0,             -- Delivered quantity
    unit                TEXT DEFAULT 'GEB',            -- Unit of measure
    is_foc              BOOLEAN DEFAULT FALSE,         -- TRUE = Free of Charge item
    created_at          TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================================
-- TABLE 7: routes — THE CORE TABLE
-- PURPOSE:  Every delivery route created by an admin. This is the central
--           table that ties together everything — SO, vehicle, vendor, GDs,
--           stops, GPS tracking, odometer readings, and expenses.
--
-- STATUS LIFECYCLE:
--   pending     → Admin creates the route, not yet started
--   in_transit  → SO starts the route via mobile app (GPS captured)
--   completed   → SO finishes all stops (end GPS captured)
--   cancelled   → Admin cancels the route (no longer active)
--
-- ROUTE CODE FORMAT: {PLANT_SHORT}-{DISTRICT_SHORT}-{YYYYMMDD}-{SEQ}
--   Example: CTG-LAXI-20260702-41
--
-- KM READINGS: Initial and final odometer readings entered by SO.
--   driven_km = final_km_reading - initial_km_reading.
--   total_distance_km (RESERVED for future OSRM GPS-based distance).
-- ============================================================================
CREATE TABLE IF NOT EXISTS routes (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    route_code          TEXT UNIQUE NOT NULL,          -- Auto-generated code (e.g. CTG-LAXI-20260702-41)
    route_name          TEXT,                          -- Optional human-friendly name
    assigned_so_id      UUID REFERENCES users(id),     -- Supply Officer assigned to this route
    vehicle_number      TEXT,                          -- Vehicle registration number
    vehicle_type        TEXT,                          -- 'cover_truck', 'open_truck', or 'pickup'
    vendor_name         TEXT,                          -- Transport vendor/contractor name
    dispatch_date       DATE,                          -- Date of dispatch
    plant_name          TEXT,                          -- Warehouse/plant (used for multi-warehouse scoping)
    district            TEXT,                          -- Primary district
    group_delivery_numbers TEXT[] NOT NULL,             -- Array of GD numbers assigned to this route
    status              TEXT DEFAULT 'pending'
                        CHECK (status IN ('pending', 'in_transit', 'completed', 'cancelled')),
    started_at          TIMESTAMPTZ,                   -- When SO tapped "Start"
    completed_at        TIMESTAMPTZ,                  -- When SO tapped "Complete"
    start_gps_lat       DOUBLE PRECISION,              -- GPS latitude at route start
    start_gps_lng       DOUBLE PRECISION,              -- GPS longitude at route start
    end_gps_lat         DOUBLE PRECISION,              -- GPS latitude at route completion
    end_gps_lng         DOUBLE PRECISION,              -- GPS longitude at route completion
    total_stops         INT DEFAULT 0,                 -- Total number of stops in route
    completed_stops     INT DEFAULT 0,                 -- Number successfully delivered
    failed_stops        INT DEFAULT 0,                 -- Number marked as failed
    total_distance_km   NUMERIC,                       -- RESERVED: OSRM GPS-calculated distance
    initial_km_reading  NUMERIC,                       -- Odometer reading at start
    final_km_reading    NUMERIC,                       -- Odometer reading at completion
    driven_km           NUMERIC,                       -- Calculated: final - initial
    transit_volume_mt   NUMERIC,                       -- Load weight in metric tons
    vehicle_capacity_mt NUMERIC,                       -- Vehicle max capacity in MT
    so_travelling_expense NUMERIC,                     -- SO travel expense in BDT
    num_vehicles_used   INT DEFAULT 1,                 -- Number of vehicles (for multi-vehicle routes)
    pdf_url             TEXT,                          -- URL to generated PDF report (future use)
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    created_by          UUID REFERENCES users(id)      -- Admin who created this route
);


-- ============================================================================
-- TABLE 8: route_stops
-- PURPOSE:  Ordered list of customer stops within a route. Each stop is
--           a delivery point that the SO visits in sequence.
--           Created when the admin builds a route (copied from parsed_stops).
--
-- stop_sequence: The order in which stops should be visited (1, 2, 3...).
-- status: Updated by the SO via mobile app as they complete each delivery.
-- ============================================================================
CREATE TABLE IF NOT EXISTS route_stops (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    route_id            UUID REFERENCES routes(id) ON DELETE CASCADE,  -- Parent route
    stop_sequence       INT NOT NULL,                 -- Visit order (1 = first stop)
    customer_id         TEXT,                          -- Customer BP ID
    customer_name       TEXT NOT NULL,                 -- Customer name
    address             TEXT,                          -- Delivery address
    district            TEXT,                          -- District
    delivery_documents  TEXT[],                        -- Array of delivery document numbers
    status              TEXT DEFAULT 'pending'
                        CHECK (status IN ('pending', 'delivered', 'partial', 'failed')),
    delivered_at        TIMESTAMPTZ,                   -- When delivery was completed
    gps_lat             DOUBLE PRECISION,              -- GPS at delivery point
    gps_lng             DOUBLE PRECISION,              -- GPS at delivery point
    remark              TEXT,                          -- SO's remark/note
    parsed_stop_id      UUID REFERENCES parsed_stops(id),  -- Link back to source parsed_stop
    created_at          TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================================
-- TABLE 9: stop_products
-- PURPOSE:  Products associated with a route stop (copied from parsed_products
--           when route is created). SOs can record actual_quantity for
--           partial delivery tracking.
-- ============================================================================
CREATE TABLE IF NOT EXISTS stop_products (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    route_stop_id       UUID REFERENCES route_stops(id) ON DELETE CASCADE,  -- Parent route stop
    material_code       TEXT,                          -- SAP material code
    material_description TEXT,                         -- Material/product name
    batch               TEXT,                          -- Batch number
    quantity            NUMERIC DEFAULT 0,             -- Original quantity from SAP
    unit                TEXT DEFAULT 'GEB',            -- Unit of measure
    is_foc              BOOLEAN DEFAULT FALSE,         -- Free of Charge flag
    actual_quantity     NUMERIC,                      -- RESERVED: actual delivered qty (for partials)
    created_at          TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================================
-- TABLE 10: delivery_events
-- PURPOSE:  Immutable audit log. Every significant action (route start,
--           delivery confirm, partial, fail, route complete, issue report)
--           is recorded here with GPS coordinates and timestamp.
--           Used for dispute resolution and performance analytics.
-- ============================================================================
CREATE TABLE IF NOT EXISTS delivery_events (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    route_id            UUID REFERENCES routes(id) ON DELETE CASCADE,  -- Related route
    route_stop_id       UUID REFERENCES route_stops(id),               -- Related stop (if applicable)
    event_type          TEXT NOT NULL CHECK (event_type IN (
                            'route_started', 'delivery_confirmed', 'delivery_partial',
                            'delivery_failed', 'route_completed', 'issue_reported'
                        )),
    timestamp           TIMESTAMPTZ DEFAULT NOW(),     -- When event occurred (server time)
    gps_lat             DOUBLE PRECISION,              -- GPS latitude at event time
    gps_lng             DOUBLE PRECISION,              -- GPS longitude at event time
    remark              TEXT,                          -- Optional remark
    performed_by        UUID REFERENCES users(id),     -- Who performed the action
    client_timestamp    TIMESTAMPTZ,                   -- Original timestamp from mobile device
    synced_at           TIMESTAMPTZ DEFAULT NOW()      -- When data was synced to server
);


-- ============================================================================
-- TABLE 11: issues
-- PURPOSE:  Problem reports submitted by SOs during route execution.
--           Issues appear as real-time alerts on the admin dashboard.
--           Admins can acknowledge issues (mark as seen).
-- ============================================================================
CREATE TABLE IF NOT EXISTS issues (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    route_id            UUID REFERENCES routes(id) ON DELETE CASCADE,       -- Related route
    route_stop_id       UUID REFERENCES route_stops(id) ON DELETE SET NULL, -- Related stop (if applicable)
    issue_type          TEXT NOT NULL,                 -- Type of issue (from issue_types or free text)
    details             TEXT,                          -- Free-text description
    gps_lat             DOUBLE PRECISION,              -- GPS where issue occurred
    gps_lng             DOUBLE PRECISION,              -- GPS where issue occurred
    reported_by         UUID REFERENCES users(id),     -- SO who reported it
    reported_at         TIMESTAMPTZ DEFAULT NOW(),
    acknowledged        BOOLEAN DEFAULT FALSE,         -- TRUE = admin has seen it
    acknowledged_by     UUID REFERENCES users(id),     -- Admin who acknowledged
    acknowledged_at     TIMESTAMPTZ                    -- When acknowledged
);


-- ============================================================================
-- TABLE 12: notifications
-- PURPOSE:  Log of all outbound notifications (SMS, WhatsApp, Email, Push).
--           Currently logs are written by the system; actual sending is
--           PENDING integration with WhatsApp Business API / SMS gateway.
--
-- STATUS:   'pending'  = queued but not yet sent
--           'sent'     = successfully dispatched
--           'failed'   = sending failed (error_message has details)
--           'delivered' = confirmed delivered (via webhook)
--
-- delivery_log: JSONB field for storing webhook responses from messaging APIs.
-- ============================================================================
CREATE TABLE IF NOT EXISTS notifications (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    route_id            UUID REFERENCES routes(id) ON DELETE CASCADE,       -- Related route
    route_stop_id       UUID REFERENCES route_stops(id) ON DELETE SET NULL,  -- Related stop
    message_type        TEXT NOT NULL,                 -- 'route_started', 'delivery_done', 'issue_alert', etc.
    message_text        TEXT,                          -- The actual message content
    recipient_name      TEXT,                          -- Customer or SO name
    recipient_phone     TEXT,                          -- Phone number
    recipient_email     TEXT,                          -- Email address
    channel             TEXT CHECK (channel IN ('sms', 'whatsapp', 'email', 'push')),  -- Delivery channel
    status              TEXT DEFAULT 'pending'
                        CHECK (status IN ('pending', 'sent', 'failed', 'delivered')),
    triggered_at        TIMESTAMPTZ DEFAULT NOW(),     -- When notification was created
    sent_at             TIMESTAMPTZ,                   -- When it was actually sent
    error_message       TEXT,                          -- Error details if failed
    delivery_log        JSONB                          -- Webhook response / delivery receipt
);


-- ============================================================================
-- TABLE 13: vendor_settlements
-- PURPOSE:  Vendor payment calculation records. After a route is completed,
--           the CSO verifies the vendor's claimed distance and calculates
--           carrying cost for payment processing.
--
-- gps_distance_km:   RESERVED for future OSRM-calculated road distance.
-- vendor_claimed_km: Distance claimed by the vendor on their invoice.
-- distance_variance: Difference between GPS and claimed distance.
-- ============================================================================
CREATE TABLE IF NOT EXISTS vendor_settlements (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    route_id            UUID REFERENCES routes(id) ON DELETE CASCADE,  -- Related route
    vendor_name         TEXT,                          -- Vendor/contractor name
    vehicle_number      TEXT,                          -- Vehicle used
    gps_distance_km     NUMERIC,                       -- RESERVED: OSRM GPS distance
    vendor_claimed_km   NUMERIC,                       -- Vendor's claimed km
    distance_variance   NUMERIC,                       -- Difference (claimed - GPS)
    carrying_cost       NUMERIC,                       -- Calculated transport cost
    route_sales_value   NUMERIC,                       -- Total sales value of route
    settlement_status   TEXT DEFAULT 'pending'
                        CHECK (settlement_status IN ('pending', 'verified', 'disputed', 'paid')),
    verified_by         UUID REFERENCES users(id),     -- CSO who verified
    verified_at         TIMESTAMPTZ,
    pdf_url             TEXT,                          -- Link to settlement PDF
    created_at          TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================================
-- TABLE 14: warehouses
-- PURPOSE:  Master reference table listing all 4 warehouses.
--           Used by fleet_vehicles, vendors, and route_templates
--           to associate records with a specific warehouse.
--
-- RELATIONS:
--   warehouses.code → fleet_vehicles.warehouse_code
--   warehouses.code → vendors.warehouse_code
--   warehouses.code → route_templates.warehouse_code
-- ============================================================================
CREATE TABLE IF NOT EXISTS warehouses (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code                TEXT UNIQUE NOT NULL,          -- Short code: CTG, GAZ, JSR, BGR
    name                TEXT NOT NULL,                 -- Full name: Chittagong, Gazipur, etc.
    location            TEXT,                          -- Geographic location description
    created_at          TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================================
-- TABLE 15: vendors
-- PURPOSE:  Transport vendor/contractor registry. Vendors provide vehicles
--           and drivers for route deliveries. Each vendor is associated
--           with a warehouse via warehouse_code.
-- ============================================================================
CREATE TABLE IF NOT EXISTS vendors (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    vendor_name         TEXT NOT NULL,                 -- Vendor/company name
    contact_phone       TEXT,                          -- Primary contact number
    warehouse_code      TEXT REFERENCES warehouses(code) ON DELETE SET NULL,  -- Warehouse association
    created_at          TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================================
-- TABLE 16: fleet_vehicles
-- PURPOSE:  Vehicle and driver registry per warehouse. Used by the admin
--           panel's fleet management module and the route builder's
--           vehicle dropdown.
-- ============================================================================
CREATE TABLE IF NOT EXISTS fleet_vehicles (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    vehicle_number      TEXT UNIQUE NOT NULL,          -- Registration number (e.g. 'DM AU-11-1917')
    driver_name         TEXT,                          -- Driver's full name
    driver_phone        TEXT,                          -- Driver's contact number
    capacity_kg         NUMERIC,                       -- Vehicle capacity in kilograms
    warehouse_code      TEXT REFERENCES warehouses(code) ON DELETE SET NULL,  -- Warehouse
    is_active           BOOLEAN DEFAULT TRUE,          -- FALSE = retired/unavailable
    created_at          TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================================
-- TABLE 17: route_templates
-- PURPOSE:  Predefined route patterns that admins can use to quickly create
--           common routes (e.g. weekly routes to the same set of customers).
--           customer_ids stores a comma-separated list of BP IDs.
-- ============================================================================
CREATE TABLE IF NOT EXISTS route_templates (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    template_name       TEXT NOT NULL,                 -- Name for this template
    description         TEXT,                          -- Optional description
    customer_ids        TEXT,                          -- Comma-separated customer BP IDs
    warehouse_code      TEXT REFERENCES warehouses(code) ON DELETE SET NULL,  -- Warehouse
    created_at          TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================================
-- TABLE 18: issue_types
-- PURPOSE:  Predefined categories for issue reporting. Used as the dropdown
--           source in the SO mobile app's issue reporting screen.
--           Managed via the admin panel's fleet/settings section.
-- ============================================================================
CREATE TABLE IF NOT EXISTS issue_types (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    type_name           TEXT UNIQUE NOT NULL,          -- Display name (e.g. 'Vehicle Breakdown')
    icon                TEXT DEFAULT '⚠',             -- Emoji icon for display
    created_at          TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================================
-- TABLE 19: activity_log
-- PURPOSE:  Central audit trail for all significant system events.
--           Records who did what, to which entity, and when.
--           Useful for debugging, security auditing, and usage analytics.
--
-- action:      Verb describing the action (e.g. 'CREATE', 'UPDATE', 'DELETE', 'LOGIN')
-- entity_type: Type of record affected (e.g. 'route', 'user', 'contact')
-- entity_id:   UUID of the affected record
-- details:     JSONB for storing contextual data (e.g. changed fields)
-- ============================================================================
CREATE TABLE IF NOT EXISTS activity_log (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id             TEXT,                          -- Who performed the action
    user_name           TEXT,                          -- Display name of the user
    action              TEXT NOT NULL,                 -- Action verb (CREATE, UPDATE, DELETE, etc.)
    entity_type         TEXT,                          -- What was affected (route, user, contact, etc.)
    entity_id           TEXT,                          -- ID/UUID of the affected record
    details             JSONB,                         -- Arbitrary JSON payload with context
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

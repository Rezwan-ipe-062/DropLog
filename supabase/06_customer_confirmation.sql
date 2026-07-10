-- ============================================================================
-- Migration 06: Customer confirmation columns on route_stops
-- PURPOSE:  Track customer-side acknowledgment of delivery via WhatsApp/n8n.
--           customer_confirmed_at: Set when customer confirms receipt
--           customer_remark:       Optional feedback from customer
--           These are informational only — NOT a gate for delivery completion.
-- ============================================================================

ALTER TABLE route_stops
    ADD COLUMN IF NOT EXISTS customer_confirmed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS customer_remark TEXT;

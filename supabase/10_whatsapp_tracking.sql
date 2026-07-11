ALTER TABLE route_stops
    ADD COLUMN IF NOT EXISTS whatsapp_start_status TEXT DEFAULT 'not_sent',
    ADD COLUMN IF NOT EXISTS whatsapp_start_sent_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS whatsapp_confirm_status TEXT DEFAULT 'not_sent',
    ADD COLUMN IF NOT EXISTS whatsapp_confirm_sent_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS customer_response TEXT DEFAULT 'no_response',
    ADD COLUMN IF NOT EXISTS customer_responded_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS delivery_exception BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_route_stops_customer_response ON route_stops(customer_response);
CREATE INDEX IF NOT EXISTS idx_route_stops_delivery_exception ON route_stops(delivery_exception) WHERE delivery_exception = TRUE;

-- ============================================================================
-- Migration 07: WhatsApp notification triggers via pg_net
-- PURPOSE:  Fire Supabase Edge Functions when routes start or stops deliver.
--           Uses pg_net extension for async HTTP calls from DB triggers.
--           Free tier: pg_net included, no Supabase webhooks needed.
-- ============================================================================

-- Enable pg_net extension (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ============================================================================
-- Trigger 1: Route started → notify all customers on that route
-- ============================================================================
CREATE OR REPLACE FUNCTION notify_route_started()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    func_url TEXT := 'https://afovfoaraolalebvookx.functions.supabase.co/send-eta';
BEGIN
    PERFORM net.http_post(
        url := func_url,
        headers := jsonb_build_object(
            'Content-Type', 'application/json'
        ),
        body := jsonb_build_object('route_id', NEW.id)::text
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_route_started ON routes;
CREATE TRIGGER trg_route_started
    AFTER UPDATE OF status ON routes
    FOR EACH ROW
    WHEN (NEW.status = 'in_transit' AND (OLD.status IS NULL OR OLD.status != 'in_transit'))
    EXECUTE FUNCTION notify_route_started();

-- ============================================================================
-- Trigger 2: Stop delivered → send confirmation request to customer
-- ============================================================================
CREATE OR REPLACE FUNCTION notify_stop_delivered()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    func_url TEXT := 'https://afovfoaraolalebvookx.functions.supabase.co/delivery-notify';
BEGIN
    PERFORM net.http_post(
        url := func_url,
        headers := jsonb_build_object(
            'Content-Type', 'application/json'
        ),
        body := jsonb_build_object('route_stop_id', NEW.id)::text
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stop_delivered ON route_stops;
CREATE TRIGGER trg_stop_delivered
    AFTER UPDATE OF status ON route_stops
    FOR EACH ROW
    WHEN (NEW.status = 'delivered' AND (OLD.status IS NULL OR OLD.status != 'delivered'))
    EXECUTE FUNCTION notify_stop_delivered();

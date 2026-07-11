-- ============================================================================
-- Migration 08: Fix pg_net notification triggers
-- PURPOSE:  The previous triggers broke the entire route/stop update workflow
--           because net.http_post() had the wrong parameter signature for the
--           installed pg_net version.
--
-- FIX:      1. Drop broken triggers
--           2. Rebuild functions with correct pg_net API (body jsonb, before headers)
--           3. Wrap net.http_post in BEGIN/EXCEPTION so trigger NEVER fails
--              the main transaction even if the Edge Function is unreachable
-- ============================================================================

-- Drop the broken triggers (safe, IF EXISTS)
DROP TRIGGER IF EXISTS trg_route_started ON routes;
DROP TRIGGER IF EXISTS trg_stop_delivered ON route_stops;

-- ============================================================================
-- Fix 1: Route started -> notify customers (safe version)
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
    BEGIN
        PERFORM net.http_post(
            url := func_url,
            body := jsonb_build_object('route_id', NEW.id),
            headers := jsonb_build_object('Content-Type', 'application/json'),
            timeout_milliseconds := 5000
        );
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_route_started
    AFTER UPDATE OF status ON routes
    FOR EACH ROW
    WHEN (NEW.status = 'in_transit' AND (OLD.status IS NULL OR OLD.status != 'in_transit'))
    EXECUTE FUNCTION notify_route_started();

-- ============================================================================
-- Fix 2: Stop delivered -> send confirmation request to customer (safe version)
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
    BEGIN
        PERFORM net.http_post(
            url := func_url,
            body := jsonb_build_object('route_stop_id', NEW.id),
            headers := jsonb_build_object('Content-Type', 'application/json'),
            timeout_milliseconds := 5000
        );
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_stop_delivered
    AFTER UPDATE OF status ON route_stops
    FOR EACH ROW
    WHEN (NEW.status = 'delivered' AND (OLD.status IS NULL OR OLD.status != 'delivered'))
    EXECUTE FUNCTION notify_stop_delivered();

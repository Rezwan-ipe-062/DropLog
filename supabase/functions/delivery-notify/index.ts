import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const WHATSAPP_TOKEN = Deno.env.get('WHATSAPP_TOKEN') || ''
const WHATSAPP_PHONE_ID = Deno.env.get('WHATSAPP_PHONE_ID') || ''
const VERIFY_TOKEN = Deno.env.get('VERIFY_TOKEN') || 'droplog_verify_2026'
const PORTAL_BASE = 'https://rezwan-ipe-062.github.io/DropLog/portal/?bp='

serve(async (req) => {
    const url = new URL(req.url)

    if (req.method === 'GET') {
        const mode = url.searchParams.get('hub.mode')
        const token = url.searchParams.get('hub.verify_token')
        const challenge = url.searchParams.get('hub.challenge')
        if (mode === 'subscribe' && token === VERIFY_TOKEN && challenge) {
            return new Response(challenge, { status: 200 })
        }
        return new Response('Forbidden', { status: 403 })
    }

    try {
        const body = await req.json()

        if (body.route_stop_id) {
            return await handleDeliveryNotify(body)
        }

        if (body.entry) {
            return await handleReply(body)
        }

        return new Response(JSON.stringify({ error: 'unknown payload' }), { status: 400 })
    } catch (e) {
        console.error('delivery-notify error:', e)
        return new Response(JSON.stringify({ error: e.message }), { status: 500 })
    }
})

async function handleDeliveryNotify(body: { route_stop_id: string }) {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    const { data: stop } = await sb
        .from('route_stops')
        .select('*, routes(route_code, route_name, vehicle_number)')
        .eq('id', body.route_stop_id)
        .single()

    if (!stop || !stop.customer_id) {
        return new Response(JSON.stringify({ ok: true, skipped: 'no customer_id' }))
    }

    const { data: contact } = await sb
        .from('contacts')
        .select('phone')
        .eq('customer_id', stop.customer_id)
        .neq('phone', null)
        .maybeSingle()

    if (!contact || !contact.phone) {
        return new Response(JSON.stringify({ ok: true, skipped: 'no phone' }))
    }

    const route = stop.routes || {}
    const message = `Your delivery via ${route.vehicle_number || ''} (${route.route_code || ''}) has been completed. Did everything go well? Reply YES or describe any issue.`

    const waRes = await fetch(
        `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_ID}/messages`,
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                to: contact.phone,
                type: 'text',
                text: { body: message },
            }),
        }
    )

    if (!waRes.ok) {
        const errText = await waRes.text()
        console.error('whatsapp send failed:', errText)
    }

    return new Response(JSON.stringify({ ok: true, sent: waRes.ok }))
}

async function handleReply(body: any) {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    const entry = body.entry?.[0]
    const change = entry?.changes?.[0]
    const message = change?.value?.messages?.[0]
    if (!message) {
        return new Response(JSON.stringify({ ok: true, skipped: 'no message' }))
    }

    const fromPhone = message.from
    const text = (message.text?.body || '').trim().toLowerCase()

    const { data: contact } = await sb
        .from('contacts')
        .select('customer_id')
        .eq('phone', fromPhone)
        .maybeSingle()

    if (!contact) {
        return new Response(JSON.stringify({ ok: true, skipped: 'unknown sender' }))
    }

    const { data: stop } = await sb
        .from('route_stops')
        .select('id, route_id')
        .eq('customer_id', contact.customer_id)
        .eq('status', 'delivered')
        .is('customer_confirmed_at', null)
        .order('delivered_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    if (!stop) {
        return new Response(JSON.stringify({ ok: true, skipped: 'no pending confirmation' }))
    }

    const isConfirmed = text === 'yes' || text === 'y' || text === 'ok' || text === 'confirmed'
    const update: any = {
        customer_confirmed_at: new Date().toISOString(),
    }
    if (!isConfirmed) {
        update.customer_remark = message.text?.body?.trim() || null
    }

    await sb.from('route_stops').update(update).eq('id', stop.id)

    return new Response(JSON.stringify({ ok: true, confirmed: isConfirmed }))
}

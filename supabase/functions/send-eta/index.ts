import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const WHATSAPP_TOKEN = Deno.env.get('WHATSAPP_TOKEN') || ''
const WHATSAPP_PHONE_ID = Deno.env.get('WHATSAPP_PHONE_ID') || ''
const PORTAL_BASE = 'https://rezwan-ipe-062.github.io/DropLog/portal/?bp='

serve(async (req) => {
    try {
        const { route_id } = await req.json()
        if (!route_id) {
            return new Response(JSON.stringify({ error: 'route_id required' }), { status: 400 })
        }

        const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

        const { data: route } = await sb.from('routes').select('*').eq('id', route_id).single()
        if (!route) {
            return new Response(JSON.stringify({ error: 'route not found' }), { status: 404 })
        }

        const { data: stops } = await sb
            .from('route_stops')
            .select('customer_id, customer_name')
            .eq('route_id', route_id)
            .neq('customer_id', null)

        if (!stops || stops.length === 0) {
            return new Response(JSON.stringify({ ok: true, skipped: 'no stops with customer_id' }))
        }

        const customerIds = [...new Set(stops.map(s => s.customer_id))]
        const { data: contacts } = await sb
            .from('contacts')
            .select('customer_id, phone')
            .in('customer_id', customerIds)
            .neq('phone', null)

        if (!contacts || contacts.length === 0) {
            return new Response(JSON.stringify({ ok: true, skipped: 'no contacts with phone' }))
        }

        const vehicle = route.vehicle_number || ''
        const routeName = route.route_name || route.route_code || ''
        const message = `Your delivery via ${vehicle} (${routeName}) is on the way. Track your delivery here: ${PORTAL_BASE}`

        let sent = 0
        for (const c of contacts) {
            const fullMsg = message + encodeURIComponent(c.customer_id || '')
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
                        to: c.phone,
                        type: 'text',
                        text: { body: fullMsg },
                    }),
                }
            )
            if (waRes.ok) sent++
        }

        return new Response(JSON.stringify({ ok: true, sent, total: contacts.length }))
    } catch (e) {
        console.error('send-eta error:', e)
        return new Response(JSON.stringify({ error: e.message }), { status: 500 })
    }
})

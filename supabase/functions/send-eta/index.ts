import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
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
            .select('id, customer_id, customer_name')
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

        const phoneToContact: Record<string, any> = {}
        for (const c of contacts) {
            if (c.phone) phoneToContact[c.phone] = c
        }

        const now = new Date().toISOString()
        let sent = 0
        let failed = 0

        for (const stop of stops) {
            const contact = contacts.find(c => c.customer_id === stop.customer_id)
            if (!contact || !contact.phone) {
                failed++
                await sb.from('route_stops').update({
                    whatsapp_start_status: 'failed',
                    whatsapp_start_sent_at: now
                }).eq('id', stop.id)
                continue
            }

            const trackingUrl = PORTAL_BASE + encodeURIComponent(stop.customer_id)
            const message = `আপনার পণ্যের ডেলিভারি শুরু হয়েছে। ডেলিভারির অবস্থা দেখতে নিচের লিংকে চাপ দিন:\n${trackingUrl}\nধন্যবাদ।`

            const waRes = await fetch(
                `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_ID}/messages`,
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

            if (waRes.ok) {
                sent++
                await sb.from('route_stops').update({
                    whatsapp_start_status: 'sent',
                    whatsapp_start_sent_at: now
                }).eq('id', stop.id)
            } else {
                failed++
                const errText = await waRes.text()
                console.error('whatsapp start failed for', stop.customer_id, ':', errText)
                await sb.from('route_stops').update({
                    whatsapp_start_status: 'failed',
                    whatsapp_start_sent_at: now
                }).eq('id', stop.id)
            }

            await sb.from('notifications').insert({
                route_id: route_id,
                route_stop_id: stop.id,
                message_type: 'whatsapp_start',
                message_text: message.substring(0, 500),
                recipient_name: stop.customer_name,
                recipient_phone: contact.phone,
                channel: 'whatsapp',
                status: waRes.ok ? 'sent' : 'failed',
                triggered_at: now,
                sent_at: waRes.ok ? now : null
            })
        }

        return new Response(JSON.stringify({ ok: true, sent, failed, total: stops.length }))
    } catch (e) {
        console.error('send-eta error:', e)
        return new Response(JSON.stringify({ error: e.message }), { status: 500 })
    }
})

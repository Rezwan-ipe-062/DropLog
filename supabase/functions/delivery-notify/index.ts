import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const WHATSAPP_TOKEN = Deno.env.get('WHATSAPP_TOKEN') || ''
const WHATSAPP_PHONE_ID = Deno.env.get('WHATSAPP_PHONE_ID') || ''
const VERIFY_TOKEN = Deno.env.get('VERIFY_TOKEN') || 'droplog_verify_2026'

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
        await sb.from('route_stops').update({
            whatsapp_confirm_status: 'failed',
            whatsapp_confirm_sent_at: new Date().toISOString()
        }).eq('id', stop.id)
        return new Response(JSON.stringify({ ok: true, skipped: 'no phone' }))
    }

    const now = new Date().toISOString()

    const bodyText = 'আপনি কি আপনার পণ্য পেয়েছেন? নিচের যেকোনো একটি অপশন চাপুন।'

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
                type: 'interactive',
                interactive: {
                    type: 'button',
                    body: { text: bodyText },
                    action: {
                        buttons: [
                            {
                                type: 'reply',
                                reply: {
                                    id: 'ha_paisi_' + stop.id,
                                    title: 'হ্যাঁ, পেয়েছি'
                                }
                            },
                            {
                                type: 'reply',
                                reply: {
                                    id: 'na_paini_' + stop.id,
                                    title: 'না, পাইনি'
                                }
                            }
                        ]
                    }
                }
            }),
        }
    )

    const status = waRes.ok ? 'sent' : 'failed'
    await sb.from('route_stops').update({
        whatsapp_confirm_status: status,
        whatsapp_confirm_sent_at: now
    }).eq('id', stop.id)

    if (!waRes.ok) {
        const errText = await waRes.text()
        console.error('whatsapp confirm failed:', errText)
    }

    const route = stop.routes || {}
    await sb.from('notifications').insert({
        route_id: stop.route_id,
        route_stop_id: stop.id,
        message_type: 'whatsapp_confirm',
        message_text: bodyText,
        recipient_name: stop.customer_name,
        recipient_phone: contact.phone,
        channel: 'whatsapp',
        status: status,
        triggered_at: now,
        sent_at: waRes.ok ? now : null
    })

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
    const now = new Date().toISOString()

    if (message.type === 'interactive' && message.interactive?.type === 'button_reply') {
        const buttonId = message.interactive.button_reply.id || ''

        let stopId = ''
        let response = ''
        if (buttonId.startsWith('ha_paisi_')) {
            stopId = buttonId.substring('ha_paisi_'.length)
            response = 'confirmed_received'
        } else if (buttonId.startsWith('na_paini_')) {
            stopId = buttonId.substring('na_paini_'.length)
            response = 'not_received'
        }

        if (stopId && response) {
            const update: any = {
                customer_response: response,
                customer_responded_at: now,
                customer_confirmed_at: now
            }
            if (response === 'not_received') {
                update.delivery_exception = true
            }

            await sb.from('route_stops').update(update).eq('id', stopId)

            return new Response(JSON.stringify({ ok: true, response, stopId }))
        }
    }

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

    const isConfirmed = text === 'yes' || text === 'y' || text === 'ok' || text === 'confirmed' || text === 'হ্যাঁ' || text === 'ha'
    const update: any = {
        customer_confirmed_at: now,
        customer_response: isConfirmed ? 'confirmed_received' : 'not_received',
        customer_responded_at: now
    }
    if (!isConfirmed) {
        update.customer_remark = message.text?.body?.trim() || null
        update.delivery_exception = true
    }

    await sb.from('route_stops').update(update).eq('id', stop.id)

    return new Response(JSON.stringify({ ok: true, confirmed: isConfirmed }))
}

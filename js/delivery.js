// ============================================================
// DropLog SO App - Delivery Actions
// ============================================================
let currentStopIndex = null;
let isProcessing = false;

function openDelivery(index) {
    const stop = stopsData[index];
    if (stop.status === 'delivered') { showToast('Already delivered', 'warning'); return; }
    if (stop.status === 'failed') { showToast('Marked as failed', 'warning'); return; }

    currentStopIndex = index;
    isProcessing = false;

    document.getElementById('deliveryCustomer').textContent = stop.customer_name;
    document.getElementById('deliveryAddress').textContent = stop.address || '';
    document.getElementById('deliveryRemark').value = '';

    // Render products
    const prods = productsData[stop.id] || [];
    document.getElementById('deliveryProducts').innerHTML = prods.map(p => 
        '<div class="product-item"><span class="p-name">' + escapeHtml(p.material_description || '') + 
        '</span><span class="p-qty">' + (p.quantity || 0) + ' ' + escapeHtml(p.unit || 'GEB') + '</span></div>'
    ).join('');

    showScreen('screenDelivery');
}

async function handleDelivered() {
    try {
        if (currentStopIndex === null || isProcessing) return;
        const stop = stopsData[currentStopIndex];
        if (!confirm('Mark ' + stop.customer_name + ' as delivered?')) return;
        isProcessing = true;

        document.querySelector('.btn-delivered').disabled = true;
        document.querySelector('.btn-delivered').textContent = 'Saving...';
        const gps = await getGPS();
        const now = new Date().toISOString();
        const remark = document.getElementById('deliveryRemark').value.trim();

        const { error } = await sb.from('route_stops').update({
            status: 'delivered',
            delivered_at: now,
            gps_lat: gps.lat,
            gps_lng: gps.lng,
            remark: remark || null
        }).eq('id', stop.id);

        if (error) {
            showToast('Save failed', 'error');
            isProcessing = false;
            document.querySelector('.btn-delivered').disabled = false;
            document.querySelector('.btn-delivered').textContent = 'Mark as Delivered';
            return;
        }

        // Log event
        await sb.from('delivery_events').insert({
            route_id: routeData.id,
            route_stop_id: stop.id,
            event_type: 'delivery_confirmed',
            gps_lat: gps.lat,
            gps_lng: gps.lng,
            remark: remark || null,
            performed_by: currentUser ? currentUser.id : null
        });

        // Update route progress
        await sb.from('routes').update({
            completed_stops: (routeData.completed_stops || 0) + 1
        }).eq('id', routeData.id);
        routeData.completed_stops = (routeData.completed_stops || 0) + 1;

        // Update local state
        stop.status = 'delivered';
        stop.delivered_at = now;

        showToast(stop.customer_name + ' - delivered', 'success');
        document.querySelector('.btn-delivered').disabled = false;
        document.querySelector('.btn-delivered').textContent = 'Mark as Delivered';
        renderStopList();
        showScreen('screenStops');
        isProcessing = false;
    } catch (e) {
        console.error('handleDelivered:', e);
        showToast(e.message || 'Something went wrong', 'error');
    }
}

async function handlePartial() {
    try {
        if (currentStopIndex === null || isProcessing) return;
        const stop = stopsData[currentStopIndex];
        if (!confirm('Mark ' + stop.customer_name + ' as partial?')) return;
        isProcessing = true;

        const gps = await getGPS();
        const now = new Date().toISOString();
        const remark = document.getElementById('deliveryRemark').value.trim();

        await sb.from('route_stops').update({
            status: 'partial',
            delivered_at: now,
            gps_lat: gps.lat,
            gps_lng: gps.lng,
            remark: remark || 'Partial delivery'
        }).eq('id', stop.id);

        await sb.from('delivery_events').insert({
            route_id: routeData.id,
            route_stop_id: stop.id,
            event_type: 'delivery_partial',
            gps_lat: gps.lat,
            gps_lng: gps.lng,
            remark: remark || 'Partial delivery',
            performed_by: currentUser ? currentUser.id : null
        });

        await sb.from('routes').update({
            completed_stops: (routeData.completed_stops || 0) + 1
        }).eq('id', routeData.id);
        routeData.completed_stops = (routeData.completed_stops || 0) + 1;

        stop.status = 'partial';
        stop.delivered_at = now;

        showToast(stop.customer_name + ' - partial', 'warning');
        renderStopList();
        showScreen('screenStops');
        isProcessing = false;
    } catch (e) {
        console.error('handlePartial:', e);
        showToast(e.message || 'Something went wrong', 'error');
    }
}

async function handleFailed() {
    try {
        if (currentStopIndex === null || isProcessing) return;
        const remark = document.getElementById('deliveryRemark').value.trim();
        if (!remark) { showToast('Add a remark for failed delivery', 'warning'); document.getElementById('deliveryRemark').focus(); return; }

        const stop = stopsData[currentStopIndex];
        if (!confirm('Mark ' + stop.customer_name + ' as failed?')) { isProcessing = false; return; }
        isProcessing = true;
    const gps = await getGPS();
    const now = new Date().toISOString();

    await sb.from('route_stops').update({
        status: 'failed',
        delivered_at: now,
        gps_lat: gps.lat,
        gps_lng: gps.lng,
        remark: remark
    }).eq('id', stop.id);

    await sb.from('delivery_events').insert({
        route_id: routeData.id,
        route_stop_id: stop.id,
        event_type: 'delivery_failed',
        gps_lat: gps.lat,
        gps_lng: gps.lng,
        remark: remark,
        performed_by: currentUser ? currentUser.id : null
    });

    await sb.from('routes').update({
        failed_stops: (routeData.failed_stops || 0) + 1
    }).eq('id', routeData.id);
    routeData.failed_stops = (routeData.failed_stops || 0) + 1;

    stop.status = 'failed';
    stop.delivered_at = now;

    showToast(stop.customer_name + ' - failed', 'error');
    renderStopList();
    showScreen('screenStops');
    isProcessing = false;
    } catch (e) {
        console.error('handleFailed:', e);
        showToast(e.message || 'Something went wrong', 'error');
    }
}
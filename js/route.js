// ============================================================
// DropLog SO App - Route Loading & Display
// ============================================================
let routeData = null;
let stopsData = [];
let productsData = {};
let routeStartTime = null;

async function handleStartRoute() {
    const code = document.getElementById('routeInput').value.trim();
    if (!code) { showToast('Enter route code', 'warning'); return; }
    if (!sb) { showToast('Connecting...', 'warning'); return; }

    document.getElementById('routeLoading').style.display = 'block';

    // Find route by code
    const { data: route, error } = await sb
        .from('routes')
        .select('*')
        .eq('route_code', code)
        .single();

    if (error || !route) {
        document.getElementById('routeLoading').style.display = 'none';
        showToast('Route not found', 'error');
        return;
    }

    routeData = route;

    // Load stops
    const { data: stops } = await sb
        .from('route_stops')
        .select('*')
        .eq('route_id', route.id)
        .order('stop_sequence');

    stopsData = stops || [];

    // Load products for all stops
    if (stopsData.length > 0) {
        const stopIds = stopsData.map(s => s.id);
        const { data: products } = await sb
            .from('stop_products')
            .select('*')
            .in('route_stop_id', stopIds);

        productsData = {};
        (products || []).forEach(p => {
            if (!productsData[p.route_stop_id]) productsData[p.route_stop_id] = [];
            productsData[p.route_stop_id].push(p);
        });
    }

    document.getElementById('routeLoading').style.display = 'none';

    // If already in transit, go directly to stops
    if (routeData.status === 'in_transit') {
        routeStartTime = routeData.started_at ? new Date(routeData.started_at) : new Date();
        renderRouteScreen();
        showScreen('screenStops');
        showToast('Route resumed', 'success');
    } else {
        // Show route overview with START button
        renderStartScreen();
        showScreen('screenStart');
    }
}

function renderStartScreen() {
    document.getElementById('startRouteName').textContent = routeData.route_name || routeData.route_code;
    document.getElementById('startRouteCode').textContent = routeData.route_code;
    document.getElementById('startVehicle').textContent = routeData.vehicle_number || '--';
    document.getElementById('startVendor').textContent = routeData.vendor_name || '--';
    document.getElementById('startDistrict').textContent = routeData.district || '--';
    document.getElementById('startStopCount').textContent = stopsData.length + ' stops';

    // Show customer list preview
    var preview = stopsData.map(function(s, i) { 
        return '<div class="start-stop-item">' + (i+1) + '. ' + s.customer_name + '</div>'; 
    }).join('');
    document.getElementById('startStopPreview').innerHTML = preview;
}

async function handleRouteStart() {
    // Validate required fields
    var initialKm = document.getElementById('startInitialKm').value.trim();
    var transitVolume = document.getElementById('startTransitVolume').value.trim();
    var vehicleCapacity = document.getElementById('startVehicleCapacity').value.trim();

    if (!initialKm) { showToast('Enter initial KM reading', 'warning'); return; }

    var btn = document.getElementById('btnStartRoute');
    btn.disabled = true;
    btn.textContent = 'Starting...';

    routeStartTime = new Date();
    var gps = await getGPS();

    await sb.from('routes').update({
        status: 'in_transit',
        started_at: routeStartTime.toISOString(),
        start_gps_lat: gps.lat,
        start_gps_lng: gps.lng,
        initial_km_reading: Number(initialKm) || null,
        transit_volume_mt: Number(transitVolume) || null,
        vehicle_capacity_mt: Number(vehicleCapacity) || null
    }).eq('id', routeData.id);

    // Log event
    await sb.from('delivery_events').insert({
        route_id: routeData.id,
        event_type: 'route_started',
        gps_lat: gps.lat,
        gps_lng: gps.lng,
        performed_by: currentUser ? currentUser.id : null
    });

    // Update local routeData with the values we just saved
    routeData.initial_km_reading = Number(initialKm) || null;
    routeData.transit_volume_mt = Number(transitVolume) || null;
    routeData.vehicle_capacity_mt = Number(vehicleCapacity) || null;
    routeData.status = 'in_transit';
    routeData.started_at = routeStartTime.toISOString();

    btn.disabled = false;
    btn.textContent = 'START';

    showToast('Route started', 'success');
    renderRouteScreen();
    showScreen('screenStops');
}

function renderRouteScreen() {
    document.getElementById('routeName').textContent = routeData.route_name || routeData.route_code;
    document.getElementById('routeCode').textContent = routeData.route_code;
    document.getElementById('routeVehicle').textContent = routeData.vehicle_number || '--';
    document.getElementById('routeVendor').textContent = routeData.vendor_name || '--';
    document.getElementById('totalStops').textContent = stopsData.length;

    renderStopList();
}

function renderStopList() {
    const list = document.getElementById('stopList');
    let completed = 0;

    let html = '';
    stopsData.forEach((stop, i) => {
        if (stop.status === 'delivered' || stop.status === 'partial') completed++;
        if (stop.status === 'failed') completed++;

        const statusClass = stop.status === 'delivered' ? 'done' : 
                           stop.status === 'partial' ? 'partial' :
                           stop.status === 'failed' ? 'failed' : 'pending';

        const indicator = stop.status === 'delivered' ? '' : 
                         stop.status === 'failed' ? 'X' : (i + 1);

        const prods = productsData[stop.id] || [];
        const totalQty = prods.reduce((s, p) => s + (p.quantity || 0), 0);
        const timeStr = stop.delivered_at ? '<div class="stop-time">' + formatTime(stop.delivered_at) + '</div>' : '';

        html += '<li class="stop-item ' + statusClass + '" onclick="openDelivery(' + i + ')">';
        html += '<div class="stop-indicator ' + statusClass + '">' + indicator + '</div>';
        html += '<div class="stop-info">';
        html += '<div class="stop-name">' + stop.customer_name + '</div>';
        html += '<div class="stop-detail">' + (stop.address || '').substring(0, 40) + ' - ' + totalQty + ' units</div>';
        html += timeStr;
        html += '</div></li>';
    });

    list.innerHTML = html;

    // Update progress
    const pct = stopsData.length > 0 ? Math.round((completed / stopsData.length) * 100) : 0;
    document.getElementById('doneCount').textContent = completed;
    document.getElementById('progressFill').style.width = pct + '%';
    document.getElementById('progressLabel').textContent = pct + '%';

    // Check if all done
    if (stopsData.length > 0 && stopsData.every(s => s.status !== 'pending')) {
        setTimeout(showRouteComplete, 500);
    }
}
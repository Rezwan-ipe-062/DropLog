// ============================================================
// DropLog SO App - Route Loading & Display
// ============================================================
let routeData = null;
let stopsData = [];
let productsData = {};
let routeStartTime = null;

async function loadMyRoutes() {
    if (!sb || !currentUser) { showScreen('screenLogin'); return; }

    document.getElementById('myRoutesList').innerHTML = '';
    document.getElementById('myRoutesLoading').style.display = 'block';
    showScreen('screenMyRoutes');

    try {
        const { data, error } = await sb
            .from('routes')
            .select('id, route_code, route_name, district, vehicle_number, status, total_stops, completed_stops, failed_stops')
            .eq('assigned_so_id', currentUser.id)
            .in('status', ['pending', 'in_transit'])
            .order('created_at', { ascending: false });

        document.getElementById('myRoutesLoading').style.display = 'none';

        if (error) { showToast('Error loading routes', 'error'); return; }

        const container = document.getElementById('myRoutesList');

        if (!data || data.length === 0) {
            container.innerHTML = '<div class="empty-text" style="margin-top:40px;">No routes assigned to you.</div>';
            return;
        }

        container.innerHTML = data.map(r => {
            const isInTransit = r.status === 'in_transit';
            const done = (r.completed_stops || 0) + (r.failed_stops || 0);
            const pct = r.total_stops > 0 ? Math.round((done / r.total_stops) * 100) : 0;

            return '<div class="route-card" onclick="handleRouteSelect(\'' + r.id + '\', ' + isInTransit + ')">' +
                '<div class="route-card-header">' +
                '<h3>' + escapeHtml(r.route_name || r.route_code) + '</h3>' +
                '<span class="route-card-status ' + r.status + '">' + (isInTransit ? 'In Transit' : 'Pending') + '</span>' +
                '</div>' +
                '<div class="route-card-meta">' +
                '<span>' + escapeHtml(r.district || '') + '</span>' +
                '<span>' + escapeHtml(r.vehicle_number || '') + '</span>' +
                '<span>' + done + '/' + (r.total_stops || 0) + ' stops</span>' +
                '</div>' +
                (isInTransit ? '<div class="route-card-progress"><div class="progress-bar"><div class="progress-fill" style="width:' + pct + '%"></div></div><span>' + pct + '%</span></div>' : '') +
                '</div>';
        }).join('');
    } catch (e) {
        console.error('loadMyRoutes:', e);
        document.getElementById('myRoutesLoading').style.display = 'none';
        showToast(e.message || 'Something went wrong', 'error');
    }
}

async function handleRouteSelect(routeId, isInTransit) {
    try {
        if (!sb) return;

        document.getElementById('myRoutesLoading').style.display = 'block';

        const { data: route, error } = await sb
            .from('routes')
            .select('*')
            .eq('id', routeId)
            .single();

        if (error || !route) { showToast('Route not found', 'error'); return; }

        routeData = route;

        const { data: stops } = await sb
            .from('route_stops')
            .select('*')
            .eq('route_id', route.id)
            .order('stop_sequence');

        stopsData = stops || [];

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

        if (isInTransit) {
            routeStartTime = routeData.started_at ? new Date(routeData.started_at) : new Date();
            renderRouteScreen();
            showScreen('screenStops');
            showToast('Route resumed', 'success');
        } else {
            renderStartScreen();
            showScreen('screenStart');
        }
    } catch (e) {
        console.error('handleRouteSelect:', e);
        showToast(e.message || 'Something went wrong', 'error');
    }
}

async function handleStartRoute() {
    try {
        const code = document.getElementById('routeInput').value.trim();
        if (!code) { showToast('Enter route code', 'warning'); return; }
        if (!sb) { showToast('Connecting...', 'warning'); return; }
        if (!currentUser || !currentUser.warehouse) {
            showToast('Session error — re-login', 'error');
            return;
        }

        document.getElementById('routeLoading').style.display = 'block';

        const { data: route, error } = await sb
            .from('routes')
            .select('*')
            .eq('route_code', code)
            .eq('plant_name', currentUser.warehouse)
            .single();

        if (error || !route) {
            document.getElementById('routeLoading').style.display = 'none';
            showToast('Route not found in your warehouse', 'error');
            return;
        }

        routeData = route;

        // Load stops
        const { data: stops, error: stopsErr } = await sb
            .from('route_stops')
            .select('*')
            .eq('route_id', route.id)
            .order('stop_sequence');

        if (stopsErr) {
            document.getElementById('routeLoading').style.display = 'none';
            showToast('Failed to load stops', 'error');
            return;
        }
        stopsData = stops || [];

        // Load products for all stops
        if (stopsData.length > 0) {
            const stopIds = stopsData.map(s => s.id);
            const { data: products, error: prodErr } = await sb
                .from('stop_products')
                .select('*')
                .in('route_stop_id', stopIds);

            if (prodErr) console.error('products load failed:', prodErr);
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
    } catch (e) {
        console.error('handleStartRoute:', e);
        showToast(e.message || 'Something went wrong', 'error');
    }
}

function renderStartScreen() {
    document.getElementById('startRouteName').textContent = routeData.route_name || routeData.route_code;
    document.getElementById('startRouteCode').textContent = routeData.route_code;
    document.getElementById('startVehicle').textContent = routeData.vehicle_number || '--';
    document.getElementById('startVendor').textContent = routeData.vendor_name || '--';
    document.getElementById('startDistrict').textContent = routeData.district || '--';
    document.getElementById('startStopCount').textContent = stopsData.length + ' stops';

    // Auto-fill vehicle capacity from fleet registry
    if (routeData.vehicle_number && sb) {
        sb.from('fleet_vehicles').select('capacity_kg').eq('vehicle_number', routeData.vehicle_number).maybeSingle().then(function(res) {
            if (res.data && res.data.capacity_kg) {
                document.getElementById('startVehicleCapacity').value = (res.data.capacity_kg / 1000).toFixed(1);
            }
        }).catch(function() {});
    }

    // Show customer list preview
    var preview = stopsData.map(function(s, i) { 
        return '<div class="start-stop-item">' + (i+1) + '. ' + escapeHtml(s.customer_name) + '</div>'; 
    }).join('');
    document.getElementById('startStopPreview').innerHTML = preview;
}

async function handleRouteStart() {
    try {
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
    } catch (e) {
        console.error('handleRouteStart:', e);
        showToast(e.message || 'Something went wrong', 'error');
    }
}

function renderRouteScreen() {
    document.getElementById('routeName').textContent = routeData.route_name || routeData.route_code;
    document.getElementById('routeCode').textContent = routeData.route_code;
    document.getElementById('routeVehicle').textContent = routeData.vehicle_number || '--';
    document.getElementById('routeVendor').textContent = routeData.vendor_name || '--';
    document.getElementById('totalStops').textContent = stopsData.length;

    const chip = document.getElementById('statusChip');
    if (chip) chip.textContent = routeData.status === 'in_transit' ? 'In Transit' : routeData.status || 'In Transit';

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
                         stop.status === 'failed' ? 'X' :
                         stop.status === 'partial' ? '\u00BD' : (i + 1);

        const prods = productsData[stop.id] || [];
        const totalQty = prods.reduce((s, p) => s + (p.quantity || 0), 0);
        const timeStr = stop.delivered_at ? '<div class="stop-time">' + formatTime(stop.delivered_at) + '</div>' : '';

        html += '<li class="stop-item ' + statusClass + '" data-index="' + i + '">';
        html += '<div class="drag-handle"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg></div>';
        html += '<div class="stop-indicator ' + statusClass + '" onclick="openDelivery(' + i + ')">' + indicator + '</div>';
        html += '<div class="stop-info" onclick="openDelivery(' + i + ')">';
        html += '<div class="stop-name">' + escapeHtml(stop.customer_name) + '</div>';
        html += '<div class="stop-detail">' + escapeHtml((stop.address || '').substring(0, 40)) + ' - ' + totalQty + ' units</div>';
        html += timeStr;
        html += '</div></li>';
    });

    // Destroy previous Sortable instance before wiping DOM
    if (list._sortable) list._sortable.destroy();

    list.innerHTML = html;

    // Init SortableJS for drag & drop reorder
    if (typeof Sortable !== 'undefined') {
        list._sortable = Sortable.create(list, {
            handle: '.drag-handle',
            animation: 200,
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            dragClass: 'sortable-drag',
            onEnd: function() {
                document.getElementById('btnSaveOrder').style.display = 'block';
            }
        });
    }

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

async function saveStopOrder() {
    try {
        const list = document.getElementById('stopList');
        const items = list.querySelectorAll('.stop-item');
        const btn = document.getElementById('btnSaveOrder');
        btn.textContent = 'Saving...';
        btn.disabled = true;

        const updates = [];
        items.forEach((li, idx) => {
            const oldIdx = parseInt(li.dataset.index, 10);
            if (oldIdx !== idx) {
                updates.push({ id: stopsData[oldIdx].id, stop_sequence: idx + 1 });
            }
        });

        if (updates.length === 0) {
            btn.style.display = 'none';
            btn.textContent = 'Save Stop Order';
            btn.disabled = false;
            return;
        }

        // Update local array
        const newOrder = [];
        items.forEach(li => {
            const oldIdx = parseInt(li.dataset.index, 10);
            newOrder.push(stopsData[oldIdx]);
        });
        stopsData = newOrder;

        // Persist to database
        for (const u of updates) {
            await sb.from('route_stops').update({ stop_sequence: u.stop_sequence }).eq('id', u.id);
        }

        btn.style.display = 'none';
        btn.textContent = 'Save Stop Order';
        btn.disabled = false;

        renderRouteScreen();
        showToast('Stop order saved', 'success');
    } catch (e) {
        console.error('saveStopOrder:', e);
        showToast(e.message || 'Failed to save order', 'error');
    }
}
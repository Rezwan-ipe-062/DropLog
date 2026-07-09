// ============================================================
// DropLog Admin - Route Builder Module (FIXED v2)
// ============================================================

let availableGDs = [];
let isCreatingRoute = false;
let selectedGDs = new Set();
let soList = [];
let stopsCache = {}; // gd_id > stops array

async function loadAvailableGDs() {
    if (!sb) return;

    try {
        const wh = getWarehouseName();

        const { data: gds, error } = await sb
            .from('available_gds')
            .select('*')
            .eq('status', 'available')
            .order('posting_date', { ascending: false });

        if (error) {
            console.error('loadAvailableGDs error:', error);
            showToast('Error loading GDs', 'error');
            return;
        }

        availableGDs = gds || [];
        console.log('[DEBUG] Loaded GDs:', availableGDs.length, 'for warehouse:', wh);

        // Load stops separately
        if (availableGDs.length > 0) {
            const gdIds = availableGDs.map(g => g.id);
            const { data: stops } = await sb
                .from('parsed_stops')
                .select('*')
                .in('gd_id', gdIds);

            // Build cache: gd_id > [stops]
            stopsCache = {};
            (stops || []).forEach(s => {
                if (!stopsCache[s.gd_id]) stopsCache[s.gd_id] = [];
                stopsCache[s.gd_id].push(s);
            });
            console.log('Loaded stops:', (stops || []).length);
        }

        selectedGDs.clear();
        renderRouteBuilder();

        // Load SO list (scoped to active warehouse)
        const { data: users } = await sb
            .from('users')
            .select('*')
            .eq('role', 'so')
            .eq('is_active', true)
            .eq('warehouse', wh);
        soList = users || [];
    } catch (e) {
        console.error('loadAvailableGDs:', e);
        showToast(e.message || 'Something went wrong', 'error');
    }
}

function getStopsForGD(gd) {
    return stopsCache[gd.id] || [];
}

function renderRouteBuilder() {
    const container = document.getElementById('routeBuilderContent');
    if (!container) return;

    console.log('[DEBUG] renderRouteBuilder: availableGDs.length=' + availableGDs.length + ' selectedGDs.size=' + selectedGDs.size);

    if (availableGDs.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No available GDs. Upload an SAP export first.</p></div>';
        return;
    }

    try {
        const multiStop = availableGDs.filter(g => g.is_multi_stop);
        const singleStop = availableGDs.filter(g => !g.is_multi_stop);
        const bundles = groupSinglesIntoBundles(singleStop);

        console.log('[DEBUG] renderRouteBuilder: multi=' + multiStop.length + ' single=' + singleStop.length + ' bundles=' + bundles.length);

        let html = '';

        if (multiStop.length > 0) {
            html += '<div class="rb-section">';
            html += '<h3 class="rb-section-title">Auto-Detected Routes <span class="badge">' + multiStop.length + '</span></h3>';
            html += '<p class="rb-section-desc">These GDs have multiple stops. Assign vehicle & SO to create route.</p>';
            multiStop.forEach(gd => { html += renderGDCard(gd); });
            html += '</div>';
        }

        if (bundles.length > 0) {
            html += '<div class="rb-section">';
            html += '<h3 class="rb-section-title">Suggested Bundles <span class="badge">' + bundles.length + '</span></h3>';
            html += '<p class="rb-section-desc">Single-stop GDs grouped by date & district. Bundle onto one truck.</p>';
            bundles.forEach((bundle, idx) => { html += renderBundleCard(bundle, idx); });
            html += '</div>';
        }

        const bundledGdNums = new Set(bundles.flatMap(b => b.gds.map(g => g.group_delivery_number)));
        const unbundled = singleStop.filter(g => !bundledGdNums.has(g.group_delivery_number));
        if (unbundled.length > 0) {
            html += '<div class="rb-section">';
            html += '<h3 class="rb-section-title">Individual GDs <span class="badge">' + unbundled.length + '</span></h3>';
            unbundled.forEach(gd => { html += renderGDCard(gd); });
            html += '</div>';
        }

        html += '<div id="routeCreateForm" class="route-create-form" style="display:none;">';
        html += renderRouteForm();
        html += '</div>';

        container.innerHTML = html;
        console.log('[DEBUG] renderRouteBuilder: rendered OK');
    } catch (e) {
        console.error('[DEBUG] renderRouteBuilder CRASH:', e);
        container.innerHTML = '<div class="empty-state"><p style="color:var(--red)">Render error: ' + escapeHtml(e.message) + '</p></div>';
        showToast('Render error — see console', 'error');
    }
}

function renderGDCard(gd) {
    if (!gd || !gd.group_delivery_number) {
        console.warn('[DEBUG] renderGDCard: invalid gd', gd);
        return '';
    }

    const stops = getStopsForGD(gd) || [];
    const isSelected = selectedGDs.has(gd.group_delivery_number);
    const isMulti = gd.is_multi_stop;
    const numCust = gd.num_unique_customers || 0;
    const totalQty = gd.total_quantity || 0;

    const gdNum = escapeHtml(String(gd.group_delivery_number));

    let html = '<div class="gd-card ' + (isSelected ? 'selected' : '') + (isMulti ? ' multi' : '') + '" ';
    html += 'onclick="toggleGDSelection(\'' + gdNum.replace(/'/g, '\\\'') + '\')">';

    html += '<div class="gd-card-header">';
    html += '<input type="checkbox" ' + (isSelected ? 'checked' : '') + ' class="gd-checkbox">';
    html += '<div class="gd-card-title">';
    html += '<strong>GD ' + gdNum + '</strong>';
    html += '<span class="gd-meta">' + escapeHtml(String(gd.district || '')) + ' - ' + formatDate(gd.posting_date) + '</span>';
    html += '</div>';
    html += '<div class="gd-card-stats">';
    html += '<span class="stat-pill">' + numCust + ' stop' + (numCust !== 1 ? 's' : '') + '</span>';
    html += '<span class="stat-pill">' + Math.round(totalQty) + ' units</span>';
    html += '</div>';
    html += '</div>';

    if (stops.length > 0) {
        html += '<div class="gd-stops-list">';
        stops.forEach(s => {
            if (!s) return;
            html += '<div class="gd-stop-item">> ' + escapeHtml(String(s.customer_name || '?')) + ' <span class="qty-badge">' + Math.round(s.total_quantity || 0) + '</span></div>';
        });
        html += '</div>';
    }

    html += '</div>';
    return html;
}

function renderBundleCard(bundle, idx) {
    if (!bundle || !bundle.gds) {
        console.warn('[DEBUG] renderBundleCard: invalid bundle', bundle);
        return '';
    }

    const isAllSelected = bundle.gds.every(g => g && selectedGDs.has(g.group_delivery_number));

    let html = '<div class="bundle-card ' + (isAllSelected ? 'selected' : '') + '">';
    html += '<div class="bundle-header" onclick="toggleBundleSelection(' + idx + ')">';
    html += '<input type="checkbox" ' + (isAllSelected ? 'checked' : '') + ' class="gd-checkbox">';
    html += '<div>';
    html += '<strong>' + escapeHtml(bundle.district || '?') + '</strong> - ' + formatDate(bundle.date);
    html += '<span class="gd-meta"> - ' + (bundle.gds.length || 0) + ' GDs, ' + (bundle.totalCustomers || 0) + ' customers, ' + Math.round(bundle.totalQty || 0) + ' units</span>';
    html += '</div>';
    html += '</div>';

    html += '<div class="bundle-gds">';
    bundle.gds.forEach(gd => {
        if (!gd || !gd.group_delivery_number) return;
        const stops = getStopsForGD(gd);
        const custName = stops.length > 0 ? (stops[0].customer_name || '?') : (gd.district || 'Customer');
        const isSelected = selectedGDs.has(gd.group_delivery_number);
        const gdNumEsc = escapeHtml(String(gd.group_delivery_number));

        html += '<div class="bundle-gd-item ' + (isSelected ? 'selected' : '') + '" onclick="event.stopPropagation(); toggleGDSelection(\'' + gdNumEsc.replace(/'/g, '\\\'') + '\')">';
        html += '<input type="checkbox" ' + (isSelected ? 'checked' : '') + '>';
        html += '<span>' + escapeHtml(custName) + '</span>';
        html += '<span class="qty-badge">' + Math.round(gd.total_quantity || 0) + ' units</span>';
        html += '</div>';
    });
    html += '</div>';
    html += '</div>';

    return html;
}

function renderRouteForm() {
    let html = '<h3>Create Route</h3>';
    html += '<div class="form-row">';
    html += '<div class="form-group"><label>Vehicle Number</label><input type="text" id="rfVehicle" placeholder="e.g. DM AU-11-1917"></div>';
    html += '<div class="form-group"><label>Vehicle Type</label><select id="rfVehicleType"><option value="cover_truck">Cover Truck</option><option value="open_truck">Open Truck</option><option value="pickup">Pickup</option></select></div>';
    html += '<div class="form-group"><label>Vendor</label><input type="text" id="rfVendor" placeholder="e.g. Rupali Agencies"></div>';
    html += '</div>';
    html += '<div class="form-row">';
    html += '<div class="form-group"><label>Assign SO</label><select id="rfSO"><option value="">- Select Supply Officer -</option></select></div>';
    html += '<div class="form-group"><label>Route Name (optional)</label><input type="text" id="rfName" placeholder="e.g. Feni Route 1"></div>';
    html += '</div>';
    html += '<div class="form-row"><div class="selected-summary" id="rfSummary"></div></div>';
    html += '<button class="btn-create-route" onclick="createRoute()">Create Route</button>';
    return html;
}

// ---- Selection ----

function toggleGDSelection(gdNum) {
    console.log('[DEBUG] toggleGDSelection: gdNum=' + gdNum + ' wasSelected=' + selectedGDs.has(gdNum));
    if (selectedGDs.has(gdNum)) selectedGDs.delete(gdNum);
    else selectedGDs.add(gdNum);
    renderRouteBuilder();
    updateRouteForm();
}

function toggleBundleSelection(bundleIdx) {
    const singleStop = availableGDs.filter(g => !g.is_multi_stop);
    const bundles = groupSinglesIntoBundles(singleStop);
    const bundle = bundles[bundleIdx];
    if (!bundle) return;

    const allSelected = bundle.gds.every(g => selectedGDs.has(g.group_delivery_number));
    bundle.gds.forEach(gd => {
        if (allSelected) selectedGDs.delete(gd.group_delivery_number);
        else selectedGDs.add(gd.group_delivery_number);
    });

    renderRouteBuilder();
    updateRouteForm();
}

function updateRouteForm() {
    const form = document.getElementById('routeCreateForm');
    if (selectedGDs.size === 0) { form.style.display = 'none'; return; }
    form.style.display = 'block';

    const soSelect = document.getElementById('rfSO');
    if (soSelect && soSelect.options.length <= 1) {
        soList.forEach(so => {
            const opt = document.createElement('option');
            opt.value = so.id;
            opt.textContent = so.name + ' (' + so.user_id + ')';
            soSelect.appendChild(opt);
        });
    }

    const selGDs = availableGDs.filter(g => selectedGDs.has(g.group_delivery_number));
    const totalStops = selGDs.reduce((s, g) => s + g.num_unique_customers, 0);
    const totalQty = selGDs.reduce((s, g) => s + g.total_quantity, 0);
    const districts = [...new Set(selGDs.map(g => g.district))];

    document.getElementById('rfSummary').innerHTML = 
        '<strong>Selected:</strong> ' + selectedGDs.size + ' GDs > ' + totalStops + ' stops > ' + Math.round(totalQty) + ' units<br>' +
        '<strong>Districts:</strong> ' + districts.map(d => escapeHtml(d)).join(', ');
}

// ---- Create Route ----

async function createRoute() {
    if (selectedGDs.size === 0) { showToast('Select at least one GD', 'warning'); return; }
    if (isCreatingRoute) return;
    isCreatingRoute = true;
    document.querySelector('.btn-create-route').disabled = true;
    document.querySelector('.btn-create-route').textContent = 'Creating...';

    const vehicle = document.getElementById('rfVehicle').value.trim();
    const vehicleType = document.getElementById('rfVehicleType').value;
    const vendor = document.getElementById('rfVendor').value.trim();
    const soId = document.getElementById('rfSO').value;
    const routeName = document.getElementById('rfName').value.trim();

    if (!vehicle) { showToast('Enter vehicle number', 'warning'); return; }

    const selGDs = availableGDs.filter(g => selectedGDs.has(g.group_delivery_number));
    const districts = [...new Set(selGDs.map(g => g.district))];
    const dispatchDate = selGDs[0].posting_date || new Date().toISOString().slice(0, 10);
    const routeCode = generateRouteCode(districts[0], dispatchDate);

    // Collect stops
    const allStops = [];
    selGDs.forEach(gd => {
        const stops = getStopsForGD(gd);
        stops.forEach(s => allStops.push(s));
    });

    try {
        const { data: routeData, error: routeErr } = await sb
            .from('routes')
            .insert({
                route_code: routeCode,
                route_name: routeName || (districts.join('+') + ' Route'),
                assigned_so_id: soId || null,
                vehicle_number: vehicle,
                vehicle_type: vehicleType,
                vendor_name: vendor,
                dispatch_date: dispatchDate,
                plant_name: selGDs[0].plant_name,
                district: districts.join(', '),
                group_delivery_numbers: Array.from(selectedGDs),
                total_stops: allStops.length,
                created_by: currentAdmin ? currentAdmin.id : null
            })
            .select()
            .single();

        if (routeErr) { showToast('Error: ' + routeErr.message, 'error'); return; }

        const routeId = routeData.id;

        // Create route_stops
        for (let i = 0; i < allStops.length; i++) {
            const stop = allStops[i];
            const { data: rsData } = await sb.from('route_stops').insert({
                route_id: routeId,
                stop_sequence: i + 1,
                customer_id: stop.customer_id,
                customer_name: stop.customer_name,
                address: stop.address,
                district: stop.district,
                delivery_documents: stop.delivery_documents,
                parsed_stop_id: stop.id
            }).select().single();

            if (!rsData) continue;

            // Copy products
            const { data: prods } = await sb.from('parsed_products').select('*').eq('stop_id', stop.id);
            if (prods && prods.length > 0) {
                await sb.from('stop_products').insert(prods.map(p => ({
                    route_stop_id: rsData.id,
                    material_code: p.material_code,
                    material_description: p.material_description,
                    batch: p.batch,
                    quantity: p.quantity,
                    unit: p.unit,
                    is_foc: p.is_foc
                })));
            }
        }

        // Mark GDs as assigned
        for (const gdNum of selectedGDs) {
            await sb.from('available_gds').update({ status: 'assigned' }).eq('group_delivery_number', gdNum);
        }

        showToast('Route ' + routeCode + ' created!', 'success');
        selectedGDs.clear();
        isCreatingRoute = false;
        loadAvailableGDs();

    } catch (err) {
        showToast('Error: ' + err.message, 'error');
        isCreatingRoute = false;
        const btn = document.querySelector('.btn-create-route');
        if (btn) { btn.disabled = false; btn.textContent = 'Create Route'; }
    }
}

function groupSinglesIntoBundles(singleStopGDs) {
    const groups = {};
    singleStopGDs.forEach(gd => {
        const key = (gd.posting_date || 'nodate') + '||' + (gd.district || 'nodistrict');
        if (!groups[key]) groups[key] = { date: gd.posting_date, district: gd.district, gds: [], totalQty: 0, totalCustomers: 0 };
        groups[key].gds.push(gd);
        groups[key].totalQty += gd.total_quantity;
        groups[key].totalCustomers += gd.num_unique_customers;
    });
    return Object.values(groups).filter(b => b.gds.length >= 2).sort((a, b) => b.gds.length - a.gds.length);
}
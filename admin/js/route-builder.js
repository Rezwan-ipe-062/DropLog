// ============================================================
// DropLog Admin - Route Builder Module v3
// ============================================================

let availableGDs = [];
let isCreatingRoute = false;
let selectedGDs = new Set();
let soList = [];
let fleetVehicles = [];
let vendors = [];
let stopsCache = {};

async function loadAvailableGDs() {
    if (!sb) return;

    const { data: gds, error } = await sb
        .from('available_gds')
        .select('*')
        .eq('status', 'available')
        .eq('warehouse', getActiveWarehouse())
        .order('posting_date', { ascending: false });

    if (error) {
        console.error('loadAvailableGDs error:', error);
        showToast('Error loading GDs', 'error');
        return;
    }

    availableGDs = gds || [];

    if (availableGDs.length > 0) {
        const gdIds = availableGDs.map(g => g.id);
        const { data: stops } = await sb
            .from('parsed_stops')
            .select('*')
            .in('gd_id', gdIds);

        stopsCache = {};
        (stops || []).forEach(s => {
            if (!stopsCache[s.gd_id]) stopsCache[s.gd_id] = [];
            stopsCache[s.gd_id].push(s);
        });
    }

    selectedGDs.clear();
    await loadFleetData();
    renderRouteBuilder();

    const { data: users } = await sb
        .from('users')
        .select('*')
        .eq('role', 'so')
        .eq('is_active', true);
    soList = users || [];
}

function getStopsForGD(gd) {
    return stopsCache[gd.id] || [];
}

function renderRouteBuilder() {
    const container = document.getElementById('routeBuilderContent');
    if (!container) return;

    if (availableGDs.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No available GDs. Upload an SAP export first.</p></div>';
        return;
    }

    const multiStop = availableGDs.filter(g => g.is_multi_stop);
    const singleStop = availableGDs.filter(g => !g.is_multi_stop);
    const bundles = groupSinglesIntoBundles(singleStop);

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
}

function renderGDCard(gd) {
    const stops = getStopsForGD(gd);
    const isSelected = selectedGDs.has(gd.group_delivery_number);
    const isMulti = gd.is_multi_stop;

    let html = '<div class="gd-card ' + (isSelected ? 'selected' : '') + (isMulti ? ' multi' : '') + '" ';
    html += 'onclick="toggleGDSelection(\'' + gd.group_delivery_number + '\')">';

    html += '<div class="gd-card-header">';
    html += '<input type="checkbox" ' + (isSelected ? 'checked' : '') + ' class="gd-checkbox">';
    html += '<div class="gd-card-title">';
    html += '<strong>GD ' + gd.group_delivery_number + '</strong>';
    html += '<span class="gd-meta">' + (gd.district || '') + ' - ' + formatDate(gd.posting_date) + '</span>';
    html += '</div>';
    html += '<div class="gd-card-stats">';
    html += '<span class="stat-pill">' + gd.num_unique_customers + ' stop' + (gd.num_unique_customers > 1 ? 's' : '') + '</span>';
    html += '<span class="stat-pill">' + Math.round(gd.total_quantity) + ' units</span>';
    html += '</div>';
    html += '</div>';

    if (stops.length > 0) {
        html += '<div class="gd-stops-list">';
        stops.forEach(s => {
            html += '<div class="gd-stop-item">> ' + s.customer_name + ' <span class="qty-badge">' + Math.round(s.total_quantity) + '</span></div>';
        });
        html += '</div>';
    }

    html += '</div>';
    return html;
}

function renderBundleCard(bundle, idx) {
    const isAllSelected = bundle.gds.every(g => selectedGDs.has(g.group_delivery_number));

    let html = '<div class="bundle-card ' + (isAllSelected ? 'selected' : '') + '">';
    html += '<div class="bundle-header" onclick="toggleBundleSelection(' + idx + ')">';
    html += '<input type="checkbox" ' + (isAllSelected ? 'checked' : '') + ' class="gd-checkbox">';
    html += '<div>';
    html += '<strong>' + bundle.district + '</strong> - ' + formatDate(bundle.date);
    html += '<span class="gd-meta"> - ' + bundle.gds.length + ' GDs, ' + bundle.totalCustomers + ' customers, ' + Math.round(bundle.totalQty) + ' units</span>';
    html += '</div>';
    html += '</div>';

    html += '<div class="bundle-gds">';
    bundle.gds.forEach(gd => {
        const stops = getStopsForGD(gd);
        const custName = stops.length > 0 ? stops[0].customer_name : (gd.district || 'Customer');
        const isSelected = selectedGDs.has(gd.group_delivery_number);

        html += '<div class="bundle-gd-item ' + (isSelected ? 'selected' : '') + '" onclick="event.stopPropagation(); toggleGDSelection(\'' + gd.group_delivery_number + '\')">';
        html += '<input type="checkbox" ' + (isSelected ? 'checked' : '') + '>';
        html += '<span>' + custName + '</span>';
        html += '<span class="qty-badge">' + Math.round(gd.total_quantity) + ' units</span>';
        html += '</div>';
    });
    html += '</div>';
    html += '</div>';

    return html;
}

function renderRouteForm() {
    let html = '<h3>Create Route</h3>';
    html += '<div class="form-row">';
    html += '<div class="form-group"><label>Vehicle</label><select id="rfVehicle" onchange="onVehicleChange()"><option value="">- Select Vehicle -</option></select></div>';
    html += '<div class="form-group"><label>Vehicle Type</label><input type="text" id="rfVehicleType" readonly style="background:var(--gray-100);"></div>';
    html += '<div class="form-group"><label>Vendor</label><select id="rfVendor"><option value="">- Select Vendor -</option></select></div>';
    html += '</div>';
    html += '<div class="form-row">';
    html += '<div class="form-group"><label>Assign SO</label><select id="rfSO"><option value="">- Select Supply Officer -</option></select></div>';
    html += '<div class="form-group"><label>Route Name (optional)</label><input type="text" id="rfName" placeholder="e.g. Feni Route 1"></div>';
    html += '</div>';
    html += '<div class="form-row"><div class="selected-summary" id="rfSummary"></div></div>';
    html += '<button class="btn-create-route" onclick="createRoute()">Create Route</button>';
    return html;
}

function onVehicleChange() {
    const sel = document.getElementById('rfVehicle');
    const selected = sel.options[sel.selectedIndex];
    const typeField = document.getElementById('rfVehicleType');
    if (selected && selected.dataset.type) {
        typeField.value = selected.dataset.type;
    } else {
        typeField.value = '';
    }
}

// ---- Selection ----

function toggleGDSelection(gdNum) {
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

    // Populate vehicle dropdown
    const vehicleSelect = document.getElementById('rfVehicle');
    if (vehicleSelect && vehicleSelect.options.length <= 1) {
        fleetVehicles.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v.vehicle_number;
            opt.textContent = v.vehicle_number + ' (' + v.vehicle_type.replace('_', ' ') + ', ' + (v.capacity_mt || '?') + ' MT)';
            opt.dataset.type = v.vehicle_type;
            vehicleSelect.appendChild(opt);
        });
    }

    // Populate vendor dropdown
    const vendorSelect = document.getElementById('rfVendor');
    if (vendorSelect && vendorSelect.options.length <= 1) {
        vendors.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v.vendor_name;
            opt.textContent = v.vendor_name;
            vendorSelect.appendChild(opt);
        });
    }

    // Populate SO dropdown
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
        '<strong>Districts:</strong> ' + districts.join(', ');
}

// ---- Generate UUID-based route code ----
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function generateRouteCode(district, date) {
    const d = new Date(date);
    const dateStr = d.toISOString().slice(0, 10).replace(/-/g, '');
    const distShort = (district || 'UNK').substring(0, 4).toUpperCase();
    const shortId = generateUUID().substring(0, 6).toUpperCase();
    var plantShort = (typeof CONFIG !== 'undefined' && CONFIG.PLANT_SHORT) ? CONFIG.PLANT_SHORT : 'CTG';
    return plantShort + '-' + distShort + '-' + dateStr + '-' + shortId;
}

// ---- Create Route ----

async function createRoute() {
    if (selectedGDs.size === 0) { showToast('Select at least one GD', 'warning'); return; }
    if (isCreatingRoute) return;

    const vehicle = document.getElementById('rfVehicle').value;
    const soId = document.getElementById('rfSO').value;
    const vendor = document.getElementById('rfVendor').value;
    const routeName = document.getElementById('rfName').value.trim();

    if (!vehicle) { showToast('Select a vehicle', 'warning'); return; }

    isCreatingRoute = true;
    const btn = document.querySelector('.btn-create-route');
    btn.disabled = true;
    btn.textContent = 'Creating...';

    try {
        const selGDs = availableGDs.filter(g => selectedGDs.has(g.group_delivery_number));
        const districts = [...new Set(selGDs.map(g => g.district))];
        const dispatchDate = selGDs[0].posting_date || new Date().toISOString().slice(0, 10);
        const routeCode = generateRouteCode(districts[0], dispatchDate);

        // Collect all stops with their products
        const allStops = [];
        const allProducts = [];
        let seq = 0;
        selGDs.forEach(gd => {
            const stops = getStopsForGD(gd);
            stops.forEach(s => {
                seq++;
                const tempId = 'tmp_' + seq;
                allStops.push({
                    temp_id: tempId,
                    route_id: null,
                    stop_sequence: seq,
                    customer_id: s.customer_id,
                    customer_name: s.customer_name,
                    address: s.address,
                    district: s.district || gd.district,
                    delivery_documents: s.delivery_documents,
                    parsed_stop_id: s.id
                });
            });
        });

        // Step 1: Insert route (no unique check on route_code - use UUID)
        const { data: routeData, error: routeErr } = await sb
            .from('routes')
            .insert({
                route_code: routeCode,
                route_name: routeName || (districts.join('+') + ' Route'),
                assigned_so_id: soId || null,
                vehicle_number: vehicle,
                vendor_name: vendor || null,
                dispatch_date: dispatchDate,
                plant_name: selGDs[0].plant_name,
                district: districts.join(', '),
                group_delivery_numbers: Array.from(selectedGDs),
                total_stops: allStops.length,
                created_by: currentAdmin ? currentAdmin.id : null
            })
            .select()
            .single();

        if (routeErr) {
            throw new Error('Route insert failed: ' + routeErr.message);
        }

        const routeId = routeData.id;

        // Step 2: Batch-insert all stops with route_id
        const stopInserts = allStops.map(s => ({
            route_id: routeId,
            stop_sequence: s.stop_sequence,
            customer_id: s.customer_id,
            customer_name: s.customer_name,
            address: s.address,
            district: s.district,
            delivery_documents: s.delivery_documents,
            parsed_stop_id: s.parsed_stop_id
        }));

        const { data: insertedStops, error: stopErr } = await sb
            .from('route_stops')
            .insert(stopInserts)
            .select();

        if (stopErr) {
            throw new Error('Stop insert failed: ' + stopErr.message);
        }

        // Step 3: Fetch all products for all parsed stops in one batch
        const parsedStopIds = allStops.map(s => s.parsed_stop_id).filter(id => id);
        if (parsedStopIds.length > 0) {
            const { data: allProds } = await sb
                .from('parsed_products')
                .select('*')
                .in('stop_id', parsedStopIds);

            // Match products to inserted stops by parsed_stop_id
            const productInserts = [];
            (insertedStops || []).forEach(rs => {
                const matchingProds = (allProds || []).filter(p => p.stop_id === rs.parsed_stop_id);
                matchingProds.forEach(p => {
                    productInserts.push({
                        route_stop_id: rs.id,
                        material_code: p.material_code,
                        material_description: p.material_description,
                        batch: p.batch,
                        quantity: p.quantity,
                        unit: p.unit,
                        is_foc: p.is_foc
                    });
                });
            });

            // Batch insert products
            if (productInserts.length > 0) {
                const { error: prodErr } = await sb.from('stop_products').insert(productInserts);
                if (prodErr) {
                    console.error('Product insert error:', prodErr);
                }
            }
        }

        // Step 4: Mark GDs as assigned (with status check to prevent double-assignment)
        for (const gdNum of selectedGDs) {
            const { error: updateErr } = await sb
                .from('available_gds')
                .update({ status: 'assigned' })
                .eq('group_delivery_number', gdNum)
                .eq('status', 'available');

            if (updateErr) {
                console.warn('GD ' + gdNum + ' may have been already assigned:', updateErr);
            }
        }

        // Step 5: Log to activity feed
        try {
            await sb.from('activity_log').insert({
                event_type: 'route_created',
                route_id: routeId,
                route_code: routeCode,
                message: 'Route ' + routeCode + ' created - ' + allStops.length + ' stops, vehicle ' + vehicle,
                severity: 'info',
                warehouse: selGDs[0].plant_name || null
            });
        } catch (e) { /* non-critical */ }

        showToast('Route ' + routeCode + ' created!', 'success');
        selectedGDs.clear();
        loadAvailableGDs();

    } catch (err) {
        showToast('Error: ' + err.message, 'error');
    } finally {
        isCreatingRoute = false;
        const btnReset = document.querySelector('.btn-create-route');
        if (btnReset) { btnReset.disabled = false; btnReset.textContent = 'Create Route'; }
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

// ---- Load fleet data for dropdowns ----
async function loadFleetData() {
    if (!sb) return;
    var wh = getActiveWarehouse();
    const [vehRes, venRes] = await Promise.all([
        sb.from('fleet_vehicles').select('*').eq('is_active', true).eq('warehouse_code', wh).order('vehicle_number'),
        sb.from('vendors').select('*').eq('warehouse_code', wh).order('vendor_name').limit(200)
    ]);
    fleetVehicles = vehRes.data || [];
    vendors = venRes.data || [];
}

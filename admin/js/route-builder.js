// ============================================================
// DropLog Admin - Route Builder Module (FIXED v2)
// ============================================================

let availableGDs = [];
let isCreatingRoute = false;
let selectedGDs = new Set();
let selectedStops = new Set();
let filterDates = new Set();
let dateDropdownOpen = false;
let soList = [];
let vehicleList = [];
let vendorList = [];
let stopsCache = {}; // gd_id > stops array

async function loadAvailableGDs() {
    if (!sb) return;

    try {
        const wh = getWarehouseName();

        const { data: gds, error } = await sb
            .from('available_gds')
            .select('*')
            .eq('status', 'available')
            .eq('plant_name', wh)
            .order('posting_date', { ascending: false });

        if (error) {
            console.error('loadAvailableGDs error:', error);
            showToast('Error loading GDs', 'error');
            return;
        }

        availableGDs = gds || [];
        // console.log('[DEBUG] Loaded GDs:', availableGDs.length, 'for warehouse:', wh);

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
            // console.log('Loaded stops:', (stops || []).length);
        }

        selectedGDs.clear();
        selectedStops.clear();
        filterDates.clear();
        dateDropdownOpen = false;
        renderRouteBuilder();

        // Load SO list (scoped to active warehouse — matches both short code and full name)
        const { data: users } = await sb
            .from('users')
            .select('*')
            .eq('role', 'so')
            .eq('is_active', true)
            .in('warehouse', [wh, ACTIVE_WAREHOUSE_CODE]);
        soList = users || [];

        // Load vehicle list
        const { data: vehicles } = await sb
            .from('fleet_vehicles')
            .select('*')
            .eq('warehouse_code', getWarehouseCode())
            .eq('is_active', true)
            .order('vehicle_number');
        vehicleList = vehicles || [];

        // Load vendor list
        const { data: vendors } = await sb
            .from('vendors')
            .select('*')
            .eq('warehouse_code', getWarehouseCode())
            .order('vendor_name');
        vendorList = vendors || [];
    } catch (e) {
        console.error('loadAvailableGDs:', e);
        showToast(e.message || 'Something went wrong', 'error');
    }
}

function getStopsForGD(gd) {
    return stopsCache[gd.id] || [];
}

function isGDAllSelected(gd) {
    const stops = getStopsForGD(gd);
    if (stops.length === 0) return false;
    return stops.every(s => selectedStops.has(s.id));
}

function isGDPartial(gd) {
    const stops = getStopsForGD(gd);
    if (stops.length === 0) return false;
    const count = stops.filter(s => selectedStops.has(s.id)).length;
    return count > 0 && count < stops.length;
}

function hasSelectedStops() {
    return selectedStops.size > 0;
}

function renderDateFilter() {
    const dates = [...new Set(availableGDs.map(g => g.posting_date).filter(Boolean))].sort().reverse();
    if (dates.length <= 1) return '';

    const selCount = filterDates.size;
    const label = selCount === 0 ? 'Posting Date' : 'Posting Date (' + selCount + ')';

    let html = '<div class="excel-date-filter">';
    html += '<button class="excel-filter-btn' + (selCount > 0 ? ' active' : '') + '" onclick="toggleDateDropdown(event)">';
    html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>';
    html += '<span>' + escapeHtml(label) + '</span>';
    html += '</button>';

    html += '<div class="excel-dropdown' + (dateDropdownOpen ? ' open' : '') + '" id="dateDropdown" onclick="event.stopPropagation()">';
    html += '<div class="excel-dropdown-head">';
    html += '<button class="excel-dd-action" onclick="event.stopPropagation(); dateSelectAll();">(Select All)</button>';
    html += '<button class="excel-dd-action" onclick="event.stopPropagation(); dateClearAll();">(Clear)</button>';
    html += '</div>';
    html += '<div class="excel-dropdown-list">';
    dates.forEach(d => {
        const checked = filterDates.has(d) ? 'checked' : '';
        html += '<label class="excel-dd-item" onclick="event.stopPropagation();">';
        html += '<input type="checkbox" ' + checked + ' onchange="toggleDateFilter(\'' + d + '\')">';
        html += '<span>' + formatDate(d) + '</span>';
        html += '</label>';
    });
    html += '</div>';
    html += '</div>';
    html += '</div>';
    return html;
}

function toggleDateDropdown(e) {
    if (e) e.stopPropagation();
    dateDropdownOpen = !dateDropdownOpen;
    renderRouteBuilder();
    if (dateDropdownOpen) {
        setTimeout(function() {
            document.addEventListener('click', closeDateDropdown, { once: true });
        }, 0);
    }
}

function closeDateDropdown() {
    dateDropdownOpen = false;
    var dd = document.getElementById('dateDropdown');
    if (dd) dd.classList.remove('open');
}

function toggleDateFilter(date) {
    if (filterDates.has(date)) filterDates.delete(date);
    else filterDates.add(date);
    renderRouteBuilder();
    if (dateDropdownOpen) {
        setTimeout(function() {
            document.addEventListener('click', closeDateDropdown, { once: true });
        }, 0);
    }
}

function dateSelectAll() {
    var dates = [...new Set(availableGDs.map(function(g) { return g.posting_date; }).filter(Boolean))];
    dates.forEach(function(d) { filterDates.add(d); });
    renderRouteBuilder();
    if (dateDropdownOpen) {
        setTimeout(function() {
            document.addEventListener('click', closeDateDropdown, { once: true });
        }, 0);
    }
}

function dateClearAll() {
    filterDates.clear();
    renderRouteBuilder();
    if (dateDropdownOpen) {
        setTimeout(function() {
            document.addEventListener('click', closeDateDropdown, { once: true });
        }, 0);
    }
}

function toggleStop(gdNum, stopId) {
    if (selectedStops.has(stopId)) selectedStops.delete(stopId);
    else selectedStops.add(stopId);
    renderRouteBuilder();
    updateRouteForm();
}

function toggleAllStopsForGD(gdNum) {
    const gd = availableGDs.find(g => g.group_delivery_number === gdNum);
    if (!gd) return;
    const stops = getStopsForGD(gd);
    const allSelected = stops.length > 0 && stops.every(s => selectedStops.has(s.id));
    stops.forEach(s => {
        if (allSelected) selectedStops.delete(s.id);
        else selectedStops.add(s.id);
    });
    renderRouteBuilder();
    updateRouteForm();
}

function renderRouteBuilder() {
    const container = document.getElementById('routeBuilderContent');
    if (!container) return;

    // console.log('[DEBUG] renderRouteBuilder: availableGDs.length=' + availableGDs.length + ' selectedGDs.size=' + selectedGDs.size);

    if (availableGDs.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No available GDs for ' + escapeHtml(getWarehouseName()) + '. Upload an SAP export first.</p></div>';
        return;
    }

    try {
        let filteredGDs = availableGDs;
        if (filterDates.size > 0) {
            filteredGDs = availableGDs.filter(gd => filterDates.has(gd.posting_date));
        }

        const multiStop = filteredGDs.filter(g => g.is_multi_stop);
        const singleStop = filteredGDs.filter(g => !g.is_multi_stop);
        const bundles = groupSinglesIntoBundles(singleStop);

        // console.log('[DEBUG] renderRouteBuilder: multi=' + multiStop.length + ' single=' + singleStop.length + ' bundles=' + bundles.length);

        let leftHtml = '<div class="rb-count-summary">' + filteredGDs.length + (filterDates.size > 0 ? ' filtered GDs' : ' Group Deliveries available') + ' for ' + escapeHtml(getWarehouseName()) + '</div>';
        leftHtml += renderDateFilter();

        if (multiStop.length > 0) {
            leftHtml += '<div class="rb-section">';
            leftHtml += '<h3 class="rb-section-title">Auto-Detected Routes <span class="badge">' + multiStop.length + '</span></h3>';
            leftHtml += '<p class="rb-section-desc">These GDs have multiple stops. Assign vehicle & SO to create route.</p>';
            multiStop.forEach(gd => { leftHtml += renderGDCard(gd); });
            leftHtml += '</div>';
        }

        if (bundles.length > 0) {
            leftHtml += '<div class="rb-section">';
            leftHtml += '<h3 class="rb-section-title">Suggested Bundles <span class="badge">' + bundles.length + '</span></h3>';
            leftHtml += '<p class="rb-section-desc">Single-stop GDs grouped by date & district. Bundle onto one truck.</p>';
            bundles.forEach((bundle, idx) => { leftHtml += renderBundleCard(bundle, idx); });
            leftHtml += '</div>';
        }

        const bundledGdNums = new Set(bundles.flatMap(b => b.gds.map(g => g.group_delivery_number)));
        const unbundled = singleStop.filter(g => !bundledGdNums.has(g.group_delivery_number));
        if (unbundled.length > 0) {
            leftHtml += '<div class="rb-section">';
            leftHtml += '<h3 class="rb-section-title">Individual GDs <span class="badge">' + unbundled.length + '</span></h3>';
            unbundled.forEach(gd => { leftHtml += renderGDCard(gd); });
            leftHtml += '</div>';
        }

        const formHtml = renderRouteForm();

        container.innerHTML = '<div class="rb-split">' +
            '<div class="rb-left">' + leftHtml + '</div>' +
            '<div class="rb-form-panel" id="routeCreateForm" style="display:none;">' +
            formHtml +
            '<button class="rb-form-close" onclick="closeRouteForm()">X</button>' +
            '</div></div>';
        // console.log('[DEBUG] renderRouteBuilder: rendered OK');
    } catch (e) {
        console.error('renderRouteBuilder:', e);
        container.innerHTML = '<div class="empty-state"><p style="color:var(--red)">Render error: ' + escapeHtml(e.message) + '</p></div>';
        showToast('Render error — see console', 'error');
    }
}

function renderGDCard(gd) {
    if (!gd || !gd.group_delivery_number) {
        return '';
    }

    const stops = getStopsForGD(gd) || [];
    const allSelected = isGDAllSelected(gd);
    const partial = isGDPartial(gd);
    const isMulti = gd.is_multi_stop;
    const numCust = gd.num_unique_customers || 0;
    const totalQty = gd.total_quantity || 0;

    const gdNum = escapeHtml(String(gd.group_delivery_number));
    const selectionClass = allSelected ? 'selected' : (partial ? 'partial' : '');

    let html = '<div class="gd-card ' + selectionClass + (isMulti ? ' multi' : '') + '" ';
    html += 'onclick="toggleAllStopsForGD(\'' + gdNum.replace(/'/g, '\\\'') + '\')">';

    html += '<div class="gd-card-header">';
    html += '<input type="checkbox" ' + (allSelected ? 'checked' : '') + ' class="gd-checkbox" onclick="event.stopPropagation(); toggleAllStopsForGD(\'' + gdNum.replace(/'/g, '\\\'') + '\')">';
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
            const docLabel = (s.delivery_documents && s.delivery_documents.length > 0) ? ' <span class="stop-docs">' + escapeHtml(s.delivery_documents.join(', ')) + '</span>' : '';
            html += '<div class="gd-stop-item">';
            html += '<input type="checkbox" class="stop-checkbox" ' + (selectedStops.has(s.id) ? 'checked' : '') + ' onclick="event.stopPropagation(); toggleStop(\'' + gdNum.replace(/'/g, '\\\'') + '\', \'' + s.id + '\')">';
            html += '<span class="stop-label">' + escapeHtml(String(s.customer_name || '?')) + '</span>';
            html += docLabel;
            html += '<span class="qty-badge">' + Math.round(s.total_quantity || 0) + '</span>';
            html += '</div>';
        });
        html += '</div>';
    }

    html += '</div>';
    return html;
}

function renderBundleCard(bundle, idx) {
    if (!bundle || !bundle.gds) {
        return '';
    }

    const allSelected = bundle.gds.every(g => g && isGDAllSelected(g));
    const totalGds = bundle.gds.length || 0;

    let html = '<div class="bundle-card ' + (allSelected ? 'selected' : '') + '">';
    html += '<div class="bundle-header" onclick="toggleBundleSelection(' + idx + ')">';
    html += '<input type="checkbox" ' + (allSelected ? 'checked' : '') + ' class="gd-checkbox" onclick="event.stopPropagation(); toggleBundleSelection(' + idx + ')">';
    html += '<div class="bundle-header-info">';
    html += '<strong>' + escapeHtml(bundle.district || '?') + '</strong>';
    html += '<span class="gd-meta">' + formatDate(bundle.date) + ' — ' + totalGds + ' GDs, ' + (bundle.totalCustomers || 0) + ' stops, ' + Math.round(bundle.totalQty || 0) + ' units</span>';
    html += '</div>';
    html += '<span class="stat-pill">' + totalGds + ' GDs</span>';
    html += '</div>';

    html += '<div class="bundle-gds">';
    bundle.gds.forEach(gd => {
        if (!gd || !gd.group_delivery_number) return;
        const stops = getStopsForGD(gd);
        const isSelected = isGDAllSelected(gd);
        const partial = isGDPartial(gd);
        const gdNumEsc = escapeHtml(String(gd.group_delivery_number));
        const totalQty = Math.round(gd.total_quantity || 0);

        html += '<div class="bundle-gd-item ' + (isSelected ? 'selected' : (partial ? 'partial' : '')) + '" onclick="event.stopPropagation(); toggleAllStopsForGD(\'' + gdNumEsc.replace(/'/g, '\\\'') + '\')">';
        html += '<input type="checkbox" ' + (isSelected ? 'checked' : '') + ' onclick="event.stopPropagation(); toggleAllStopsForGD(\'' + gdNumEsc.replace(/'/g, '\\\'') + '\')">';
        html += '<div class="bundle-gd-info">';
        html += '<strong>GD ' + gdNumEsc + '</strong>';
        if (stops.length > 0) {
            const custNames = stops.map(s => escapeHtml(String(s.customer_name || '?'))).join(', ');
            const docNums = stops.filter(s => s.delivery_documents && s.delivery_documents.length > 0).map(s => escapeHtml(s.delivery_documents.join(', '))).join('; ');
            html += '<span>' + custNames + '</span>';
            if (docNums) html += '<span class="stop-docs">' + docNums + '</span>';
            html += '<div class="bundle-stop-checks">';
            stops.forEach(s => {
                if (!s) return;
                html += '<label class="bundle-stop-check" onclick="event.stopPropagation();">';
                html += '<input type="checkbox" ' + (selectedStops.has(s.id) ? 'checked' : '') + ' onclick="event.stopPropagation(); toggleStop(\'' + gdNumEsc.replace(/'/g, '\\\'') + '\', \'' + s.id + '\')">';
                html += '<span>' + escapeHtml(String(s.customer_name || '?')) + ' <span class="qty-badge">' + Math.round(s.total_quantity || 0) + '</span></span>';
                html += '</label>';
            });
            html += '</div>';
        } else {
            html += '<span>No stops loaded</span>';
        }
        html += '</div>';
        html += '<span class="qty-badge">' + totalQty + ' units</span>';
        html += '</div>';
    });
    html += '</div>';
    html += '</div>';

    return html;
}

function renderRouteForm() {
    let html = '<h3>Create Route</h3>';
    html += '<div class="form-row">';
    html += '<div class="form-group"><label>Vehicle Number</label><select id="rfVehicle" onchange="onRouteVehicleChange()"><option value="">- Select Vehicle -</option></select></div>';
    html += '<div class="form-group"><label>Vehicle Type</label><select id="rfVehicleType"><option value="cover_truck">Cover Truck</option><option value="open_truck">Open Truck</option><option value="pickup">Pickup</option></select></div>';
    html += '<div class="form-group"><label>Vendor</label><select id="rfVendor"><option value="">- Select Vendor -</option></select></div>';
    html += '</div>';
    html += '<div class="form-row">';
    html += '<div class="form-group" id="rfCapacityGroup" style="display:none;"><label>Vehicle Capacity</label><div id="rfCapacityDisplay" style="padding:9px 12px;background:var(--gray-100);border-radius:6px;font-size:14px;color:var(--gray-600);">—</div></div>';
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
    toggleAllStopsForGD(gdNum);
}

function toggleBundleSelection(bundleIdx) {
    const singleStop = availableGDs.filter(g => !g.is_multi_stop);
    const bundles = groupSinglesIntoBundles(singleStop);
    const bundle = bundles[bundleIdx];
    if (!bundle) return;

    const allSelected = bundle.gds.every(g => isGDAllSelected(g));
    bundle.gds.forEach(gd => {
        const stops = getStopsForGD(gd);
        stops.forEach(s => {
            if (allSelected) selectedStops.delete(s.id);
            else selectedStops.add(s.id);
        });
    });

    renderRouteBuilder();
    updateRouteForm();
}

function updateRouteForm() {
    const form = document.getElementById('routeCreateForm');
    if (selectedStops.size === 0) { form.style.display = 'none'; return; }
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

    const vehicleSelect = document.getElementById('rfVehicle');
    if (vehicleSelect && vehicleSelect.options.length <= 1) {
        vehicleList.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v.vehicle_number;
            opt.textContent = v.vehicle_number;
            vehicleSelect.appendChild(opt);
        });
    }

    const vendorSelect = document.getElementById('rfVendor');
    if (vendorSelect && vendorSelect.options.length <= 1) {
        vendorList.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v.vendor_name;
            opt.textContent = v.vendor_name;
            vendorSelect.appendChild(opt);
        });
    }

    let totalQty = 0;
    let gdSet = new Set();
    let districtSet = new Set();
    availableGDs.forEach(gd => {
        const stops = getStopsForGD(gd);
        stops.forEach(s => {
            if (selectedStops.has(s.id)) {
                totalQty += (s.total_quantity || 0);
                gdSet.add(gd.group_delivery_number);
                if (gd.district) districtSet.add(gd.district);
            }
        });
    });

    document.getElementById('rfSummary').innerHTML = 
        '<strong>Selected:</strong> ' + gdSet.size + ' GDs &gt; ' + selectedStops.size + ' stops &gt; ' + Math.round(totalQty) + ' units<br>' +
        '<strong>Districts:</strong> ' + [...districtSet].map(d => escapeHtml(d)).join(', ');
}

function closeRouteForm() {
    selectedStops.clear();
    renderRouteBuilder();
}

function onRouteVehicleChange() {
    var vehicleNum = document.getElementById('rfVehicle').value;
    var capGroup = document.getElementById('rfCapacityGroup');
    var capDisplay = document.getElementById('rfCapacityDisplay');
    if (!vehicleNum) {
        capGroup.style.display = 'none';
        return;
    }
    var vehicle = vehicleList.find(function(v) { return v.vehicle_number === vehicleNum; });
    if (vehicle && vehicle.capacity_mt) {
        capDisplay.textContent = vehicle.capacity_mt + ' MT';
    } else {
        capDisplay.textContent = 'Not set';
    }
    capGroup.style.display = 'block';
}

// ---- Create Route ----

async function createRoute() {
    if (selectedStops.size === 0) { showToast('Select at least one stop', 'warning'); return; }
    if (isCreatingRoute) return;
    isCreatingRoute = true;
    document.querySelector('.btn-create-route').disabled = true;
    document.querySelector('.btn-create-route').textContent = 'Creating...';

    const vehicle = document.getElementById('rfVehicle').value.trim();
    const vehicleType = document.getElementById('rfVehicleType').value;
    const vendor = document.getElementById('rfVendor').value.trim();
    const soId = document.getElementById('rfSO').value;
    const routeName = document.getElementById('rfName').value.trim();

    const selectedVehicle = vehicleList.find(function(v) { return v.vehicle_number === vehicle; });
    const vehicleCapacityMt = selectedVehicle && selectedVehicle.capacity_mt ? selectedVehicle.capacity_mt : null;

    if (!vehicle) {
        showToast('Enter vehicle number', 'warning');
        isCreatingRoute = false;
        document.querySelector('.btn-create-route').disabled = false;
        document.querySelector('.btn-create-route').textContent = 'Create Route';
        return;
    }

    if (!soId) { showToast('Assign a Supply Officer', 'warning'); isCreatingRoute = false; document.querySelector('.btn-create-route').disabled = false; document.querySelector('.btn-create-route').textContent = 'Create Route'; return; }

    const allStops = [];
    const gdSet = new Set();
    const districtSet = new Set();
    let dispatchDate = null;

    availableGDs.forEach(gd => {
        const stops = getStopsForGD(gd);
        stops.forEach(s => {
            if (selectedStops.has(s.id)) {
                allStops.push(s);
                gdSet.add(gd.group_delivery_number);
                if (gd.district) districtSet.add(gd.district);
                if (!dispatchDate && gd.posting_date) dispatchDate = gd.posting_date;
            }
        });
    });

    if (allStops.length === 0) { showToast('No stops selected', 'warning'); isCreatingRoute = false; document.querySelector('.btn-create-route').disabled = false; document.querySelector('.btn-create-route').textContent = 'Create Route'; return; }

    const districts = [...districtSet];
    if (!dispatchDate) dispatchDate = new Date().toISOString().slice(0, 10);
    const routeCode = generateRouteCode(districts[0], dispatchDate);

    try {
        const { data: routeData, error: routeErr } = await sb
            .from('routes')
            .insert({
                route_code: routeCode,
                route_name: routeName || (districts.join('+') + ' Route'),
                status: 'pending',
                assigned_so_id: soId || null,
                vehicle_number: vehicle,
                vehicle_type: vehicleType,
                vehicle_capacity_mt: vehicleCapacityMt,
                vendor_name: vendor,
                dispatch_date: dispatchDate,
                plant_name: getWarehouseName(),
                district: districts.join(', '),
                group_delivery_numbers: [...gdSet],
                total_stops: allStops.length,
                created_by: currentAdmin ? currentAdmin.id : null
            })
            .select()
            .single();

        if (routeErr) { showToast('Error: ' + routeErr.message, 'error'); return; }

        const routeId = routeData.id;

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

        for (const gdNum of gdSet) {
            await sb.from('available_gds').update({ status: 'assigned' }).eq('group_delivery_number', gdNum);
        }

        showToast('Route ' + routeCode + ' created!', 'success');
        selectedStops.clear();
        isCreatingRoute = false;
        switchTab('dashboard');

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
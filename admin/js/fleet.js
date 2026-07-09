// ============================================================
// DropLog Admin - Fleet & Routes Module v1
// ============================================================

function switchFleetTab(tab, btn) {
    // Update tab buttons
    document.querySelectorAll('.fleet-tabs .nav-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');

    // Show corresponding content
    ['fleetVehiclesContent','fleetVendorsContent','fleetRoutesContent','fleetIssueTypesContent'].forEach(id => {
        document.getElementById(id).style.display = 'none';
    });

    switch (tab) {
        case 'vehicles': document.getElementById('fleetVehiclesContent').style.display = 'block'; loadVehicles(); break;
        case 'vendors': document.getElementById('fleetVendorsContent').style.display = 'block'; loadVendors(); break;
        case 'routes': document.getElementById('fleetRoutesContent').style.display = 'block'; loadRouteTemplates(); break;
        case 'issue-types': document.getElementById('fleetIssueTypesContent').style.display = 'block'; loadIssueTypes(); break;
    }
}

async function loadFleetData() {
    // Preload all fleet data when the tab is opened
    if (document.getElementById('fleetVehiclesContent').style.display !== 'none') loadVehicles();
    if (document.getElementById('fleetVendorsContent').style.display !== 'none') loadVendors();
    if (document.getElementById('fleetRoutesContent').style.display !== 'none') loadRouteTemplates();
    if (document.getElementById('fleetIssueTypesContent').style.display !== 'none') loadIssueTypes();
}

// ======================================================================
// VEHICLES
// ======================================================================

async function loadVehicles() {
    const el = document.getElementById('fleetVehiclesContent');
    if (!sb) { el.innerHTML = '<p>Not connected.</p>'; return; }

    const { data, error } = await sb.from('fleet_vehicles').select('*').order('vehicle_number');
    if (error) { el.innerHTML = '<p class="error">Error: ' + error.message + '</p>'; return; }

    el.innerHTML = `
        <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;">
            <input type="text" id="newVehicleNo" placeholder="Vehicle Number" style="flex:1;min-width:140px;padding:9px 12px;border:1.5px solid var(--gray-300);border-radius:6px;font-size:14px;">
            <input type="text" id="newVehicleDriver" placeholder="Driver Name" style="flex:1;min-width:140px;padding:9px 12px;border:1.5px solid var(--gray-300);border-radius:6px;font-size:14px;">
            <input type="text" id="newVehiclePhone" placeholder="Driver Phone" style="width:130px;padding:9px 12px;border:1.5px solid var(--gray-300);border-radius:6px;font-size:14px;">
            <input type="text" id="newVehicleCapacity" placeholder="Capacity (kg)" style="width:110px;padding:9px 12px;border:1.5px solid var(--gray-300);border-radius:6px;font-size:14px;">
            <button class="btn-small" onclick="addVehicle()">+ Add Vehicle</button>
        </div>
        <table>
            <thead><tr><th>Vehicle No</th><th>Driver</th><th>Driver Phone</th><th>Capacity</th><th></th></tr></thead>
            <tbody id="vehiclesBody"></tbody>
        </table>
        <p id="noVehicles" class="empty-text" style="${data && data.length ? 'display:none;' : ''}">No vehicles registered.</p>
    `;

    const tbody = document.getElementById('vehiclesBody');
    if (data && data.length > 0) {
        tbody.innerHTML = data.map(v =>
            '<tr>' +
            '<td><strong class="editable" onclick="editVehicle(\'' + v.id + '\',\'vehicle_number\',this)">' + esc(v.vehicle_number) + '</strong></td>' +
            '<td class="editable" onclick="editVehicle(\'' + v.id + '\',\'driver_name\',this)">' + esc(v.driver_name || '—') + '</td>' +
            '<td class="editable" onclick="editVehicle(\'' + v.id + '\',\'driver_phone\',this)">' + esc(v.driver_phone || '—') + '</td>' +
            '<td class="editable" onclick="editVehicle(\'' + v.id + '\',\'capacity_kg\',this)">' + (v.capacity_kg || '—') + '</td>' +
            '<td><span class="link-delete" onclick="deleteVehicle(\'' + v.id + '\')">Delete</span></td>' +
            '</tr>'
        ).join('');
    }
}

async function addVehicle() {
    const vehicle_number = document.getElementById('newVehicleNo').value.trim();
    if (!vehicle_number) { showToast('Enter vehicle number', 'warning'); return; }

    await sb.from('fleet_vehicles').insert({
        vehicle_number: vehicle_number,
        driver_name: document.getElementById('newVehicleDriver').value.trim() || null,
        driver_phone: document.getElementById('newVehiclePhone').value.trim() || null,
        capacity_kg: parseInt(document.getElementById('newVehicleCapacity').value) || null
    });

    ['newVehicleNo','newVehicleDriver','newVehiclePhone','newVehicleCapacity'].forEach(id =>
        document.getElementById(id).value = '');
    showToast('Vehicle added', 'success');
    loadVehicles();
}

async function editVehicle(id, field, el) {
    const current = el.textContent.trim();
    const input = document.createElement('input');
    input.type = 'text';
    input.value = current === '—' ? '' : current;
    input.className = 'inline-edit-input';
    input.style.width = Math.max(input.value.length * 9 + 20, 120) + 'px';

    el.textContent = '';
    el.appendChild(input);
    input.focus();
    input.select();

    input.addEventListener('blur', async () => {
        const val = input.value.trim();
        if (val === current) { el.textContent = current || '—'; return; }
        const update = {};
        update[field] = field === 'capacity_kg' ? (parseInt(val) || null) : (val || null);
        await sb.from('fleet_vehicles').update(update).eq('id', id);
        loadVehicles();
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
        if (e.key === 'Escape') { el.textContent = current || '—'; }
    });
}

async function deleteVehicle(id) {
    if (!confirm('Delete this vehicle?')) return;
    await sb.from('fleet_vehicles').delete().eq('id', id);
    showToast('Vehicle deleted', 'success');
    loadVehicles();
}

// ======================================================================
// VENDORS
// ======================================================================

async function loadVendors() {
    const el = document.getElementById('fleetVendorsContent');
    if (!sb) { el.innerHTML = '<p>Not connected.</p>'; return; }

    const { data, error } = await sb.from('vendors').select('*').order('vendor_name');
    if (error) { el.innerHTML = '<p class="error">Error: ' + error.message + '</p>'; return; }

    el.innerHTML = `
        <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;">
            <input type="text" id="newVendorName" placeholder="Vendor/Transporter Name" style="flex:1;min-width:160px;padding:9px 12px;border:1.5px solid var(--gray-300);border-radius:6px;font-size:14px;">
            <input type="text" id="newVendorPhone" placeholder="Contact Phone" style="width:150px;padding:9px 12px;border:1.5px solid var(--gray-300);border-radius:6px;font-size:14px;">
            <button class="btn-small" onclick="addVendor()">+ Add Vendor</button>
        </div>
        <table>
            <thead><tr><th>Vendor/Transporter</th><th>Contact Phone</th><th></th></tr></thead>
            <tbody id="vendorsBody"></tbody>
        </table>
        <p id="noVendors" class="empty-text" style="${data && data.length ? 'display:none;' : ''}">No vendors registered.</p>
    `;

    const tbody = document.getElementById('vendorsBody');
    if (data && data.length > 0) {
        tbody.innerHTML = data.map(v =>
            '<tr>' +
            '<td><strong class="editable" onclick="editVendor(\'' + v.id + '\',\'vendor_name\',this)">' + esc(v.vendor_name) + '</strong></td>' +
            '<td class="editable" onclick="editVendor(\'' + v.id + '\',\'contact_phone\',this)">' + esc(v.contact_phone || '—') + '</td>' +
            '<td><span class="link-delete" onclick="deleteVendor(\'' + v.id + '\')">Delete</span></td>' +
            '</tr>'
        ).join('');
    }
}

async function addVendor() {
    const vendor_name = document.getElementById('newVendorName').value.trim();
    if (!vendor_name) { showToast('Enter vendor name', 'warning'); return; }

    await sb.from('vendors').insert({
        vendor_name: vendor_name,
        contact_phone: document.getElementById('newVendorPhone').value.trim() || null
    });

    document.getElementById('newVendorName').value = '';
    document.getElementById('newVendorPhone').value = '';
    showToast('Vendor added', 'success');
    loadVendors();
}

async function editVendor(id, field, el) {
    const current = el.textContent.trim();
    const input = document.createElement('input');
    input.type = 'text';
    input.value = current === '—' ? '' : current;
    input.className = 'inline-edit-input';
    input.style.width = Math.max(input.value.length * 9 + 20, 120) + 'px';

    el.textContent = '';
    el.appendChild(input);
    input.focus();
    input.select();

    input.addEventListener('blur', async () => {
        const val = input.value.trim();
        if (val === current) { el.textContent = current || '—'; return; }
        const update = {};
        update[field] = val || null;
        await sb.from('vendors').update(update).eq('id', id);
        loadVendors();
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
        if (e.key === 'Escape') { el.textContent = current || '—'; }
    });
}

async function deleteVendor(id) {
    if (!confirm('Delete this vendor?')) return;
    await sb.from('vendors').delete().eq('id', id);
    showToast('Vendor deleted', 'success');
    loadVendors();
}

// ======================================================================
// ROUTE TEMPLATES
// ======================================================================

async function loadRouteTemplates() {
    const el = document.getElementById('fleetRoutesContent');
    if (!sb) { el.innerHTML = '<p>Not connected.</p>'; return; }

    const { data, error } = await sb.from('route_templates').select('*').order('template_name');
    if (error) { el.innerHTML = '<p class="error">Error: ' + error.message + '</p>'; return; }

    el.innerHTML = `
        <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;">
            <input type="text" id="newRouteTemplateName" placeholder="Template Name (e.g. CTG-North)" style="flex:1;min-width:140px;padding:9px 12px;border:1.5px solid var(--gray-300);border-radius:6px;font-size:14px;">
            <input type="text" id="newRouteTemplateDesc" placeholder="Description" style="flex:1;min-width:160px;padding:9px 12px;border:1.5px solid var(--gray-300);border-radius:6px;font-size:14px;">
            <input type="text" id="newRouteTemplateCustomers" placeholder="Customer IDs (comma-separated)" style="flex:2;min-width:200px;padding:9px 12px;border:1.5px solid var(--gray-300);border-radius:6px;font-size:14px;">
            <button class="btn-small" onclick="addRouteTemplate()">+ Add Template</button>
        </div>
        <table>
            <thead><tr><th>Template Name</th><th>Description</th><th>Customers</th><th></th></tr></thead>
            <tbody id="routeTemplatesBody"></tbody>
        </table>
        <p id="noRouteTemplates" class="empty-text" style="${data && data.length ? 'display:none;' : ''}">No route templates yet.</p>
    `;

    const tbody = document.getElementById('routeTemplatesBody');
    if (data && data.length > 0) {
        tbody.innerHTML = data.map(t =>
            '<tr>' +
            '<td><strong class="editable" onclick="editRouteTemplate(\'' + t.id + '\',\'template_name\',this)">' + esc(t.template_name) + '</strong></td>' +
            '<td class="editable" onclick="editRouteTemplate(\'' + t.id + '\',\'description\',this)">' + esc(t.description || '—') + '</td>' +
            '<td style="font-size:12px;max-width:200px;overflow:hidden;text-overflow:ellipsis;">' + esc(t.customer_ids || '—') + '</td>' +
            '<td><span class="link-delete" onclick="deleteRouteTemplate(\'' + t.id + '\')">Delete</span></td>' +
            '</tr>'
        ).join('');
    }
}

async function addRouteTemplate() {
    const template_name = document.getElementById('newRouteTemplateName').value.trim();
    if (!template_name) { showToast('Enter template name', 'warning'); return; }

    await sb.from('route_templates').insert({
        template_name: template_name,
        description: document.getElementById('newRouteTemplateDesc').value.trim() || null,
        customer_ids: document.getElementById('newRouteTemplateCustomers').value.trim() || null
    });

    ['newRouteTemplateName','newRouteTemplateDesc','newRouteTemplateCustomers'].forEach(id =>
        document.getElementById(id).value = '');
    showToast('Route template added', 'success');
    loadRouteTemplates();
}

async function editRouteTemplate(id, field, el) {
    const current = el.textContent.trim();
    const input = document.createElement('input');
    input.type = 'text';
    input.value = current === '—' ? '' : current;
    input.className = 'inline-edit-input';
    input.style.width = Math.max(input.value.length * 9 + 20, 120) + 'px';

    el.textContent = '';
    el.appendChild(input);
    input.focus();
    input.select();

    input.addEventListener('blur', async () => {
        const val = input.value.trim();
        if (val === current) { el.textContent = current || '—'; return; }
        const update = {};
        update[field] = val || null;
        await sb.from('route_templates').update(update).eq('id', id);
        loadRouteTemplates();
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
        if (e.key === 'Escape') { el.textContent = current || '—'; }
    });
}

async function deleteRouteTemplate(id) {
    if (!confirm('Delete this route template?')) return;
    await sb.from('route_templates').delete().eq('id', id);
    showToast('Route template deleted', 'success');
    loadRouteTemplates();
}

// ======================================================================
// ISSUE TYPES
// ======================================================================

async function loadIssueTypes() {
    const el = document.getElementById('fleetIssueTypesContent');
    if (!sb) { el.innerHTML = '<p>Not connected.</p>'; return; }

    const { data, error } = await sb.from('issue_types').select('*').order('type_name');
    if (error) { el.innerHTML = '<p class="error">Error: ' + error.message + '</p>'; return; }

    el.innerHTML = `
        <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;">
            <input type="text" id="newIssueTypeName" placeholder="Issue Type (e.g. Wrong Product)" style="flex:1;min-width:160px;padding:9px 12px;border:1.5px solid var(--gray-300);border-radius:6px;font-size:14px;">
            <input type="text" id="newIssueTypeIcon" placeholder="Icon emoji (e.g. ⚠)" style="width:60px;padding:9px 12px;border:1.5px solid var(--gray-300);border-radius:6px;font-size:14px;text-align:center;">
            <button class="btn-small" onclick="addIssueType()">+ Add Type</button>
        </div>
        <table>
            <thead><tr><th>Issue Type</th><th>Icon</th><th></th></tr></thead>
            <tbody id="issueTypesBody"></tbody>
        </table>
        <p id="noIssueTypes" class="empty-text" style="${data && data.length ? 'display:none;' : ''}">No issue types defined.</p>
    `;

    const tbody = document.getElementById('issueTypesBody');
    if (data && data.length > 0) {
        tbody.innerHTML = data.map(t =>
            '<tr>' +
            '<td><strong class="editable" onclick="editIssueType(\'' + t.id + '\',\'type_name\',this)">' + esc(t.type_name) + '</strong></td>' +
            '<td class="editable" onclick="editIssueType(\'' + t.id + '\',\'icon\',this)">' + (t.icon || '—') + '</td>' +
            '<td><span class="link-delete" onclick="deleteIssueType(\'' + t.id + '\')">Delete</span></td>' +
            '</tr>'
        ).join('');
    }
}

async function addIssueType() {
    const type_name = document.getElementById('newIssueTypeName').value.trim();
    if (!type_name) { showToast('Enter issue type name', 'warning'); return; }

    await sb.from('issue_types').insert({
        type_name: type_name,
        icon: document.getElementById('newIssueTypeIcon').value.trim() || null
    });

    document.getElementById('newIssueTypeName').value = '';
    document.getElementById('newIssueTypeIcon').value = '';
    showToast('Issue type added', 'success');
    loadIssueTypes();
}

async function editIssueType(id, field, el) {
    const current = el.textContent.trim();
    const input = document.createElement('input');
    input.type = 'text';
    input.value = current === '—' ? '' : current;
    input.className = 'inline-edit-input';
    input.style.width = Math.max(input.value.length * 9 + 20, 120) + 'px';

    el.textContent = '';
    el.appendChild(input);
    input.focus();
    input.select();

    input.addEventListener('blur', async () => {
        const val = input.value.trim();
        if (val === current) { el.textContent = current || '—'; return; }
        const update = {};
        update[field] = val || null;
        await sb.from('issue_types').update(update).eq('id', id);
        loadIssueTypes();
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
        if (e.key === 'Escape') { el.textContent = current || '—'; }
    });
}

async function deleteIssueType(id) {
    if (!confirm('Delete this issue type?')) return;
    await sb.from('issue_types').delete().eq('id', id);
    showToast('Issue type deleted', 'success');
    loadIssueTypes();
}

function esc(s) {
    if (!s) return '';
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}

// ============================================================
// DropLog Admin - Fleet Management Module
// ============================================================
// Handles: vehicle/driver registration, listing, deletion

async function loadVehicles() {
    if (!sb) return;

    const { data } = await sb
        .from('fleet_vehicles')
        .select('*')
        .eq('warehouse_code', getWarehouseCode())
        .order('created_at', { ascending: false });

    const tbody = document.getElementById('fleetBody');
    const empty = document.getElementById('noFleet');

    if (!data || data.length === 0) {
        tbody.innerHTML = '';
        empty.style.display = 'block';
        return;
    }

    empty.style.display = 'none';
    tbody.innerHTML = data.map(v =>
        '<tr>' +
        '<td><strong>' + escapeHtml(v.vehicle_number) + '</strong></td>' +
        '<td>' + escapeHtml(v.driver_name || '-') + '</td>' +
        '<td>' + escapeHtml(v.driver_phone || '-') + '</td>' +
        '<td>' + (v.capacity_kg ? v.capacity_kg + ' kg' : '-') + '</td>' +
        '<td><span class="status-badge ' + (v.is_active ? 'status-completed' : 'status-pending') + '">' + (v.is_active ? 'Active' : 'Inactive') + '</span></td>' +
        '<td><span class="link-delete" onclick="deleteVehicle(\'' + v.id + '\')">Delete</span></td>' +
        '</tr>'
    ).join('');
}

async function addVehicle() {
    const vehicle = document.getElementById('fvVehicle').value.trim();
    const driver = document.getElementById('fvDriver').value.trim();
    const phone = document.getElementById('fvPhone').value.trim();
    const capacity = document.getElementById('fvCapacity').value.trim();

    if (!vehicle) { showToast('Enter vehicle number', 'warning'); return; }

    const { error } = await sb.from('fleet_vehicles').insert({
        vehicle_number: vehicle,
        driver_name: driver || null,
        driver_phone: phone || null,
        capacity_kg: capacity ? Number(capacity) : null,
        warehouse_code: getWarehouseCode()
    });

    if (error) { showToast(error.message, 'error'); return; }

    document.getElementById('fvVehicle').value = '';
    document.getElementById('fvDriver').value = '';
    document.getElementById('fvPhone').value = '';
    document.getElementById('fvCapacity').value = '';

    showToast('Vehicle added', 'success');
    loadVehicles();
}

async function deleteVehicle(id) {
    if (!confirm('Remove this vehicle?')) return;
    const { error } = await sb.from('fleet_vehicles').delete().eq('id', id);
    if (error) { showToast(error.message, 'error'); return; }
    showToast('Vehicle removed', 'success');
    loadVehicles();
}

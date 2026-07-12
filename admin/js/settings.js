async function loadSettings() {
    if (!sb) return;
    document.getElementById('settingsWarehouseName').textContent = getWarehouseName();
    try {
        var { data: wh } = await sb.from('warehouses').select('per_km_cost').eq('name', getWarehouseName()).maybeSingle();
        if (wh) {
            document.getElementById('settingsPerKmCost').value = wh.per_km_cost || '';
        }
    } catch (e) {
        console.error('loadSettings:', e);
    }
}

async function saveWarehouseSettings() {
    try {
        var perKmCost = document.getElementById('settingsPerKmCost').value.trim();
        var val = perKmCost ? Number(perKmCost) : 0;
        var { error } = await sb.from('warehouses').update({ per_km_cost: val }).eq('name', getWarehouseName());
        if (error) {
            showToast('Error saving: ' + error.message, 'error');
            return;
        }
        showToast('Per KM cost saved: BDT ' + val + '/km', 'success');
        document.getElementById('settingsStatus').innerHTML = '<p class="success-text">Saved at ' + new Date().toLocaleString() + '</p>';
    } catch (e) {
        console.error('saveWarehouseSettings:', e);
        showToast(e.message || 'Something went wrong', 'error');
    }
}

// ============================================================
// DropLog Admin - Vendors Management Module
// ============================================================
// Handles: transport vendor/contractor registry, listing, deletion

async function loadVendors() {
    if (!sb) return;

    try {
        const { data, error } = await sb
            .from('vendors')
            .select('*')
            .eq('warehouse_code', getWarehouseCode())
            .order('vendor_name');

        if (error) { showToast(error.message, 'error'); return; }

        const tbody = document.getElementById('vendorsBody');
        const empty = document.getElementById('noVendors');

        if (!data || data.length === 0) {
            tbody.innerHTML = '';
            empty.classList.remove('hidden');
            return;
        }

        empty.classList.add('hidden');
        tbody.innerHTML = data.map(v =>
            '<tr>' +
            '<td><strong>' + escapeHtml(v.vendor_name) + '</strong></td>' +
            '<td>' + escapeHtml(v.contact_phone || '-') + '</td>' +
            '<td><span class="link-delete" onclick="deleteVendor(\'' + v.id + '\')">Delete</span></td>' +
            '</tr>'
        ).join('');

        document.getElementById('vendorCount').textContent = data.length + ' vendors';
    } catch (e) {
        console.error('loadVendors:', e);
        showToast(e.message || 'Something went wrong', 'error');
    }
}

async function addVendor() {
    const name = document.getElementById('newVendorName').value.trim();
    const phone = document.getElementById('newVendorPhone').value.trim();

    if (!name) { showToast('Enter vendor name', 'warning'); return; }

    try {
        const { error } = await sb.from('vendors').insert({
            vendor_name: name,
            contact_phone: phone || null,
            warehouse_code: getWarehouseCode()
        });

        if (error) { showToast(error.message, 'error'); return; }

        document.getElementById('newVendorName').value = '';
        document.getElementById('newVendorPhone').value = '';

        showToast('Vendor added', 'success');
        loadVendors();
    } catch (e) {
        showToast(e.message || 'Failed to add vendor', 'error');
    }
}

async function deleteVendor(id) {
    if (!confirm('Remove this vendor?')) return;
    const { error } = await sb.from('vendors').delete().eq('id', id);
    if (error) { showToast(error.message, 'error'); return; }
    showToast('Vendor removed', 'success');
    loadVendors();
}

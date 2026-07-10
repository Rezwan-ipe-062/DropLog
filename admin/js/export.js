// ============================================================
// DropLog Admin — Excel Export Functions
// ============================================================

function _checkXLSX() {
    if (typeof XLSX === 'undefined') {
        showToast('Excel library loading, try again in a moment', 'warning');
        return false;
    }
    return true;
}

function _dateStr() {
    return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

// ---- Export All Routes ----
async function exportRoutes() {
    if (!_checkXLSX()) return;
    showToast('Preparing routes export...', 'info');

    try {
        const { data: routes } = await sb
            .from('routes')
            .select('*')
            .eq('plant_name', getWarehouseName())
            .order('created_at', { ascending: false });

        if (!routes || routes.length === 0) {
            showToast('No routes to export', 'warning');
            return;
        }

        // Fetch all stops in one query
        const routeIds = routes.map(r => r.id);
        const { data: allStops } = await sb
            .from('route_stops')
            .select('route_id, status')
            .in('route_id', routeIds);

        const stopsByRoute = {};
        (allStops || []).forEach(s => {
            if (!stopsByRoute[s.route_id]) stopsByRoute[s.route_id] = [];
            stopsByRoute[s.route_id].push(s);
        });

        // Fetch SO names
        const soIds = [...new Set(routes.map(r => r.assigned_so_id).filter(Boolean))];
        const soMap = {};
        if (soIds.length > 0) {
            const { data: users } = await sb.from('users').select('id, name').in('id', soIds);
            (users || []).forEach(u => { soMap[u.id] = u.name; });
        }

        const rows = routes.map(r => {
            const stops = stopsByRoute[r.id] || [];
            const delivered = stops.filter(s => s.status === 'delivered' || s.status === 'partial').length;
            const failed = stops.filter(s => s.status === 'failed').length;
            return {
                'Route Code': r.route_code,
                'Route Name': r.route_name || '',
                'District': r.district || '',
                'Dispatch Date': r.dispatch_date ? new Date(r.dispatch_date).toLocaleDateString('en-GB') : '',
                'Status': r.status,
                'Supply Officer': soMap[r.assigned_so_id] || '--',
                'Vehicle': r.vehicle_number || '',
                'Vendor': r.vendor_name || '',
                'Total Stops': r.total_stops || stops.length,
                'Delivered': delivered,
                'Failed': failed,
                'Started': r.started_at ? new Date(r.started_at).toLocaleString('en-GB') : '',
                'Completed': r.completed_at ? new Date(r.completed_at).toLocaleString('en-GB') : '',
                'Driven KM': r.driven_km || '',
                'Transit Volume (MT)': r.transit_volume_mt || '',
                'SO Expense (BDT)': r.so_travelling_expense || ''
            };
        });

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Routes');

        // Auto-size columns
        const colWidths = Object.keys(rows[0] || {}).map(key => ({
            wch: Math.max(key.length, ...rows.map(r => String(r[key] || '').length)) + 2
        }));
        ws['!cols'] = colWidths;

        const filename = 'DropLog_Routes_' + _dateStr() + '.xlsx';
        XLSX.writeFile(wb, filename);
        showToast('Exported ' + rows.length + ' routes', 'success');
    } catch (e) {
        console.error('exportRoutes:', e);
        showToast('Export failed: ' + e.message, 'error');
    }
}

// ---- Export Deliveries for a Single Route ----
async function exportDeliveries(routeId) {
    if (!_checkXLSX()) return;
    showToast('Preparing deliveries export...', 'info');

    try {
        const { data: route } = await sb.from('routes').select('*').eq('id', routeId).single();
        if (!route) { showToast('Route not found', 'error'); return; }

        const { data: stops } = await sb.from('route_stops').select('*').eq('route_id', routeId).order('stop_sequence');
        const { data: products } = await sb.from('stop_products').select('*').in('route_stop_id', (stops || []).map(s => s.id));

        const productsByStop = {};
        (products || []).forEach(p => {
            if (!productsByStop[p.route_stop_id]) productsByStop[p.route_stop_id] = [];
            productsByStop[p.route_stop_id].push(p);
        });

        let soName = '--';
        if (route.assigned_so_id) {
            const { data: so } = await sb.from('users').select('name').eq('id', route.assigned_so_id).single();
            if (so) soName = so.name;
        }

        const rows = (stops || []).map((s, i) => {
            const stopProducts = productsByStop[s.id] || [];
            const productStr = stopProducts.map(p => p.material_description + ' x' + p.delivered_quantity).join('; ');
            return {
                '#': i + 1,
                'Customer': s.customer_name,
                'Customer ID': s.customer_id || '',
                'Address': s.address || '',
                'Status': s.status,
                'Delivered At': s.delivered_at ? new Date(s.delivered_at).toLocaleString('en-GB') : '',
                'GPS Lat': s.gps_lat || '',
                'GPS Lng': s.gps_lng || '',
                'Remark': s.remark || '',
                'Products': productStr
            };
        });

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Deliveries');

        // Add route info as a header sheet
        const infoRows = [
            { 'Field': 'Route Code', 'Value': route.route_code },
            { 'Field': 'Route Name', 'Value': route.route_name || '' },
            { 'Field': 'District', 'Value': route.district || '' },
            { 'Field': 'Supply Officer', 'Value': soName },
            { 'Field': 'Vehicle', 'Value': route.vehicle_number || '' },
            { 'Field': 'Vendor', 'Value': route.vendor_name || '' },
            { 'Field': 'Dispatch Date', 'Value': route.dispatch_date ? new Date(route.dispatch_date).toLocaleDateString('en-GB') : '' },
            { 'Field': 'Status', 'Value': route.status },
            { 'Field': 'Total Stops', 'Value': String(route.total_stops || (stops || []).length) },
            { 'Field': 'Driven KM', 'Value': String(route.driven_km || '') }
        ];
        const infoWs = XLSX.utils.json_to_sheet(infoRows);
        XLSX.utils.book_append_sheet(wb, infoWs, 'Route Info');

        const filename = 'DropLog_Deliveries_' + route.route_code + '.xlsx';
        XLSX.writeFile(wb, filename);
        showToast('Exported ' + rows.length + ' deliveries', 'success');
    } catch (e) {
        console.error('exportDeliveries:', e);
        showToast('Export failed: ' + e.message, 'error');
    }
}

// ---- Export Contacts ----
async function exportContacts() {
    if (!_checkXLSX()) return;
    showToast('Preparing contacts export...', 'info');

    try {
        const { data: contacts } = await sb
            .from('contacts')
            .select('*')
            .eq('plant_name', getWarehouseName())
            .order('customer_name');

        if (!contacts || contacts.length === 0) {
            showToast('No contacts to export', 'warning');
            return;
        }

        const rows = contacts.map(c => ({
            'BP ID': c.customer_id || '',
            'Customer Name': c.customer_name,
            'Phone': c.phone || '',
            'Email': c.email || '',
            'District': c.district || '',
            'Region': c.region || '',
            'Unit Name': c.unit_name || ''
        }));

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Contacts');

        const colWidths = Object.keys(rows[0] || {}).map(key => ({
            wch: Math.max(key.length, ...rows.map(r => String(r[key] || '').length)) + 2
        }));
        ws['!cols'] = colWidths;

        const filename = 'DropLog_Contacts_' + _dateStr() + '.xlsx';
        XLSX.writeFile(wb, filename);
        showToast('Exported ' + rows.length + ' contacts', 'success');
    } catch (e) {
        console.error('exportContacts:', e);
        showToast('Export failed: ' + e.message, 'error');
    }
}

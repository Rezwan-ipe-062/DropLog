// ============================================================
// DropLog Admin - Search Module
// ============================================================
// Handles: search across GDs, DOs, customers, locations

let searchTimeout = null;

function handleSearch(query) {
    clearTimeout(searchTimeout);
    if (query.length < 2) {
        document.getElementById('searchResults').innerHTML = '';
        return;
    }
    searchTimeout = setTimeout(() => executeSearch(query), 300);
}

async function executeSearch(query) {
    if (!sb) return;

    const results = document.getElementById('searchResults');
    results.innerHTML = '<p class="searching">Searching...</p>';

    const wh = getWarehouseName();

    // Search in route_stops (covers customer, DO, GD)
    const { data: stops } = await sb
        .from('route_stops')
        .select('*, routes!inner(route_code, route_name, status)')
        .or('customer_name.ilike.%' + query + '%,delivery_documents.cs.{' + query + '}')
        .eq('routes.plant_name', wh)
        .limit(20);

    // Search in available_gds
    const { data: gds } = await sb
        .from('available_gds')
        .select('*')
        .or('group_delivery_number.ilike.%' + query + '%,district.ilike.%' + query + '%')
        .eq('plant_name', wh)
        .limit(10);

    let html = '';

    if (stops && stops.length > 0) {
        html += '<h4>Route Stops (' + stops.length + ')</h4>';
        stops.forEach(s => {
            const route = s.routes || {};
            html += '<div class="search-result">';
            html += '<strong>' + s.customer_name + '</strong>';
            html += '<span class="sr-meta">' + (s.address || '') + '</span>';
            html += '<span class="sr-meta">Route: ' + (route.route_code || '-') + ' | Status: ' + s.status + '</span>';
            html += '</div>';
        });
    }

    if (gds && gds.length > 0) {
        html += '<h4>Group Deliveries (' + gds.length + ')</h4>';
        gds.forEach(g => {
            html += '<div class="search-result">';
            html += '<strong>GD ' + g.group_delivery_number + '</strong>';
            html += '<span class="sr-meta">' + g.district + ' - ' + formatDate(g.posting_date) + ' - ' + g.status + '</span>';
            html += '</div>';
        });
    }

    if (!html) html = '<p class="empty-text">No results for "' + query + '"</p>';
    results.innerHTML = html;
}
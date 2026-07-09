// ============================================================
// DropLog Admin - Search Module
// ============================================================
// Handles: search across GDs, DOs, customers, locations

let searchTimeout = null;
let searchFilter = 'all';

function setSearchFilter(filter) {
    searchFilter = filter;
    document.querySelectorAll('.sf-chip').forEach(c => c.classList.toggle('active', c.dataset.filter === filter));
    const q = document.querySelector('.search-input').value.trim();
    if (q.length >= 2) executeSearch(q);
}

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

    try {
        const results = document.getElementById('searchResults');
        results.innerHTML = '<p class="searching">Searching...</p>';

        const wh = getWarehouseName();
        let html = '';

        // Search in route_stops (covers customer, DO, GD)
        if (searchFilter === 'all' || searchFilter === 'stops') {
            const { data: stops } = await sb
                .from('route_stops')
                .select('*, routes!inner(route_code, route_name, status)')
                .or('customer_name.ilike.%' + query + '%,delivery_documents.cs.{' + query + '}')
                .eq('routes.plant_name', wh)
                .limit(20);

            if (stops && stops.length > 0) {
                html += '<h4>Route Stops (' + stops.length + ')</h4>';
                stops.forEach(s => {
                    const route = s.routes || {};
                    html += '<div class="search-result">';
                    html += '<strong>' + escapeHtml(s.customer_name) + '</strong>';
                    html += '<span class="sr-meta">' + escapeHtml(s.address || '') + '</span>';
                    html += '<span class="sr-meta">Route: ' + escapeHtml(route.route_code || '-') + ' | Status: ' + escapeHtml(s.status) + '</span>';
                    html += '</div>';
                });
            }
        }

        // Search in available_gds
        if (searchFilter === 'all' || searchFilter === 'gds') {
            const { data: gds } = await sb
                .from('available_gds')
                .select('*')
                .or('group_delivery_number.ilike.%' + query + '%,district.ilike.%' + query + '%')
                .eq('plant_name', wh)
                .limit(10);

            if (gds && gds.length > 0) {
                html += '<h4>Group Deliveries (' + gds.length + ')</h4>';
                gds.forEach(g => {
                    html += '<div class="search-result">';
                    html += '<strong>GD ' + escapeHtml(g.group_delivery_number) + '</strong>';
                    html += '<span class="sr-meta">' + escapeHtml(g.district) + ' - ' + formatDate(g.posting_date) + ' - ' + escapeHtml(g.status) + '</span>';
                    html += '</div>';
                });
            }
        }

        if (!html) html = '<p class="empty-text">No results for "' + escapeHtml(query) + '"</p>';
        results.innerHTML = html;
    } catch (e) {
        console.error('executeSearch:', e);
        showToast(e.message || 'Something went wrong', 'error');
    }
}
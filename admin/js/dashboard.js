let dashboardPolling = null;
let _activeFilter = null;

async function loadDashboard() {
    if (!sb) return;

    try {
        const wh = getWarehouseName();

        const [routesRes, issuesRes] = await Promise.all([
            sb.from('routes').select('id, status, total_stops, completed_stops, failed_stops').eq('plant_name', wh),
            sb.from('issues').select('id', { count: 'exact' }).eq('acknowledged', false)
        ]);

        if (routesRes.error) { console.error('dashboard routes query:', routesRes.error); }
        if (issuesRes.error) { console.error('dashboard issues query:', issuesRes.error); }

        const routes = routesRes.data || [];
        const pending = routes.filter(r => r.status === 'pending').length;
        const inTransit = routes.filter(r => r.status === 'in_transit').length;
        const completed = routes.filter(r => r.status === 'completed').length;
        const openIssues = issuesRes.count || 0;

        document.getElementById('statTotal').textContent = routes.length;
        document.getElementById('statPending').textContent = pending;
        document.getElementById('statTransit').textContent = inTransit;
        document.getElementById('statCompleted').textContent = completed;
        document.getElementById('statIssues').textContent = openIssues;

        await loadActiveRoutes();
        await loadRecentRoutes();
        startDashboardPolling();
        initAdminMap();
        renderAdminMap();
    } catch (e) {
        console.error('loadDashboard:', e);
    }
}

async function loadActiveRoutes() {
    try {
        const { data } = await sb
            .from('routes')
            .select('*, route_stops(*)')
            .eq('status', 'in_transit')
            .eq('plant_name', getWarehouseName())
            .order('started_at', { ascending: false });

        const container = document.getElementById('activeRoutes');
        if (!data || data.length === 0) {
            container.innerHTML = '<p class="empty-text">No routes currently in transit.</p>';
            window._adminActiveRoutesData = [];
            renderAdminMap();
            return;
        }

        window._adminActiveRoutesData = data;

        container.innerHTML = data.map(route => {
            const stops = route.route_stops || [];
            const done = stops.filter(s => s.status === 'delivered' || s.status === 'partial').length;
            const failed = stops.filter(s => s.status === 'failed').length;
            const total = stops.length;
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;

            let html = '<div class="active-route-card" onclick="viewRouteDetail(\'' + route.id + '\')" style="cursor:pointer;">';
            html += '<div class="arc-header">';
            html += '<div><strong>' + escapeHtml(route.route_name || route.route_code) + '</strong>';
            html += '<span class="arc-meta">' + escapeHtml(route.district) + ' - ' + escapeHtml(route.vehicle_number) + '</span></div>';
            html += '<span class="arc-pct">' + pct + '%</span>';
            html += '</div>';
            html += '<div class="progress-bar"><div class="progress-fill" style="width:' + pct + '%"></div></div>';
            html += '<div class="arc-stats">';
            html += '<span>[OK] ' + done + ' delivered</span>';
            if (failed > 0) html += '<span class="red">[X] ' + failed + ' failed</span>';
            html += '<span>' + (total - done - failed) + ' remaining</span>';
            html += '<span class="arc-time">Started ' + formatTime(route.started_at) + '</span>';
            html += '</div>';
            html += '<div class="stop-dots">';
            stops.sort((a, b) => a.stop_sequence - b.stop_sequence).forEach(s => {
                const cls = s.status === 'delivered' ? 'done' : s.status === 'partial' ? 'partial' : s.status === 'failed' ? 'failed' : 'pending';
                html += '<span class="dot ' + cls + '" title="' + escapeHtml(s.customer_name) + '"></span>';
            });
            html += '</div></div>';
            return html;
        }).join('');

        renderAdminMap();
    } catch (e) {
        console.error('loadActiveRoutes:', e);
    }
}

async function loadRecentRoutes(filterStatus) {
    try {
        let query = sb
            .from('routes')
            .select('*')
            .eq('plant_name', getWarehouseName())
            .order('created_at', { ascending: false })
            .limit(50);

        if (filterStatus) {
            if (filterStatus === 'active') {
                query = query.eq('status', 'in_transit');
            } else {
                query = query.eq('status', filterStatus);
            }
        } else {
            query = query.in('status', ['completed', 'pending']);
        }

        const { data } = await query;

        const tbody = document.getElementById('recentRoutesBody');
        const filterLabel = document.getElementById('filterLabel');
        const clearFilter = document.getElementById('clearFilter');

        if (!filterStatus) {
            if (filterLabel) filterLabel.textContent = '';
            if (clearFilter) clearFilter.style.display = 'none';
        } else {
            if (filterLabel) filterLabel.textContent = 'Showing: ' + filterStatus.charAt(0).toUpperCase() + filterStatus.slice(1);
            if (clearFilter) clearFilter.style.display = 'inline';
        }

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-text">' +
                (filterStatus ? 'No ' + filterStatus + ' routes.' : 'No routes yet.') +
                '</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(r => {
            const statusClass = r.status === 'completed' ? 'status-completed' : 
                               r.status === 'in_transit' ? 'status-transit' : 'status-pending';
            return '<tr onclick="viewRouteDetail(\'' + r.id + '\')" style="cursor:pointer;">' +
                '<td><strong>' + escapeHtml(r.route_code) + '</strong></td>' +
                '<td>' + escapeHtml(r.route_name || '-') + '</td>' +
                '<td>' + escapeHtml(r.district || '-') + '</td>' +
                '<td>' + formatDate(r.dispatch_date) + '</td>' +
                '<td>' + (r.completed_stops || 0) + '/' + (r.total_stops || 0) + '</td>' +
                '<td><span class="status-badge ' + escapeHtml(statusClass) + '">' + escapeHtml(r.status) + '</span></td>' +
                '<td><span class="link-delete" onclick="event.stopPropagation(); deleteRoute(\'' + r.id + '\')">Delete</span></td>' +
                '</tr>';
        }).join('');
    } catch (e) {
        console.error('loadRecentRoutes:', e);
    }
}

function filterByStatus(status) {
    _activeFilter = (_activeFilter === status) ? null : status;

    document.querySelectorAll('.stat-card').forEach(c => c.classList.remove('active'));
    if (_activeFilter) {
        const labels = { pending: 'Pending', active: 'In Transit', completed: 'Completed', issues: 'Open Issues' };
        document.querySelectorAll('.stat-card').forEach(c => {
            const lbl = c.querySelector('.stat-label');
            if (lbl && lbl.textContent === labels[_activeFilter]) c.classList.add('active');
        });
    }

    if (_activeFilter === 'issues') {
        loadIssueRoutes();
    } else {
        loadRecentRoutes(_activeFilter);
    }
}

async function loadIssueRoutes() {
    try {
        const { data } = await sb
            .from('issues')
            .select('*, routes!inner(route_code, route_name, district, status)')
            .eq('routes.plant_name', getWarehouseName())
            .order('reported_at', { ascending: false })
            .limit(100);

        const tbody = document.getElementById('recentRoutesBody');
        const filterLabel = document.getElementById('filterLabel');
        const clearFilter = document.getElementById('clearFilter');
        const openCount = (data || []).filter(i => !i.acknowledged).length;
        if (filterLabel) filterLabel.textContent = 'Issues (' + openCount + ' open / ' + (data || []).length + ' total)';
        if (clearFilter) clearFilter.style.display = 'inline';

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-text">No issues reported.</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(issue => {
            const r = issue.routes || {};
            const ackLabel = issue.acknowledged ? '<span class="status-badge status-completed">Dismissed</span>' : '<span class="status-badge status-pending">Open</span>';
            return '<tr onclick="viewRouteDetail(\'' + issue.route_id + '\')" style="cursor:pointer;">' +
                '<td><strong>' + escapeHtml(r.route_code || '?') + '</strong></td>' +
                '<td>' + escapeHtml(r.route_name || '-') + '</td>' +
                '<td>' + escapeHtml(r.district || '-') + '</td>' +
                '<td>' + formatDate(issue.reported_at) + '</td>' +
                '<td>' + escapeHtml(issue.issue_type) + '</td>' +
                '<td>' + ackLabel + '</td>' +
                '<td>' + escapeHtml(issue.details || '').substring(0, 25) + '</td>' +
                '</tr>';
        }).join('');
    } catch (e) {
        console.error('loadIssueRoutes:', e);
    }
}

async function checkIssues() {
    if (!sb) return;
    try {
        const { data } = await sb
            .from('issues')
            .select('*, routes(route_code, route_name)')
            .eq('acknowledged', false)
            .order('reported_at', { ascending: false })
            .limit(1);

        if (data && data.length > 0) {
            showIssueAlert(data[0]);
        }
    } catch (e) {
        console.error('checkIssues:', e);
    }
}

function showIssueAlert(issue) {
    const popup = document.getElementById('issueAlertPopup');
    const route = issue.routes || {};
    document.getElementById('issueAlertText').innerHTML =
        '<strong>' + escapeHtml(issue.issue_type) + '</strong><br>' +
        escapeHtml(issue.details || '') + '<br>' +
        '<span class="issue-meta">Route: ' + escapeHtml(route.route_code || '?') + ' - ' + formatTime(issue.reported_at) + '</span>';
    popup.classList.add('visible');
}

async function dismissIssue() {
    try {
        await sb.from('issues').update({
            acknowledged: true,
            acknowledged_by: currentAdmin ? currentAdmin.id : null,
            acknowledged_at: new Date().toISOString()
        }).eq('acknowledged', false);

        document.getElementById('issueAlertPopup').classList.remove('visible');
        loadDashboard();
    } catch (e) {
        console.error('dismissIssue:', e);
        showToast(e.message || 'Something went wrong', 'error');
    }
}

function startDashboardPolling() {
    if (dashboardPolling) clearInterval(dashboardPolling);
    dashboardPolling = setInterval(() => {
        loadActiveRoutes();
        checkIssues();
    }, 10000);
}

function stopDashboardPolling() {
    if (dashboardPolling) {
        clearInterval(dashboardPolling);
        dashboardPolling = null;
    }
}

// ---- Delete Route ----
async function deleteRoute(routeId) {
    if (!confirm('Delete this route? This cannot be undone.')) return;
    try {
        const { data: stops } = await sb.from('route_stops').select('id').eq('route_id', routeId);
        if (stops && stops.length > 0) {
            const stopIds = stops.map(s => s.id);
            await sb.from('stop_products').delete().in('route_stop_id', stopIds);
        }
        await sb.from('route_stops').delete().eq('route_id', routeId);
        await sb.from('delivery_events').delete().eq('route_id', routeId);
        await sb.from('issues').delete().eq('route_id', routeId);
        await sb.from('notifications').delete().eq('route_id', routeId);

        const { data: routeData } = await sb.from('routes').select('group_delivery_numbers').eq('id', routeId).single();
        await sb.from('routes').delete().eq('id', routeId);

        if (routeData && routeData.group_delivery_numbers) {
            for (const gdNum of routeData.group_delivery_numbers) {
                await sb.from('available_gds').update({ status: 'available' }).eq('group_delivery_number', gdNum);
            }
        }

        showToast('Route deleted', 'success');
        loadDashboard();
    } catch (err) {
        showToast('Error deleting: ' + err.message, 'error');
    }
}

// ---- Route Detail View ----
async function viewRouteDetail(routeId) {
    if (!sb) return;

    const { data: route } = await sb.from('routes').select('*').eq('id', routeId).single();
    if (!route) { showToast('Route not found', 'error'); return; }

    const { data: stops } = await sb.from('route_stops').select('*').eq('route_id', routeId).order('stop_sequence');
    const { data: issues } = await sb.from('issues').select('*').eq('route_id', routeId).order('reported_at', { ascending: false });

    let soName = '--';
    if (route.assigned_so_id) {
        const { data: so } = await sb.from('users').select('name').eq('id', route.assigned_so_id).single();
        if (so) soName = so.name;
    }

    let html = '<div class="route-detail-overlay" id="routeDetailOverlay">';
    html += '<div class="route-detail-panel">';
    html += '<div class="rd-header">';
    html += '<h2>' + (route.route_name || route.route_code) + '</h2>';
    html += '<button class="rd-close" onclick="closeRouteDetail()">X</button>';
    html += '</div>';

    var statusClass = route.status === 'completed' ? 'status-completed' : route.status === 'in_transit' ? 'status-transit' : 'status-pending';
    html += '<div style="display:flex;align-items:center;gap:12px;margin:8px 0;">';
    html += '<span class="status-badge ' + statusClass + '">' + route.status + '</span>';
    if (route.status === 'completed') {
        html += '<button class="btn-download-report" onclick="event.stopPropagation(); generateRouteReport(\'' + route.id + '\')">Download Route Report</button>';
    }
    html += '</div>';

    html += '<div class="rd-info-grid">';
    html += '<div class="rd-info-item"><span class="rd-label">Route Code</span><span class="rd-value">' + route.route_code + '</span></div>';
    html += '<div class="rd-info-item"><span class="rd-label">District</span><span class="rd-value">' + (route.district || '--') + '</span></div>';
    html += '<div class="rd-info-item"><span class="rd-label">Vehicle</span><span class="rd-value">' + (route.vehicle_number || '--') + '</span></div>';
    html += '<div class="rd-info-item"><span class="rd-label">Vendor</span><span class="rd-value">' + (route.vendor_name || '--') + '</span></div>';
    html += '<div class="rd-info-item"><span class="rd-label">Supply Officer</span><span class="rd-value">' + soName + '</span></div>';
    html += '<div class="rd-info-item"><span class="rd-label">Dispatch Date</span><span class="rd-value">' + formatDate(route.dispatch_date) + '</span></div>';
    html += '<div class="rd-info-item"><span class="rd-label">Started</span><span class="rd-value">' + (route.started_at ? formatTime(route.started_at) + ' ' + formatDate(route.started_at) : '--') + '</span></div>';
    html += '<div class="rd-info-item"><span class="rd-label">Completed</span><span class="rd-value">' + (route.completed_at ? formatTime(route.completed_at) + ' ' + formatDate(route.completed_at) : '--') + '</span></div>';
    html += '<div class="rd-info-item"><span class="rd-label">Total Stops</span><span class="rd-value">' + route.total_stops + '</span></div>';
    html += '<div class="rd-info-item"><span class="rd-label">Delivered</span><span class="rd-value rd-green">' + (route.completed_stops || 0) + '</span></div>';
    html += '<div class="rd-info-item"><span class="rd-label">Failed</span><span class="rd-value rd-red">' + (route.failed_stops || 0) + '</span></div>';
    html += '<div class="rd-info-item"><span class="rd-label">GPS Distance</span><span class="rd-value">' + (route.total_distance_km ? route.total_distance_km + ' km' : 'Pending') + '</span></div>';
    html += '</div>';

    html += '<h3 class="rd-section-title">Delivery Stops</h3>';
    html += '<table class="rd-stops-table"><thead><tr><th>#</th><th>Customer</th><th>Address</th><th>Status</th><th>Time</th><th>Remark</th></tr></thead><tbody>';
    (stops || []).forEach(function(stop) {
        var rowClass = stop.status === 'failed' ? 'rd-row-failed' : stop.status === 'partial' ? 'rd-row-partial' : stop.status === 'delivered' ? 'rd-row-done' : '';
        var statusBadge = stop.status === 'delivered' ? '<span class="rd-badge rd-badge-green">Delivered</span>' :
                         stop.status === 'partial' ? '<span class="rd-badge rd-badge-orange">Partial</span>' :
                         stop.status === 'failed' ? '<span class="rd-badge rd-badge-red">Failed</span>' :
                         '<span class="rd-badge rd-badge-gray">Pending</span>';
        html += '<tr class="' + rowClass + '">';
        html += '<td>' + stop.stop_sequence + '</td>';
        html += '<td><strong>' + stop.customer_name + '</strong></td>';
        html += '<td>' + (stop.address || '--').substring(0, 35) + '</td>';
        html += '<td>' + statusBadge + '</td>';
        html += '<td>' + (stop.delivered_at ? formatTime(stop.delivered_at) : '--') + '</td>';
        html += '<td class="rd-remark">' + (stop.remark || '--') + '</td>';
        html += '</tr>';
    });
    html += '</tbody></table>';

    if (issues && issues.length > 0) {
        html += '<h3 class="rd-section-title rd-issues-title">Issues Reported</h3>';
        issues.forEach(function(issue) {
            html += '<div class="rd-issue-card">';
            html += '<strong>' + issue.issue_type + '</strong>';
            if (issue.details) html += '<p>' + issue.details + '</p>';
            html += '<span class="rd-issue-time">' + formatTime(issue.reported_at) + ' ' + formatDate(issue.reported_at) + '</span>';
            html += '</div>';
        });
    }

    html += '</div></div>';

    var existing = document.getElementById('routeDetailOverlay');
    if (existing) existing.remove();
    document.body.insertAdjacentHTML('beforeend', html);
}

function closeRouteDetail() {
    var overlay = document.getElementById('routeDetailOverlay');
    if (overlay) overlay.remove();
}

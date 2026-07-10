var _supabaseUrl = 'https://afovfoaraolalebvookx.supabase.co';
var _supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmb3Zmb2FyYW9sYWxlYnZvb2t4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzNTExMDksImV4cCI6MjA5ODkyNzEwOX0.mFQa-RvRYm-Rol7_I5O0vVThAf5Tfd59w6F5Fa3w7Bw';

var sb = null;
function initSupabase() {
    if (window.supabase && window.supabase.createClient) {
        sb = window.supabase.createClient(_supabaseUrl, _supabaseKey);
        return true;
    }
    return false;
}
var _sbRetry = setInterval(function() { if (initSupabase()) clearInterval(_sbRetry); }, 200);

// ---- Utils ----
function showToast(msg, type) {
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast' + (type ? ' ' + type : '') + ' show';
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function() { t.classList.remove('show'); }, 3000);
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, function(c) {
        return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];
    });
}

function fmtDate(d) {
    if (!d) return '--';
    return new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
}

function fmtTime(d) {
    if (!d) return '--';
    return new Date(d).toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit', hour12:true });
}

function fmtDateTime(d) {
    if (!d) return '--';
    return fmtDate(d) + ' ' + fmtTime(d);
}

function $(id) { return document.getElementById(id); }

function toggleTheme() {
    var html = document.documentElement;
    var next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    try { localStorage.setItem('droplog-theme', next); } catch(e) {}
}

(function() {
    var saved = 'light';
    try { var t = localStorage.getItem('droplog-theme'); if (t) saved = t; } catch(e) {}
    document.documentElement.setAttribute('data-theme', saved);
})();

// ---- Modal ----
function showBpModal() {
    $('bpModal').style.display = 'flex';
    $('bpInput').value = '';
    $('bpInput').focus();
    $('searchError').style.display = 'none';
}

// ---- Navigation ----
function navigate(section) {
    document.querySelectorAll('.nav-item').forEach(function(l) { l.classList.remove('active'); });
    var el = document.querySelector('.nav-item[data-section="' + section + '"]');
    if (el) el.classList.add('active');
    if (section === 'support') {
        showToast('Support contact info coming soon', 'info');
        return;
    }
    var target = document.getElementById(section);
    if (target) target.scrollIntoView({ behavior:'smooth', block:'start' });
}

document.addEventListener('click', function(e) {
    var link = e.target.closest('.nav-item');
    if (!link) return;
    e.preventDefault();
    var section = link.getAttribute('data-section');
    document.querySelectorAll('.nav-item').forEach(function(l) { l.classList.remove('active'); });
    link.classList.add('active');
    if (section === 'support') {
        showToast('Support contact info coming soon', 'info');
        return;
    }
    var target = document.getElementById(section);
    if (target) target.scrollIntoView({ behavior:'smooth', block:'start' });
});

// ---- URL param ----
(function() {
    var bp = new URLSearchParams(window.location.search).get('bp');
    if (bp) {
        $('bpInput').value = bp;
        setTimeout(handleSearch, 600);
    }
})();

// ---- Enter key ----
document.addEventListener('DOMContentLoaded', function() {
    var inp = $('bpInput');
    if (inp) inp.addEventListener('keydown', function(e) { if (e.key === 'Enter') handleSearch(); });
});

// ---- Main Search ----
async function handleSearch() {
    var bpId = $('bpInput').value.trim();
    var errEl = $('searchError');

    if (!bpId) { errEl.textContent = 'Please enter a BP ID.'; errEl.style.display = 'block'; return; }
    if (!/^\d{4,10}$/.test(bpId)) { errEl.textContent = 'BP ID should be 4-10 digits.'; errEl.style.display = 'block'; return; }
    errEl.style.display = 'none';

    if (!sb) { showToast('Loading, please try again...', 'warning'); return; }

    $('bpModal').style.display = 'none';
    $('dashboard').style.display = 'none';
    $('appTopbar').style.display = 'none';
    $('bottomNav').style.display = 'none';
    $('loadScreen').style.display = 'flex';
    $('loadText').textContent = 'Loading deliveries for BP ' + bpId + '…';
    $('topbarBpLabel').textContent = 'BP ' + bpId;

    try {
        // Query 1: route_stops for this BP
        var { data: stops, error } = await sb
            .from('route_stops')
            .select('*, routes(route_code, route_name, dispatch_date, vehicle_number, vendor_name, plant_name, status, started_at, completed_at, total_stops, completed_stops, failed_stops)')
            .eq('customer_id', bpId)
            .order('delivered_at', { ascending: false, nullsFirst: false })
            .limit(50);

        if (error) throw error;
        stops = stops || [];

        if (stops.length === 0) {
            $('loadScreen').style.display = 'none';
            showToast('No deliveries found for this BP ID.', 'warning');
            showBpModal();
            return;
        }

        // Collect route IDs
        var routeIds = [];
        stops.forEach(function(s) { if (s.route_id && routeIds.indexOf(s.route_id) === -1) routeIds.push(s.route_id); });

        // Query 2: products
        var stopIds = stops.map(function(s) { return s.id; });
        var productsByStop = {};
        if (stopIds.length > 0) {
            var { data: prods } = await sb.from('stop_products').select('*').in('route_stop_id', stopIds);
            (prods || []).forEach(function(p) {
                if (!productsByStop[p.route_stop_id]) productsByStop[p.route_stop_id] = [];
                productsByStop[p.route_stop_id].push(p);
            });
        }

        // Query 3: issues
        var issues = [];
        if (routeIds.length > 0) {
            var { data: iss } = await sb.from('issues').select('*').in('route_id', routeIds).order('reported_at', { ascending: false });
            issues = iss || [];
        }

        // ---- Compute stats ----
        var delivered = stops.filter(function(s) { return s.status === 'delivered'; }).length;
        var partial = stops.filter(function(s) { return s.status === 'partial'; }).length;
        var failed = stops.filter(function(s) { return s.status === 'failed'; }).length;
        var pending = stops.filter(function(s) { return !s.status || s.status === 'pending'; }).length;
        var inTransit = stops.filter(function(s) { return s.status === 'in_transit'; }).length;
        var completedTotal = delivered + partial;
        var openIssues = issues.filter(function(i) { return !i.acknowledged; });

        // Route statuses
        var routeStatuses = {};
        stops.forEach(function(s) {
            if (s.routes && s.route_id && !routeStatuses[s.route_id]) routeStatuses[s.route_id] = s.routes.status || 'pending';
        });
        var activeRouteCount = Object.keys(routeStatuses).filter(function(id) { return routeStatuses[id] === 'in_transit'; }).length;

        // Latest stop
        var sorted = stops.slice().sort(function(a, b) {
            return (b.delivered_at || b.created_at || '').localeCompare(a.delivered_at || a.created_at || '');
        });
        var latest = sorted[0] || null;
        var needsAction = openIssues.length + failed;

        // ---- Render ----
        $('loadScreen').style.display = 'none';
        $('appTopbar').style.display = 'block';
        $('bottomNav').style.display = 'grid';
        $('dashboard').style.display = 'block';

        renderHeroStats(delivered, inTransit, needsAction, completedTotal);
        renderGlassCard(stops, latest, routeStatuses);
        renderSnapshot(stops, delivered, partial, openIssues.length);
        renderDispatch(stops, routeStatuses);
        renderMap(stops);
        renderExceptions(openIssues);
        renderPod(stops, completedTotal, partial, productsByStop);

        var name = latest ? (latest.customer_name || 'Distributor') : 'Distributor';
        $('heroTitle').textContent = 'Know where every delivery stands, ' + name.split(' ')[0] + '.';
        $('heroDesc').textContent = stops.length + ' deliveries tracked · ' + activeRouteCount + ' active routes';
        $('snapshotTotal').textContent = stops.length + ' deliveries';
        $('dispatchCount').textContent = routeIds.length + ' routes';
        $('exceptionCount').textContent = openIssues.length;
        window.scrollTo(0, 0);
    } catch (e) {
        console.error(e);
        $('loadScreen').style.display = 'none';
        showToast('Error loading data. Please try again.', 'error');
        showBpModal();
    }
}

// ---- Hero Stats ----
function renderHeroStats(active, transit, needs, pod) {
    $('statActive').textContent = active || 0;
    $('statTransit').textContent = transit || 0;
    $('statDelay').textContent = needs || 0;
    $('statPod').textContent = pod || 0;
}

// ---- Glass Card ----
function renderGlassCard(stops, latest, routeStatuses) {
    if (!latest || !latest.routes) {
        $('glassRouteCode').textContent = '--';
        $('glassRouteName').textContent = 'No active route';
        $('glassStatus').textContent = 'Pending';
        $('glassStatus').className = 'chip chip-gray';
        $('gpFill').style.width = '0%';
        $('glassEta').textContent = '--';
        $('glassVehicle').textContent = '--';
        $('glassProgress').textContent = '0';
        hideAllChips();
        return;
    }

    var route = latest.routes;
    $('glassRouteCode').textContent = route.route_code || 'DO-?';
    $('glassRouteName').textContent = route.route_name || '';

    // Status chip
    var st = route.status || 'pending';
    var chipMap = { 'in_transit':'chip-blue', 'completed':'chip-green', 'pending':'chip-gray', 'cancelled':'chip-red', 'delayed':'chip-amber' };
    $('glassStatus').textContent = st.replace('_', ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
    $('glassStatus').className = 'chip ' + (chipMap[st] || 'chip-gray');

    // Progress
    var total = route.total_stops || stops.length || 1;
    var done = (route.completed_stops || stops.filter(function(s) { return s.status === 'delivered' || s.status === 'partial'; }).length) || 0;
    var pct = Math.min(100, Math.round((done / total) * 100));
    $('gpFill').style.width = pct + '%';
    $('glassProgress').textContent = pct;

    $('glassEta').textContent = route.started_at ? fmtTime(route.started_at) : '--';
    $('glassVehicle').textContent = route.vehicle_number || '--';

    // Floating chips
    hideAllChips();
    if (st === 'in_transit') $('fcTransitChip').style.display = 'flex';
    if (route.started_at) {
        $('fcEtaChip').style.display = 'flex';
        $('fcEtaTime').textContent = fmtTime(route.started_at);
    }
    if (done > 0 && st !== 'completed') $('fcPodChip').style.display = 'flex';
    if (st === 'delayed') $('fcDelayChip').style.display = 'flex';
}

function hideAllChips() {
    ['fcTransitChip','fcEtaChip','fcPodChip','fcDelayChip'].forEach(function(id) { $(id).style.display = 'none'; });
}

// ---- Snapshot ----
function renderSnapshot(stops, delivered, partial, exceptionCount) {
    var active = stops.filter(function(s) { return s.status === 'in_transit' || s.status === 'pending' || !s.status; }).length;
    $('snapActive').textContent = active;
    var total = stops.length || 1;
    $('snapActiveBar').style.width = Math.round((delivered / total) * 100) + '%';
    $('snapExceptions').textContent = exceptionCount;
    $('snapExceptionTag').textContent = exceptionCount > 0 ? exceptionCount + ' need action' : 'All clear';
    $('snapPod').textContent = delivered + partial;
    $('snapCutoffTime').textContent = '3:00 PM';
    $('snapCutoffLabel').textContent = partial > 0 ? partial + ' partial' : 'Order release';
}

// ---- Dispatch Board ----
function renderDispatch(stops, routeStatuses) {
    var routes = {};
    stops.forEach(function(s) {
        if (!s.routes) return;
        var rid = s.route_id;
        if (!routes[rid]) {
            routes[rid] = { route: s.routes, stops: [], status: routeStatuses[rid] || 'pending' };
        }
        routes[rid].stops.push(s);
    });

    var container = $('dispatchList');
    var rids = Object.keys(routes);
    if (rids.length === 0) {
        container.innerHTML = '<div class="dispatch-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z"/><path d="m3 9 2.45-4.9A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.1L21 9"/></svg><p>No active routes</p></div>';
        return;
    }

    var colors = ['#007A3D','#0065A8','#F5B335','#6E3FA3','#2CB5E8','#D94A38'];

    container.innerHTML = rids.map(function(rid, i) {
        var r = routes[rid];
        var route = r.route;
        var total = r.stops.length;
        var done = r.stops.filter(function(s) { return s.status === 'delivered' || s.status === 'partial'; }).length;
        var pct = total > 0 ? Math.round((done / total) * 100) : 0;

        var cls = 'ready';
        var label = (route.status || 'pending').replace('_', ' ');
        if (route.status === 'in_transit') { cls = 'live'; label = 'Live'; }
        else if (route.status === 'completed') { cls = 'done'; label = 'Done'; }
        else if (route.status === 'delayed') { cls = 'delay'; label = 'Delayed'; }
        else if (route.status === 'cancelled') { cls = 'fail'; label = 'Cancelled'; }
        else { label = 'Pending'; }

        var c = colors[i % colors.length];
        return '<div class="dispatch-card">' +
            '<div class="dispatch-dot" style="background:' + c + '">' + (i + 1) + '</div>' +
            '<div class="dispatch-info"><strong>' + escapeHtml(route.route_code || 'DO-?') + ' · ' + escapeHtml(route.route_name || '') + '</strong>' +
            '<span>' + done + '/' + total + ' stops completed · ' + pct + '</span></div>' +
            '<div class="dispatch-eta"><strong>' + (route.vehicle_number ? escapeHtml(route.vehicle_number) : '--') + '</strong><span>' + escapeHtml(route.status || '') + '</span></div>' +
            '<span class="dispatch-status ' + cls + '">' + label + '</span>' +
            '</div>';
    }).join('');
}

// ---- Map ----
var _map = null;

function renderMap(stops) {
    if (_map) { _map.remove(); _map = null; }
    var container = $('portalMap');
    if (!container) return;

    var gpsPoints = stops.filter(function(s) { return (s.status === 'delivered' || s.status === 'partial') && s.gps_lat && s.gps_lng; })
        .map(function(s) { return { lat: parseFloat(s.gps_lat), lng: parseFloat(s.gps_lng), name: s.customer_name, status: s.status, time: s.delivered_at }; });

    if (gpsPoints.length === 0) {
        container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:350px;color:var(--muted);background:var(--bg);border-radius:16px;">No GPS data for delivered stops</div>';
        return;
    }

    container.innerHTML = '';
    if (typeof L === 'undefined') { setTimeout(function() { renderMap(stops); }, 500); return; }

    _map = L.map(container, { zoomControl: false, attributionControl: false }).setView([23.685, 90.356], 7);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(_map);

    var latlngs = [];
    gpsPoints.forEach(function(pt) {
        var ll = [pt.lat, pt.lng];
        latlngs.push(ll);
        var color = pt.status === 'delivered' ? '#007A3D' : '#E65100';
        L.circleMarker(ll, { radius: 7, color: color, fillColor: color, fillOpacity: 0.9, weight: 2 })
            .bindPopup('<b>' + escapeHtml(pt.name) + '</b>' + (pt.time ? '<br>' + fmtDateTime(pt.time) : '') + '<br>' + pt.status)
            .addTo(_map);
    });

    if (latlngs.length >= 2) {
        L.polyline(latlngs, { color: '#007A3D', weight: 2, opacity: 0.5, dashArray: '6, 5' }).addTo(_map);
    }

    if (latlngs.length === 1) { _map.setView(latlngs[0], 13); }
    else if (latlngs.length > 0) { _map.fitBounds(latlngs, { padding: [30, 30], maxZoom: 14 }); }
}

// ---- Exceptions ----
function renderExceptions(issues) {
    var container = $('exceptionList');
    if (issues.length === 0) {
        container.innerHTML = '<div class="exception-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4 12 14.01l-3-3"/></svg><p>No exceptions — everything on track</p></div>';
        $('exceptionCount').textContent = '0';
        return;
    }

    $('exceptionCount').textContent = issues.length;
    container.innerHTML = issues.map(function(issue, i) {
        var type = (issue.issue_type || 'issue').replace(/_/g, ' ');
        var details = (issue.details || '').substring(0, 60);
        if (issue.details && issue.details.length > 60) details += '…';
        var bg = i % 2 === 0 ? '#D94A38' : '#F5B335';
        return '<div class="exception-item">' +
            '<div class="exception-icon" style="background:' + bg + '">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>' +
            '</div>' +
            '<div class="exception-info"><strong>' + escapeHtml(type) + '</strong><span>' + escapeHtml(details) + ' · ' + fmtTime(issue.reported_at) + '</span></div>' +
            '<span class="exception-badge">Open</span>' +
            '</div>';
    }).join('');
}

// ---- POD ----
function renderPod(stops, completed, partial, productsByStop) {
    $('podCompleted').textContent = completed + ' stops' + (partial > 0 ? ' (' + partial + ' partial)' : '');
    if (completed > 0) { $('podItem1').classList.add('pod-done'); }

    var totalQty = 0;
    Object.keys(productsByStop).forEach(function(sid) {
        productsByStop[sid].forEach(function(p) {
            totalQty += parseFloat(p.delivered_quantity || p.quantity || 0);
        });
    });
    $('podQty').textContent = totalQty > 0 ? totalQty + ' units' : '-- units';
    if (totalQty > 0) { $('podItem2').classList.add('pod-done'); $('podCheck2').classList.add('pod-check'); }

    var withTime = stops.filter(function(s) { return s.delivered_at; }).sort(function(a, b) { return b.delivered_at.localeCompare(a.delivered_at); });
    $('podTime').textContent = withTime.length > 0 ? fmtDateTime(withTime[0].delivered_at) : '--';
    if (withTime.length > 0) { $('podItem3').classList.add('pod-done'); }

    $('podPartial').textContent = partial > 0 ? partial + ' stops' : 'None';
    if (partial > 0) { $('podItem4').classList.add('pod-done'); $('podCheck4').classList.add('pod-check'); }
}

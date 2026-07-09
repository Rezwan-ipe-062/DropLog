let adminMap = null;
let adminMapMarkers = [];
let adminMapPolylines = [];
let adminMapInitialized = false;

function initAdminMap() {
    if (adminMap) {
        adminMap.invalidateSize();
        return;
    }
    const container = document.getElementById('adminRouteMap');
    if (!container) return;
    if (typeof L === 'undefined') {
        setTimeout(initAdminMap, 500);
        return;
    }
    adminMap = L.map(container, {
        zoomControl: false,
        attributionControl: false
    }).setView([23.685, 90.356], 7);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18
    }).addTo(adminMap);
    adminMapInitialized = true;
}

function renderAdminMap() {
    if (!adminMap || !adminMapInitialized) return;
    clearAdminMap();
    const routes = window._adminActiveRoutesData;
    if (!routes || routes.length === 0) {
        adminMap.setView([23.685, 90.356], 7);
        return;
    }
    const allPoints = [];
    routes.forEach(function(route) {
        const stops = route.route_stops || [];
        const trailPoints = [];
        stops.forEach(function(stop) {
            const lat = parseFloat(stop.gps_lat);
            const lng = parseFloat(stop.gps_lng);
            if (!lat || !lng) return;
            const latlng = [lat, lng];
            allPoints.push(latlng);
            var color;
            if (stop.status === 'delivered') { color = '#00A94F'; trailPoints.push(latlng); }
            else if (stop.status === 'partial') { color = '#E65100'; trailPoints.push(latlng); }
            else if (stop.status === 'failed') { color = '#B71C1C'; }
            else { color = '#90A4AE'; }
            var marker = L.circleMarker(latlng, {
                radius: 7, color: color, fillColor: color,
                fillOpacity: stop.status === 'pending' ? 0.25 : 0.8, weight: 2
            }).addTo(adminMap);
            marker.bindPopup('<b>' + (route.route_name || route.route_code) + '</b><br>' +
                escapeHtml(stop.customer_name) + '<br>' +
                'Status: ' + stop.status + '<br>' +
                (stop.delivered_at ? formatTime(stop.delivered_at) : ''));
            adminMapMarkers.push(marker);
        });
        if (trailPoints.length >= 2) {
            var polyline = L.polyline(trailPoints, {
                color: '#00A94F', weight: 3, opacity: 0.6, dashArray: '8, 6'
            }).addTo(adminMap);
            adminMapPolylines.push(polyline);
        }
    });
    if (allPoints.length > 0) {
        adminMap.fitBounds(allPoints.length === 1
            ? [allPoints[0], [allPoints[0][0] + 0.05, allPoints[0][1] + 0.05]]
            : allPoints, { padding: [30, 30], maxZoom: 14 });
    }
}

function clearAdminMap() {
    adminMapMarkers.forEach(function(m) { if (adminMap) adminMap.removeLayer(m); });
    adminMapMarkers = [];
    adminMapPolylines.forEach(function(p) { if (adminMap) adminMap.removeLayer(p); });
    adminMapPolylines = [];
}

function destroyAdminMap() {
    if (adminMap) {
        adminMap.remove();
        adminMap = null;
    }
    adminMapMarkers = [];
    adminMapPolylines = [];
    adminMapInitialized = false;
}

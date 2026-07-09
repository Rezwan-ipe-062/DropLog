let routeMap = null;
let mapInitialized = false;
let trailPolyline = null;
let stopMarkers = [];
let currentPosMarker = null;
let gpsWatchId = null;

function initRouteMap() {
    const container = document.getElementById('routeMap');
    if (!container) return;

    if (routeMap) {
        routeMap.invalidateSize();
        updateRouteMap();
        return;
    }

    if (typeof L === 'undefined') return;

    routeMap = L.map(container, {
        zoomControl: false,
        attributionControl: false,
        tap: true
    }).setView([23.685, 90.356], 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18
    }).addTo(routeMap);

    routeMap.on('load', function() {
        mapInitialized = true;
        updateRouteMap();
    });

    // Watch GPS position
    if (navigator.geolocation) {
        gpsWatchId = navigator.geolocation.watchPosition(function(pos) {
            const latlng = [pos.coords.latitude, pos.coords.longitude];
            if (!currentPosMarker) {
                currentPosMarker = L.circleMarker(latlng, {
                    radius: 8,
                    color: '#2196F3',
                    fillColor: '#2196F3',
                    fillOpacity: 0.8,
                    weight: 2
                }).addTo(routeMap);
                currentPosMarker.bindPopup('You are here');
            } else {
                currentPosMarker.setLatLng(latlng);
            }
        }, function() {}, { enableHighAccuracy: true, timeout: 15000 });
    }
}

function updateRouteMap() {
    if (!routeMap || !mapInitialized) return;
    if (!stopsData || stopsData.length === 0) return;

    // Clear old markers
    stopMarkers.forEach(m => routeMap.removeLayer(m));
    stopMarkers = [];

    const trailPoints = [];
    const allPoints = [];

    stopsData.forEach(function(stop, i) {
        if (!stop.gps_lat || !stop.gps_lng) return;
        const latlng = [stop.gps_lat, stop.gps_lng];
        allPoints.push(latlng);

        var markerColor, markerIcon;
        if (stop.status === 'delivered') {
            markerColor = '#00A94F';
            trailPoints.push(latlng);
        } else if (stop.status === 'partial') {
            markerColor = '#E65100';
            trailPoints.push(latlng);
        } else if (stop.status === 'failed') {
            markerColor = '#B71C1C';
        } else {
            markerColor = '#90A4AE';
        }

        const marker = L.circleMarker(latlng, {
            radius: stop.status === 'pending' ? 7 : 6,
            color: markerColor,
            fillColor: markerColor,
            fillOpacity: stop.status === 'pending' ? 0.25 : 0.8,
            weight: 2
        }).addTo(routeMap);

        marker.bindPopup('<b>' + escapeHtml(stop.customer_name) + '</b>' +
            (stop.delivered_at ? '<br>' + formatTime(stop.delivered_at) : '') +
            '<br>Stop ' + (i + 1) + ' of ' + stopsData.length);

        stopMarkers.push(marker);
    });

    // Update trail polyline
    if (trailPolyline) routeMap.removeLayer(trailPolyline);
    if (trailPoints.length >= 2) {
        trailPolyline = L.polyline(trailPoints, {
            color: '#00A94F',
            weight: 3,
            opacity: 0.7,
            dashArray: '8, 6'
        }).addTo(routeMap);
    }

    // Fit bounds to show all points + current position
    const all = allPoints.slice();
    if (currentPosMarker) all.push(currentPosMarker.getLatLng());
    if (all.length > 0) {
        routeMap.fitBounds(all.length === 1
            ? [all[0], [all[0][0] + 0.01, all[0][1] + 0.01]]
            : all, { padding: [30, 30], maxZoom: 15 });
    }
}

function destroyRouteMap() {
    if (gpsWatchId !== null) { navigator.geolocation.clearWatch(gpsWatchId); gpsWatchId = null; }
    if (routeMap) { routeMap.remove(); routeMap = null; }
    mapInitialized = false;
    stopMarkers = [];
    trailPolyline = null;
    currentPosMarker = null;
}

let routeMap = null;
let trailPolyline = null;
let stopMarkers = [];
let currentPosMarker = null;
let gpsWatchId = null;

function initRouteMap() {
    const container = document.getElementById('routeMap');
    if (!container) { console.log('routeMap: no container'); return; }
    if (typeof L === 'undefined') { console.log('routeMap: Leaflet not loaded'); return; }

    // If map already exists, just resize and refresh
    if (routeMap) {
        routeMap.invalidateSize();
        renderMapMarkers();
        return;
    }

    routeMap = L.map(container, {
        zoomControl: false,
        attributionControl: false,
        tap: true
    }).setView([23.685, 90.356], 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18
    }).addTo(routeMap);

    // Markers and trail right away on first render
    renderMapMarkers();

    // Start GPS watch
    startGpsWatch();
}

function renderMapMarkers() {
    if (!routeMap) return;
    if (!stopsData || stopsData.length === 0) { console.log('routeMap: no stopsData'); return; }

    // Clear old markers
    stopMarkers.forEach(m => routeMap.removeLayer(m));
    stopMarkers = [];
    if (trailPolyline) routeMap.removeLayer(trailPolyline);
    trailPolyline = null;

    const trailPoints = [];
    const allPoints = [];

    stopsData.forEach(function(stop, i) {
        const lat = parseFloat(stop.gps_lat);
        const lng = parseFloat(stop.gps_lng);
        if (!lat || !lng) return;
        const latlng = [lat, lng];
        allPoints.push(latlng);

        var markerColor;
        if (stop.status === 'delivered') { markerColor = '#00A94F'; trailPoints.push(latlng); }
        else if (stop.status === 'partial') { markerColor = '#E65100'; trailPoints.push(latlng); }
        else if (stop.status === 'failed') { markerColor = '#B71C1C'; }
        else { markerColor = '#90A4AE'; }

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

    // Trail polyline connecting delivered/partial stops
    if (trailPoints.length >= 2) {
        trailPolyline = L.polyline(trailPoints, {
            color: '#00A94F', weight: 3, opacity: 0.7, dashArray: '8, 6'
        }).addTo(routeMap);
    }

    // Fit bounds
    if (currentPosMarker) allPoints.push(currentPosMarker.getLatLng());
    if (allPoints.length > 0) {
        routeMap.fitBounds(allPoints.length === 1
            ? [allPoints[0], [allPoints[0][0] + 0.01, allPoints[0][1] + 0.01]]
            : allPoints, { padding: [30, 30], maxZoom: 15 });
    }
}

function startGpsWatch() {
    if (gpsWatchId !== null) return;
    if (!navigator.geolocation) return;

    gpsWatchId = navigator.geolocation.watchPosition(function(pos) {
        const latlng = [pos.coords.latitude, pos.coords.longitude];
        if (!currentPosMarker) {
            currentPosMarker = L.circleMarker(latlng, {
                radius: 8, color: '#2196F3', fillColor: '#2196F3',
                fillOpacity: 0.8, weight: 2
            }).addTo(routeMap);
            currentPosMarker.bindPopup('You are here');
        } else {
            currentPosMarker.setLatLng(latlng);
        }
    }, function(err) {
        console.log('GPS watch error:', err.message);
    }, { enableHighAccuracy: true, timeout: 15000 });
}

function destroyRouteMap() {
    if (gpsWatchId !== null) {
        navigator.geolocation.clearWatch(gpsWatchId);
        gpsWatchId = null;
    }
    if (routeMap) {
        routeMap.remove();
        routeMap = null;
    }
    stopMarkers = [];
    trailPolyline = null;
    currentPosMarker = null;
}

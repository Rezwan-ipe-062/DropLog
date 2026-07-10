// ============================================================
// DropLog SO App - GPS Helper with retry, fallback & debounce
// ============================================================
let lastKnownGPS = null;
let lastGPSTime = 0;
const GPS_DEBOUNCE_MS = 60000;

function getGPS({ silent } = {}) {
    return new Promise((resolve) => {
        if (lastKnownGPS && (Date.now() - lastGPSTime) < GPS_DEBOUNCE_MS) {
            resolve(lastKnownGPS);
            return;
        }

        if (!navigator.geolocation) {
            if (!silent) showToast('GPS not available', 'warning');
            resolve(lastKnownGPS || { lat: null, lng: null });
            return;
        }

        let attempts = 0;
        const maxAttempts = 3;

        function tryGPS(highAccuracy) {
            attempts++;
            navigator.geolocation.getCurrentPosition(
                pos => {
                    const result = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                    lastKnownGPS = result;
                    lastGPSTime = Date.now();
                    resolve(result);
                },
                err => {
                    if (attempts < maxAttempts) {
                        tryGPS(highAccuracy && attempts < 2);
                    } else if (lastKnownGPS) {
                        if (!silent) showToast('Using last known location', 'info');
                        resolve(lastKnownGPS);
                    } else {
                        if (!silent) showToast('Could not get GPS', 'warning');
                        resolve({ lat: null, lng: null });
                    }
                },
                { timeout: highAccuracy ? 8000 : 15000, enableHighAccuracy: highAccuracy }
            );
        }

        tryGPS(true);
    });
}
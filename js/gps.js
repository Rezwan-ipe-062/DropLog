// ============================================================
// DropLog SO App - GPS Helper
// ============================================================
function getGPS() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            resolve({ lat: null, lng: null });
            return;
        }
        navigator.geolocation.getCurrentPosition(
            pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => resolve({ lat: null, lng: null }),
            { timeout: 8000, enableHighAccuracy: true }
        );
    });
}
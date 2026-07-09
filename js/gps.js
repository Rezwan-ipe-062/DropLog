// ============================================================
// DropLog SO App - GPS Helper v2
// ============================================================
function getGPS() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            resolve({ lat: null, lng: null });
            return;
        }
        navigator.geolocation.getCurrentPosition(
            pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => {
                // Fallback: try again without high accuracy
                navigator.geolocation.getCurrentPosition(
                    pos2 => resolve({ lat: pos2.coords.latitude, lng: pos2.coords.longitude }),
                    () => resolve({ lat: null, lng: null }),
                    { timeout: 10000, enableHighAccuracy: false }
                );
            },
            { timeout: 8000, enableHighAccuracy: true }
        );
    });
}

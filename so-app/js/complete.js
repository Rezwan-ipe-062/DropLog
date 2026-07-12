// ============================================================
// DropLog SO App - Route Completion
// ============================================================

function showRouteComplete() {
    const delivered = stopsData.filter(s => s.status === 'delivered' || s.status === 'partial').length;
    const failed = stopsData.filter(s => s.status === 'failed').length;
    const endTime = new Date();

    document.getElementById('summaryDelivered').textContent = delivered + '/' + stopsData.length;
    document.getElementById('summaryFailed').textContent = failed;
    document.getElementById('summaryStart').textContent = formatTime(routeStartTime);
    document.getElementById('summaryEnd').textContent = formatTime(endTime);

    let ms = routeStartTime ? (endTime - routeStartTime) : 0;
    document.getElementById('summaryDuration').textContent = 
        Math.floor(ms / 3600000) + 'h ' + Math.floor((ms % 3600000) / 60000) + 'm';

    showScreen('screenComplete');
}

async function handleFinish() {
    try {
        // Get final KM and expense from the form
        if (!confirm('Submit route as complete?')) return;

        let finalKm = document.getElementById('completeFinalKm').value.trim();
        let expense = document.getElementById('completeExpense').value.trim();
        let carryingCost = document.getElementById('completeCarryingCost').value.trim();
        let loadingCost = document.getElementById('completeLoadingCost').value.trim();

        if (!finalKm) { showToast('Enter final KM reading', 'warning'); return; }

        let finalKmNum = Number(finalKm) || 0;
        let expenseNum = Number(expense) || 0;
        let carryingCostNum = Number(carryingCost) || 0;
        let loadingCostNum = Number(loadingCost) || 0;

        // Fetch fresh route data to get initial_km (in case local is stale)
        let freshRoute = routeData;
        if (sb) {
            let { data: fr } = await sb.from('routes').select('initial_km_reading').eq('id', routeData.id).single();
            if (fr) freshRoute = fr;
        }
        let initialKm = freshRoute.initial_km_reading || 0;
        let drivenKm = (initialKm > 0 && finalKmNum > initialKm) ? finalKmNum - initialKm : 0;
        if (initialKm > 0 && finalKmNum > 0 && drivenKm === 0) {
            showToast('Final KM should be greater than initial KM (' + initialKm + ')', 'warning');
        }

        let btn = document.querySelector('#screenComplete .btn-primary');
        if (btn) { btn.disabled = true; btn.textContent = 'Submitting...'; }

        let gps = await getGPS();
        let now = new Date().toISOString();

        var { error: completeErr } = await sb.from('routes').update({
            status: 'completed',
            completed_at: now,
            end_gps_lat: gps.lat,
            end_gps_lng: gps.lng,
            final_km_reading: finalKmNum,
            driven_km: drivenKm,
            so_travelling_expense: expenseNum || null,
            carrying_cost: carryingCostNum || null,
            loading_unloading_cost: loadingCostNum || null
        }).eq('id', routeData.id);

        if (completeErr && !navigator.onLine) {
            await dbQueueMutation({
                action: 'complete',
                route_id: routeData.id,
                route_data: { status: 'completed', completed_at: now, end_gps_lat: gps.lat, end_gps_lng: gps.lng, final_km_reading: finalKmNum, driven_km: drivenKm, so_travelling_expense: expenseNum || null, carrying_cost: carryingCostNum || null, loading_unloading_cost: loadingCostNum || null },
                event_data: { route_id: routeData.id, event_type: 'route_completed', gps_lat: gps.lat, gps_lng: gps.lng, performed_by: currentUser ? currentUser.id : null }
            });
            showToast('Route queued — will sync when online', 'info');
            resetAfterComplete();
            return;
        }

        if (completeErr) {
            showToast('Failed to submit route', 'error');
            if (btn) { btn.disabled = false; btn.textContent = 'Submit and Finish'; }
            return;
        }

        await sb.from('delivery_events').insert({
            route_id: routeData.id,
            event_type: 'route_completed',
            gps_lat: gps.lat,
            gps_lng: gps.lng,
            performed_by: currentUser ? currentUser.id : null
        });

        showToast('Route submitted', 'success');

        resetAfterComplete();
    } catch (e) {
        console.error('handleFinish:', e);
        showToast(e.message || 'Something went wrong', 'error');
    }
}

function resetAfterComplete() {
    dbClearRouteData(routeData ? routeData.id : '');
    routeData = null;
    stopsData = [];
    productsData = {};
    currentStopIndex = null;
    routeStartTime = null;
    document.getElementById('routeInput').value = '';
    setTimeout(loadMyRoutes, 1500);
}
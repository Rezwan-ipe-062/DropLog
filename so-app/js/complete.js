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

    var ms = routeStartTime ? (endTime - routeStartTime) : 0;
    document.getElementById('summaryDuration').textContent = 
        Math.floor(ms / 3600000) + 'h ' + Math.floor((ms % 3600000) / 60000) + 'm';

    showScreen('screenComplete');
}

async function handleFinish() {
    try {
        // Get final KM and expense from the form
        if (!confirm('Submit route as complete?')) return;

        var finalKm = document.getElementById('completeFinalKm').value.trim();
        var expense = document.getElementById('completeExpense').value.trim();

        if (!finalKm) { showToast('Enter final KM reading', 'warning'); return; }

        var finalKmNum = Number(finalKm) || 0;
        var expenseNum = Number(expense) || 0;

        // Fetch fresh route data to get initial_km (in case local is stale)
        var freshRoute = routeData;
        if (sb) {
            var { data: fr } = await sb.from('routes').select('initial_km_reading').eq('id', routeData.id).single();
            if (fr) freshRoute = fr;
        }
        var initialKm = freshRoute.initial_km_reading || 0;
        var drivenKm = (initialKm > 0 && finalKmNum > initialKm) ? finalKmNum - initialKm : 0;
        if (initialKm > 0 && finalKmNum > 0 && drivenKm === 0) {
            showToast('Final KM should be greater than initial KM (' + initialKm + ')', 'warning');
        }

        var btn = document.querySelector('#screenComplete .btn-primary');
        if (btn) { btn.disabled = true; btn.textContent = 'Submitting...'; }

        var gps = await getGPS();
        var now = new Date().toISOString();

        await sb.from('routes').update({
            status: 'completed',
            completed_at: now,
            end_gps_lat: gps.lat,
            end_gps_lng: gps.lng,
            final_km_reading: finalKmNum,
            driven_km: drivenKm,
            so_travelling_expense: expenseNum || null
        }).eq('id', routeData.id);

        await sb.from('delivery_events').insert({
            route_id: routeData.id,
            event_type: 'route_completed',
            gps_lat: gps.lat,
            gps_lng: gps.lng,
            performed_by: currentUser ? currentUser.id : null
        });

        showToast('Route submitted', 'success');

        // Reset
        setTimeout(function() {
            routeData = null;
            stopsData = [];
            productsData = {};
            currentStopIndex = null;
            routeStartTime = null;
            document.getElementById('routeInput').value = '';
            loadMyRoutes();
        }, 1500);
    } catch (e) {
        console.error('handleFinish:', e);
        showToast(e.message || 'Something went wrong', 'error');
    }
}
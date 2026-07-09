// ============================================================
// DropLog SO App - Issue Reporting
// ============================================================
let selectedIssueType = null;

function showIssueScreen() {
    selectedIssueType = null;
    document.querySelectorAll('.issue-option').forEach(o => o.classList.remove('selected'));
    document.getElementById('issueDetails').value = '';
    showScreen('screenIssue');
}

function selectIssue(el) {
    document.querySelectorAll('.issue-option').forEach(o => o.classList.remove('selected'));
    el.classList.add('selected');
    selectedIssueType = el.textContent;
}

async function handleIssueSubmit() {
    try {
        if (!selectedIssueType) { showToast('Select issue type', 'warning'); return; }
        if (!confirm('Send "' + selectedIssueType + '" alert to warehouse?')) return;

        const details = document.getElementById('issueDetails').value.trim();
        const gps = await getGPS();

        await sb.from('issues').insert({
            route_id: routeData.id,
            issue_type: selectedIssueType,
            details: details || null,
            gps_lat: gps.lat,
            gps_lng: gps.lng,
            reported_by: currentUser ? currentUser.id : null
        });

        await sb.from('delivery_events').insert({
            route_id: routeData.id,
            event_type: 'issue_reported',
            gps_lat: gps.lat,
            gps_lng: gps.lng,
            remark: selectedIssueType + (details ? ' - ' + details : ''),
            performed_by: currentUser ? currentUser.id : null
        });

        showToast('Alert sent to warehouse', 'success');
        showScreen('screenStops');
    } catch (e) {
        console.error('handleIssueSubmit:', e);
        showToast(e.message || 'Something went wrong', 'error');
    }
}
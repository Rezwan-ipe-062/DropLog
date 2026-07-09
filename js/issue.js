// ============================================================
// DropLog SO App - Issue Reporting v2
// ============================================================
let selectedIssueType = null;

function showIssueScreen() {
    selectedIssueType = null;
    document.querySelectorAll('.issue-option').forEach(o => o.classList.remove('selected'));
    document.getElementById('issueDetails').value = '';

    // Load issue types from DB
    if (sb) {
        sb.from('issue_types').select('type_name, icon').order('type_name').then(({ data }) => {
            const list = document.querySelector('.issue-list');
            if (data && data.length > 0) {
                list.innerHTML = data.map(t =>
                    '<li class="issue-option" onclick="selectIssue(this)">' +
                    (t.icon || '•') + ' ' + t.type_name + '</li>'
                ).join('');
            }
        });
    }

    showScreen('screenIssue');
}

function selectIssue(el) {
    document.querySelectorAll('.issue-option').forEach(o => o.classList.remove('selected'));
    el.classList.add('selected');
    selectedIssueType = el.textContent.replace(/^[^\w]\s/, '').trim();
    if (!selectedIssueType) selectedIssueType = el.textContent.trim();
}

async function handleIssueSubmit() {
    if (!selectedIssueType) { showToast('Select issue type', 'warning'); return; }

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
}

// ============================================================
// DropLog Admin - Notifications Module
// ============================================================
// Handles: viewing notification log, status tracking

async function loadNotifications() {
    if (!sb) return;

    const { data } = await sb
        .from('notifications')
        .select('*, routes!inner(plant_name)')
        .eq('routes.plant_name', getWarehouseName())
        .order('triggered_at', { ascending: false })
        .limit(50);

    const tbody = document.getElementById('notificationsBody');
    const empty = document.getElementById('noNotifications');

    if (!data || data.length === 0) {
        tbody.innerHTML = '';
        empty.style.display = 'block';
        return;
    }

    empty.style.display = 'none';
    tbody.innerHTML = data.map(n => {
        const typeClass = n.message_type === 'route_started' ? 'type-start' : 
                         n.message_type === 'delivery_done' ? 'type-done' :
                         n.message_type === 'issue_alert' ? 'type-issue' : 'type-complete';
        const statusClass = n.status === 'sent' ? 'noti-sent' : 
                           n.status === 'delivered' ? 'noti-delivered' : 
                           n.status === 'failed' ? 'noti-failed' : 'noti-pending';

        return '<tr>' +
            '<td class="td-time">' + formatTime(n.triggered_at) + '<br><small>' + formatDate(n.triggered_at) + '</small></td>' +
            '<td><span class="noti-type ' + typeClass + '">' + (n.message_type || '').replace('_', ' ') + '</span></td>' +
            '<td>' + (n.recipient_name || '-') + '</td>' +
            '<td>' + (n.recipient_phone || '-') + '</td>' +
            '<td class="td-msg">' + (n.message_text || '-') + '</td>' +
            '<td><span class="noti-status ' + statusClass + '">' + n.status + '</span></td>' +
            '</tr>';
    }).join('');
}
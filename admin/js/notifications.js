// ============================================================
// DropLog Admin - Notifications Module
// ============================================================
// Handles: viewing notification log, status tracking

async function loadNotifications() {
    if (!sb) return;

    try {
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
            empty.classList.remove('hidden');
            return;
        }

        empty.classList.add('hidden');
        tbody.innerHTML = data.map(n => {
            const typeClass = n.message_type === 'route_started' ? 'type-start' : 
                             n.message_type === 'delivery_done' ? 'type-done' :
                             n.message_type === 'issue_alert' ? 'type-issue' :
                             n.message_type === 'whatsapp_start' ? 'type-start' :
                             n.message_type === 'whatsapp_confirm' ? 'type-done' : 'type-complete';
            const statusClass = n.status === 'sent' ? 'noti-sent' : 
                               n.status === 'delivered' ? 'noti-delivered' : 
                               n.status === 'failed' ? 'noti-failed' : 'noti-pending';
            const typeLabel = n.message_type === 'whatsapp_start' ? 'WhatsApp - Route Started' :
                             n.message_type === 'whatsapp_confirm' ? 'WhatsApp - Confirm Request' :
                             (n.message_type || '').replace('_', ' ');

            return '<tr>' +
                '<td class="td-time">' + formatTime(n.triggered_at) + '<br><small>' + formatDate(n.triggered_at) + '</small></td>' +
                '<td><span class="noti-type ' + escapeHtml(typeClass) + '">' + escapeHtml(typeLabel) + '</span></td>' +
                '<td>' + escapeHtml(n.recipient_name || '-') + '</td>' +
                '<td>' + escapeHtml(n.recipient_phone || '-') + '</td>' +
                '<td class="td-msg">' + escapeHtml(n.message_text || '-') + '</td>' +
                '<td><span class="noti-status ' + escapeHtml(statusClass) + '">' + escapeHtml(n.status) + '</span></td>' +
                '</tr>';
        }).join('');
    } catch (e) {
        console.error('loadNotifications:', e);
        showToast(e.message || 'Something went wrong', 'error');
    }
}
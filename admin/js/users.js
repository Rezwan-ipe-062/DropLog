// ============================================================
// DropLog Admin - Users Module
// ============================================================
// Handles: SO account management (add, list, delete)

async function loadUsers() {
    if (!sb) return;

    const { data } = await sb
        .from('users')
        .select('*')
        .eq('role', 'so')
        .order('name');

    const tbody = document.getElementById('usersBody');
    const empty = document.getElementById('noUsers');

    if (!data || data.length === 0) {
        tbody.innerHTML = '';
        empty.style.display = 'block';
        return;
    }

    empty.style.display = 'none';
    tbody.innerHTML = data.map(u => 
        '<tr>' +
        '<td><strong>' + u.name + '</strong></td>' +
        '<td>' + u.user_id + '</td>' +
        '<td>' + u.pin + '</td>' +
        '<td>' + (u.warehouse || '-') + '</td>' +
        '<td>' + (u.phone || '-') + '</td>' +
        '<td><span class="link-delete" onclick="deleteUser(\'' + u.id + '\')">Delete</span></td>' +
        '</tr>'
    ).join('');
}

async function addUser() {
    const name = document.getElementById('newSOName').value.trim();
    const userId = document.getElementById('newSOId').value.trim();
    const pin = document.getElementById('newSOPin').value.trim();
    const phone = document.getElementById('newSOPhone').value.trim();

    if (!name || !userId || pin.length !== 4) {
        showToast('Fill all fields (PIN must be 4 digits)', 'warning');
        return;
    }

    const { error } = await sb.from('users').insert({
        user_id: userId, name, pin, role: 'so', 
        phone: phone || null, warehouse: CONFIG.PLANT_NAME
    });

    if (error) {
        showToast('Error: ' + error.message, 'error');
        return;
    }

    document.getElementById('newSOName').value = '';
    document.getElementById('newSOId').value = '';
    document.getElementById('newSOPin').value = '';
    document.getElementById('newSOPhone').value = '';
    showToast('SO added', 'success');
    loadUsers();
}

async function deleteUser(id) {
    if (!confirm('Delete this Supply Officer?')) return;
    await sb.from('users').delete().eq('id', id);
    showToast('Deleted', 'success');
    loadUsers();
}
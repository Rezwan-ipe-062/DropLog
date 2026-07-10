// ============================================================
// DropLog Admin - Users Module
// ============================================================
// Handles: SO account management (add, list, delete)

async function loadUsers() {
    if (!sb) return;

    try {
        const { data } = await sb
            .from('users')
            .select('*')
            .eq('role', 'so')
            .in('warehouse', [getWarehouseName(), getWarehouseCode()])
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
            '<td><strong>' + escapeHtml(u.name) + '</strong></td>' +
            '<td>' + escapeHtml(u.user_id) + '</td>' +
            '<td>' + escapeHtml(u.warehouse || '-') + '</td>' +
            '<td>' + escapeHtml(u.phone || '-') + '</td>' +
            '<td style="font-family:monospace;font-weight:600;">' + escapeHtml(u.pin_plain || '--') + '</td>' +
            '<td><span class="link-delete" onclick="resetPin(\'' + u.id + '\', \'' + escapeHtml(u.name) + '\')">Reset</span></td>' +
            '<td><span class="link-delete" onclick="deleteUser(\'' + u.id + '\')">Delete</span></td>' +
            '</tr>'
        ).join('');
    } catch (e) {
        console.error('loadUsers:', e);
        showToast(e.message || 'Something went wrong', 'error');
    }
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

    try {
        const hashedPin = await hashPin(pin);

        const { error } = await sb.from('users').insert({
            user_id: userId, name, pin: hashedPin, pin_plain: pin, role: 'so', 
            phone: phone || null, warehouse: getWarehouseName()
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
    } catch (e) {
        console.error('addUser:', e);
        showToast(e.message || 'Something went wrong', 'error');
    }
}

async function deleteUser(id) {
    if (!confirm('Delete this Supply Officer?')) return;
    try {
        await sb.from('users').delete().eq('id', id);
        showToast('Deleted', 'success');
        loadUsers();
    } catch (e) {
        console.error('deleteUser:', e);
        showToast(e.message || 'Something went wrong', 'error');
    }
}

async function resetPin(userId, userName) {
    var newPin = prompt('Enter new 4-digit PIN for ' + userName + ':');
    if (!newPin || newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
        showToast('PIN must be exactly 4 digits', 'warning');
        return;
    }
    if (!confirm('Set new PIN for ' + userName + '?')) return;
    try {
        var hashed = await hashPin(newPin);
        await sb.from('users').update({ pin: hashed, pin_plain: newPin }).eq('id', userId);
        showToast('PIN reset for ' + userName, 'success');
        loadUsers();
    } catch (e) {
        console.error('resetPin:', e);
        showToast(e.message || 'Something went wrong', 'error');
    }
}
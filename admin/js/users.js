// ============================================================
// DropLog Admin - Users Module v2
// ============================================================

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
        '<td><strong class="editable" onclick="editUserField(\'' + u.id + '\',\'name\',this)">' + esc(u.name) + '</strong></td>' +
        '<td class="editable" onclick="editUserField(\'' + u.id + '\',\'user_id\',this)">' + esc(u.user_id) + '</td>' +
        '<td class="editable" onclick="editUserField(\'' + u.id + '\',\'phone\',this)">' + esc(u.phone || '—') + '</td>' +
        '<td>' + esc(u.warehouse || '—') + '</td>' +
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

async function editUserField(id, field, el) {
    const current = el.textContent.trim();
    const input = document.createElement('input');
    input.type = 'text';
    input.value = current === '—' ? '' : current;
    input.className = 'inline-edit-input';
    input.style.width = Math.max(input.value.length * 9 + 20, 100) + 'px';

    el.textContent = '';
    el.appendChild(input);
    input.focus();
    input.select();

    input.addEventListener('blur', async () => {
        const val = input.value.trim();
        if (val === current) { el.textContent = current || '—'; return; }
        const update = {};
        update[field] = val || null;
        await sb.from('users').update(update).eq('id', id);
        loadUsers();
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
        if (e.key === 'Escape') { el.textContent = current || '—'; }
    });
}

async function deleteUser(id) {
    if (!confirm('Delete this Supply Officer?')) return;
    await sb.from('users').delete().eq('id', id);
    showToast('Deleted', 'success');
    loadUsers();
}

function esc(s) {
    if (!s) return '';
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}

// ============================================================
// DropLog SO App - Authentication v2
// ============================================================
let currentUser = null;

async function handleLogin() {
    const empId = document.getElementById('empId').value.trim();
    const pin = document.getElementById('empPin').value.trim();

    if (!empId) { showToast('Enter Employee ID', 'warning'); return; }
    if (pin.length !== 4) { showToast('PIN must be 4 digits', 'warning'); return; }
    if (!sb) { showToast('Connecting...', 'warning'); return; }

    const { data, error } = await sb
        .from('users')
        .select('*')
        .eq('user_id', empId)
        .eq('pin', pin)
        .eq('role', 'so')
        .single();

    if (error || !data) {
        showToast('Invalid ID or PIN', 'error');
        return;
    }

    currentUser = data;
    document.getElementById('userBadge').textContent = data.name || empId;
    localStorage.setItem('droplog_so', JSON.stringify({ id: data.id, name: data.name, user_id: data.user_id }));
    showToast('Signed in', 'success');
    showScreen('screenRoute');
}

function handleLogout() {
    currentUser = null;
    localStorage.removeItem('droplog_so');
    showScreen('screenLogin');
}

async function checkSession() {
    const saved = localStorage.getItem('droplog_so');
    if (!saved) { showScreen('screenLogin'); return; }

    try {
        const parsed = JSON.parse(saved);
        const { data, error } = await sb
            .from('users')
            .select('id, name, user_id')
            .eq('id', parsed.id)
            .eq('role', 'so')
            .single();

        if (error || !data) {
            localStorage.removeItem('droplog_so');
            showScreen('screenLogin');
            return;
        }

        currentUser = data;
        document.getElementById('userBadge').textContent = data.name || '';
        showScreen('screenRoute');
    } catch (e) {
        localStorage.removeItem('droplog_so');
        showScreen('screenLogin');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const check = setInterval(() => {
        if (sb) {
            clearInterval(check);
            checkSession();
        }
    }, 300);
});

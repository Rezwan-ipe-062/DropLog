// ============================================================
// DropLog SO App - Authentication
// ============================================================
let currentUser = null;

async function handleLogin() {
    try {
        const empId = document.getElementById('empId').value.trim();
        const pin = document.getElementById('empPin').value.trim();

        if (!empId) { showToast('Enter Employee ID', 'warning'); return; }
        if (pin.length !== 4) { showToast('PIN must be 4 digits', 'warning'); return; }
        if (!sb) { showToast('Connecting...', 'warning'); return; }

        const hashedPin = await hashPin(pin);

        const { data, error } = await sb
            .from('users')
            .select('*')
            .eq('user_id', empId)
            .eq('pin', hashedPin)
            .eq('role', 'so')
            .single();

        if (error || !data) {
            showToast('Invalid ID or PIN', 'error');
            return;
        }

        currentUser = data;
        document.getElementById('userBadge').textContent = (data.name || empId) + ' [' + (data.warehouse || '?') + ']';
        localStorage.setItem('droplog_so', JSON.stringify({ id: data.id, name: data.name, user_id: data.user_id, warehouse: data.warehouse }));
        showToast('Signed in', 'success');
        showScreen('screenRoute');
    } catch (e) {
        console.error('handleLogin:', e);
        showToast(e.message || 'Something went wrong', 'error');
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

async function checkSession() {
    const saved = localStorage.getItem('droplog_so');
    if (!saved) { showScreen('screenLogin'); return; }
    try {
        const parsed = JSON.parse(saved);
        const { data, error } = await sb
            .from('users')
            .select('id, name, user_id, warehouse')
            .eq('id', parsed.id)
            .eq('role', 'so')
            .single();
        if (error || !data) {
            localStorage.removeItem('droplog_so');
            showScreen('screenLogin');
            return;
        }
        currentUser = data;
        document.getElementById('userBadge').textContent = (data.name || '') + ' [' + (data.warehouse || '?') + ']';
        showScreen('screenRoute');
    } catch (e) {
        localStorage.removeItem('droplog_so');
        showScreen('screenLogin');
    }
}

function handleLogout() {
    currentUser = null;
    localStorage.removeItem('droplog_so');
    showScreen('screenLogin');
}
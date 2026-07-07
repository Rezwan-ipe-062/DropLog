// ============================================================
// DropLog SO App - Authentication
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
    showToast('Signed in', 'success');
    showScreen('screenRoute');
}

function handleLogout() {
    currentUser = null;
    showScreen('screenLogin');
}
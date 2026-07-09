// ============================================================
// DropLog Admin — Authentication Module v2
// ============================================================

let currentAdmin = null;

function showLoginScreen() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('mainApp').style.display = 'none';
}

function showMainApp() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    document.getElementById('adminName').textContent = currentAdmin.name || 'Admin';
    switchTab('dashboard');
}

async function handleAdminLogin() {
    const userId = document.getElementById('loginId').value.trim();
    const pin = document.getElementById('loginPin').value.trim();

    if (!userId) { showToast('Enter Admin ID', 'warning'); return; }
    if (!pin) { showToast('Enter password', 'warning'); return; }
    if (!sb) { showToast('Connecting...', 'warning'); return; }

    const { data, error } = await sb
        .from('users')
        .select('*')
        .eq('user_id', userId)
        .eq('pin', pin)
        .in('role', ['admin', 'csd'])
        .single();

    if (error || !data) {
        showToast('Invalid credentials', 'error');
        return;
    }

    currentAdmin = data;
    localStorage.setItem('droplog_admin', JSON.stringify(data));
    showToast('Signed in as ' + data.name, 'success');
    showMainApp();
}

function handleLogout() {
    currentAdmin = null;
    localStorage.removeItem('droplog_admin');
    showLoginScreen();
    showToast('Signed out', 'info');
}

async function checkSession() {
    const saved = localStorage.getItem('droplog_admin');
    if (!saved) { showLoginScreen(); return; }

    try {
        const parsed = JSON.parse(saved);
        // Validate session against DB
        const { data, error } = await sb
            .from('users')
            .select('id, name, role, user_id')
            .eq('id', parsed.id)
            .in('role', ['admin', 'csd'])
            .single();

        if (error || !data) {
            localStorage.removeItem('droplog_admin');
            showLoginScreen();
            return;
        }

        currentAdmin = data;
        showMainApp();
    } catch (e) {
        localStorage.removeItem('droplog_admin');
        showLoginScreen();
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

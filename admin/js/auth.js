// ============================================================
// DropLog Admin â€” Authentication Module
// ============================================================
// Handles: admin login, session check, logout

let currentAdmin = null;

function showLoginScreen() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('mainApp').style.display = 'none';
}

function showMainApp() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';

    // Set admin name
    const nameEl = document.getElementById('adminName');
    if (nameEl) nameEl.textContent = currentAdmin.name || 'Admin';

    // Set warehouse dropdown to current
    const whSelect = document.querySelector('.wh-select');
    if (whSelect) whSelect.value = ACTIVE_WAREHOUSE_CODE;

    // Load default tab
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

// Check saved session on load
function checkSession() {
    const saved = localStorage.getItem('droplog_admin');
    if (saved) {
        try {
            currentAdmin = JSON.parse(saved);
            showMainApp();
        } catch (e) {
            showLoginScreen();
        }
    } else {
        showLoginScreen();
    }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    // Wait for Supabase
    const check = setInterval(() => {
        if (sb) {
            clearInterval(check);
            checkSession();
        }
    }, 300);
});
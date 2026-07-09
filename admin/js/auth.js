// ============================================================
// DropLog Admin — Authentication Module v3 (Multi-Warehouse)
// ============================================================

let currentAdmin = null;

function showLoginScreen() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('mainApp').style.display = 'none';
}

function showMainApp() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';

    // Warehouse-aware header
    var wh = getActiveWarehouse();
    var whLabel = getWarehouseLabel();
    document.getElementById('adminName').textContent = (currentAdmin.name || 'Admin') + ' — ' + whLabel;

    // Add warehouse tag to header-right
    var el = document.querySelector('.header-right .wh-tag');
    if (!el) {
        el = document.createElement('span');
        el.className = 'wh-tag';
        el.style.cssText = 'background:rgba(255,255,255,0.12);padding:4px 10px;border-radius:4px;font-size:11px;font-weight:600;';
        document.querySelector('.header-right').insertBefore(el, document.querySelector('.btn-logout'));
    }
    el.textContent = whLabel;

    switchTab('dashboard');
}

async function handleAdminLogin() {
    const userId = document.getElementById('loginId').value.trim();
    const pin = document.getElementById('loginPin').value.trim();

    if (!userId) { showToast('Enter Admin ID', 'warning'); return; }
    if (!pin) { showToast('Enter password', 'warning'); return; }
    if (!sb) { showToast('Connecting...', 'warning'); return; }

    // Set warehouse from URL param (or default)
    setActiveWarehouse(getActiveWarehouse());

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
        // Initialize warehouse from URL param
        setActiveWarehouse(getActiveWarehouse());
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

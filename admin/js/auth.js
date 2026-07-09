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

    const nameEl = document.getElementById('adminName');
    if (nameEl) nameEl.textContent = ACTIVE_WAREHOUSE_CODE + ' - ' + (currentAdmin.name || 'Admin');

    // Load default tab
    switchTab('dashboard');
}

async function handleAdminLogin() {
    const userId = document.getElementById('loginId').value.trim();
    const pin = document.getElementById('loginPin').value.trim();

    if (!userId) { showToast('Enter Admin ID', 'warning'); return; }
    if (!pin) { showToast('Enter password', 'warning'); return; }
    if (!sb) { showToast('Connecting...', 'warning'); return; }

    try {
        const hashedPin = await hashPin(pin);

        const { data, error } = await sb
            .from('users')
            .select('*')
            .eq('user_id', userId)
            .eq('pin', hashedPin)
            .in('role', ['admin', 'csd'])
            .single();

        if (error || !data) {
            showToast('Invalid credentials', 'error');
            return;
        }

        currentAdmin = data;
        localStorage.setItem('droplog_admin', JSON.stringify(data));
        showToast('Signed in as ' + data.name, 'success');

        // Auto-redirect if logged into wrong warehouse
        if (data.warehouse !== getWarehouseName()) {
            const code = data.warehouse.substring(0, 3);
            const url = new URL(window.location.href);
            url.searchParams.set('wh', code);
            window.location.href = url.toString();
            return;
        }

        showMainApp();
    } catch (e) {
        console.error('handleAdminLogin:', e);
        showToast(e.message || 'Something went wrong', 'error');
    }
}

function handleLogout() {
    currentAdmin = null;
    localStorage.removeItem('droplog_admin');
    showLoginScreen();
    showToast('Signed out', 'info');
}

// Check saved session on load
function checkSession() {
    try {
        const saved = localStorage.getItem('droplog_admin');
        if (saved) {
            try {
                currentAdmin = JSON.parse(saved);
                // If saved session is for a different warehouse, force re-login
                if (currentAdmin.warehouse !== getWarehouseName()) {
                    localStorage.removeItem('droplog_admin');
                    currentAdmin = null;
                    showLoginScreen();
                    return;
                }
                showMainApp();
            } catch (e) {
                console.error('checkSession (parse):', e);
                showLoginScreen();
            }
        } else {
            showLoginScreen();
        }
    } catch (e) {
        console.error('checkSession:', e);
        showToast(e.message || 'Something went wrong', 'error');
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
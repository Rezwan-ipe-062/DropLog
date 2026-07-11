// ============================================================
// DropLog SO App - Configuration
// ============================================================
const CONFIG = {
    SUPABASE_URL: 'https://afovfoaraolalebvookx.supabase.co',
    SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmb3Zmb2FyYW9sYWxlYnZvb2t4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzNTExMDksImV4cCI6MjA5ODkyNzEwOX0.mFQa-RvRYm-Rol7_I5O0vVThAf5Tfd59w6F5Fa3w7Bw',
    APP_NAME: 'DropLog',
    VERSION: '2.0.0',
    PORTAL_BASE: 'https://rezwan-ipe-062.github.io/DropLog/portal/?bp=',
    PORTAL_CONFIRM: 'https://rezwan-ipe-062.github.io/DropLog/portal/confirm/?stop='
};

let sb = null;
function initSupabase() {
    if (window.supabase && window.supabase.createClient) {
        sb = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
        return true;
    }
    return false;
}
const _sbInit = setInterval(() => { if (initSupabase()) clearInterval(_sbInit); }, 200);

// Security helpers
function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
}

// Security: hash PIN with SHA-256 before sending to DB
async function hashPin(pin) {
    const data = new TextEncoder().encode(pin + 'droplog_salt_v1');
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Shared utilities
function showToast(msg, type) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast ' + (type || 'info') + ' show';
    clearTimeout(showToast._t);
    const duration = type === 'error' ? 5000 : 2500;
    showToast._t = setTimeout(() => t.classList.remove('show'), duration);
}

function formatTime(d) {
    if (!d) return '--';
    if (typeof d === 'string') d = new Date(d);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

let _backNav = false;

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    var el = document.getElementById(id);
    if (!el) return;
    el.classList.add('active');
    var header = document.getElementById('appHeader');
    header.style.display = (id === 'screenLogin') ? 'none' : 'block';
    window.scrollTo(0, 0);

    // Push history so hardware back navigates in-app instead of leaving
    if (!_backNav && id !== 'screenLogin') history.pushState({ screen: id }, '');
    _backNav = false;

    // Hide save order button when leaving stops screen
    if (id !== 'screenStops') {
        var btn = document.getElementById('btnSaveOrder');
        if (btn) { btn.style.display = 'none'; btn.textContent = 'Save Stop Order'; btn.disabled = false; }
    }
}

// Handle hardware/device back button
window.addEventListener('popstate', function(e) {
    if (e.state && e.state.screen) {
        _backNav = true;
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        var el = document.getElementById(e.state.screen);
        if (!el) return;
        el.classList.add('active');
        var header = document.getElementById('appHeader');
        header.style.display = 'block';
        window.scrollTo(0, 0);
    }
});
// ============================================================
// DropLog Admin — Configuration
// ============================================================

const WAREHOUSE_MAP = {
    CTG: { name: 'CHITTAGONG', short: 'CTG' },
    GAZ: { name: 'GAZIPUR',    short: 'GAZ' },
    JSR: { name: 'JASHORE',    short: 'JSR' },
    BGR: { name: 'BOGURA',     short: 'BGR' },
};

// Parse ?wh= from URL or default to CTG
const _urlParams = new URLSearchParams(window.location.search);
const _whParam = _urlParams.get('wh');
const ACTIVE_WAREHOUSE_CODE = (_whParam && WAREHOUSE_MAP[_whParam.toUpperCase()])
    ? _whParam.toUpperCase() : 'CTG';

const CONFIG = {
    // Supabase
    SUPABASE_URL: 'https://afovfoaraolalebvookx.supabase.co',
    SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmb3Zmb2FyYW9sYWxlYnZvb2t4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzNTExMDksImV4cCI6MjA5ODkyNzEwOX0.mFQa-RvRYm-Rol7_I5O0vVThAf5Tfd59w6F5Fa3w7Bw',

    // App settings
    APP_NAME: 'DropLog',
    VERSION: '2.0.0',
    PLANT_NAME: WAREHOUSE_MAP[ACTIVE_WAREHOUSE_CODE].name,
    PLANT_SHORT: ACTIVE_WAREHOUSE_CODE,

    // SAP Parser â€” columns to extract from "Data" sheet
    SAP_COLUMNS: {
        group_delivery_number: ['Group Delivery Number', 'GD Number', 'Group Delivery'],
        delivery_document: ['Delivery Document', 'DO Number', 'Delivery'],
        billing_document_type: ['Billing Document Type', 'Billing Type'],
        bill_to_party_id: ['Bill-To Party', 'Business Partner ID', 'BP ID', 'Customer ID', 'Bill to Party'],
        bill_to_party_name: ['Bill-To Party Name', 'Customer Name', 'Bill to Party', 'BP Name'],
        bill_to_party_address: ['Bill-To Party Address', 'Customer Address', 'Bill to Party Address'],
        bill_to_party_city: ['Bill-To Party City', 'Customer City', 'Bill to Party City'],
        ship_to_party_name: ['Ship-To Party Name1', 'Ship To Party', 'Ship to Party'],
        ship_to_party_address: ['Ship-To Party Address', 'Ship to Party Address'],
        sales_district_desc: ['Sales District Description', 'District', 'Sales District'],
        ship_to_region_desc: ['Ship To Region Description', 'Region', 'Ship to Region'],
        material_code: ['Material', 'Material Code', 'Product Code'],
        material_description: ['Material Description', 'Product Description', 'Description'],
        batch: ['Batch', 'Batch No', 'Lot Number'],
        delivered_quantity: ['Delivered Quantity', 'Quantity', 'Del Qty', 'Qty'],
        sales_unit: ['Sales unit', 'Unit', 'UOM', 'Sales Unit'],
        plant_name: ['Plant Name', 'Plant', 'Warehouse'],
        posting_date: ['Posting Date', 'Post Date', 'Date'],
        delivery_document_date: ['Delivery Document Date', 'DO Date', 'Delivery Date'],
        order_reason_desc: ['Order Reason Description', 'Order Reason', 'Reason'],
    },

    // Preferred sheet names in SAP export (case-insensitive)
    SAP_SHEETS: ['Data', 'data', 'Sheet2'],
};

// Initialize Supabase client
let sb = null;
function initSupabase() {
    if (window.supabase && window.supabase.createClient) {
        sb = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
        return true;
    }
    return false;
}

// Retry until Supabase JS loads
const _sbInit = setInterval(() => {
    if (initSupabase()) clearInterval(_sbInit);
}, 200);

// ============================================================
// Shared utilities
// ============================================================
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast ' + type + ' show';
    clearTimeout(showToast._t);
    const duration = type === 'error' ? 5000 : 3000;
    showToast._t = setTimeout(() => toast.classList.remove('show'), duration);
}

function formatDate(dateStr) {
    if (!dateStr) return 'â€”';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(dateStr) {
    if (!dateStr) return 'â€”';
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function generateRouteCode(district, date) {
    const d = new Date(date);
    const dateStr = d.toISOString().slice(0, 10).replace(/-/g, '');
    const distShort = (district || 'UNK').substring(0, 4).toUpperCase();
    const rand = Math.floor(Math.random() * 99).toString().padStart(2, '0');
    return CONFIG.PLANT_SHORT + '-' + distShort + '-' + dateStr + '-' + rand;
}

// ============================================================
// Security helpers
// ============================================================
function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
}

// ============================================================
// Security: hash PIN with SHA-256 before sending to DB
// ============================================================
async function hashPin(pin) {
    const data = new TextEncoder().encode(pin + 'droplog_salt_v1');
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ============================================================
// Multi-warehouse helpers
// ============================================================
function getWarehouseCode() {
    return ACTIVE_WAREHOUSE_CODE;
}

function getWarehouseName() {
    return CONFIG.PLANT_NAME;
}

function getWarehouseList() {
    return Object.entries(WAREHOUSE_MAP).map(([code, w]) => ({ code, name: w.name }));
}

function switchWarehouse(code) {
    const url = new URL(window.location.href);
    url.searchParams.set('wh', code.toUpperCase());
    window.location.href = url.toString();
}
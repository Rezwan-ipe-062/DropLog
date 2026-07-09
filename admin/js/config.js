// ============================================================
// DropLog Admin â€” Configuration
// ============================================================

const CONFIG = {
    // Supabase
    SUPABASE_URL: 'https://afovfoaraolalebvookx.supabase.co',
    SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmb3Zmb2FyYW9sYWxlYnZvb2t4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzNTExMDksImV4cCI6MjA5ODkyNzEwOX0.mFQa-RvRYm-Rol7_I5O0vVThAf5Tfd59w6F5Fa3w7Bw',

    // App settings
    APP_NAME: 'DropLog',
    VERSION: '3.0.0',

    // Multi-warehouse support: query param ?wh=CTG or ?wh=GAZ etc.
    // Default is CHITTAGONG if no param
    WAREHOUSES: {
        CTG: { name: 'CHITTAGONG', label: 'Chittagong' },
        GAZ: { name: 'GAZIPUR', label: 'Gazipur' },
        JSR: { name: 'JESSORE', label: 'Jessore' },
        BGR: { name: 'BOGRA', label: 'Bogra' }
    },
    DEFAULT_WAREHOUSE: 'CTG',

    // Route code format: {PLANT_SHORT}-{DISTRICT_SHORT}-{DATE}-{SEQ}
    // PLANT_SHORT is now derived from the active warehouse

    // SAP Parser â€” columns to extract from "Data" sheet
    SAP_COLUMNS: {
        group_delivery_number: ['Group Delivery Number'],
        delivery_document: ['Delivery Document'],
        billing_document_type: ['Billing Document Type'],
        bill_to_party_id: ['Bill-To Party', 'Business Partner ID'],
        bill_to_party_name: ['Bill-To Party Name'],
        bill_to_party_address: ['Bill-To Party Address'],
        bill_to_party_city: ['Bill-To Party City'],
        ship_to_party_name: ['Ship-To Party Name1'],
        ship_to_party_address: ['Ship-To Party Address'],
        sales_district_desc: ['Sales District Description'],
        ship_to_region_desc: ['Ship To Region Description'],
        material_code: ['Material'],
        material_description: ['Material Description'],
        batch: ['Batch'],
        delivered_quantity: ['Delivered Quantity'],
        sales_unit: ['Sales unit'],
        plant_name: ['Plant Name'],
        posting_date: ['Posting Date'],
        delivery_document_date: ['Delivery Document Date'],
        order_reason_desc: ['Order Reason Description'],
    },

    // Preferred sheet names in SAP export
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
    showToast._t = setTimeout(() => toast.classList.remove('show'), 3000);
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

// ---- Multi-warehouse helpers ----

let _activeWarehouse = null;

function getActiveWarehouse() {
    if (_activeWarehouse) return _activeWarehouse;

    // 1. URL param ?wh=CTG
    var params = new URLSearchParams(window.location.search);
    var whParam = params.get('wh');

    // 2. Fall back to localStorage
    var whStored = localStorage.getItem('droplog_warehouse');

    // 3. Default
    var whCode = whParam || whStored || CONFIG.DEFAULT_WAREHOUSE;

    // Validate against known warehouses
    if (!CONFIG.WAREHOUSES[whCode]) {
        whCode = CONFIG.DEFAULT_WAREHOUSE;
    }

    _activeWarehouse = whCode;
    return whCode;
}

function setActiveWarehouse(code) {
    if (CONFIG.WAREHOUSES[code]) {
        _activeWarehouse = code;
        localStorage.setItem('droplog_warehouse', code);
    }
}

function getWarehouseName() {
    var wh = getActiveWarehouse();
    return CONFIG.WAREHOUSES[wh] ? CONFIG.WAREHOUSES[wh].name : wh;
}

function getWarehouseLabel() {
    var wh = getActiveWarehouse();
    return CONFIG.WAREHOUSES[wh] ? CONFIG.WAREHOUSES[wh].label : wh;
}

// Filter helper — adds .eq('warehouse', wh) to a Supabase query
// For fleet tables that use warehouse_code column instead
function scopeWarehouse(query, column) {
    column = column || 'warehouse';
    return query.eq(column, getActiveWarehouse());
}

function generateRouteCode(district, date) {
    const d = new Date(date);
    const dateStr = d.toISOString().slice(0, 10).replace(/-/g, '');
    const distShort = (district || 'UNK').substring(0, 4).toUpperCase();
    const rand = Math.floor(Math.random() * 99).toString().padStart(2, '0');
    return getActiveWarehouse() + '-' + distShort + '-' + dateStr + '-' + rand;
}
// ============================================================
// DropLog Admin â€” Configuration
// ============================================================
// Change ONLY this file when switching environments

const CONFIG = {
    // Supabase
    SUPABASE_URL: 'https://afovfoaraolalebvookx.supabase.co',
    SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmb3Zmb2FyYW9sYWxlYnZvb2t4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzNTExMDksImV4cCI6MjA5ODkyNzEwOX0.mFQa-RvRYm-Rol7_I5O0vVThAf5Tfd59w6F5Fa3w7Bw',

    // App settings
    APP_NAME: 'DropLog',
    VERSION: '2.0.0',
    PLANT_NAME: 'CHITTAGONG',

    // Route code format: {PLANT_SHORT}-{DISTRICT_SHORT}-{DATE}-{SEQ}
    PLANT_SHORT: 'CTG',

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

function generateRouteCode(district, date) {
    const d = new Date(date);
    const dateStr = d.toISOString().slice(0, 10).replace(/-/g, '');
    const distShort = (district || 'UNK').substring(0, 4).toUpperCase();
    const rand = Math.floor(Math.random() * 99).toString().padStart(2, '0');
    return CONFIG.PLANT_SHORT + '-' + distShort + '-' + dateStr + '-' + rand;
}
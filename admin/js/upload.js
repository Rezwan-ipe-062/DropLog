// ============================================================
// DropLog Admin - Upload Module v3
// ============================================================

async function handleSAPUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const statusEl = document.getElementById('uploadStatus');
    statusEl.textContent = 'Reading file...';
    statusEl.className = 'upload-status processing';

    if (typeof XLSX === 'undefined') {
        showToast('Excel library still loading, try again', 'warning');
        return;
    }

    try {
        const data = await readFileAsArrayBuffer(file);
        const wb = XLSX.read(data, { type: 'array' });

        // Detect if this is a standard template (13 columns) or full SAP export
        const sheet = detectDataSheet(wb);
        if (!sheet) {
            statusEl.textContent = 'Error: No valid data sheet found';
            statusEl.className = 'upload-status error';
            return;
        }

        statusEl.textContent = 'Parsing columns...';
        const rows = XLSX.utils.sheet_to_json(sheet);

        let mapped;
        // Try template mode first (exact column names, 13 columns)
        mapped = mapTemplateColumns(rows);
        if (!mapped) {
            // Fall back to auto-detect mode
            mapped = mapColumns(rows);
        }

        if (!mapped) {
            statusEl.textContent = 'Error: Required columns not found. Use the standard template or full SAP export.';
            statusEl.className = 'upload-status error';
            return;
        }

        statusEl.textContent = 'Parsed ' + mapped.length + ' rows. Grouping...';
        const grouped = groupIntoStructure(mapped);

        // Pre-upload validation: show warning if GDs already assigned
        const existingGdNums = grouped.map(g => g.group_delivery_number);
        const { data: existingGds } = await sb
            .from('available_gds')
            .select('group_delivery_number, status')
            .in('group_delivery_number', existingGdNums);

        const assignedGds = (existingGds || []).filter(g => g.status === 'assigned');
        if (assignedGds.length > 0) {
            const msg = assignedGds.length + ' GD(s) are already assigned to routes and will be skipped: ' +
                assignedGds.map(g => g.group_delivery_number).join(', ');
            if (!confirm(msg + '\n\nContinue with the remaining GDs?')) {
                statusEl.textContent = 'Upload cancelled';
                statusEl.className = 'upload-status';
                return;
            }
        }

        statusEl.textContent = 'Found ' + grouped.length + ' Group Deliveries. Writing to database...';

        const result = await writeToSupabase(mapped, grouped);

        if (result.success) {
            statusEl.textContent = '[OK] ' + result.added + ' new GDs uploaded (' + result.stops + ' stops, ' + result.products + ' product lines' +
                (result.skipped > 0 ? ', ' + result.skipped + ' skipped (already assigned)' : '') + ')';
            statusEl.className = 'upload-status success';
            showToast('Upload complete', 'success');
            if (typeof loadAvailableGDs === 'function') loadAvailableGDs();
        } else {
            statusEl.textContent = 'Error: ' + result.error;
            statusEl.className = 'upload-status error';
        }

    } catch (err) {
        statusEl.textContent = 'Error: ' + err.message;
        statusEl.className = 'upload-status error';
        console.error('Upload error:', err);
    }

    event.target.value = '';
}

// ---- Template Mode (13 fixed columns, exact match) ----
const TEMPLATE_COLUMNS = [
    'group_delivery_number', 'delivery_document', 'bill_to_party_id',
    'bill_to_party_name', 'bill_to_party_address', 'billing_document_type',
    'posting_date', 'material_code', 'material_description',
    'delivered_quantity', 'sales_district_desc', 'plant_name',
    'order_reason_desc'
];

const TEMPLATE_HEADERS = [
    'Group Delivery Number', 'Delivery Document', 'Bill-To Party',
    'Bill-To Party Name', 'Bill-To Party Address', 'Billing Document Type',
    'Posting Date', 'Material', 'Material Description',
    'Delivered Quantity', 'Sales District Description', 'Plant Name',
    'Order Reason Description'
];

function mapTemplateColumns(rows) {
    if (!rows || rows.length === 0) return null;
    const sampleRow = rows[0];

    // Check if ALL template headers exist exactly
    let allFound = true;
    for (const h of TEMPLATE_HEADERS) {
        if (!sampleRow.hasOwnProperty(h)) { allFound = false; break; }
    }
    if (!allFound) return null;

    return rows.map(row => {
        const mapped = {};
        TEMPLATE_COLUMNS.forEach((key, i) => {
            const original = TEMPLATE_HEADERS[i];
            mapped[key] = row[original] !== undefined ? row[original] : null;
        });
        mapped.group_delivery_number = String(mapped.group_delivery_number || '').trim();
        mapped.delivery_document = String(mapped.delivery_document || '').trim();
        mapped.bill_to_party_id = String(mapped.bill_to_party_id || '').trim();
        mapped.delivered_quantity = Number(mapped.delivered_quantity) || 0;
        mapped.posting_date = excelDateToISO(mapped.posting_date);
        mapped.delivery_document_date = null;
        mapped.is_foc = (mapped.billing_document_type === 'ZY70') ||
            (String(mapped.order_reason_desc || '').toUpperCase().includes('FOC'));
        mapped.ship_to_region_desc = mapped.ship_to_party_address = mapped.ship_to_party_name = mapped.ship_to_party_city = null;
        return mapped;
    }).filter(r => r.group_delivery_number && r.group_delivery_number !== 'undefined');
}

// ---- Auto-detect mode (full SAP export) ----
function mapColumns(rows) {
    if (!rows || rows.length === 0) return null;

    const sampleRow = rows[0];
    const colMapping = {};
    let requiredFound = 0;
    const required = ['group_delivery_number', 'delivery_document', 'bill_to_party_name',
                      'material_description', 'delivered_quantity'];

    for (const [internalName, possibleNames] of Object.entries(CONFIG.SAP_COLUMNS)) {
        for (const colName of possibleNames) {
            if (sampleRow.hasOwnProperty(colName)) {
                colMapping[internalName] = colName;
                if (required.includes(internalName)) requiredFound++;
                break;
            }
        }
    }

    if (requiredFound < required.length) {
        console.error('Missing required columns. Found mapping:', colMapping);
        return null;
    }

    return rows.map(row => {
        const mapped = {};
        for (const [internal, original] of Object.entries(colMapping)) {
            mapped[internal] = row[original] !== undefined ? row[original] : null;
        }
        mapped.group_delivery_number = String(mapped.group_delivery_number || '').trim();
        mapped.delivery_document = String(mapped.delivery_document || '').trim();
        mapped.bill_to_party_id = String(mapped.bill_to_party_id || '').trim();
        mapped.delivered_quantity = Number(mapped.delivered_quantity) || 0;
        mapped.posting_date = excelDateToISO(mapped.posting_date);
        mapped.delivery_document_date = excelDateToISO(mapped.delivery_document_date);
        mapped.is_foc = (mapped.billing_document_type === 'ZY70') ||
                        (String(mapped.order_reason_desc || '').toUpperCase().includes('FOC'));
        return mapped;
    }).filter(r => r.group_delivery_number && r.group_delivery_number !== 'undefined');
}

// ---- Shared helpers (same as before, with epoch fix) ----

function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(new Uint8Array(e.target.result));
        reader.onerror = e => reject(new Error('File read failed'));
        reader.readAsArrayBuffer(file);
    });
}

function excelDateToISO(value, wb) {
    if (!value) return null;
    if (typeof value === 'string' && value.includes('-')) return value;
    if (typeof value === 'number') {
        // Check if workbook uses 1904 date system (Mac Excel)
        var date1904 = false;
        if (wb && wb.Workbook && wb.Workbook.WBProps) {
            date1904 = wb.Workbook.WBProps.date1904 || false;
        }
        var epoch = date1904 ? new Date(1904, 0, 1) : new Date(1899, 11, 30);
        var date = new Date(epoch.getTime() + value * 86400000);
        return date.toISOString().slice(0, 10);
    }
    var d = new Date(value);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return null;
}

function detectDataSheet(wb) {
    for (const name of CONFIG.SAP_SHEETS) {
        if (wb.SheetNames.includes(name)) {
            const sheet = wb.Sheets[name];
            const sample = XLSX.utils.sheet_to_json(sheet, { range: 0, header: 1 });
            if (sample[0] && sample[0].length > 5) return sheet;
        }
    }
    let best = null, maxCols = 0;
    for (const name of wb.SheetNames) {
        const sample = XLSX.utils.sheet_to_json(wb.Sheets[name], { range: 0, header: 1 });
        if (sample[0] && sample[0].length > maxCols) {
            maxCols = sample[0].length;
            best = wb.Sheets[name];
        }
    }
    return best;
}

function groupIntoStructure(rows) {
    const gdMap = {};
    rows.forEach(row => {
        const gd = row.group_delivery_number;
        if (!gdMap[gd]) gdMap[gd] = [];
        gdMap[gd].push(row);
    });

    const results = [];

    for (const [gdNum, gdRows] of Object.entries(gdMap)) {
        const stopMap = {};
        gdRows.forEach(row => {
            const key = (row.bill_to_party_id || '') + '||' + (row.bill_to_party_name || '');
            if (!stopMap[key]) {
                stopMap[key] = {
                    customer_id: row.bill_to_party_id,
                    customer_name: row.bill_to_party_name || 'Unknown',
                    address: row.bill_to_party_address || row.ship_to_party_address || '',
                    city: row.bill_to_party_city || '',
                    district: row.sales_district_desc || '',
                    delivery_documents: new Set(),
                    products: [],
                    total_quantity: 0
                };
            }
            stopMap[key].delivery_documents.add(row.delivery_document);
            stopMap[key].products.push({
                delivery_document: row.delivery_document,
                material_code: String(row.material_code || ''),
                material_description: row.material_description || '',
                batch: row.batch || '',
                quantity: row.delivered_quantity,
                unit: row.sales_unit || 'GEB',
                is_foc: row.is_foc
            });
            stopMap[key].total_quantity += row.delivered_quantity;
        });

        const stops = Object.values(stopMap).map(s => ({
            ...s,
            delivery_documents: Array.from(s.delivery_documents),
            num_products: s.products.length
        }));

        const firstRow = gdRows[0];
        results.push({
            group_delivery_number: gdNum,
            posting_date: firstRow.posting_date || null,
            plant_name: firstRow.plant_name || '',
            district: firstRow.sales_district_desc || '',
            region: firstRow.ship_to_region_desc || '',
            num_delivery_docs: new Set(gdRows.map(r => r.delivery_document)).size,
            num_unique_customers: stops.length,
            total_quantity: gdRows.reduce((s, r) => s + r.delivered_quantity, 0),
            total_products: gdRows.length,
            is_multi_stop: stops.length > 1,
            stops: stops
        });
    }

    return results;
}

async function writeToSupabase(rawRows, grouped) {
    if (!sb) return { success: false, error: 'Database not connected' };

    let totalStops = 0, totalProducts = 0, added = 0, skipped = 0;

    try {
        // 1. Upsert GDs — only add new ones, skip assigned ones
        for (const gd of grouped) {
            // Check if GD already exists and is assigned
            const { data: existing } = await sb
                .from('available_gds')
                .select('id, status')
                .eq('group_delivery_number', gd.group_delivery_number)
                .maybeSingle();

            if (existing && existing.status === 'assigned') {
                skipped++;
                continue;
            }

            // Upsert GD
            const gdRecord = {
                group_delivery_number: gd.group_delivery_number,
                posting_date: gd.posting_date || null,
                plant_name: gd.plant_name,
                district: gd.district,
                region: gd.region,
                num_delivery_docs: gd.num_delivery_docs,
                num_unique_customers: gd.num_unique_customers,
                total_quantity: gd.total_quantity,
                total_products: gd.total_products,
                is_multi_stop: gd.is_multi_stop,
                status: 'available'
            };

            const { data: insertedGd, error: gdErr } = await sb
                .from('available_gds')
                .upsert(gdRecord, { onConflict: 'group_delivery_number' })
                .select()
                .single();

            if (gdErr) {
                console.error('GD insert error:', gdErr);
                continue;
            }

            added++;
            const gdId = insertedGd.id;

            // 2. Delete existing stops + products for this GD (if re-uploading)
            const { data: oldStops } = await sb.from('parsed_stops').select('id').eq('gd_id', gdId);
            if (oldStops && oldStops.length > 0) {
                const oldIds = oldStops.map(s => s.id);
                await sb.from('parsed_products').delete().in('stop_id', oldIds);
                await sb.from('parsed_stops').delete().eq('gd_id', gdId);
            }

            // 3. Insert stops
            const stopRecords = gd.stops.map(stop => ({
                gd_id: gdId,
                group_delivery_number: gd.group_delivery_number,
                customer_id: stop.customer_id,
                customer_name: stop.customer_name,
                address: stop.address,
                city: stop.city,
                district: stop.district || gd.district,
                delivery_documents: stop.delivery_documents,
                total_quantity: stop.total_quantity,
                num_products: stop.num_products
            }));

            const { data: insertedStops, error: stopErr } = await sb
                .from('parsed_stops')
                .insert(stopRecords)
                .select();

            if (stopErr) {
                console.error('Stop insert error:', stopErr);
                continue;
            }

            totalStops += (insertedStops || []).length;

            // 4. Insert products
            const productRecords = [];
            (insertedStops || []).forEach(rs => {
                // Find matching stop by customer_id + customer_name
                const origStop = gd.stops.find(s =>
                    s.customer_id === rs.customer_id && s.customer_name === rs.customer_name);
                if (origStop) {
                    origStop.products.forEach(p => {
                        productRecords.push({
                            stop_id: rs.id,
                            delivery_document: p.delivery_document,
                            material_code: p.material_code,
                            material_description: p.material_description,
                            batch: p.batch,
                            quantity: p.quantity,
                            unit: p.unit || 'GEB',
                            is_foc: p.is_foc
                        });
                    });
                }
            });

            if (productRecords.length > 0) {
                const { error: prodErr } = await sb.from('parsed_products').insert(productRecords);
                if (prodErr) {
                    console.error('Product insert error:', prodErr);
                } else {
                    totalProducts += productRecords.length;
                }
            }
        }

        return { success: true, stops: totalStops, products: totalProducts, added: added, skipped: skipped };

    } catch (err) {
        console.error('writeToSupabase error:', err);
        return { success: false, error: err.message, added: added, skipped: skipped };
    }
}

async function clearAllData() {
    if (!confirm('This will delete ALL parsed data (GDs, stops, products). Routes are NOT affected. Continue?')) return;

    showToast('Clearing...', 'warning');

    await sb.from('parsed_products').delete().not('id', 'is', null);
    await sb.from('parsed_stops').delete().not('id', 'is', null);
    await sb.from('available_gds').delete().not('id', 'is', null);
    await sb.from('raw_deliveries').delete().not('id', 'is', null);

    showToast('All parsed data cleared', 'success');
    document.getElementById('uploadStatus').textContent = '';

    availableGDs = [];
    stopsCache = {};
    selectedGDs = new Set();

    var rbContent = document.getElementById('routeBuilderContent');
    if (rbContent) rbContent.innerHTML = '<div class="empty-state"><p>No available GDs. Upload an SAP export first.</p></div>';
}

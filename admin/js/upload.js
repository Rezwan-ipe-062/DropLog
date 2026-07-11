// ============================================================
// DropLog Admin - Upload Module (SAP Parser - Client Side)
// ============================================================
// FIXED: v2 - proper GD>Stop>Product write chain

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

        const sheet = detectDataSheet(wb);
        if (!sheet) {
            statusEl.textContent = 'Error: No valid data sheet found';
            statusEl.className = 'upload-status error';
            return;
        }

        statusEl.textContent = 'Parsing columns...';
        const rows = XLSX.utils.sheet_to_json(sheet);

        const mapped = mapColumns(rows);
        if (!mapped) {
            statusEl.textContent = 'Error: Required columns not found in SAP export';
            statusEl.className = 'upload-status error';
            return;
        }

        statusEl.textContent = 'Parsed ' + mapped.length + ' rows. Grouping...';
        const groupedResult = groupIntoStructure(mapped);
        const grouped = groupedResult.results;
        const mergedCount = groupedResult.mergedCount;

        statusEl.textContent = 'Found ' + grouped.length + ' Group Deliveries. Writing to database...';

        const result = await writeToSupabase(mapped, grouped);

        if (result.success) {
            var msg = '[OK] ' + grouped.length + ' GDs uploaded (' + result.stops + ' stops, ' + result.products + ' product lines)';
            if (mergedCount > 0) msg += ' — ' + mergedCount + ' GD(s) merged across plant name variants';
            statusEl.textContent = msg;
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

    // Reset file input so same file can be re-uploaded
    event.target.value = '';
}

// ---- Helpers ----

function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(new Uint8Array(e.target.result));
        reader.onerror = e => reject(new Error('File read failed'));
        reader.readAsArrayBuffer(file);
    });
}


// Convert Excel serial number to ISO date string (YYYY-MM-DD)
function excelDateToISO(value) {
    if (!value) return null;
    // Already a string date
    if (typeof value === 'string' && value.includes('-')) return value;
    // Excel serial number
    if (typeof value === 'number') {
        const epoch = new Date(1899, 11, 30); // Excel epoch: Dec 30, 1899
        const date = new Date(epoch.getTime() + value * 86400000);
        return date.toISOString().slice(0, 10);
    }
    // Try parsing as date
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return null;
}

function detectDataSheet(wb) {
    const sheetNamesLower = wb.SheetNames.map(n => n.trim().toLowerCase());
    for (const name of CONFIG.SAP_SHEETS) {
        const idx = sheetNamesLower.indexOf(name.trim().toLowerCase());
        if (idx !== -1) {
            const sheet = wb.Sheets[wb.SheetNames[idx]];
            const sample = XLSX.utils.sheet_to_json(sheet, { range: 0, header: 1 });
            if (sample[0] && sample[0].length > 20) return sheet;
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

function mapColumns(rows) {
    if (!rows || rows.length === 0) return null;

    const sampleRow = rows[0];
    // Build lowercase lookup of actual column names (trimmed)
    const actualCols = {};
    Object.keys(sampleRow).forEach(k => {
        const trimmed = k.trim();
        actualCols[trimmed.toLowerCase()] = trimmed;
    });

    const colMapping = {};
    let requiredFound = 0;
    const required = ['group_delivery_number', 'delivery_document', 'bill_to_party_name', 
                      'material_description', 'delivered_quantity'];

    for (const [internalName, possibleNames] of Object.entries(CONFIG.SAP_COLUMNS)) {
        for (const colName of possibleNames) {
            const key = colName.toLowerCase();
            if (actualCols[key]) {
                colMapping[internalName] = actualCols[key];
                if (required.includes(internalName)) requiredFound++;
                break;
            }
        }
    }

    if (requiredFound < required.length) {
        console.error('Missing required columns. Found mapping:', colMapping);
        console.error('Available columns in file:', Object.keys(actualCols));
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
        mapped._raw_plant_name = String(mapped.plant_name || '').trim();
        mapped.plant_name = normalizePlantName(mapped.plant_name);
        // Convert date fields from Excel serial numbers
        mapped.posting_date = excelDateToISO(mapped.posting_date);
        mapped.delivery_document_date = excelDateToISO(mapped.delivery_document_date);
        mapped.is_foc = (mapped.billing_document_type === 'ZY70') || 
                        (String(mapped.order_reason_desc || '').toUpperCase().includes('FOC'));
        return mapped;
    }).filter(r => r.group_delivery_number && r.group_delivery_number !== 'undefined');
}

function groupIntoStructure(rows) {
    const gdMap = {};
    rows.forEach(row => {
        const gd = row.group_delivery_number;
        if (!gdMap[gd]) gdMap[gd] = [];
        gdMap[gd].push(row);
    });

    const results = [];
    let mergedCount = 0;

    for (const [gdNum, gdRows] of Object.entries(gdMap)) {
        // Detect if same GD appeared under different plant name spellings
        const rawNames = [...new Set(gdRows.map(r => r._raw_plant_name).filter(Boolean))];
        if (rawNames.length > 1) {
            mergedCount++;
            console.log('GD ' + gdNum + ' appeared under multiple plant names:', rawNames.join(', '), '— normalized to', gdRows[0].plant_name);
        }
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
            plant_name: normalizePlantName(firstRow.plant_name),
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

    return { results: results, mergedCount: mergedCount };
}

async function writeToSupabase(rawRows, grouped) {
    if (!sb) return { success: false, error: 'Database not connected' };

    let totalStops = 0, totalProducts = 0;

    try {
        // 1. Write available_gds first (all at once)
        const gdRecords = grouped.map(gd => ({
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
        }));

        // Deduplicate by group_delivery_number (same GD may appear under multiple plant name spellings)
        const seen = {};
        const dedupedGDs = [];
        let duplicateCount = 0;
        gdRecords.forEach(function(r) {
            if (seen[r.group_delivery_number]) {
                duplicateCount++;
                console.log('Duplicate GD merged:', r.group_delivery_number, '(appeared as', seen[r.group_delivery_number], 'and', r.plant_name + ')');
                return;
            }
            seen[r.group_delivery_number] = r.plant_name;
            dedupedGDs.push(r);
        });

        // Delete existing and re-insert (clean slate)
        await sb.from('available_gds').delete().eq('plant_name', getWarehouseName());

        const { data: insertedGDs, error: gdErr } = await sb
            .from('available_gds')
            .insert(dedupedGDs)
            .select();

        if (gdErr) {
            console.error('GD insert error:', gdErr);
            return { success: false, error: 'Failed to insert GDs: ' + gdErr.message };
        }

        console.log('Inserted GDs:', insertedGDs.length);

        // 2. Build a lookup: group_delivery_number > id
        const gdLookup = {};
        insertedGDs.forEach(g => { gdLookup[g.group_delivery_number] = g.id; });

        // 3. Insert all stops
        const allStopRecords = [];
        const stopToProducts = {}; // temp index to link products after stop insert

        let stopIdx = 0;
        for (const gd of grouped) {
            const gdId = gdLookup[gd.group_delivery_number];
            if (!gdId) { console.warn('No ID for GD:', gd.group_delivery_number); continue; }

            for (const stop of gd.stops) {
                allStopRecords.push({
                    _idx: stopIdx,  // temp field, won't be sent to DB
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
                });
                stopToProducts[stopIdx] = stop.products;
                stopIdx++;
            }
        }

        // Remove _idx before sending to DB, insert in batches
        const stopRecordsClean = allStopRecords.map(({ _idx, ...rest }) => rest);

        let insertedStops = [];
        for (let i = 0; i < stopRecordsClean.length; i += 100) {
            const batch = stopRecordsClean.slice(i, i + 100);
            const { data: batchData, error: stopErr } = await sb
                .from('parsed_stops')
                .insert(batch)
                .select();

            if (stopErr) {
                console.error('Stop insert error (batch ' + i + '):', stopErr);
                continue;
            }
            if (batchData) insertedStops = insertedStops.concat(batchData);
        }

        totalStops = insertedStops.length;
        console.log('Inserted stops:', totalStops);

        // 4. Insert products - match by order (stops inserted in same order)
        const allProductRecords = [];

        for (let i = 0; i < insertedStops.length; i++) {
            const stopId = insertedStops[i].id;
            const products = stopToProducts[i] || [];

            products.forEach(p => {
                allProductRecords.push({
                    stop_id: stopId,
                    delivery_document: p.delivery_document,
                    material_code: p.material_code,
                    material_description: p.material_description,
                    batch: p.batch,
                    quantity: p.quantity,
                    unit: p.unit,
                    is_foc: p.is_foc
                });
            });
        }

        // Insert products in batches of 200
        for (let i = 0; i < allProductRecords.length; i += 200) {
            const batch = allProductRecords.slice(i, i + 200);
            const { error: prodErr } = await sb.from('parsed_products').insert(batch);
            if (prodErr) {
                console.error('Product insert error (batch ' + i + '):', prodErr);
            } else {
                totalProducts += batch.length;
            }
        }

        console.log('Inserted products:', totalProducts);

        return { success: true, stops: totalStops, products: totalProducts, duplicates: duplicateCount };

    } catch (err) {
        console.error('writeToSupabase error:', err);
        return { success: false, error: err.message };
    }
}

async function clearAllData() {
    if (!confirm('This will delete ALL parsed data (GDs, stops, products) for ' + getWarehouseName() + '. Routes are NOT affected. Continue?')) return;

    try {
        showToast('Clearing...', 'warning');
        var wh = getWarehouseName();

        // Delete in order (child tables first due to foreign keys)
        var gdIds = (await sb.from('available_gds').select('id').eq('plant_name', wh)).data || [];
        var gdIdList = gdIds.map(function(g) { return g.id; });
        if (gdIdList.length > 0) {
            var stopIds = (await sb.from('parsed_stops').select('id').in('gd_id', gdIdList)).data || [];
            var stopIdList = stopIds.map(function(s) { return s.id; });
            if (stopIdList.length > 0) {
                await sb.from('parsed_products').delete().in('stop_id', stopIdList);
            }
            await sb.from('parsed_stops').delete().in('gd_id', gdIdList);
        }
        await sb.from('available_gds').delete().eq('plant_name', wh).gt('created_at', '2000-01-01');
        await sb.from('raw_deliveries').delete().eq('plant_name', wh).gt('created_at', '2000-01-01');

        showToast('All parsed data cleared', 'success');
        document.getElementById('uploadStatus').textContent = '';

        // Reset Route Builder state in memory
        availableGDs = [];
        stopsCache = {};
        selectedGDs = new Set();
        selectedStops = new Set();
        filterDate = null;

        // Clear Route Builder UI
        var rbContent = document.getElementById('routeBuilderContent');
        if (rbContent) rbContent.innerHTML = '<div class="empty-state"><p>No available GDs. Upload an SAP export first.</p></div>';
    } catch (e) {
        console.error('clearAllData:', e);
        showToast(e.message || 'Something went wrong', 'error');
    }
}
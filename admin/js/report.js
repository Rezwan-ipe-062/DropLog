// ============================================================
// DropLog Admin - Route Report Generator v3 (2-Page Premium)
// ============================================================
// Page 1: Official Route Information form (for filing)
// Page 2: Trip Analytics & Detail (for CSO review)

var jsPDFScript = document.createElement('script');
jsPDFScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
document.head.appendChild(jsPDFScript);

async function generateRouteReport(routeId) {
    if (typeof window.jspdf === 'undefined') {
        showToast('PDF library loading, try again', 'warning');
        return;
    }

    // Load all data
    var { data: route } = await sb.from('routes').select('*').eq('id', routeId).single();
    if (!route) { showToast('Route not found', 'error'); return; }

    var { data: stops } = await sb.from('route_stops').select('*').eq('route_id', routeId).order('stop_sequence');
    stops = stops || [];

    var { data: issues } = await sb.from('issues').select('*').eq('route_id', routeId).order('reported_at');
    issues = issues || [];

    var soName = '--';
    if (route.assigned_so_id) {
        var { data: so } = await sb.from('users').select('name, user_id').eq('id', route.assigned_so_id).single();
        if (so) soName = so.name;
    }

    var perKmCost = 0;
    if (route.plant_name) {
        var { data: wh } = await sb.from('warehouses').select('per_km_cost').eq('name', route.plant_name).maybeSingle();
        if (wh && wh.per_km_cost) perKmCost = Number(wh.per_km_cost);
    }

    // Helpers
    function fDate(d) { if (!d) return '--'; return new Date(d).toLocaleDateString('en-GB', {day:'2-digit', month:'2-digit', year:'numeric'}); }
    function fTime(d) { if (!d) return '--'; return new Date(d).toLocaleTimeString('en-US', {hour:'numeric', minute:'2-digit', hour12:true}); }
    function fDateTime(d) { if (!d) return '--'; return fDate(d) + ' ' + fTime(d); }

    var doc = new window.jspdf.jsPDF('p', 'mm', 'a4');
    var W = 210, H = 297;
    var M = 14;
    var y = 0;

    // Brand colors
    var synBlue = [0, 69, 124];
    var synGreen = [0, 169, 79];
    var grayLight = [244, 245, 247];
    var grayMid = [200, 204, 212];
    var grayDark = [61, 66, 80];
    var white = [255, 255, 255];
    var red = [183, 28, 28];
    var amber = [245, 158, 11];
    var deepBlue = [0, 59, 111];
    var ink = [23, 33, 43];

    // ================================================================
    // PAGE 1: Official Route Information Form
    // ================================================================

    // --- Header Bar ---
    doc.setFillColor(synBlue[0], synBlue[1], synBlue[2]);
    doc.rect(0, 0, W, 18, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('syngenta', M, 8);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('Syngenta Bangladesh Limited', M, 13);

    // DropLog branding (right side of header)
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('DropLog', W - M, 8, { align: 'right' });
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('Digital Route Tracking', W - M, 13, { align: 'right' });

    // --- Title ---
    doc.setTextColor(0, 0, 0);
    y = 26;
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('ROUTE INFORMATION', W/2, y, { align: 'center' });
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(grayDark[0], grayDark[1], grayDark[2]);
    doc.text('Official Record - Customer Service & Distribution', W/2, y + 5, { align: 'center' });

    // --- Form Table ---
    y = 36;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(8);
    var tableX = M;
    var tableW = W - 2*M;
    var rowH = 7.5;
    var halfW = tableW / 2;

    function drawFormRow(label, value, x, w) {
        doc.setDrawColor(grayMid[0], grayMid[1], grayMid[2]);
        doc.setLineWidth(0.2);
        doc.rect(x, y, w, rowH);
        doc.setFillColor(grayLight[0], grayLight[1], grayLight[2]);
        doc.rect(x, y, w * 0.45, rowH, 'F');
        doc.setDrawColor(grayMid[0], grayMid[1], grayMid[2]);
        doc.rect(x, y, w, rowH);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.text(label, x + 3, y + 5);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.text(String(value || '--'), x + w * 0.47, y + 5);
    }

    function splitRow(l1, v1, l2, v2) {
        drawFormRow(l1, v1, tableX, halfW);
        drawFormRow(l2, v2, tableX + halfW, halfW);
        y += rowH;
    }

    function fullRow(l, v) {
        drawFormRow(l, v, tableX, tableW);
        y += rowH;
    }

    // Form fields
    splitRow('Warehouse', route.plant_name || 'Chittagong', 'Transit Number', route.route_code);
    splitRow('Start Date & Time', fDateTime(route.started_at), 'Complete Date & Time', fDateTime(route.completed_at));
    fullRow('Return Date', fDate(route.completed_at));

    // KM Row (3 cols)
    var thirdW = tableW / 3;
    doc.setDrawColor(grayMid[0], grayMid[1], grayMid[2]);
    doc.setFillColor(grayLight[0], grayLight[1], grayLight[2]);
    doc.rect(tableX, y, thirdW, rowH, 'FD');
    doc.rect(tableX + thirdW, y, thirdW, rowH, 'FD');
    doc.rect(tableX + 2*thirdW, y, thirdW, rowH, 'FD');
    // Override with values
    doc.setFillColor(255, 255, 255);
    doc.rect(tableX, y, thirdW, rowH, 'D');
    doc.rect(tableX + thirdW, y, thirdW, rowH, 'D');
    doc.rect(tableX + 2*thirdW, y, thirdW, rowH, 'D');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text('Initial Reading', tableX + 2, y + 3);
    doc.text('Last Reading', tableX + thirdW + 2, y + 3);
    doc.text('Driven (KM)', tableX + 2*thirdW + 2, y + 3);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(String(route.initial_km_reading || '--'), tableX + 2, y + 6.5);
    doc.text(String(route.final_km_reading || '--'), tableX + thirdW + 2, y + 6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(synBlue[0], synBlue[1], synBlue[2]);
    var drivenDisplay = (route.initial_km_reading && route.final_km_reading) ? String(route.driven_km) : '--';
    doc.text(drivenDisplay, tableX + 2*thirdW + 2, y + 6.5);
    doc.setTextColor(0, 0, 0);
    y += rowH;

    fullRow('Route Name', route.route_name || route.district);
    splitRow('Region', route.district, 'No of Stockist Visited', stops.length);

    // Visited Stockist Location (taller row)
    var locH = Math.max(rowH * 3, Math.ceil(stops.length / 2) * 5 + 10);
    doc.setDrawColor(grayMid[0], grayMid[1], grayMid[2]);
    doc.rect(tableX, y, tableW, locH);
    doc.setFillColor(grayLight[0], grayLight[1], grayLight[2]);
    doc.rect(tableX, y, tableW * 0.25, rowH, 'F');
    doc.setDrawColor(grayMid[0], grayMid[1], grayMid[2]);
    doc.rect(tableX, y, tableW, locH);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('Visited Stockist', tableX + 3, y + 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    var locStartY = y + 5;
    var colWidth = (tableW - 8) / 2;
    stops.forEach(function(s, i) {
        var col = Math.floor(i / 8);
        var row = i % 8;
        var xp = tableX + 4 + col * colWidth;
        var yp = locStartY + row * 4 + 4;
        if (yp < y + locH - 2) {
            doc.text((i+1) + '. ' + s.customer_name.substring(0, 24), xp, yp);
        }
    });
    y += locH;

    // Vehicle section
    var vType = (route.vehicle_type || 'cover_truck') === 'cover_truck' ? 'Cover Truck' : 'Open Truck';
    splitRow('Vehicle No & Type', (route.vehicle_number || '--') + '  (' + vType + ')', 'No. of Vehicles Used', route.num_vehicles_used || '1');
    fullRow('Vendor Name', route.vendor_name || '--');

    // Financial section
    fullRow('Route Sales Value', route.sales_value ? 'BDT ' + Number(route.sales_value).toLocaleString() : '--');
    fullRow('Others Region Sales', '');
    fullRow('Transit Volume (MT)', route.transit_volume_mt ? route.transit_volume_mt + ' MT' : '--');
    fullRow('Vehicle Capacity (MT)', route.vehicle_capacity_mt ? route.vehicle_capacity_mt + ' MT' : '--');
    fullRow('SO Travelling Expense', route.so_travelling_expense ? 'BDT ' + Number(route.so_travelling_expense).toLocaleString() : '--');
    fullRow('Carrying Cost', route.carrying_cost ? 'BDT ' + Number(route.carrying_cost).toLocaleString() : '--');
    fullRow('Loading/Unloading Cost', route.loading_unloading_cost ? 'BDT ' + Number(route.loading_unloading_cost).toLocaleString() : '--');

    // Signatures
    y += 12;
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.text('Data Entry by SO (Name & Signature):', tableX, y);
    doc.text('Driver/Vendor Sign:', tableX + 68, y);
    doc.text('Verified by CSO:', tableX + 130, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(soName, tableX, y);
    y += 6;
    doc.setDrawColor(0);
    doc.setLineWidth(0.3);
    doc.line(tableX, y, tableX + 55, y);
    doc.line(tableX + 68, y, tableX + 120, y);
    doc.line(tableX + 130, y, W - M, y);

    // Footer note
    y += 8;
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(grayDark[0], grayDark[1], grayDark[2]);
    doc.text('Note: Please put actual informations. Based on this data, Route Analysis & prepare Transport bill.', tableX, y);

    // Page footer
    doc.setFontSize(6);
    doc.text('Generated by DropLog v2.0 | ' + new Date().toLocaleString(), tableX, H - 8);
    doc.text('Page 1 of 2', W - M, H - 8, { align: 'right' });

    // ================================================================
    // PAGE 2: Exception Review & Delivery Dashboard
    // ================================================================
    doc.addPage();
    y = 0;

    // Compute aggregates
    var delivered = stops.filter(function(s) { return s.status === 'delivered' || s.status === 'partial'; }).length;
    var failed = stops.filter(function(s) { return s.status === 'failed'; }).length;
    var pending = stops.filter(function(s) { return s.status === 'pending'; }).length;
    var confirmedCount = stops.filter(function(s) { return s.customer_response === 'confirmed_received'; }).length;
    var notReceivedCount = stops.filter(function(s) { return s.customer_response === 'not_received'; }).length;
    var noResponseCount = stops.filter(function(s) { return !s.customer_response || s.customer_response === 'no_response'; }).length;
    var gpsCount = stops.filter(function(s) { return s.gps_lat && s.gps_lng; }).length;
    var successRate = stops.length > 0 ? Math.round((delivered / stops.length) * 100) : 0;
    var costKM = (route.driven_km || 0) * perKmCost;
    var costExpense = Number(route.so_travelling_expense || 0);
    var costCarrying = Number(route.carrying_cost || 0);
    var costLoading = Number(route.loading_unloading_cost || 0);
    var totalCost = costKM + costExpense + costCarrying + costLoading;
    var salesVal = Number(route.sales_value || 0);
    var costRatio = salesVal > 0 ? (totalCost / salesVal) * 100 : 0;

    // Duration calc
    var duration = '--';
    if (route.started_at && route.completed_at) {
        var ms = new Date(route.completed_at) - new Date(route.started_at);
        var hrs = Math.floor(ms / 3600000);
        var mins = Math.floor((ms % 3600000) / 60000);
        duration = hrs + 'h ' + mins + 'm';
    }

    // --- Header Bar ---
    doc.setFillColor(synBlue[0], synBlue[1], synBlue[2]);
    doc.rect(0, 0, W, 18, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('EXCEPTION REVIEW', M, 10);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(route.route_code + ' | ' + (route.route_name || route.district), M, 15);
    doc.text('DropLog', W - M, 10, { align: 'right' });
    doc.text(fDate(route.dispatch_date), W - M, 15, { align: 'right' });

    doc.setTextColor(0, 0, 0);
    y = 24;

    // --- Hero Gradient Area ---
    var heroH = 36;
    var gradSteps = 20;
    for (var g = 0; g < gradSteps; g++) {
        var t = g / gradSteps;
        var r = Math.round(deepBlue[0] + (synBlue[0] - deepBlue[0]) * t);
        var gr = Math.round(deepBlue[1] + (synBlue[1] - deepBlue[1]) * t);
        var b = Math.round(deepBlue[2] + (synBlue[2] - deepBlue[2]) * t);
        doc.setFillColor(r, gr, b);
        doc.rect(tableX + g * (tableW / gradSteps), y, tableW / gradSteps + 1, heroH, 'F');
    }
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('EXCEPTION-LED EXECUTIVE REPORT', tableX + 6, y + 7);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    var heroTitle = 'Failed Delivery Investigation';
    if (failed === 0) heroTitle = 'Route Performance Review';
    if (route.route_name) heroTitle += ' - ' + route.route_name;
    else if (route.district) heroTitle += ' - ' + route.district;
    doc.text(heroTitle, tableX + 6, y + 17);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 215, 235);
    doc.text('Transit ' + (route.route_code || '--') + ' | ' + soName + ' | ' + (route.vehicle_number || '--'), tableX + 6, y + 27);

    // Decision box (right side)
    doc.setFillColor(40, 70, 110);
    doc.roundedRect(tableX + tableW - 62, y + 4, 58, heroH - 8, 4, 4, 'F');
    doc.setDrawColor(100, 140, 180);
    doc.setLineWidth(0.3);
    doc.roundedRect(tableX + tableW - 62, y + 4, 58, heroH - 8, 4, 4, 'S');
    // Priority pill
    doc.setFillColor(180, 40, 40);
    doc.roundedRect(tableX + tableW - 56, y + 7, 46, 7, 10, 10, 'F');
    doc.setTextColor(255, 230, 230);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.text(failed > 0 ? 'PRIORITY: INVESTIGATE' : 'STATUS: COMPLETED', tableX + tableW - 33, y + 12, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(200, 220, 240);
    var decisionText = failed > 0 ? 'Review failed delivery and vendor performance.' : 'All stops delivered. Review route economics.';
    doc.text(decisionText, tableX + tableW - 56, y + 19, { maxWidth: 48 });
    doc.setTextColor(0, 0, 0);

    y += heroH + 6;

    // --- Alert Section (only if failed > 0) ---
    if (failed > 0) {
        var failedStop = stops.filter(function(s) { return s.status === 'failed'; })[0];
        var alertH = 26;
        doc.setFillColor(255, 241, 242);
        doc.roundedRect(tableX, y, tableW, alertH, 5, 5, 'F');
        doc.setDrawColor(254, 205, 211);
        doc.setLineWidth(0.3);
        doc.roundedRect(tableX, y, tableW, alertH, 5, 5, 'S');

        // Red circle with !
        doc.setFillColor(red[0], red[1], red[2]);
        doc.circle(tableX + 12, y + alertH / 2, 7, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('!', tableX + 12, y + alertH / 2 + 4, { align: 'center' });

        // Alert text
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text(failed + ' failed delivery' + (failed > 1 ? 's' : '') + ' require' + (failed > 1 ? '' : 's') + ' management follow-up', tableX + 26, y + 9);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(127, 29, 29);
        if (failedStop) {
            var alertDetail = failedStop.customer_name;
            if (failedStop.remark) alertDetail += ' - ' + failedStop.remark;
            doc.text(alertDetail, tableX + 26, y + 17);
        }

        // Decision needed box
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(tableX + tableW - 62, y + 3, 58, alertH - 6, 4, 4, 'F');
        doc.setDrawColor(254, 205, 211);
        doc.setLineWidth(0.3);
        doc.roundedRect(tableX + tableW - 62, y + 3, 58, alertH - 6, 4, 4, 'S');
        doc.setTextColor(red[0], red[1], red[2]);
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'bold');
        doc.text('Decision needed', tableX + tableW - 56, y + 9);
        doc.setFontSize(5.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(grayDark[0], grayDark[1], grayDark[2]);
        doc.text('Assign owner, confirm evidence, decide re-delivery', tableX + tableW - 56, y + 15, { maxWidth: 50 });

        y += alertH + 6;
    }

    // --- KPI Grid (5 cards) ---
    var kpiCardW = (tableW - 16) / 5;
    var kpiH = 28;
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(grayDark[0], grayDark[1], grayDark[2]);
    doc.text('DECISION KPIs', tableX, y);
    y += 5;

    var kpis = [
        { label: 'Failed Stops', value: String(failed), note: failed > 0 ? (stops.filter(function(s){return s.status==='failed';})[0]||{}).customer_name||'' : 'None', color: failed > 0 ? 'red' : 'green' },
        { label: 'Success Rate', value: successRate + '%', note: delivered + ' delivered of ' + stops.length, color: successRate >= 80 ? 'green' : successRate >= 50 ? 'amber' : 'red' },
        { label: 'Confirmed Receipt', value: confirmedCount + '/' + stops.length, note: confirmedCount > 0 ? String(confirmedCount) + ' confirmed' : 'No confirmations', color: confirmedCount > 0 ? 'green' : notReceivedCount > 0 ? 'red' : 'amber' },
        { label: 'GPS Coverage', value: gpsCount + '/' + stops.length, note: gpsCount > 0 ? Math.round(gpsCount/stops.length*100) + '% coverage' : 'No GPS data', color: gpsCount/stops.length >= 0.7 ? 'green' : gpsCount > 0 ? 'amber' : 'red' },
        { label: 'Cost Ratio', value: costRatio > 0 ? costRatio.toFixed(1) + '%' : '--', note: totalCost > 0 ? 'BDT ' + Math.round(totalCost).toLocaleString() + ' vs ' + (salesVal ? 'BDT ' + Math.round(salesVal).toLocaleString() : '--') : 'No cost data', color: costRatio > 30 ? 'red' : costRatio > 15 ? 'amber' : 'green' }
    ];

    var kpiColors = {
        red: red,
        green: synGreen,
        amber: [230, 126, 34]
    };

    kpis.forEach(function(kpi, i) {
        var kx = tableX + i * (kpiCardW + 4);
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(kx, y, kpiCardW, kpiH, 4, 4, 'F');
        doc.setDrawColor(grayMid[0], grayMid[1], grayMid[2]);
        doc.setLineWidth(0.2);
        doc.roundedRect(kx, y, kpiCardW, kpiH, 4, 4, 'S');

        doc.setFontSize(6);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(grayDark[0], grayDark[1], grayDark[2]);
        doc.text(kpi.label, kx + 4, y + 5);

        var c = kpiColors[kpi.color] || grayDark;
        doc.setTextColor(c[0], c[1], c[2]);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(kpi.value, kx + 4, y + 19);

        doc.setFontSize(5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(grayDark[0], grayDark[1], grayDark[2]);
        doc.text(kpi.note, kx + 4, y + 25, { maxWidth: kpiCardW - 6 });
    });

    y += kpiH + 8;

    // --- Delivery Timeline with Management Action ---
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(grayDark[0], grayDark[1], grayDark[2]);
    doc.text('DELIVERY TIMELINE', tableX, y);
    y += 5;

    // Table header
    var colDefs = [
        { x: 0, w: 8, label: '#' },
        { x: 8, w: 48, label: 'Customer' },
        { x: 56, w: 24, label: 'Status' },
        { x: 80, w: 38, label: 'Remark' },
        { x: 118, w: 38, label: 'Mgmt Action' },
        { x: 156, w: 26, label: 'Reply & Time' }
    ];
    doc.setFillColor(synBlue[0], synBlue[1], synBlue[2]);
    doc.rect(tableX, y, tableW, 6, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    colDefs.forEach(function(col) {
        doc.text(col.label, tableX + col.x + 2, y + 4.2);
    });
    y += 7;

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');

    stops.forEach(function(stop, i) {
        if (y > 265) { doc.addPage(); y = M; }

        // Row bg: failed rows get highlight
        var rowBg = i % 2 === 0 ? [250, 250, 252] : [255, 255, 255];
        if (stop.status === 'failed') rowBg = [255, 240, 240];
        else if (stop.delivery_exception) rowBg = [255, 247, 237];
        doc.setFillColor(rowBg[0], rowBg[1], rowBg[2]);
        doc.rect(tableX, y - 2.5, tableW, 6, 'F');

        // # with exception marker
        doc.setTextColor(grayDark[0], grayDark[1], grayDark[2]);
        doc.setFontSize(6.5);
        doc.text(String(i + 1), tableX + colDefs[0].x + 2, y + 1.5);
        if (stop.delivery_exception) {
            doc.setTextColor(red[0], red[1], red[2]);
            doc.setFont('helvetica', 'bold');
            doc.text('!', tableX + colDefs[0].x + 2, y + 1.5);
        }

        // Customer
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(6);
        doc.text(stop.customer_name.substring(0, 22), tableX + colDefs[1].x + 2, y + 1.5);

        // Status badge
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(5.5);
        if (stop.status === 'delivered') { doc.setTextColor(synGreen[0], synGreen[1], synGreen[2]); }
        else if (stop.status === 'failed') { doc.setTextColor(red[0], red[1], red[2]); }
        else if (stop.status === 'partial') { doc.setTextColor(230, 81, 0); }
        else { doc.setTextColor(grayDark[0], grayDark[1], grayDark[2]); }
        doc.text((stop.status || 'pending').toUpperCase(), tableX + colDefs[2].x + 2, y + 1.5);

        // Remark
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(grayDark[0], grayDark[1], grayDark[2]);
        doc.setFontSize(5.5);
        var remarkStr = '--';
        if (stop.remark) {
            remarkStr = stop.remark.substring(0, 24);
            if (stop.remark.length > 24) remarkStr += '...';
        }
        doc.text(remarkStr, tableX + colDefs[3].x + 2, y + 1.5);

        // Management Action
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5.5);
        if (stop.status === 'failed') {
            doc.setTextColor(red[0], red[1], red[2]);
            doc.setFont('helvetica', 'bold');
            doc.text('Investigate', tableX + colDefs[4].x + 2, y + 1.5);
        } else if (stop.customer_response === 'not_received') {
            doc.setTextColor(230, 126, 34);
            doc.setFont('helvetica', 'bold');
            doc.text('Follow up', tableX + colDefs[4].x + 2, y + 1.5);
        } else if (stop.customer_response !== 'confirmed_received') {
            doc.setTextColor(grayDark[0], grayDark[1], grayDark[2]);
            doc.text('Confirm receipt', tableX + colDefs[4].x + 2, y + 1.5);
        } else {
            doc.setTextColor(synGreen[0], synGreen[1], synGreen[2]);
            doc.text('Completed', tableX + colDefs[4].x + 2, y + 1.5);
        }

        // Reply & Time
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5.5);
        var resp = stop.customer_response || 'no_response';
        var respLabel = resp === 'confirmed_received' ? 'Received' : resp === 'not_received' ? 'Not Recvd' : '--';
        doc.text(respLabel, tableX + colDefs[5].x + 2, y + 0.5);
        doc.setFontSize(5);
        doc.setTextColor(grayDark[0], grayDark[1], grayDark[2]);
        doc.text(stop.delivered_at ? fTime(stop.delivered_at) : '--', tableX + colDefs[5].x + 2, y + 4);

        y += 6;
    });

    // --- Customer Feedback Summary (compact) ---
    y += 6;
    if (y > 265) { doc.addPage(); y = M; }

    var fbH = 18;
    doc.setFillColor(grayLight[0], grayLight[1], grayLight[2]);
    doc.roundedRect(tableX, y, tableW, fbH, 4, 4, 'F');
    doc.setDrawColor(grayMid[0], grayMid[1], grayMid[2]);
    doc.setLineWidth(0.3);
    doc.roundedRect(tableX, y, tableW, fbH, 4, 4, 'S');

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('CUSTOMER FEEDBACK SUMMARY', tableX + 6, y + 6);

    var fbW = (tableW - 24) / 3;
    doc.setFontSize(6.5);
    // Confirmed
    doc.setFillColor(237, 248, 239);
    doc.roundedRect(tableX + 6, y + 9, fbW, fbH - 12, 3, 3, 'F');
    doc.setTextColor(synGreen[0], synGreen[1], synGreen[2]);
    doc.setFont('helvetica', 'bold');
    doc.text(String(confirmedCount) + ' Confirmed', tableX + 10, y + 14);
    // Not Received
    doc.setFillColor(255, 241, 242);
    doc.roundedRect(tableX + fbW + 12, y + 9, fbW, fbH - 12, 3, 3, 'F');
    doc.setTextColor(red[0], red[1], red[2]);
    doc.setFont('helvetica', 'bold');
    doc.text(String(notReceivedCount) + ' Not Received', tableX + fbW + 16, y + 14);
    // No Response
    doc.setFillColor(255, 247, 237);
    doc.roundedRect(tableX + 2*fbW + 18, y + 9, fbW, fbH - 12, 3, 3, 'F');
    doc.setTextColor(230, 126, 34);
    doc.setFont('helvetica', 'bold');
    doc.text(String(noResponseCount) + ' No Response', tableX + 2*fbW + 22, y + 14);

    y += fbH + 6;

    // --- Investigation Checklist (only if failed > 0) ---
    if (failed > 0) {
        if (y > 250) { doc.addPage(); y = M; }

        var chkH = 48;
        doc.setFillColor(grayLight[0], grayLight[1], grayLight[2]);
        doc.roundedRect(tableX, y, tableW, chkH, 4, 4, 'F');
        doc.setDrawColor(grayMid[0], grayMid[1], grayMid[2]);
        doc.setLineWidth(0.3);
        doc.roundedRect(tableX, y, tableW, chkH, 4, 4, 'S');

        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text('INVESTIGATION CHECKLIST', tableX + 6, y + 6);

        var steps = [
            { num: '1', title: 'Validate the claim', desc: 'Check GPS trail, SO note, customer call record, timing.' },
            { num: '2', title: 'Confirm customer impact', desc: 'Was the stockist out of stock, closed, or inaccessible?' },
            { num: '3', title: 'Decide recovery action', desc: 'Re-delivery, partial, route resequence, or commercial follow-up.' },
            { num: '4', title: 'Tag root cause', desc: 'Weather, planning, vendor, customer readiness, or documentation.' }
        ];

        doc.setFontSize(5.5);
        steps.forEach(function(step, si) {
            var sx = tableX + 6 + (si % 2) * (tableW / 2 - 4);
            var sy = y + 13 + Math.floor(si / 2) * 16;

            // Number circle
            doc.setFillColor(234, 244, 251);
            doc.circle(sx + 5, sy + 2, 4, 'F');
            doc.setTextColor(synBlue[0], synBlue[1], synBlue[2]);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7);
            doc.text(step.num, sx + 5, sy + 4.5, { align: 'center' });

            doc.setTextColor(0, 0, 0);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6);
            doc.text(step.title, sx + 13, sy + 1);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(grayDark[0], grayDark[1], grayDark[2]);
            doc.setFontSize(5);
            doc.text(step.desc, sx + 13, sy + 7, { maxWidth: 65 });
        });

        y += chkH + 6;
    }

    // --- Issues Section ---
    if (issues.length > 0) {
        y += 2;
        if (y > 250) { doc.addPage(); y = M; }

        var issueBoxH = 10 + issues.length * 5;
        doc.setFillColor(255, 247, 237);
        doc.roundedRect(tableX, y, tableW, issueBoxH, 4, 4, 'F');
        doc.setDrawColor(red[0], red[1], red[2]);
        doc.setLineWidth(0.3);
        doc.roundedRect(tableX, y, tableW, issueBoxH, 4, 4, 'S');

        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(red[0], red[1], red[2]);
        doc.text('ISSUES REPORTED (' + issues.length + ')', tableX + 6, y + 6);
        y += 10;

        doc.setTextColor(0, 0, 0);
        doc.setFontSize(6);
        issues.forEach(function(issue) {
            if (y > 275) { doc.addPage(); y = M; }
            doc.setFont('helvetica', 'bold');
            doc.text('- ' + issue.issue_type, tableX + 6, y);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(grayDark[0], grayDark[1], grayDark[2]);
            if (issue.details) doc.text(issue.details.substring(0, 60), tableX + 45, y);
            doc.setTextColor(grayDark[0], grayDark[1], grayDark[2]);
            doc.text(fTime(issue.reported_at), tableX + 170, y);
            y += 5;
            doc.setTextColor(0, 0, 0);
        });
        y += 4;
    }

    // --- Cost & Route Economics ---
    y += 4;
    if (y > 250) { doc.addPage(); y = M; }

    var costBoxH = 46;
    doc.setFillColor(grayLight[0], grayLight[1], grayLight[2]);
    doc.roundedRect(tableX, y, tableW, costBoxH, 4, 4, 'F');
    doc.setDrawColor(grayMid[0], grayMid[1], grayMid[2]);
    doc.setLineWidth(0.3);
    doc.roundedRect(tableX, y, tableW, costBoxH, 4, 4, 'S');

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('COST & ROUTE ECONOMICS', tableX + 6, y + 6);

    var costL = tableX + 6;
    var costR = tableX + tableW / 2 + 4;
    var costY = y + 14;
    var costRowH2 = 5;

    function drawCostLine(label, value, x, isTotal) {
        doc.setFont('helvetica', isTotal ? 'bold' : 'normal');
        doc.setFontSize(isTotal ? 7 : 6.5);
        doc.setTextColor(isTotal ? 0 : grayDark[0], isTotal ? 0 : grayDark[1], isTotal ? 0 : grayDark[2]);
        doc.text(label, x, costY);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(isTotal ? 7.5 : 6.5);
        doc.setTextColor(0, 0, 0);
        doc.text(value, x + 70, costY, { align: 'right' });
        costY += costRowH2;
    }

    drawCostLine('SO travelling expense', 'BDT ' + Math.round(costExpense).toLocaleString(), costL);
    drawCostLine('Carrying cost', 'BDT ' + Math.round(costCarrying).toLocaleString(), costL);
    drawCostLine('Loading/unloading cost', 'BDT ' + Math.round(costLoading).toLocaleString(), costL);
    drawCostLine('Driven KM x Per KM cost', 'BDT ' + Math.round(costKM).toLocaleString(), costL);

    costY = y + 14;
    drawCostLine('Route sales value', salesVal ? 'BDT ' + Math.round(salesVal).toLocaleString() : '--', costR, true);
    drawCostLine('Total route cost', 'BDT ' + Math.round(totalCost).toLocaleString(), costR, true);
    var costRatioColor = costRatio > 30 ? 'red' : costRatio > 15 ? 'amber' : 'green';
    var crc = costRatioColor === 'red' ? red : costRatioColor === 'amber' ? [230, 126, 34] : synGreen;
    doc.setTextColor(crc[0], crc[1], crc[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('Cost Ratio: ' + (costRatio > 0 ? costRatio.toFixed(1) + '%' : '--'), costR, costY + 2);

    y += costBoxH + 6;

    // --- Management Questions (if issues or failed) ---
    if (failed > 0 || issues.length > 0) {
        if (y > 260) { doc.addPage(); y = M; }

        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(grayDark[0], grayDark[1], grayDark[2]);
        doc.text('MANAGEMENT REVIEW QUESTIONS', tableX, y);
        y += 5;

        var qW = (tableW - 12) / 3;
        var qH = 22;
        var questions = [
            { title: 'Planning lens', body: 'Was the flood/issue risk known before dispatch? Should the route sequence or date have changed?' },
            { title: 'Logistics / Vendor lens', body: 'Did the vendor attempt reasonable access and capture evidence? If not, performance review is justified.' },
            { title: 'Commercial / CS lens', body: 'Did the stockist receive proactive communication and recovery commitment? This matters more than cost ratio.' }
        ];

        questions.forEach(function(q, qi) {
            var qx = tableX + qi * (qW + 6);
            doc.setFillColor(255, 255, 255);
            doc.roundedRect(qx, y, qW, qH, 4, 4, 'F');
            doc.setDrawColor(grayMid[0], grayMid[1], grayMid[2]);
            doc.setLineWidth(0.2);
            doc.roundedRect(qx, y, qW, qH, 4, 4, 'S');

            doc.setTextColor(deepBlue[0], deepBlue[1], deepBlue[2]);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6.5);
            doc.text(q.title, qx + 5, y + 6);
            doc.setTextColor(grayDark[0], grayDark[1], grayDark[2]);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(5.5);
            doc.text(q.body, qx + 5, y + 11, { maxWidth: qW - 8 });
        });

        y += qH + 6;
    }

    // Page 2 footer
    doc.setFontSize(6);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(grayDark[0], grayDark[1], grayDark[2]);
    doc.text('DropLog v2.0 - Syngenta Bangladesh | Customer Service & Distribution', tableX, H - 8);
    doc.text('Page 2 of 2', W - M, H - 8, { align: 'right' });

    // Save
    var filename = 'Route_Report_' + route.route_code + '.pdf';
    doc.save(filename);
    showToast('Report downloaded: ' + filename, 'success');
}
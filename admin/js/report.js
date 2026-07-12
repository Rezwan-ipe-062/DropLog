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
    // PAGE 2: Trip Analytics & Delivery Detail
    // ================================================================
    doc.addPage();
    y = 0;

    // Header bar
    doc.setFillColor(synBlue[0], synBlue[1], synBlue[2]);
    doc.rect(0, 0, W, 18, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('TRIP DETAIL & ANALYTICS', M, 10);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(route.route_code + ' | ' + (route.route_name || route.district), M, 15);
    doc.text('DropLog', W - M, 10, { align: 'right' });
    doc.text(fDate(route.dispatch_date), W - M, 15, { align: 'right' });

    doc.setTextColor(0, 0, 0);
    y = 24;

    // --- Summary Cards Row ---
    var delivered = stops.filter(function(s) { return s.status === 'delivered' || s.status === 'partial'; }).length;
    var failed = stops.filter(function(s) { return s.status === 'failed'; }).length;
    var pending = stops.filter(function(s) { return s.status === 'pending'; }).length;

    // Duration calc
    var duration = '--';
    if (route.started_at && route.completed_at) {
        var ms = new Date(route.completed_at) - new Date(route.started_at);
        var hrs = Math.floor(ms / 3600000);
        var mins = Math.floor((ms % 3600000) / 60000);
        duration = hrs + 'h ' + mins + 'm';
    }

    var cardW = (tableW - 12) / 4;
    var cardH = 16;
    var cards = [
        { label: 'DELIVERED', value: delivered + '/' + stops.length, color: synGreen },
        { label: 'FAILED', value: String(failed), color: red },
        { label: 'DURATION', value: duration, color: synBlue },
        { label: 'DISTANCE', value: (route.initial_km_reading && route.final_km_reading && route.driven_km) ? route.driven_km + ' km' : '--', color: synBlue }
    ];

    cards.forEach(function(card, i) {
        var cx = tableX + i * (cardW + 4);
        doc.setFillColor(grayLight[0], grayLight[1], grayLight[2]);
        doc.roundedRect(cx, y, cardW, cardH, 2, 2, 'F');
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(grayDark[0], grayDark[1], grayDark[2]);
        doc.text(card.label, cx + 4, y + 5);
        doc.setFontSize(12);
        doc.setTextColor(card.color[0], card.color[1], card.color[2]);
        doc.text(card.value, cx + 4, y + 12);
    });

    y += cardH + 8;
    doc.setTextColor(0, 0, 0);

    // --- Delivery Timeline Table ---
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Delivery Timeline', tableX, y);
    y += 5;

    // Table header
    doc.setFillColor(synBlue[0], synBlue[1], synBlue[2]);
    doc.rect(tableX, y, tableW, 6, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.text('#', tableX + 2, y + 4.2);
    doc.text('Customer', tableX + 10, y + 4.2);
    doc.text('Location', tableX + 48, y + 4.2);
    doc.text('Status', tableX + 90, y + 4.2);
    doc.text('Time', tableX + 112, y + 4.2);
    doc.text('WA', tableX + 132, y + 4.2);
    doc.text('Customer Reply', tableX + 146, y + 4.2);
    doc.text('Exception', tableX + 178, y + 4.2);
    y += 7;

    // Table rows
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');

    stops.forEach(function(stop, i) {
        if (y > 260) { doc.addPage(); y = M; }

        // Alternate row bg
        if (i % 2 === 0) {
            doc.setFillColor(250, 250, 252);
            doc.rect(tableX, y - 3, tableW, 5.5, 'F');
        }

        // Failed row highlight
        if (stop.status === 'failed') {
            doc.setFillColor(254, 242, 242);
            doc.rect(tableX, y - 3, tableW, 5.5, 'F');
        }

        doc.setTextColor(grayDark[0], grayDark[1], grayDark[2]);
        doc.text(String(i + 1), tableX + 2, y);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text(stop.customer_name.substring(0, 18), tableX + 10, y);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(grayDark[0], grayDark[1], grayDark[2]);
        doc.text((stop.address || '').substring(0, 18), tableX + 48, y);

        // Status with color
        if (stop.status === 'delivered') { doc.setTextColor(synGreen[0], synGreen[1], synGreen[2]); }
        else if (stop.status === 'failed') { doc.setTextColor(red[0], red[1], red[2]); }
        else if (stop.status === 'partial') { doc.setTextColor(230, 81, 0); }
        else { doc.setTextColor(grayDark[0], grayDark[1], grayDark[2]); }
        doc.setFont('helvetica', 'bold');
        doc.text((stop.status || 'pending').toUpperCase(), tableX + 90, y);

        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');
        doc.text(stop.delivered_at ? fTime(stop.delivered_at) : '--', tableX + 112, y);

        // WhatsApp status
        var waStatus = stop.whatsapp_confirm_status || 'not_sent';
        var waColor = waStatus === 'sent' ? synGreen : waStatus === 'failed' ? red : grayDark;
        doc.setTextColor(waColor[0], waColor[1], waColor[2]);
        doc.setFontSize(5.5);
        doc.text(waStatus === 'not_sent' ? '--' : waStatus.toUpperCase(), tableX + 132, y);
        doc.setFontSize(7);

        // Customer response
        var resp = stop.customer_response || 'no_response';
        var respLabel = resp === 'confirmed_received' ? 'Yes, received' : resp === 'not_received' ? 'No, not received' : '--';
        var respColor = resp === 'confirmed_received' ? synGreen : resp === 'not_received' ? red : grayDark;
        doc.setTextColor(respColor[0], respColor[1], respColor[2]);
        doc.text(respLabel.substring(0, 16), tableX + 146, y);

        // Exception flag
        if (stop.delivery_exception) {
            doc.setTextColor(red[0], red[1], red[2]);
            doc.setFont('helvetica', 'bold');
            doc.text('FLAG', tableX + 178, y);
        } else {
            doc.setTextColor(grayDark[0], grayDark[1], grayDark[2]);
            doc.text('--', tableX + 178, y);
        }

        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');

        y += 5.5;
    });

    // --- Issues Section ---
    if (issues.length > 0) {
        y += 8;
        if (y > 250) { doc.addPage(); y = M; }

        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(red[0], red[1], red[2]);
        doc.text('Issues Reported (' + issues.length + ')', tableX, y);
        y += 5;

        doc.setFontSize(7);
        doc.setTextColor(0, 0, 0);
        issues.forEach(function(issue) {
            if (y > 275) { doc.addPage(); y = M; }
            doc.setFont('helvetica', 'bold');
            doc.text('- ' + issue.issue_type, tableX + 2, y);
            doc.setFont('helvetica', 'normal');
            if (issue.details) {
                doc.text(issue.details.substring(0, 60), tableX + 40, y);
            }
            doc.setTextColor(grayDark[0], grayDark[1], grayDark[2]);
            doc.text(fTime(issue.reported_at), tableX + 150, y);
            doc.setTextColor(0, 0, 0);
            y += 4.5;
        });
    }

    // --- Route Performance Box ---
    y += 10;
    if (y > 240) { doc.addPage(); y = M; }

    doc.setFillColor(grayLight[0], grayLight[1], grayLight[2]);
    doc.roundedRect(tableX, y, tableW, 30, 2, 2, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Route Performance', tableX + 4, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);

    var perfY = y + 12;
    var perfCol = tableW / 3;

    // Col 1
    doc.text('Success Rate:', tableX + 4, perfY);
    doc.setFont('helvetica', 'bold');
    var successRate = stops.length > 0 ? Math.round((delivered / stops.length) * 100) : 0;
    doc.setTextColor(synGreen[0], synGreen[1], synGreen[2]);
    doc.text(successRate + '%', tableX + 4, perfY + 5);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');

    // Col 2
    doc.text('Avg Time/Stop:', tableX + perfCol + 4, perfY);
    doc.setFont('helvetica', 'bold');
    var avgTime = '--';
    if (route.started_at && route.completed_at && delivered > 0) {
        var totalMins = (new Date(route.completed_at) - new Date(route.started_at)) / 60000;
        avgTime = Math.round(totalMins / delivered) + ' min';
    }
    doc.text(avgTime, tableX + perfCol + 4, perfY + 5);
    doc.setFont('helvetica', 'normal');

    // Col 3
    doc.text('KM per Stop:', tableX + 2*perfCol + 4, perfY);
    doc.setFont('helvetica', 'bold');
    var kmPerStop = (route.initial_km_reading && route.final_km_reading && route.driven_km && stops.length > 0) ? (route.driven_km / stops.length).toFixed(1) + ' km' : '--';
    doc.text(kmPerStop, tableX + 2*perfCol + 4, perfY + 5);
    doc.setFont('helvetica', 'normal');

    // Row 2 of performance
    perfY += 12;
    doc.text('SO Name:', tableX + 4, perfY);
    doc.setFont('helvetica', 'bold');
    doc.text(soName, tableX + 4, perfY + 5);
    doc.setFont('helvetica', 'normal');

    doc.text('Vehicle:', tableX + perfCol + 4, perfY);
    doc.setFont('helvetica', 'bold');
    doc.text(route.vehicle_number || '--', tableX + perfCol + 4, perfY + 5);
    doc.setFont('helvetica', 'normal');

    doc.text('Vendor:', tableX + 2*perfCol + 4, perfY);
    doc.setFont('helvetica', 'bold');
    doc.text(route.vendor_name || '--', tableX + 2*perfCol + 4, perfY + 5);

    // --- Cost Distribution Section ---
    y += 12;
    if (y > 230) { doc.addPage(); y = M; }

    doc.setFillColor(grayLight[0], grayLight[1], grayLight[2]);
    doc.roundedRect(tableX, y, tableW, 42, 2, 2, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Cost Distribution', tableX + 4, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);

    var costKM = (route.driven_km || 0) * perKmCost;
    var costExpense = Number(route.so_travelling_expense || 0);
    var costCarrying = Number(route.carrying_cost || 0);
    var costLoading = Number(route.loading_unloading_cost || 0);
    var totalCost = costKM + costExpense + costCarrying + costLoading;
    var salesVal = Number(route.sales_value || 0);
    var costRatio = salesVal > 0 ? (totalCost / salesVal) * 100 : 0;

    var costX = tableX + 4;
    var costY = y + 12;
    var costCol1 = 50;
    var costCol2 = 30;
    var costRowH = 5;

    function drawCostRow(label, value, isTotal) {
        if (isTotal) doc.setFont('helvetica', 'bold');
        doc.text(label, costX, costY);
        doc.setFont('helvetica', isTotal ? 'bold' : 'normal');
        doc.text(value, costX + costCol1, costY, { align: 'right' });
        costY += costRowH;
    }

    doc.setFont('helvetica', 'normal');
    drawCostRow('Driven KM (' + (route.driven_km || 0) + ') x Per KM Cost', 'BDT ' + Math.round(costKM).toLocaleString());
    drawCostRow('SO Travelling Expense', 'BDT ' + Math.round(costExpense).toLocaleString());
    drawCostRow('Carrying Cost', 'BDT ' + Math.round(costCarrying).toLocaleString());
    drawCostRow('Loading/Unloading Cost', 'BDT ' + Math.round(costLoading).toLocaleString());

    // Separator line
    doc.setDrawColor(grayMid[0], grayMid[1], grayMid[2]);
    doc.line(costX, costY, costX + costCol1 + costCol2, costY);
    costY += 2;

    drawCostRow('Total Cost', 'BDT ' + Math.round(totalCost).toLocaleString(), true);
    costY += 1;
    drawCostRow('Route Sales Value', salesVal ? 'BDT ' + Math.round(salesVal).toLocaleString() : '--', true);
    drawCostRow('Cost Ratio', costRatio > 0 ? costRatio.toFixed(1) + '%' : '--', true);

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
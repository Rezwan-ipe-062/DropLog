// ============================================================
// DropLog Admin - Route Report Generator v3 (2-Page Premium)
// ============================================================
// Page 1: Official Route Information form (for filing)
// Page 2: Trip Analytics & Detail (for CSO review)

var jsPDFScript = document.createElement('script');
jsPDFScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
document.head.appendChild(jsPDFScript);

// Decode Google/OSRM encoded polyline format
function decodePolyline(encoded) {
    var points = [];
    var index = 0, lat = 0, lng = 0;
    while (index < encoded.length) {
        var b, shift = 0, result = 0;
        do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1F) << shift; shift += 5; } while (b >= 0x20);
        var dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
        lat += dlat;
        shift = 0; result = 0;
        do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1F) << shift; shift += 5; } while (b >= 0x20);
        var dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
        lng += dlng;
        points.push([lat * 1e-5, lng * 1e-5]);
    }
    return points;
}

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

    // OSRM route data (free, no API key)
    var osrmRoute = null;
    var gpsStops = (stops || []).filter(function(s) { return s.gps_lat && s.gps_lng; });
    if (gpsStops.length >= 2) {
        try {
            var coords = gpsStops.map(function(s) { return s.gps_lng + ',' + s.gps_lat; }).join(';');
            var url = 'https://router.project-osrm.org/route/v1/driving/' + coords + '?overview=full&alternatives=false&steps=false';
            var resp = await fetch(url);
            var data = await resp.json();
            if (data && data.code === 'Ok' && data.routes && data.routes.length > 0) {
                osrmRoute = data.routes[0];
            }
        } catch (e) { /* OSRM failed, proceed without */ }
    }

    var soName = '--';
    if (route.assigned_so_id) {
        var { data: so } = await sb.from('users').select('name, user_id').eq('id', route.assigned_so_id).single();
        if (so) soName = so.name;
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
    fullRow('Route Sales Value', '');
    fullRow('Others Region Sales', '');
    fullRow('Transit Volume (MT)', route.transit_volume_mt ? route.transit_volume_mt + ' MT' : '--');
    fullRow('Vehicle Capacity (MT)', route.vehicle_capacity_mt ? route.vehicle_capacity_mt + ' MT' : '--');
    fullRow('SO Travelling Expense', route.so_travelling_expense ? 'BDT ' + route.so_travelling_expense : '--');
    fullRow('Carrying Cost', '');
    fullRow('Loading/Unloading Cost', '');

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
    doc.text('Location', tableX + 58, y + 4.2);
    doc.text('Status', tableX + 102, y + 4.2);
    doc.text('Time', tableX + 125, y + 4.2);
    doc.text('GPS', tableX + 148, y + 4.2);
    doc.text('Remark', tableX + 165, y + 4.2);
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
        doc.text(stop.customer_name.substring(0, 22), tableX + 10, y);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(grayDark[0], grayDark[1], grayDark[2]);
        doc.text((stop.address || '').substring(0, 22), tableX + 58, y);

        // Status with color
        if (stop.status === 'delivered') { doc.setTextColor(synGreen[0], synGreen[1], synGreen[2]); }
        else if (stop.status === 'failed') { doc.setTextColor(red[0], red[1], red[2]); }
        else if (stop.status === 'partial') { doc.setTextColor(230, 81, 0); }
        else { doc.setTextColor(grayDark[0], grayDark[1], grayDark[2]); }
        doc.setFont('helvetica', 'bold');
        doc.text((stop.status || 'pending').toUpperCase(), tableX + 102, y);

        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');
        doc.text(stop.delivered_at ? fTime(stop.delivered_at) : '--', tableX + 125, y);

        // GPS
        var gpsText = (stop.gps_lat && stop.gps_lng) ? stop.gps_lat.toFixed(4) + ', ' + stop.gps_lng.toFixed(4) : '--';
        doc.setFontSize(5.5);
        doc.text(gpsText, tableX + 148, y);
        doc.setFontSize(7);

        // Remark
        doc.text((stop.remark || '').substring(0, 18), tableX + 165, y);

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

    // --- Route Map Sketch (from OSRM) ---
    if (osrmRoute && gpsStops.length >= 2) {
        y += 6;
        if (y > 210) { doc.addPage(); y = M; }

        // Draw route sketch on a canvas
        var canvas = document.createElement('canvas');
        canvas.width = 600;
        canvas.height = 300;
        var ctx = canvas.getContext('2d');

        // Decode OSRM polyline
        var poly = osrmRoute.geometry;
        var points = [];
        if (typeof poly === 'string') {
            // OSRM returns encoded polyline string
            try {
                var decoded = decodePolyline(poly);
                points = decoded;
            } catch(e) { points = []; }
        }
        if (points.length === 0 || !Array.isArray(points)) {
            // Fall back to stop-to-stop straight lines
            points = gpsStops.map(function(s) { return [s.gps_lat, s.gps_lng]; });
        }

        // Draw background
        ctx.fillStyle = '#f4f5f7';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Margins
        var pad = 40;
        var drawW = canvas.width - pad * 2;
        var drawH = canvas.height - pad * 2;

        // Find bounds
        var minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
        points.forEach(function(p) {
            if (p[0] < minLat) minLat = p[0];
            if (p[0] > maxLat) maxLat = p[0];
            if (p[1] < minLng) minLng = p[1];
            if (p[1] > maxLng) maxLng = p[1];
        });
        var latRange = maxLat - minLat || 0.01;
        var lngRange = maxLng - minLng || 0.01;
        // Add 10% padding
        minLat -= latRange * 0.1; maxLat += latRange * 0.1;
        minLng -= lngRange * 0.1; maxLng += lngRange * 0.1;
        latRange = maxLat - minLat; lngRange = maxLng - minLng;

        function toCanvas(lat, lng) {
            var x = pad + ((lng - minLng) / lngRange) * drawW;
            var y2 = pad + ((maxLat - lat) / latRange) * drawH;
            return [x, y2];
        }

        // Draw route line
        ctx.beginPath();
        ctx.strokeStyle = '#00457C';
        ctx.lineWidth = 4;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        points.forEach(function(p, i) {
            var c = toCanvas(p[0], p[1]);
            if (i === 0) ctx.moveTo(c[0], c[1]);
            else ctx.lineTo(c[0], c[1]);
        });
        ctx.stroke();

        // Draw stop markers
        gpsStops.forEach(function(s, i) {
            var c = toCanvas(s.gps_lat, s.gps_lng);
            ctx.beginPath();
            ctx.arc(c[0], c[1], 8, 0, Math.PI * 2);
            // Color by status
            if (s.status === 'delivered') ctx.fillStyle = '#00A94F';
            else if (s.status === 'failed') ctx.fillStyle = '#b71c1c';
            else if (s.status === 'partial') ctx.fillStyle = '#e65100';
            else ctx.fillStyle = '#6b7080';
            ctx.fill();
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Number label
            ctx.fillStyle = 'white';
            ctx.font = 'bold 10px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(i + 1), c[0], c[1]);

            // Name label below marker
            ctx.fillStyle = '#1a1d23';
            ctx.font = '9px sans-serif';
            ctx.textBaseline = 'top';
            ctx.fillText(s.customer_name.substring(0, 16), c[0], c[1] + 12);
        });

        // Legend
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillStyle = '#666';
        ctx.textBaseline = 'top';
        ctx.fillText('Distance: ' + ((osrmRoute.distance / 1000).toFixed(1) + ' km'), pad, canvas.height - pad + 8);
        ctx.fillText('Duration: ~' + Math.round(osrmRoute.duration / 60) + ' min', pad + 100, canvas.height - pad + 8);
        ctx.fillText('Stops: ' + gpsStops.length + ' GPS points', pad + 220, canvas.height - pad + 8);

        // Embed canvas as PNG in PDF
        var imgData = canvas.toDataURL('image/png');

        // Add route map section
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('Route Map (OSRM Driving Route)', tableX, y);
        y += 3;

        // Calculate the height for the image to fit in the PDF (maintain aspect ratio)
        var imgW = tableW;
        var imgH = (canvas.height / canvas.width) * imgW;
        // Cap height
        if (imgH > 80) { imgH = 80; }

        doc.addImage(imgData, 'PNG', tableX, y, imgW, imgH);
        y += imgH + 4;

        // ODOMETER vs OSRM comparison
        var osrmKm = (osrmRoute.distance / 1000).toFixed(1);
        var odometerKm = (route.initial_km_reading && route.final_km_reading && route.driven_km) ? route.driven_km : null;
        if (odometerKm) {
            doc.setFontSize(7);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(grayDark[0], grayDark[1], grayDark[2]);
            doc.text('Odometer: ' + odometerKm + ' km  |  OSRM Route: ' + osrmKm + ' km  |  Diff: ' + (odometerKm - parseFloat(osrmKm)).toFixed(1) + ' km', tableX, y);
            y += 4;
            doc.setTextColor(0, 0, 0);
        }
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
    if (osrmRoute) {
        var osrmKmPerStop = (osrmRoute.distance / 1000 / stops.length).toFixed(1);
        doc.text(osrmKmPerStop + ' km', tableX + 2*perfCol + 4, perfY + 5);
    } else {
        var kmPerStop = (route.initial_km_reading && route.final_km_reading && route.driven_km && stops.length > 0) ? (route.driven_km / stops.length).toFixed(1) + ' km' : '--';
        doc.text(kmPerStop, tableX + 2*perfCol + 4, perfY + 5);
    }
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
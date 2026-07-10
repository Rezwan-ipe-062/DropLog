// ============================================================
// DropLog Admin - Contacts Module
// ============================================================
// Handles: customer phone/email upload and management

async function loadContacts() {
    if (!sb) return;

    try {
        const { data, error } = await sb
            .from('contacts')
            .select('*')
            .eq('plant_name', getWarehouseName())
            .order('customer_name');

        const tbody = document.getElementById('contactsBody');
        const empty = document.getElementById('noContacts');

        if (!data || data.length === 0) {
            tbody.innerHTML = '';
            empty.style.display = 'block';
            return;
        }

        empty.style.display = 'none';
        var BASE = 'https://rezwan-ipe-062.github.io/DropLog/portal/?bp=';
        tbody.innerHTML = data.map(function(c) {
            var link = c.customer_id ? BASE + encodeURIComponent(c.customer_id) : '';
            return '<tr>' +
            '<td>' + escapeHtml(c.customer_id || '-') + '</td>' +
            '<td><strong>' + escapeHtml(c.customer_name || '') + '</strong></td>' +
            '<td>' + escapeHtml(c.phone || '-') + '</td>' +
            '<td>' + escapeHtml(c.email || '-') + '</td>' +
            '<td>' + escapeHtml(c.district || '-') + '</td>' +
            '<td>' + (link ? '<a href="' + link + '" target="_blank" class="portal-link" title="' + link + '">Open</a> <span class="link-copy" onclick="copyToClipboard(\'' + link + '\')">Copy</span>' : '-') + '</td>' +
            '<td><span class="link-delete" onclick="deleteContact(\'' + c.id + '\')">Delete</span></td>' +
            '</tr>';
        }).join('');

        document.getElementById('contactCount').textContent = data.length + ' contacts';
    } catch (e) {
        console.error('loadContacts:', e);
        showToast(e.message || 'Something went wrong', 'error');
    }
}

async function handleContactsUpload(event) {
    const file = event.target.files[0];
    if (!file || typeof XLSX === 'undefined') return;

    try {
        const statusEl = document.getElementById('contactUploadStatus');
        statusEl.textContent = 'Processing...';

        const data = await readFileAsArrayBuffer(file);
        const wb = XLSX.read(data, { type: 'array' });
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

        var whName = getWarehouseName();
        const contacts = rows.map(r => ({
            customer_id: String(r['BP ID'] || r['Customer ID'] || '').trim() || null,
            customer_name: r['Customer Name'] || r['Name'] || '',
            proprietor: r['Proprietor'] || null,
            address: r['Street (Market Place, Postal Area, Upazilla & District) '] || r['Address'] || null,
            phone: String(r['Telephone'] || r['Phone'] || r['Mobile'] || '').trim() || null,
            email: (r['Email'] || '').trim() || null,
            district: (r['Region '] || r['Region'] || r['District'] || '').trim() || null,
            region: (r[' Zone Name'] || r['Zone'] || '').trim() || null,
            unit_name: r['Unit Name'] || null,
            plant_name: whName
        })).filter(c => c.customer_name);

        if (contacts.length === 0) {
            statusEl.textContent = 'No valid contacts found in file';
            return;
        }

        // Upsert (based on customer_id)
        const { error } = await sb.from('contacts').upsert(contacts, { onConflict: 'customer_id' });

        if (error) {
            statusEl.textContent = 'Error: ' + error.message;
        } else {
            statusEl.textContent = '[OK] ' + contacts.length + ' contacts uploaded';
            statusEl.className = 'upload-status success';
            loadContacts();
        }
    } catch (e) {
        console.error('handleContactsUpload:', e);
        showToast(e.message || 'Something went wrong', 'error');
    }
}

async function addContact() {
    const bpId = document.getElementById('addContactBpId').value.trim();
    const name = document.getElementById('addContactName').value.trim();
    const phone = document.getElementById('addContactPhone').value.trim();
    const email = document.getElementById('addContactEmail').value.trim();
    const district = document.getElementById('addContactDistrict').value.trim();

    if (!name) { showToast('Enter customer name', 'warning'); return; }

    try {
        await sb.from('contacts').insert({
            customer_id: bpId || null,
            customer_name: name,
            phone: phone || null,
            email: email || null,
            district: district || null,
            plant_name: getWarehouseName()
        });

        document.getElementById('addContactBpId').value = '';
        document.getElementById('addContactName').value = '';
        document.getElementById('addContactPhone').value = '';
        document.getElementById('addContactEmail').value = '';
        document.getElementById('addContactDistrict').value = '';
        showToast('Contact added', 'success');
        loadContacts();
    } catch (e) {
        console.error('addContact:', e);
        showToast(e.message || 'Something went wrong', 'error');
    }
}

async function deleteContact(id) {
    if (!confirm('Delete this contact?')) return;
    try {
        await sb.from('contacts').delete().eq('id', id);
        showToast('Deleted', 'success');
        loadContacts();
    } catch (e) {
        console.error('deleteContact:', e);
        showToast(e.message || 'Something went wrong', 'error');
    }
}
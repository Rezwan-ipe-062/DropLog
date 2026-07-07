// ============================================================
// DropLog Admin - Contacts Module
// ============================================================
// Handles: customer phone/email upload and management

async function loadContacts() {
    if (!sb) return;

    const { data, error } = await sb
        .from('contacts')
        .select('*')
        .order('customer_name');

    const tbody = document.getElementById('contactsBody');
    const empty = document.getElementById('noContacts');

    if (!data || data.length === 0) {
        tbody.innerHTML = '';
        empty.style.display = 'block';
        return;
    }

    empty.style.display = 'none';
    tbody.innerHTML = data.map(c => 
        '<tr>' +
        '<td>' + (c.customer_id || '-') + '</td>' +
        '<td><strong>' + (c.customer_name || '') + '</strong></td>' +
        '<td>' + (c.phone || '-') + '</td>' +
        '<td>' + (c.email || '-') + '</td>' +
        '<td>' + (c.district || '-') + '</td>' +
        '<td><span class="link-delete" onclick="deleteContact(\'' + c.id + '\')">Delete</span></td>' +
        '</tr>'
    ).join('');

    document.getElementById('contactCount').textContent = data.length + ' contacts';
}

async function handleContactsUpload(event) {
    const file = event.target.files[0];
    if (!file || typeof XLSX === 'undefined') return;

    const statusEl = document.getElementById('contactUploadStatus');
    statusEl.textContent = 'Processing...';

    const data = await readFileAsArrayBuffer(file);
    const wb = XLSX.read(data, { type: 'array' });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

    const contacts = rows.map(r => ({
        customer_id: String(r['BP ID'] || r['Customer ID'] || '').trim() || null,
        customer_name: r['Customer Name'] || r['Name'] || '',
        proprietor: r['Proprietor'] || null,
        address: r['Street (Market Place, Postal Area, Upazilla & District) '] || r['Address'] || null,
        phone: String(r['Telephone'] || r['Phone'] || r['Mobile'] || '').trim() || null,
        email: (r['Email'] || '').trim() || null,
        district: (r['Region '] || r['Region'] || r['District'] || '').trim() || null,
        region: (r[' Zone Name'] || r['Zone'] || '').trim() || null,
        unit_name: r['Unit Name'] || null
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
}

async function addContact() {
    const name = document.getElementById('addContactName').value.trim();
    const phone = document.getElementById('addContactPhone').value.trim();
    const email = document.getElementById('addContactEmail').value.trim();

    if (!name) { showToast('Enter customer name', 'warning'); return; }

    await sb.from('contacts').insert({ customer_name: name, phone: phone || null, email: email || null });

    document.getElementById('addContactName').value = '';
    document.getElementById('addContactPhone').value = '';
    document.getElementById('addContactEmail').value = '';
    showToast('Contact added', 'success');
    loadContacts();
}

async function deleteContact(id) {
    if (!confirm('Delete this contact?')) return;
    await sb.from('contacts').delete().eq('id', id);
    showToast('Deleted', 'success');
    loadContacts();
}
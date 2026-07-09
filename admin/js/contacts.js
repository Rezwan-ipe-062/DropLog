// ============================================================
// DropLog Admin - Contacts Module v2
// ============================================================

let contactsData = [];
let selectedContactIds = new Set();

async function loadContacts() {
    if (!sb) return;

    const { data, error } = await sb
        .from('contacts')
        .select('*')
        .order('customer_name');

    contactsData = data || [];

    renderContacts();

    document.getElementById('contactCount').textContent = contactsData.length + ' contacts';
}

function renderContacts() {
    const tbody = document.getElementById('contactsBody');
    const empty = document.getElementById('noContacts');
    const query = (document.getElementById('contactSearch').value || '').toLowerCase();

    const filtered = contactsData.filter(c =>
        !query || (c.customer_name && c.customer_name.toLowerCase().includes(query)) ||
        (c.phone && c.phone.includes(query)) ||
        (c.customer_id && c.customer_id.toLowerCase().includes(query))
    );

    if (filtered.length === 0) {
        tbody.innerHTML = '';
        empty.style.display = 'block';
        return;
    }

    empty.style.display = 'none';

    tbody.innerHTML = filtered.map(c => {
        const isValidPhone = c.phone && /^01[3-9]\d{8}$/.test(c.phone);
        const phoneDisplay = c.phone ?
            '<span class="phone-badge' + (isValidPhone ? '' : ' phone-invalid') + '">' + esc(c.phone) + '</span>' :
            '<span style="color:var(--gray-400);">—</span>';
        const checked = selectedContactIds.has(c.id) ? 'checked' : '';
        return '<tr>' +
            '<td><input type="checkbox" class="contact-checkbox" value="' + c.id + '" ' + checked + ' onchange="toggleContactSelect(this)"></td>' +
            '<td>' + esc(c.customer_id || '—') + '</td>' +
            '<td><strong class="editable" onclick="editContactField(\'' + c.id + '\',\'customer_name\',this)">' + esc(c.customer_name) + '</strong></td>' +
            '<td class="editable" onclick="editContactField(\'' + c.id + '\',\'phone\',this)">' + phoneDisplay + '</td>' +
            '<td class="editable" onclick="editContactField(\'' + c.id + '\',\'district\',this)">' + esc(c.district || '—') + '</td>' +
            '<td><span class="link-delete" onclick="deleteContact(\'' + c.id + '\')">Delete</span></td>' +
            '</tr>';
    }).join('');

    updateBulkDeleteButton();
}

function filterContacts(value) {
    renderContacts();
}

function toggleSelectAllContacts(master) {
    const checkboxes = document.querySelectorAll('.contact-checkbox');
    checkboxes.forEach(cb => {
        cb.checked = master.checked;
        if (master.checked) selectedContactIds.add(cb.value);
        else selectedContactIds.delete(cb.value);
    });
    updateBulkDeleteButton();
}

function toggleContactSelect(cb) {
    if (cb.checked) selectedContactIds.add(cb.value);
    else selectedContactIds.delete(cb.value);
    updateBulkDeleteButton();
}

function updateBulkDeleteButton() {
    const btn = document.getElementById('btnDeleteSelected');
    const count = selectedContactIds.size;
    if (count > 0) {
        btn.style.display = 'inline-block';
        document.getElementById('selectedCount').textContent = count;
    } else {
        btn.style.display = 'none';
    }
}

function clearSelection() {
    selectedContactIds.clear();
    document.querySelectorAll('.contact-checkbox').forEach(cb => cb.checked = false);
    updateBulkDeleteButton();
}

async function deleteSelectedContacts() {
    const count = selectedContactIds.size;
    if (count === 0) return;
    if (!confirm('Delete ' + count + ' selected contact(s)?')) return;

    const ids = Array.from(selectedContactIds);
    const { error } = await sb.from('contacts').delete().in('id', ids);

    if (error) {
        showToast('Error: ' + error.message, 'error');
        return;
    }

    showToast('Deleted ' + count + ' contact(s)', 'success');
    clearSelection();
    loadContacts();
}

async function deleteContact(id) {
    if (!confirm('Delete this contact?')) return;
    await sb.from('contacts').delete().eq('id', id);
    showToast('Deleted', 'success');
    loadContacts();
}

async function addContact() {
    const bpid = document.getElementById('addContactBPID').value.trim();
    const name = document.getElementById('addContactName').value.trim();
    const phone = document.getElementById('addContactPhone').value.trim();
    const district = document.getElementById('addContactDistrict').value.trim();

    if (!name) { showToast('Enter customer name', 'warning'); return; }
    if (phone && !/^01[3-9]\d{8}$/.test(phone)) {
        if (!confirm('Phone number "' + phone + '" does not look like a valid BD number. Add anyway?')) return;
    }

    const record = {
        customer_name: name,
        phone: phone || null,
        district: district || null
    };
    if (bpid) record.customer_id = bpid;

    await sb.from('contacts').insert(record);

    document.getElementById('addContactBPID').value = '';
    document.getElementById('addContactName').value = '';
    document.getElementById('addContactPhone').value = '';
    document.getElementById('addContactDistrict').value = '';
    showToast('Contact added', 'success');
    loadContacts();
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
        address: r['Street (Market Place, Postal Area, Upazilla & District) '] || r['Street'] || r['Address'] || null,
        phone: String(r['Telephone'] || r['Phone'] || r['Mobile'] || '').trim() || null,
        email: (r['Email'] || '').trim() || null,
        district: (r['Region'] || r['District'] || '').trim() || null,
        region: (r[' Zone Name'] || r['Zone Name'] || r['Zone'] || '').trim() || null,
        unit_name: r['Unit Name'] || null
    })).filter(c => c.customer_name);

    if (contacts.length === 0) {
        statusEl.textContent = 'No valid contacts found';
        return;
    }

    // Validate phone numbers during upload
    let validCount = 0, warnCount = 0;
    contacts.forEach(c => {
        if (c.phone && /^01[3-9]\d{8}$/.test(c.phone)) validCount++;
        else if (c.phone) warnCount++;
    });

    if (warnCount > 0 && !confirm(warnCount + ' contact(s) have invalid BD phone numbers. Upload anyway?')) {
        statusEl.textContent = 'Upload cancelled';
        return;
    }

    const { error } = await sb.from('contacts').upsert(contacts, { onConflict: 'customer_id' });

    if (error) {
        statusEl.textContent = 'Error: ' + error.message;
    } else {
        statusEl.textContent = '[OK] ' + contacts.length + ' contacts uploaded (' + validCount + ' valid phones' +
            (warnCount > 0 ? ', ' + warnCount + ' need review' : '') + ')';
        statusEl.className = 'upload-status success';
        loadContacts();
    }
}

async function editContactField(id, field, el) {
    const current = el.textContent.trim();
    const input = document.createElement('input');
    input.type = 'text';
    input.value = current === '—' ? '' : current;
    input.className = 'inline-edit-input';
    input.style.width = Math.max(input.value.length * 9 + 20, 100) + 'px';

    el.textContent = '';
    el.appendChild(input);
    input.focus();
    input.select();

    const save = async () => {
        const val = input.value.trim();
        if (val === current) {
            el.textContent = current || '—';
            return;
        }

        // BD phone validation
        if (field === 'phone' && val && !/^01[3-9]\d{8}$/.test(val)) {
            if (!confirm('Phone "' + val + '" is not a valid BD number. Save anyway?')) {
                el.textContent = current || '—';
                return;
            }
        }

        const update = {};
        update[field] = val || null;
        await sb.from('contacts').update(update).eq('id', id);
        loadContacts();
    };

    input.addEventListener('blur', save);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
        if (e.key === 'Escape') { el.textContent = current || '—'; }
    });
}

function esc(s) {
    if (!s) return '';
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}

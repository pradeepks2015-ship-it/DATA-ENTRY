// Office Assistant — Master Data merge, VLOOKUP, village-wise split & export
// Offline-first, IndexedDB cache, multi-tab Excel export, no backend required

(function() {
    let masterData = [];
    let masterHeaders = [];
    let rawData = [];
    let rawHeaders = [];
    let selectedColumns = [];
    let keyColumn = '';
    let splitByColumn = '';
    const MASTER_DB_KEY = 'office-assistant-master-data-v1';

    // Expose global functions
    window.toggleColumnSelection = function() {};
    window.setKeyColumn = function() {};
    window.setSplitByColumn = function() {};
    window.processAndExport = async function() {};
    window.clearMasterData = function() {};

    // Initialize only if Office Assistant view exists
    window.addEventListener('DOMContentLoaded', function() {
        if (document.getElementById('office-assistant-view')) {
            init();
        }
    });

    function init() {
        setupFileUploads();
        loadCachedData();
        setupProcessButton();
    }

    function setupFileUploads() {
        const master = document.getElementById('office-assistant-master-upload');
        const raw = document.getElementById('office-assistant-raw-upload');
        if (master) master.addEventListener('change', handleMasterUpload);
        if (raw) raw.addEventListener('change', handleRawUpload);
    }

    async function handleMasterUpload(e) {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const data = await parseFile(file);
            masterData = data.rows;
            masterHeaders = data.headers;
            await cacheData(data);
            updateUI();
        } catch (err) {
            console.error('Master upload error:', err);
        }
    }

    async function handleRawUpload(e) {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const data = await parseFile(file);
            rawData = data.rows;
            rawHeaders = data.headers;
            updateUI();
        } catch (err) {
            console.error('Raw upload error:', err);
        }
    }

    async function parseFile(file) {
        const text = await file.text();
        const isCSV = file.name.endsWith('.csv');

        if (isCSV) {
            const lines = text.trim().split(/\r?\n/);
            const headers = lines[0].split(',').map(h => h.trim());
            const rows = lines.slice(1).map(line => {
                const values = line.split(',');
                const obj = {};
                headers.forEach((h, i) => obj[h] = (values[i] || '').trim());
                return obj;
            });
            return { headers, rows };
        } else {
            await ensureXlsx_();
            const ab = await file.arrayBuffer();
            const wb = XLSX.read(ab, { type: 'array' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
            const headers = (data[0] || []).map(h => String(h ?? '').trim());
            const rows = data.slice(1).map(values => {
                const obj = {};
                headers.forEach((h, i) => obj[h] = (values[i] ?? ''));
                return obj;
            });
            return { headers, rows };
        }
    }

    function idbReq(req) {
        return new Promise((resolve, reject) => {
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async function cacheData(data) {
        try {
            const db = await openDB();
            const tx = db.transaction('data', 'readwrite');
            await idbReq(tx.objectStore('data').put({ headers: data.headers, rows: data.rows, time: new Date().toISOString() }, MASTER_DB_KEY));
        } catch (err) {
            console.warn('Cache failed:', err);
        }
    }

    async function loadCachedData() {
        try {
            const db = await openDB();
            const tx = db.transaction('data', 'readonly');
            const cached = await idbReq(tx.objectStore('data').get(MASTER_DB_KEY));
            if (cached?.headers && cached?.rows) {
                masterHeaders = cached.headers;
                masterData = cached.rows;
                updateUI();
            }
        } catch (err) {
            console.warn('Load cache failed:', err);
        }
    }

    function openDB() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open('office_assistant', 1);
            req.onerror = () => reject(req.error);
            req.onsuccess = () => resolve(req.result);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('data')) {
                    db.createObjectStore('data');
                }
            };
        });
    }

    function fillSelect(id, firstLabel, firstValue, current) {
        const sel = document.getElementById(id);
        if (!sel) return;
        sel.textContent = '';
        const first = document.createElement('option');
        first.value = firstValue;
        first.textContent = firstLabel;
        sel.appendChild(first);
        const all = [...new Set([...masterHeaders, ...rawHeaders])];
        all.forEach(h => {
            const opt = document.createElement('option');
            opt.value = h;
            opt.textContent = h;
            if (h === current) opt.selected = true;
            sel.appendChild(opt);
        });
    }

    function updateUI() {
        const masterStatus = document.getElementById('office-assistant-master-status');
        if (masterStatus) {
            masterStatus.style.display = masterHeaders.length ? 'block' : 'none';
            masterStatus.textContent = '✓ Master data loaded — ' + masterData.length + ' rows';
        }
        const rawStatus = document.getElementById('office-assistant-raw-status');
        if (rawStatus) {
            rawStatus.style.display = rawHeaders.length ? 'block' : 'none';
            rawStatus.textContent = '✓ Raw data loaded — ' + rawData.length + ' rows';
        }
        // दोनों फ़ाइलों में जो column common हो, वही key बन सकता है — पहला common column अपने-आप चुन लो
        if (!keyColumn || !masterHeaders.includes(keyColumn) || !rawHeaders.includes(keyColumn)) {
            keyColumn = masterHeaders.find(h => rawHeaders.includes(h)) || '';
        }
        fillSelect('office-assistant-key-column', '-- Select --', '', keyColumn);
        fillSelect('office-assistant-split-column', 'None', '', splitByColumn);
    }

    window.toggleColumnSelection = function(header) {
        const idx = selectedColumns.indexOf(header);
        idx > -1 ? selectedColumns.splice(idx, 1) : selectedColumns.push(header);
    };

    window.setKeyColumn = function(val) {
        keyColumn = val;
    };

    window.setSplitByColumn = function(val) {
        splitByColumn = val === 'None' ? '' : val;
    };

    window.processAndExport = async function() {
        if (!keyColumn || !masterHeaders.includes(keyColumn) || !rawHeaders.includes(keyColumn)) {
            alert('Select a valid key column');
            return;
        }

        const matched = [];
        const notFound = [];

        // 12K×12K बार find() करने के बजाय एक बार Map — तेज़ lookup
        const masterByKey = new Map();
        masterData.forEach(m => {
            const k = String(m[keyColumn] ?? '').trim();
            if (k && !masterByKey.has(k)) masterByKey.set(k, m);
        });

        rawData.forEach(rawRow => {
            const keyVal = String(rawRow[keyColumn] ?? '').trim();
            const master = masterByKey.get(keyVal);
            if (master) {
                matched.push({ ...master, ...rawRow });
            } else {
                notFound.push(rawRow);
            }
        });

        try {
            await ensureXlsx_();
            const wb = XLSX.utils.book_new();
            const headers = selectedColumns.length ? selectedColumns : [...new Set([...masterHeaders, ...rawHeaders])];

            const grouped = {};
            matched.forEach(row => {
                const key = splitByColumn ? (row[splitByColumn] || 'blank') : 'all';
                if (!grouped[key]) grouped[key] = [];
                grouped[key].push(row);
            });

            Object.entries(grouped).forEach(([grp, rows]) => {
                const sheetData = rows.map(r => headers.map(h => r[h] ?? ''));
                const ws = XLSX.utils.aoa_to_sheet([headers, ...sheetData]);
                XLSX.utils.book_append_sheet(wb, ws, grp.substring(0, 31));
            });

            if (notFound.length) {
                const ws = XLSX.utils.aoa_to_sheet([rawHeaders, ...notFound.map(r => rawHeaders.map(h => r[h] ?? ''))]);
                XLSX.utils.book_append_sheet(wb, ws, 'Not Found');
            }

            XLSX.writeFile(wb, `Master_Merge_${new Date().toISOString().substring(0, 10)}.xlsx`);
        } catch (err) {
            console.error('Export error:', err);
            alert('Excel बनाने में दिक्कत: ' + (err && err.message ? err.message : err));
        }
    };

    window.clearMasterData = async function() {
        if (!confirm('Clear master data?')) return;
        masterData = [];
        masterHeaders = [];
        selectedColumns = [];
        keyColumn = '';
        try {
            const db = await openDB();
            const tx = db.transaction('data', 'readwrite');
            await idbReq(tx.objectStore('data').delete(MASTER_DB_KEY));
        } catch (err) {
            console.warn('Clear failed:', err);
        }
        updateUI();
    };

    function setupProcessButton() {
        const btn = document.getElementById('office-assistant-process-btn');
        if (btn) btn.addEventListener('click', window.processAndExport);
    }
})();

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
    window.processAndExport = function() {};
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
            const lines = text.trim().split('\n');
            const headers = lines[0].split(',').map(h => h.trim());
            const rows = lines.slice(1).map(line => {
                const values = line.split(',');
                const obj = {};
                headers.forEach((h, i) => obj[h] = (values[i] || '').trim());
                return obj;
            });
            return { headers, rows };
        } else {
            if (typeof XLSX === 'undefined') throw new Error('XLSX library not loaded');
            const ab = await file.arrayBuffer();
            const wb = XLSX.read(ab, { type: 'array' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
            const headers = data[0];
            const rows = data.slice(1).map(values => {
                const obj = {};
                headers.forEach((h, i) => obj[h] = (values[i] || ''));
                return obj;
            });
            return { headers, rows };
        }
    }

    async function cacheData(data) {
        try {
            const db = await openDB();
            const tx = db.transaction('data', 'readwrite');
            await tx.objectStore('data').put({ key: MASTER_DB_KEY, ...data, time: new Date().toISOString() });
        } catch (err) {
            console.warn('Cache failed:', err);
        }
    }

    async function loadCachedData() {
        try {
            const db = await openDB();
            const tx = db.transaction('data', 'readonly');
            const cached = await tx.objectStore('data').get(MASTER_DB_KEY);
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

    function updateUI() {
        const masterStatus = document.getElementById('office-assistant-master-status');
        if (masterStatus) masterStatus.style.display = masterHeaders.length ? 'block' : 'none';
        const rawStatus = document.getElementById('office-assistant-raw-status');
        if (rawStatus) rawStatus.style.display = rawHeaders.length ? 'block' : 'none';
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

    window.processAndExport = function() {
        if (!keyColumn || !masterHeaders.includes(keyColumn) || !rawHeaders.includes(keyColumn)) {
            alert('Select a valid key column');
            return;
        }

        const matched = [];
        const notFound = [];

        rawData.forEach(rawRow => {
            const keyVal = rawRow[keyColumn];
            const master = masterData.find(m => m[keyColumn] === keyVal);
            if (master) {
                matched.push({ ...master, ...rawRow });
            } else {
                notFound.push(rawRow);
            }
        });

        try {
            const wb = XLSX.utils.book_new();
            const headers = selectedColumns.length ? selectedColumns : [...new Set([...masterHeaders, ...rawHeaders])];

            const grouped = {};
            matched.forEach(row => {
                const key = splitByColumn ? (row[splitByColumn] || 'blank') : 'all';
                if (!grouped[key]) grouped[key] = [];
                grouped[key].push(row);
            });

            Object.entries(grouped).forEach(([grp, rows]) => {
                const sheetData = rows.map(r => headers.map(h => r[h] || ''));
                const ws = XLSX.utils.aoa_to_sheet([headers, ...sheetData]);
                XLSX.utils.book_append_sheet(wb, ws, grp.substring(0, 31));
            });

            if (notFound.length) {
                const ws = XLSX.utils.aoa_to_sheet([rawHeaders, ...notFound.map(r => rawHeaders.map(h => r[h] || ''))]);
                XLSX.utils.book_append_sheet(wb, ws, 'Not Found');
            }

            XLSX.writeFile(wb, `Master_Merge_${new Date().toISOString().substring(0, 10)}.xlsx`);
        } catch (err) {
            console.error('Export error:', err);
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
            await tx.objectStore('data').delete(MASTER_DB_KEY);
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

// Office Assistant — Master Data merge, VLOOKUP, village-wise split & export
// Offline-first, IndexedDB cache, multi-tab Excel export, no backend required

(function() {
    let masterData = [];
    let masterHeaders = [];
    let rawData = [];
    let rawHeaders = [];
    let sampleHeaders = [];
    let selectedColumns = [];
    let sampleName = '';
    let keyColumn = '';
    let splitByColumn = '';
    const MASTER_DB_KEY = 'office-assistant-master-data-v1';
    const SAMPLE_DB_KEY = 'office-assistant-sample-format-v1';
    const COLS_DB_KEY = 'office-assistant-selected-columns-v1';

    // Expose global functions
    window.setKeyColumn = function() {};
    window.setSplitByColumn = function() {};
    window.processAndExport = async function() {};
    window.clearMasterData = function() {};
    window.clearSampleFormat = function() {};
    window.clearRawData = function() {};
    window.selectAllColumns = function() {};
    window.clearSelectedColumns = function() {};

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
        const sample = document.getElementById('office-assistant-sample-upload');
        if (master) master.addEventListener('change', handleMasterUpload);
        if (raw) raw.addEventListener('change', handleRawUpload);
        if (sample) sample.addEventListener('change', handleSampleUpload);
    }

    // "Consumer No" बनाम "CONSUMER_NO" बनाम "consumer no." — एक ही column का नाम दोनों फ़ाइलों में
    // अलग-अलग तरह लिखा होता है, इसलिए मिलान करते समय बड़े/छोटे अक्षर और space/_/./- हटा देते हैं
    function normHdr(h) {
        return String(h ?? '').toLowerCase().replace(/[^a-z0-9ऀ-ॿ]/g, '');
    }

    function resolveHeader(headers, wanted) {
        const want = normHdr(wanted);
        if (!want) return '';
        return headers.find(h => normHdr(h) === want) || '';
    }

    function errText(err) {
        return err && err.message ? err.message : String(err);
    }

    async function handleMasterUpload(e) {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const data = await parseFile(file);
            masterData = data.rows;
            masterHeaders = data.headers;
            await cachePut(MASTER_DB_KEY, { headers: data.headers, rows: data.rows });
            updateUI();
        } catch (err) {
            console.error('Master upload error:', err);
            alert('Master फ़ाइल पढ़ी नहीं जा सकी: ' + errText(err));
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
            alert('Raw फ़ाइल पढ़ी नहीं जा सकी: ' + errText(err));
        }
    }

    // नमूना (sample) फ़ाइल — इसकी सिर्फ़ पहली पंक्ति (column के नाम) चाहिए, उसका डेटा नहीं।
    // निकलने वाली Excel में बिल्कुल यही columns, इसी क्रम में आएंगे।
    async function handleSampleUpload(e) {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const data = await parseFile(file);
            if (!data.headers.length) throw new Error('पहली पंक्ति में कोई column नाम नहीं मिला');
            sampleHeaders = data.headers;
            sampleName = file.name;
            await cachePut(SAMPLE_DB_KEY, { headers: sampleHeaders, name: sampleName });
            updateUI();
        } catch (err) {
            console.error('Sample upload error:', err);
            alert('नमूना फ़ाइल पढ़ी नहीं जा सकी: ' + errText(err));
        }
    }

    async function parseFile(file) {
        if (/\.csv$/i.test(file.name)) {
            const text = await file.text();
            const lines = text.trim().split(/\r?\n/);
            const headers = splitCsvLine(lines[0] || '').map(h => h.trim());
            const rows = lines.slice(1).map(line => {
                const values = splitCsvLine(line);
                const obj = {};
                headers.forEach((h, i) => obj[h] = String(values[i] ?? '').trim());
                return obj;
            });
            return { headers, rows: rows.filter(hasAnyValue) };
        }

        await ensureXlsx_();
        const ab = await file.arrayBuffer();
        const wb = XLSX.read(ab, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
        // कुछ ledger export ऊपर खाली/शीर्षक पंक्तियाँ रखते हैं — header वही पहली पंक्ति मानो
        // जिसमें कम से कम दो खाने भरे हों
        const hdrIdx = data.findIndex(r => Array.isArray(r) && r.filter(c => String(c ?? '').trim()).length >= 2);
        if (hdrIdx < 0) return { headers: [], rows: [] };
        const headers = data[hdrIdx].map(h => String(h ?? '').trim());
        const rows = data.slice(hdrIdx + 1).map(values => {
            const obj = {};
            headers.forEach((h, i) => obj[h] = String(values[i] ?? '').trim());
            return obj;
        });
        return { headers, rows: rows.filter(hasAnyValue) };
    }

    function hasAnyValue(row) {
        return Object.keys(row).some(k => String(row[k] ?? '').trim() !== '');
    }

    function idbReq(req) {
        return new Promise((resolve, reject) => {
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
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

    async function cachePut(key, value) {
        try {
            const db = await openDB();
            const tx = db.transaction('data', 'readwrite');
            await idbReq(tx.objectStore('data').put({ ...value, time: new Date().toISOString() }, key));
        } catch (err) {
            console.warn('Cache failed:', err);
        }
    }

    async function cacheDelete(key) {
        try {
            const db = await openDB();
            const tx = db.transaction('data', 'readwrite');
            await idbReq(tx.objectStore('data').delete(key));
        } catch (err) {
            console.warn('Clear failed:', err);
        }
    }

    async function loadCachedData() {
        try {
            const db = await openDB();
            const master = await idbReq(db.transaction('data', 'readonly').objectStore('data').get(MASTER_DB_KEY));
            if (master?.headers && master?.rows) {
                masterHeaders = master.headers;
                masterData = master.rows;
            }
            const sample = await idbReq(db.transaction('data', 'readonly').objectStore('data').get(SAMPLE_DB_KEY));
            if (sample?.headers?.length) {
                sampleHeaders = sample.headers;
                sampleName = sample.name || 'सहेजा हुआ नमूना';
            }
            const cols = await idbReq(db.transaction('data', 'readonly').objectStore('data').get(COLS_DB_KEY));
            if (cols?.columns?.length) selectedColumns = cols.columns;
            updateUI();
        } catch (err) {
            console.warn('Load cache failed:', err);
        }
    }

    function fillSelect(id, firstLabel, current) {
        const sel = document.getElementById(id);
        if (!sel) return;
        sel.textContent = '';
        const first = document.createElement('option');
        first.value = '';
        first.textContent = firstLabel;
        sel.appendChild(first);
        [...new Set([...masterHeaders, ...rawHeaders])].forEach(h => {
            const opt = document.createElement('option');
            opt.value = h;
            opt.textContent = h;
            if (h === current) opt.selected = true;
            sel.appendChild(opt);
        });
    }

    function setStatus(id, on, text) {
        const el = document.getElementById(id);
        if (!el) return;
        el.style.display = on ? 'block' : 'none';
        el.textContent = text;
    }

    function allHeaders() {
        return dedupeHeaders([...masterHeaders, ...rawHeaders]);
    }

    // 40 columns में से सिर्फ़ 5 चाहिए — हर column के आगे एक checkbox
    function renderColumnPicker() {
        const box = document.getElementById('office-assistant-columns');
        if (!box) return;
        const all = allHeaders();
        box.textContent = '';
        box.style.display = all.length ? 'block' : 'none';
        all.forEach(h => {
            const label = document.createElement('label');
            label.style.cssText = 'display:block; font-size:12px; padding:3px 2px; cursor:pointer;';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.value = h;
            cb.checked = !!resolveHeader(selectedColumns, h);
            cb.style.marginRight = '6px';
            cb.addEventListener('change', () => toggleColumn(h, cb.checked));
            label.appendChild(cb);
            label.appendChild(document.createTextNode(h));
            box.appendChild(label);
        });
        updateColumnCount();
    }

    function updateColumnCount() {
        const all = allHeaders();
        // चुनाव उन columns का भी याद रहता है जिनकी फ़ाइल अभी अपलोड नहीं हुई — गिनती में सिर्फ़ मौजूदा
        const live = all.filter(h => resolveHeader(selectedColumns, h)).length;
        setStatus('office-assistant-columns-count', all.length > 0,
            live
                ? live + ' / ' + all.length + ' columns चुने — सिर्फ़ यही Excel में आएंगे'
                : 'कोई column नहीं चुना — पूरे ' + all.length + ' columns आएंगे');
    }

    function toggleColumn(header, on) {
        const existing = resolveHeader(selectedColumns, header);
        if (on && !existing) {
            selectedColumns.push(header);
        } else if (!on && existing) {
            selectedColumns = selectedColumns.filter(c => c !== existing);
        }
        updateColumnCount();
        cachePut(COLS_DB_KEY, { columns: selectedColumns });
    }

    window.selectAllColumns = function() {
        selectedColumns = allHeaders();
        cachePut(COLS_DB_KEY, { columns: selectedColumns });
        renderColumnPicker();
    };

    window.clearSelectedColumns = function() {
        selectedColumns = [];
        cachePut(COLS_DB_KEY, { columns: [] });
        renderColumnPicker();
    };

    function updateUI() {
        setStatus('office-assistant-master-status', masterHeaders.length,
            '✓ Master data तैयार — ' + masterData.length + ' पंक्तियाँ');
        setStatus('office-assistant-raw-status', rawHeaders.length,
            '✓ Raw data तैयार — ' + rawData.length + ' पंक्तियाँ');
        setStatus('office-assistant-sample-status', sampleHeaders.length,
            '✓ नमूना तैयार — ' + sampleHeaders.length + ' columns (' + sampleName + ')');
        // दोनों फ़ाइलों में जो column common हो वही key बन सकता है — पहला common column अपने-आप चुन लो
        if (!keyColumn || !resolveHeader(masterHeaders, keyColumn) || !resolveHeader(rawHeaders, keyColumn)) {
            keyColumn = masterHeaders.find(h => resolveHeader(rawHeaders, h)) || '';
        }
        const colsBox = document.getElementById('office-assistant-columns-section');
        if (colsBox) colsBox.style.display = sampleHeaders.length ? 'none' : 'block';
        fillSelect('office-assistant-key-column', '-- Select --', keyColumn);
        fillSelect('office-assistant-split-column', 'None', splitByColumn);
        renderColumnPicker();
    }

    window.setKeyColumn = function(val) {
        keyColumn = val;
    };

    window.setSplitByColumn = function(val) {
        splitByColumn = val === 'None' ? '' : val;
    };

    window.processAndExport = async function() {
        if (!masterData.length) { alert('पहले Master Data अपलोड करें।'); return; }
        if (!rawData.length) { alert('पहले Raw Data अपलोड करें।'); return; }
        if (!keyColumn) { alert('Key Column चुनें — वह column जो दोनों फ़ाइलों में है (जैसे Consumer No)।'); return; }

        const masterKey = resolveHeader(masterHeaders, keyColumn);
        const rawKey = resolveHeader(rawHeaders, keyColumn);
        if (!masterKey || !rawKey) {
            // कौन-से column दोनों में हैं, यह बता दो — वरना पता ही नहीं चलता कि गड़बड़ कहाँ है
            const common = masterHeaders.filter(h => resolveHeader(rawHeaders, h));
            alert('"' + keyColumn + '" ' + (masterKey ? 'Raw' : 'Master') + ' फ़ाइल में नहीं है।\n\n' +
                (common.length
                    ? 'दोनों फ़ाइलों में ये columns हैं, इनमें से कोई चुनें:\n• ' + common.join('\n• ')
                    : 'दोनों फ़ाइलों में कोई भी column एक जैसा नहीं है — फ़ाइलें जाँच लें।'));
            return;
        }

        const masterByKey = new Map();
        masterData.forEach(m => {
            const k = String(m[masterKey] ?? '').trim();
            if (k && !masterByKey.has(k)) masterByKey.set(k, m);
        });

        const matched = [];
        const notFound = [];
        rawData.forEach(rawRow => {
            const k = String(rawRow[rawKey] ?? '').trim();
            const master = k ? masterByKey.get(k) : null;
            if (master) {
                matched.push({ ...master, ...rawRow });
            } else {
                notFound.push(rawRow);
            }
        });

        if (!matched.length) {
            alert('एक भी उपभोक्ता मैच नहीं हुआ — "' + keyColumn + '" के नंबर दोनों फ़ाइलों में अलग तरह से लिखे हो सकते हैं।');
            return;
        }

        try {
            await ensureXlsx_();
            const wb = XLSX.utils.book_new();
            // नमूना फ़ाइल दी हो तो उसी के columns, उसी क्रम में — वरना दोनों फ़ाइलों के सारे columns
            // पहले नमूना (अगर दिया हो), फिर checkbox से चुने columns, वरना सारे columns।
            // सारे वाले रास्ते में एक ही column दो वर्तनी से दो बार न आए ("Consumer No"/"CONSUMER_NO")
            const outHeaders = sampleHeaders.length ? sampleHeaders
                : (selectedColumns.length ? allHeaders().filter(h => resolveHeader(selectedColumns, h)) : allHeaders());

            const grouped = new Map();
            matched.forEach(row => {
                const g = splitByColumn ? (String(pick(row, splitByColumn)).trim() || 'खाली') : 'सभी';
                if (!grouped.has(g)) grouped.set(g, []);
                grouped.get(g).push(row);
            });

            const usedNames = new Set();
            [...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0], 'hi')).forEach(([grp, rows]) => {
                const aoa = [outHeaders, ...rows.map(r => outHeaders.map(h => pick(r, h)))];
                XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), sheetName(grp, usedNames));
            });

            if (notFound.length) {
                const aoa = [rawHeaders, ...notFound.map(r => rawHeaders.map(h => r[h] ?? ''))];
                XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), sheetName('नहीं मिले', usedNames));
            }

            XLSX.writeFile(wb, 'Master_Merge_' + new Date().toISOString().substring(0, 10) + '.xlsx');
            setStatus('office-assistant-result', true,
                '✓ ' + matched.length + ' मिले, ' + notFound.length + ' नहीं मिले, ' +
                grouped.size + ' शीट बनीं, ' + outHeaders.length + ' columns' +
                (sampleHeaders.length ? ' (नमूने के अनुसार)' : ''));
        } catch (err) {
            console.error('Export error:', err);
            alert('Excel बनाने में दिक्कत: ' + errText(err));
        }
    };

    function dedupeHeaders(headers) {
        const seen = new Set();
        return headers.filter(h => {
            const n = normHdr(h);
            if (!n || seen.has(n)) return false;
            seen.add(n);
            return true;
        });
    }

    // column का नाम नमूने में अलग तरह लिखा हो तो भी उसकी क़ीमत मिल जाए
    function pick(row, wanted) {
        if (Object.prototype.hasOwnProperty.call(row, wanted)) return row[wanted] ?? '';
        const actual = resolveHeader(Object.keys(row), wanted);
        return actual ? (row[actual] ?? '') : '';
    }

    // Excel शीट के नाम में : \ / ? * [ ] नहीं चल सकते, और 31 अक्षर से लंबे नहीं हो सकते
    function sheetName(name, used) {
        const base = String(name || 'शीट').replace(/[:\\/?*[\]]/g, ' ').trim().substring(0, 31) || 'शीट';
        let out = base, n = 2;
        while (used.has(out)) {
            const suffix = ' (' + n++ + ')';
            out = base.substring(0, 31 - suffix.length) + suffix;
        }
        used.add(out);
        return out;
    }

    function resetInput(id) {
        const el = document.getElementById(id);
        if (el) el.value = '';
    }

    window.clearMasterData = async function() {
        if (!confirm('Master Data हटाना है?')) return;
        masterData = [];
        masterHeaders = [];
        keyColumn = '';
        resetInput('office-assistant-master-upload');
        await cacheDelete(MASTER_DB_KEY);
        updateUI();
    };

    window.clearRawData = function() {
        rawData = [];
        rawHeaders = [];
        resetInput('office-assistant-raw-upload');
        setStatus('office-assistant-result', false, '');
        updateUI();
    };

    window.clearSampleFormat = async function() {
        if (!confirm('नमूना format हटाना है? फिर सारे columns निकलेंगे।')) return;
        sampleHeaders = [];
        sampleName = '';
        resetInput('office-assistant-sample-upload');
        await cacheDelete(SAMPLE_DB_KEY);
        updateUI();
    };

    function setupProcessButton() {
        const btn = document.getElementById('office-assistant-process-btn');
        if (btn) btn.addEventListener('click', window.processAndExport);
    }
})();

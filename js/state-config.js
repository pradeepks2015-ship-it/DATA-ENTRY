        const divisionConfigs = {
            "DIVISION SEONI": {
                colorClass: "bg-blue-grad",
                themeColor: "#2563eb",
                themeGradient: "linear-gradient(135deg, #2563eb 0%, #1e40af 100%)",
                showSpecialActions: false,
                dcs: [
                    { name: "ARI", csvUrl: "" },
                    { name: "BADALPAR", csvUrl: "" },
                    { name: "BANDOL", csvUrl: "" },
                    { name: "BARGHAT", csvUrl: "" },
                    { name: "DHARNA", csvUrl: "" },
                    { name: "GOPALGANJ", csvUrl: "" },
                    { name: "KANHIWADA", csvUrl: "" },
                    { name: "KEOLARI", csvUrl: "" },
                    { name: "KHAIRAPALARI", csvUrl: "" },
                    { name: "KURAI", csvUrl: "" },
                    { name: "MUNGWANI", csvUrl: "" },
                    { name: "PANDIYA CHHAPARA", csvUrl: "" },
                    { name: "SEONI (T)", csvUrl: "" },
                    { name: "SEONI (RES)", csvUrl: "" },
                    { name: "UGALI", csvUrl: "" }
                ]
            },
            "DIVISION LAKHNADON": {
                colorClass: "bg-orange-grad",
                themeColor: "#f59e0b",
                themeGradient: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                showSpecialActions: false,
                dcs: [
                    { name: "ADEGAON", csvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTMkEMNGnfv0_jHM12lAl34sD8kJLWPbLuA8WGhKH_smPfH3aDdmVrwbtyyPJZuD6KK4m6quw-q9MWN/pub?output=csv" }
                ]
            }
        };

        // Global error logging — silent failures ab console me dikhengi (debugging ke liye)
        window.addEventListener("error", (e) => console.error("App error:", e.message, e.error || ""));
        window.addEventListener("unhandledrejection", (e) => console.error("Unhandled promise rejection:", e.reason));

        // Local (IST) date helpers — toISOString() UTC deta hai jisse subah 5:30 se
        // pehle "aaj" ki jagah "kal" ki date aa jaati thi.
        function localDateIso_(d) {
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        }
        function localTodayIso_() { return localDateIso_(new Date()); }

        // Ek hi Apps Script deployment — sab modules isi ko use karte hain.
        const APPS_SCRIPT_EXEC_URL = "https://script.google.com/macros/s/AKfycbwH7cske7TMbQHw65eBt-fkKVFYWNLGqPr5UgZ3AblevWTKgdTuOk2NDNquo-1iTL0-XQ/exec";
        const scriptURL = APPS_SCRIPT_EXEC_URL;

        // ===== Shared Module Sync (Broken Pole / Bijli Chori) =====
        // Single Apps Script Web App endpoint shared across all 4 modules (module name sent as a parameter).
        // PASTE the deployed Apps Script /exec URL here once available - leave empty to keep working
        // device-local only (entries will not sync between users until this is set).
        const sharedModuleSyncScriptUrl = APPS_SCRIPT_EXEC_URL;
        const SHARED_SYNC_MODULES = ["broken_pole", "bijli_chori"];
        const sharedModuleSyncEnabled = !!sharedModuleSyncScriptUrl;

        localStorage.removeItem("stock-movements-cache");

        let activeDiv = "", activeDC = "", activeGrad = "bg-teal-grad", summaryMode = "DAILY", summaryModule = "MOBILE", activeViewLevel = "", currentData = null, pendingLevel = "", dcCacheRaw = {}, dcCacheRows = {}, uiListSummary = [], grandTC = 0, grandTU = 0;
        const feederCsvUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vT8bBAXJZhlwS_giGXBlS6rDXJ_auZfWZzNVPQaBnD09jB_m7jnrqeGGX5WP8V2jOD_WL90_KQ2pJa4/pub?output=csv";
        const feederSubmitScriptUrl = APPS_SCRIPT_EXEC_URL;
        const feederReportSheetCsvUrl = "https://docs.google.com/spreadsheets/d/1XnsLz_5643XqGgrcMzhIzI_cF4E4S6Zc1esNEQe554A/export?format=csv&gid=0";
        const feederDcDistributionConfig = {
            "11 KV - BAKODA SEONI AG": [
                { dcName: "CHHAPARA-1", percent: 100 }
            ],
            "11 KV - GANESHGANJ MIX": [
                { dcName: "CHHAPARA-2", percent: 30 },
                { dcName: "CHHAPARA-1", percent: 70 }
            ],
            "11 KV - BANDOL AG": [
                { dcName: "CHHAPARA-2", percent: 35 },
                { dcName: "CHHAPARA-1", percent: 65 }
            ],
            "11 KV - BARRA MIX": [
                { dcName: "CHHAPARA-2", percent: 30 },
                { dcName: "CHHAPARA-1", percent: 70 }
            ],
            "11 KV - CHHAPARA TOWN": [
                { dcName: "CHHAPARA-2", percent: 10 },
                { dcName: "CHHAPARA-1", percent: 90 }
            ],
            "11 KV - SELWA DL": [
                { dcName: "GANESHGANJ", percent: 50 }
            ],
            "11KV ADEGAON MIX": [
                { dcName: "ADEGAON", percent: 100 }
            ],
            "11KV MADI (ADEGAON) MIX": [
                { dcName: "ADEGAON", percent: 100 }
            ],
            "11KV BIBI DL": [
                { dcName: "ADEGAON", percent: 100 }
            ],
            "11KV BIBI AG": [
                { dcName: "ADEGAON", percent: 100 }
            ],
            "11 KV PATAN": [
                { dcName: "ADEGAON", percent: 100 }
            ],
            "11 KV MADHI": [
                { dcName: "ADEGAON", percent: 100 }
            ],
            "11 KV PINDRAI": [
                { dcName: "ADEGAON", percent: 100 }
            ],
            "ADEGAON-CB": [
                { dcName: "ADEGAON", percent: 100 }
            ],
            "33KV ADEGAON": [
                { dcName: "ADEGAON", percent: 100 }
            ],
            "33KV ADEGAON-CHAMARI": [
                { dcName: "ADEGAON", percent: 100 }
            ],
            "33KV MADI OUTGOING": [
                { dcName: "ADEGAON", percent: 100 }
            ],
            "33KV ADEGAON (CHAMARI)": [
                { dcName: "ADEGAON", percent: 100 }
            ],
            "33KV MADHI INCOMING": [
                { dcName: "ADEGAON", percent: 100 }
            ],
            "11KV KHAPA MIX": [
                { dcName: "ADEGAON", percent: 100 }
            ],
            "11KV DUDWARA DL": [
                { dcName: "ADEGAON", percent: 100 }
            ],
            "33KV ADEGAON FEEDER": [
                { dcName: "ADEGAON", percent: 100 }
            ]
        };
        let feederRows = [];
        let feederSubstations = ["ADEGAON", "MADHI", "CHAMARI", "DUDWARA", "132KV LAKHNADON"];
        let allFeederSubstations = ["ADEGAON", "MADHI", "CHAMARI", "DUDWARA", "132KV LAKHNADON"];
        // Only these 33/11 KV substations are shown in the Feeder Reading tab.
        const FEEDER_VISIBLE_SUBSTATIONS = ["ADEGAON", "MADHI", "CHAMARI", "DUDWARA", "132KV LAKHNADON"];
        let feederDataLoaded = false;
        // Fallback feeder rows used when the Google Sheet (feederCsvUrl) hasn't loaded yet.
        const fallbackFeederRows = [
            { "33/11 KV SUBSTATION": "ADEGAON", "33 AND 11 KV FEEDER": "11KV ADEGAON MIX", substation: "ADEGAON", feeder: "11KV ADEGAON MIX", meterNo: "BS12774695", mf: "3000" },
            { "33/11 KV SUBSTATION": "ADEGAON", "33 AND 11 KV FEEDER": "11KV MADI (ADEGAON) MIX", substation: "ADEGAON", feeder: "11KV MADI (ADEGAON) MIX", meterNo: "BS12774693", mf: "4000" },
            { "33/11 KV SUBSTATION": "ADEGAON", "33 AND 11 KV FEEDER": "11KV BIBI DL", substation: "ADEGAON", feeder: "11KV BIBI DL", meterNo: "BS12776368", mf: "4000" },
            { "33/11 KV SUBSTATION": "ADEGAON", "33 AND 11 KV FEEDER": "11KV BIBI AG", substation: "ADEGAON", feeder: "11KV BIBI AG", meterNo: "BS12774694", mf: "4000" },
            { "33/11 KV SUBSTATION": "ADEGAON", "33 AND 11 KV FEEDER": "ADEGAON-CB", substation: "ADEGAON", feeder: "ADEGAON-CB", meterNo: "BS12770679", mf: "4000" },
            { "33/11 KV SUBSTATION": "MADHI", "33 AND 11 KV FEEDER": "11 KV PATAN", substation: "MADHI", feeder: "11 KV PATAN", meterNo: "BS12775542", mf: "4000" },
            { "33/11 KV SUBSTATION": "MADHI", "33 AND 11 KV FEEDER": "11 KV MADHI", substation: "MADHI", feeder: "11 KV MADHI", meterNo: "BS12775541", mf: "4000" },
            { "33/11 KV SUBSTATION": "MADHI", "33 AND 11 KV FEEDER": "11 KV PINDRAI", substation: "MADHI", feeder: "11 KV PINDRAI", meterNo: "BS12775540", mf: "4000" },
            // DUDWARA 33/11 KV Substation (SS Code 5097)
            { "33/11 KV SUBSTATION": "DUDWARA", "33 AND 11 KV FEEDER": "11KV KHAPA MIX", substation: "DUDWARA", feeder: "11KV KHAPA MIX", meterNo: "BS12773341", mf: "4000", ssCode: "5097" },
            { "33/11 KV SUBSTATION": "DUDWARA", "33 AND 11 KV FEEDER": "11KV DUDWARA DL", substation: "DUDWARA", feeder: "11KV DUDWARA DL", meterNo: "BS12773342", mf: "4000", ssCode: "5097" },
            // 132KV LAKHNADON Substation
            { "33/11 KV SUBSTATION": "132KV LAKHNADON", "33 AND 11 KV FEEDER": "33KV ADEGAON FEEDER", substation: "132KV LAKHNADON", feeder: "33KV ADEGAON FEEDER", meterNo: "MPP28230", mf: "120", feederType: "33 KV" },
            // 33 KV Feeders (MF readings)
            { "33/11 KV SUBSTATION": "ADEGAON", "33 AND 11 KV FEEDER": "33KV ADEGAON", substation: "ADEGAON", feeder: "33KV ADEGAON", meterNo: "BS12775548", mf: "24000", feederType: "33 KV" },
            { "33/11 KV SUBSTATION": "ADEGAON", "33 AND 11 KV FEEDER": "33KV ADEGAON-CHAMARI", substation: "ADEGAON", feeder: "33KV ADEGAON-CHAMARI", meterNo: "BS12775550", mf: "12000", feederType: "33 KV" },
            { "33/11 KV SUBSTATION": "ADEGAON", "33 AND 11 KV FEEDER": "33KV MADI OUTGOING", substation: "ADEGAON", feeder: "33KV MADI OUTGOING", meterNo: "BS12776133", mf: "12000", feederType: "33 KV" },
            { "33/11 KV SUBSTATION": "CHAMARI", "33 AND 11 KV FEEDER": "33KV ADEGAON (CHAMARI)", substation: "CHAMARI", feeder: "33KV ADEGAON (CHAMARI)", meterNo: "BS12775544", mf: "12000", feederType: "33 KV" },
            { "33/11 KV SUBSTATION": "MADHI", "33 AND 11 KV FEEDER": "33KV MADHI INCOMING", substation: "MADHI", feeder: "33KV MADHI INCOMING", meterNo: "BS12775543", mf: "12000", feederType: "33 KV" }
        ];
        let feederReportRows = [];
        let feederReportLoaded = false;
        let feederReportLoadMessage = "";
        let selectedFeederSubstation = "";
        let activeFeederOperator = null;
        let summaryRefreshToken = 0;
        let chhaparaFeederEntries = [];
        const mobileUpdateStorageKey = "seoni-circle-mobile-updated";
        const dcCsvCacheStoragePrefix = "seoni-circle-dc-csv-";
        const chhaparaFeederStorageKey = "seoni-circle-chhapara-feeder-output";
        const feederRecentSubmittedStorageKey = "seoni-circle-feeder-recent-submitted";
        const feederOperatorStorageKey = "feederOperatorProfile";
        const brokenPoleStorageKey = "seoni-circle-broken-pole-entries";
        const pdcStorageKey = "seoni-circle-pdc-nontraceable-entries";
        let bpGeoData = null;

        // ===== IndexedDB wrapper for photo-heavy entries (Broken Pole) =====
        // localStorage has a tiny ~5-10MB shared limit; IndexedDB allows much larger storage
        // for entries that include base64 photo data.
        const IDB_DB_NAME = "seoni-circle-photo-store";
        const IDB_DB_VERSION = 4;
        const IDB_STORES = ["broken_pole", "bijli_chori", "karya_charitra", "sync_queue"];
        // Max entries allowed per store (raised from 500 to 2000 - photos are resized small,
        // so 2000 entries comfortably fits within typical IndexedDB quotas on mobile browsers).
        const IDB_STORE_LIMITS = {
            broken_pole: 500,
            bijli_chori: 200,
            karya_charitra: 1000   // Text-only, no photos — higher limit ok
        };
        // Note: Cloud (Google Sheet/Drive) has no practical limit for DC-level usage.
        // Local limits above are conservative since cloud sync backs up all entries.
        // Oldest local entries are auto-deleted when limit is reached — cloud copy remains safe.
        let idbInstance = null;

        // Shows a warning toast when a store is nearing its limit, so the user can
        // download the MIS report and clear old entries before data starts getting removed.
        async function checkStoreCapacityWarning_(storeName, labelHi) {
            try {
                const limit = IDB_STORE_LIMITS[storeName] || 500;
                const count = await idbCount_(storeName);
                const pct = count / limit;
                if (pct >= 1) {
                    showToast(`${labelHi}: Device cache full (${limit} entries) — sabse purani local entry auto-delete ho gayi. Cloud mein sab safe hai.`, false);
                } else if (pct >= 0.9) {
                    showToast(`${labelHi}: ${count}/${limit} entries device par. Limit ke paas — purani entries auto-delete hongi (cloud mein safe rahegi).`, false);
                } else if (pct >= 0.75) {
                    showToast(`${labelHi}: ${count}/${limit} entries device par (75% full).`, true);
                }
                return count;
            } catch (_) {
                return 0;
            }
        }

        function openPhotoDb_() {
            return new Promise((resolve, reject) => {
                if (idbInstance) return resolve(idbInstance);
                if (!window.indexedDB) return reject(new Error("IndexedDB not supported"));
                const request = indexedDB.open(IDB_DB_NAME, IDB_DB_VERSION);
                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    IDB_STORES.forEach((storeName) => {
                        if (!db.objectStoreNames.contains(storeName)) {
                            db.createObjectStore(storeName, { keyPath: "id", autoIncrement: true });
                        }
                    });
                };
                request.onsuccess = (event) => {
                    idbInstance = event.target.result;
                    resolve(idbInstance);
                };
                request.onerror = () => reject(request.error);
            });
        }

        async function idbGetAll_(storeName) {
            try {
                const db = await openPhotoDb_();
                return await new Promise((resolve, reject) => {
                    const tx = db.transaction(storeName, "readonly");
                    const store = tx.objectStore(storeName);
                    const req = store.getAll();
                    req.onsuccess = () => resolve(req.result || []);
                    req.onerror = () => reject(req.error);
                });
            } catch (_) {
                return [];
            }
        }

        async function idbAdd_(storeName, entry) {
            const db = await openPhotoDb_();
            return await new Promise((resolve, reject) => {
                const tx = db.transaction(storeName, "readwrite");
                const store = tx.objectStore(storeName);
                const req = store.add(entry);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
        }

        async function idbDelete_(storeName, id) {
            try {
                const db = await openPhotoDb_();
                const tx = db.transaction(storeName, "readwrite");
                const store = tx.objectStore(storeName);
                store.delete(id);
                return new Promise((resolve) => {
                    tx.oncomplete = () => resolve(true);
                    tx.onerror = () => resolve(false);
                });
            } catch (_) {
                return false;
            }
        }

        async function idbCount_(storeName) {
            try {
                const db = await openPhotoDb_();
                return await new Promise((resolve, reject) => {
                    const tx = db.transaction(storeName, "readonly");
                    const store = tx.objectStore(storeName);
                    const req = store.count();
                    req.onsuccess = () => resolve(req.result || 0);
                    req.onerror = () => reject(req.error);
                });
            } catch (_) {
                return 0;
            }
        }

        async function idbDeleteOldest_(storeName, count) {
            try {
                const db = await openPhotoDb_();
                const all = await idbGetAll_(storeName);
                const sorted = all.slice().sort((a, b) => (a.id || 0) - (b.id || 0));
                const toDelete = sorted.slice(0, count);
                const tx = db.transaction(storeName, "readwrite");
                const store = tx.objectStore(storeName);
                toDelete.forEach((item) => store.delete(item.id));
                return new Promise((resolve) => {
                    tx.oncomplete = () => resolve(true);
                    tx.onerror = () => resolve(false);
                });
            } catch (_) {
                return false;
            }
        }

        const feederAlertStartDateKey = "2026-07-01";

        // ===== Shared Module Sync helpers (Broken Pole / Bijli Chori) =====
        // In-memory cache of remote (shared) entries per module, refreshed on view open.
        const sharedModuleEntriesCache = {
            broken_pole: [],
            bijli_chori: [],
            karya_charitra: []
        };
        const sharedModuleLastFetch = {};

        // Sends a single entry (with photo(s) as base64 data URLs) to the shared backend.
        // Returns the entry_id assigned by the server, or "" on failure (caller should
        // continue working with local-only storage in that case).
        async function syncEntryToCloud_(module, entry, isReplay = false) {
            window.__lastSyncQueued = false;
            if (!sharedModuleSyncEnabled) return "";
            try {
                // Step 1: Send entry metadata only (no photo_data) to get entry_id
                const entryToSync = JSON.parse(JSON.stringify(entry));
                if (entryToSync.photo_data) delete entryToSync.photo_data;
                if (Array.isArray(entryToSync.photos)) {
                    entryToSync.photos = entryToSync.photos.map((p) => {
                        const s = { ...p }; delete s.photo_data; return s;
                    });
                }

                const payload = new URLSearchParams();
                payload.append("module", module);
                payload.append("entry_json", JSON.stringify(entryToSync));

                const response = await fetch(sharedModuleSyncScriptUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
                    body: payload.toString()
                });
                const parsed = JSON.parse((await response.text()) || "{}");
                if (!parsed || parsed.status !== "success") return "";
                const entryId = parsed.entry_id || "";
                if (!entryId) return "";

                // Step 2: Upload each photo — AWAIT each one so they actually save to Drive
                // before we return. This makes submit slightly slower but ensures photos
                // are visible to other users immediately after submission.
                const photoUploads = [];
                if (entry.photo_data) {
                    photoUploads.push({ data: entry.photo_data, name: entry.photo_name || "", index: -1 });
                }
                if (Array.isArray(entry.photos)) {
                    entry.photos.forEach((p, idx) => {
                        if (p && p.photo_data) {
                            photoUploads.push({ data: p.photo_data, name: p.name || "", index: idx });
                        }
                    });
                }

                // Upload photos sequentially with retry (sequential avoids overwhelming Apps Script)
                for (const photo of photoUploads) {
                    let uploaded = false;
                    for (let attempt = 0; attempt < 3 && !uploaded; attempt++) {
                        try {
                            const photoPayload = new URLSearchParams();
                            photoPayload.append("module", module);
                            photoPayload.append("action", "uploadPhoto");
                            photoPayload.append("entry_id", entryId);
                            photoPayload.append("photo_data", photo.data);
                            photoPayload.append("photo_name", photo.name);
                            photoPayload.append("photo_index", String(photo.index));

                            const photoResponse = await fetch(sharedModuleSyncScriptUrl, {
                                method: "POST",
                                headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
                                body: photoPayload.toString()
                            });
                            const photoResult = JSON.parse((await photoResponse.text()) || "{}");
                            if (photoResult && photoResult.status === "success") {
                                uploaded = true;
                            }
                        } catch (_) {
                            // Wait 1s before retry
                            await new Promise((r) => setTimeout(r, 1000));
                        }
                    }
                }

                // Invalidate cache so other users get fresh data with photos on next fetch
                sharedModuleLastFetch[module] = 0;

                return entryId;
            } catch (err) {
                // Network error (offline)? Queue me daal do — internet aane par
                // processSyncQueue_ ise apne aap cloud me bhej degi (photos samet).
                if (!isReplay && (navigator.onLine === false || err instanceof TypeError)) {
                    try {
                        if (!entry.client_id) entry.client_id = genClientId_();
                        await queueOfflineSync_({ kind: "shared_entry", module, entry: JSON.parse(JSON.stringify(entry)) });
                        window.__lastSyncQueued = true;
                    } catch (qErr) { console.error(qErr); }
                } else {
                    console.error(err);
                }
                return "";
            }
        }

        // ===================== OFFLINE SYNC QUEUE =====================
        // Internet na hone par submit hui entries is queue me jaati hain aur
        // internet aate hi APNE AAP cloud me sync ho jaati hain.
        function genClientId_() {
            return "C" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        }

        async function idbPut_(storeName, record) {
            const db = await openPhotoDb_();
            return await new Promise((resolve, reject) => {
                const tx = db.transaction(storeName, "readwrite");
                const req = tx.objectStore(storeName).put(record);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
        }

        async function queueOfflineSync_(item) {
            await idbAdd_("sync_queue", { ...item, createdAt: Date.now() });
            updateSyncQueueBadge_();
        }

        // Sync hone ke baad local record me cloud ka entry_id bhar deta hai,
        // taaki wahi entry duplicate na dikhe.
        async function backfillEntryId_(module, clientId, entryId) {
            if (!clientId || !entryId) return;
            try {
                if (!IDB_STORES.includes(module)) return;
                const all = await idbGetAll_(module);
                const rec = all.find((r) => r.client_id === clientId);
                if (rec && !rec.entry_id) {
                    rec.entry_id = entryId;
                    await idbPut_(module, rec);
                }
            } catch (err) { console.error(err); }
        }

        async function updateSyncQueueBadge_() {
            try {
                const badge = document.getElementById("sync-queue-badge");
                if (!badge) return;
                const items = await idbGetAll_("sync_queue");
                if (items.length) {
                    badge.style.display = "inline-flex";
                    badge.innerText = `🔄 ${items.length} pending`;
                } else {
                    badge.style.display = "none";
                }
            } catch (err) { console.error(err); }
        }

        let syncQueueProcessing_ = false;
        async function processSyncQueue_() {
            if (syncQueueProcessing_) return;
            if (navigator.onLine === false) return;
            syncQueueProcessing_ = true;
            let done = 0;
            try {
                const items = (await idbGetAll_("sync_queue")).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
                for (const item of items) {
                    try {
                        if (item.kind === "shared_entry") {
                            const entryId = await syncEntryToCloud_(item.module, item.entry, true);
                            if (!entryId) break; // abhi bhi fail — order banaye rakhne ke liye yahin ruko
                            await backfillEntryId_(item.module, item.entry.client_id, entryId);
                            sharedModuleLastFetch[item.module] = 0;
                        } else if (item.kind === "post_form") {
                            const response = await fetch(APPS_SCRIPT_EXEC_URL, {
                                method: "POST",
                                headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
                                body: item.body
                            });
                            if (!response.ok) break;
                        }
                        await idbDelete_("sync_queue", item.id);
                        done++;
                    } catch (err) { console.error(err); break; }
                }
            } finally {
                syncQueueProcessing_ = false;
                updateSyncQueueBadge_();
                if (done) showToast(`${done} offline entry cloud me sync ho gayi ✅`, true);
            }
        }

        // Internet wapas aate hi sync; app khulne par bhi check; har 2 min safety check
        window.addEventListener("online", () => setTimeout(processSyncQueue_, 1500));
        setTimeout(processSyncQueue_, 5000);
        setTimeout(updateSyncQueueBadge_, 3000);
        setInterval(processSyncQueue_, 120000);
        // ================== END OFFLINE SYNC QUEUE ====================

        // Fetches all shared entries for a module from the backend. Returns [] on
        // failure (offline, not configured, etc.) so callers can fall back to local data.
        async function fetchSharedEntries_(module, forceRefresh) {
            if (!sharedModuleSyncEnabled) return [];
            const now = Date.now();
            if (!forceRefresh && sharedModuleLastFetch[module] && (now - sharedModuleLastFetch[module] < 10000)) {
                return sharedModuleEntriesCache[module] || [];
            }
            try {
                const url = `${sharedModuleSyncScriptUrl}?action=getEntries&module=${encodeURIComponent(module)}`;
                const data = await loadRemoteJson(url);
                if (data && data.status === "success" && Array.isArray(data.entries)) {
                    sharedModuleEntriesCache[module] = data.entries;
                    sharedModuleLastFetch[module] = now;
                    return data.entries;
                }
                return sharedModuleEntriesCache[module] || [];
            } catch (_) {
                return sharedModuleEntriesCache[module] || [];
            }
        }

        // Deletes a shared entry on the backend by its entry_id (string assigned by server).
        async function deleteSharedEntry_(module, entryId) {
            if (!sharedModuleSyncEnabled || !entryId) return false;
            try {
                const payload = new URLSearchParams();
                payload.append("module", module);
                payload.append("action", "deleteEntry");
                payload.append("entry_id", entryId);
                const response = await fetch(sharedModuleSyncScriptUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
                    body: payload.toString()
                });
                const text = await response.text();
                const parsed = JSON.parse(text || "{}");
                return parsed && parsed.status === "success";
            } catch (_) {
                return false;
            }
        }

        // Merges local IndexedDB entries with shared (remote) entries for a module,
        // de-duplicating by entry_id (entries synced from this device will have the
        // same entry_id locally and remotely once sync succeeds).
        function mergeLocalAndSharedEntries_(localEntries, sharedEntries) {
            const merged = [];
            const seenIds = new Set();

            // Shared entries first (so cloud copy - with Drive photo URLs - wins on id collision)
            (sharedEntries || []).forEach((e) => {
                const id = e.entry_id || "";
                if (id) seenIds.add(id);
                merged.push(e);
            });

            (localEntries || []).forEach((e) => {
                const id = e.entry_id || "";
                if (id && seenIds.has(id)) return; // already represented by shared copy
                merged.push(e);
            });

            // Sort by timestamp ascending (fallback to local id) so newest-first reversal works consistently
            merged.sort((a, b) => {
                const ta = a.timestamp ? new Date(a.timestamp).getTime() : (a.id || 0);
                const tb = b.timestamp ? new Date(b.timestamp).getTime() : (b.id || 0);
                return ta - tb;
            });
            return merged;
        }


        let mobileSubmittedSheetMap = {};
        let feederRecentSubmittedEntries = [];

        document.addEventListener("DOMContentLoaded", () => {
            // One-time cleanup: old broken-pole/PDC entries used to be stored in localStorage
            // with embedded photos, which could fill up the shared 5-10MB quota.
            // They've moved to IndexedDB, so remove the old keys to free up space.
            try {
                localStorage.removeItem(brokenPoleStorageKey);
                localStorage.removeItem(pdcStorageKey);
            } catch (_) {}

            const today = localTodayIso_();
            document.getElementById("report-date").value = today;
            // Default MIS date range: 1st of current month to today
            const now = new Date();
            const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01`;
            if (document.getElementById("mis-from-date")) document.getElementById("mis-from-date").value = firstOfMonth;
            if (document.getElementById("mis-to-date")) document.getElementById("mis-to-date").value = today;
            getAllDcConfigs().forEach(async ({ name, csvUrl }) => {
                if (!csvUrl) return;
                try {
                    const rawCsv = await loadRemoteText(csvUrl);
                    const normalizedDc = normalizeDcName(name);
                    const parsedRows = isLikelyCsvPayload(rawCsv) ? parseConsumerCsv(rawCsv) : [];
                    if (parsedRows.length) {
                        dcCacheRaw[normalizedDc] = rawCsv;
                        dcCacheRows[normalizedDc] = parsedRows;
                        try {
                            localStorage.setItem(`${dcCsvCacheStoragePrefix}${normalizedDc}`, rawCsv);
                        } catch (_) {}
                    }
                } catch (e) {}
            });

            initChhaparaFeederCalculator();
            switchView("home");
        });


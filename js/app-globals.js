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
                    { name: "ADEGAON", csvUrl: "./data/adegaon-consumers.csv" }
                ]
            }
        };

        // ===== Error log — device par persist hota hai, taaki field me kuch toote to
        // koi bhi (JE khud ya officer) "एरर लॉग" khol kar wajah dekh sake, bina DevTools ke =====
        const ERROR_LOG_KEY = "seoni-circle-error-log";
        const ERROR_LOG_MAX = 100;

        function getErrorLogs_() {
            try { return JSON.parse(localStorage.getItem(ERROR_LOG_KEY)) || []; } catch (_) { return []; }
        }

        function logErr_(ctx, err, extra) {
            try {
                const message = err ? (err.message || String(err)) : "";
                const entry = {
                    t: new Date().toISOString(),
                    view: document.querySelector(".view.active")?.id || "?",
                    dc: (typeof activeDC !== "undefined" && activeDC) || "",
                    ctx: ctx || "",
                    msg: String(message).slice(0, 300),
                    extra: extra ? String(extra).slice(0, 200) : "",
                };
                const logs = getErrorLogs_();
                logs.push(entry);
                if (logs.length > ERROR_LOG_MAX) logs.splice(0, logs.length - ERROR_LOG_MAX);
                localStorage.setItem(ERROR_LOG_KEY, JSON.stringify(logs));
            } catch (_) {}
        }

        function clearErrorLogs_() {
            try { localStorage.removeItem(ERROR_LOG_KEY); } catch (_) {}
        }

        // Har device ka apna ek sthir (persistent) pehchaan number — employee login
        // na ho tab bhi admin dekh sake ki error kis phone/device se aa rahi hai.
        const DEVICE_ID_KEY = "seoni-circle-device-id";
        function getDeviceId_() {
            try {
                let id = localStorage.getItem(DEVICE_ID_KEY);
                if (!id) {
                    id = "D" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
                    localStorage.setItem(DEVICE_ID_KEY, id);
                }
                return id;
            } catch (_) { return ""; }
        }

        // Error logs pehle sirf isi device ke localStorage me bandh rehte the — admin
        // ko kabhi pata nahi chalta tha ki field me kis DC/device par kya toot raha
        // hai. Ab yeh (mobile_correction jaisi hi generic backend mechanism se)
        // cloud par bhi bhej diye jaate hain, taaki Admin Dashboard se sabhi devices
        // ki dikkatein ek jagah dikh sakein. Backend par "device_diagnostics" module
        // add karna hoga (PHOTO_MODULES me), warna yeh chupchaap fail hokar agli
        // baar phir try karega — koi crash/blocking nahi hoti.
        const DIAGNOSTICS_MODULE = "device_diagnostics";
        async function syncErrorLogsToCloud_() {
            if (!sharedModuleSyncEnabled) return;
            try {
                const logs = getErrorLogs_();
                // Apni hi sync-failure ko report karna recursive noise banata hai
                // (backend module abhi register na hua ho to har 5 min ek nayi
                // "sync-device_diagnostics fail" entry ban jaati) — usse turant
                // synced maan lete hain, register hote hi normal ho jaayega.
                logs.forEach((l) => { if (l.ctx === `sync-${DIAGNOSTICS_MODULE}`) l.synced = true; });
                const unsynced = logs.filter((l) => !l.synced).slice(0, 10); // ek baar me thoda hi, network par bhaar na pade
                if (!unsynced.length) return;
                const deviceId = getDeviceId_();
                let anySynced = false;
                for (const log of unsynced) {
                    const entry = { ...log, device_id: deviceId, timestamp: log.t || new Date().toISOString() };
                    // isReplay=true — fail hone par sync_queue me nahi daalte (diagnostics
                    // ki apni retry agli periodic run me khud ho jaati hai, asli user-data
                    // ki queue ko bewajah bhaari nahi karna chahte).
                    const entryId = await syncEntryToCloud_(DIAGNOSTICS_MODULE, entry, true);
                    if (entryId) { log.synced = true; anySynced = true; }
                }
                if (anySynced) {
                    try { localStorage.setItem(ERROR_LOG_KEY, JSON.stringify(logs)); } catch (_) {}
                }
            } catch (_) {}
        }

        // Kisi bhi network call (Apps Script/Sheets ko) ek max samay ke baad khud
        // hi rok deta hai — pehle koi bhi fetch() dheere/atke huye network par
        // anishchit samay tak latki reh sakti thi (na success na fail), isliye UI
        // "Saving..."/"लोड हो रहा है" me hamesha ke liye fas sakta tha. Ab timeout
        // ke baad AbortError throw hota hai, jise caller apne normal catch/error
        // path se hi handle kar leta hai (jaise real network error).
        async function fetchWithTimeout_(url, options = {}, timeoutMs = 15000) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
            try {
                return await fetch(url, { ...options, signal: controller.signal });
            } finally {
                clearTimeout(timeoutId);
            }
        }

        // PDF/Excel export libraries (jsPDF, jsPDF-autotable, html2canvas, xlsx)
        // ab CDN (cdnjs.cloudflare.com) se nahi, is app ke apne server se lazy-load
        // hote hain — sirf tab jab koi user wakai PDF/Excel download karta hai, na
        // ki har app-boot par. Isse (a) rural/kharab network par CDN unreachable
        // hone ka risk khatam hota hai, (b) jo user kabhi export nahi karte unke
        // liye shuruaati load lighter rehta hai.
        const _vendorLoadPromises_ = {};
        function loadVendorScript_(key, src) {
            if (_vendorLoadPromises_[key]) return _vendorLoadPromises_[key];
            _vendorLoadPromises_[key] = new Promise((resolve, reject) => {
                const script = document.createElement("script");
                script.src = src;
                script.onload = () => resolve();
                script.onerror = () => { delete _vendorLoadPromises_[key]; reject(new Error(`${src} load nahi hui`)); };
                document.head.appendChild(script);
            });
            return _vendorLoadPromises_[key];
        }
        function ensureJsPdf_() {
            return loadVendorScript_("jspdf", "js/vendor/jspdf.umd.min.js")
                .then(() => loadVendorScript_("jspdf-autotable", "js/vendor/jspdf.plugin.autotable.min.js"));
        }
        function ensureHtml2Canvas_() {
            return loadVendorScript_("html2canvas", "js/vendor/html2canvas.min.js");
        }
        function ensureXlsx_() {
            return loadVendorScript_("xlsx", "js/vendor/xlsx.full.min.js");
        }
        function loadVendorStyle_(key, href) {
            if (_vendorLoadPromises_[key]) return _vendorLoadPromises_[key];
            _vendorLoadPromises_[key] = new Promise((resolve, reject) => {
                const link = document.createElement("link");
                link.rel = "stylesheet";
                link.href = href;
                link.onload = () => resolve();
                link.onerror = () => { delete _vendorLoadPromises_[key]; reject(new Error(`${href} load nahi hui`)); };
                document.head.appendChild(link);
            });
            return _vendorLoadPromises_[key];
        }
        function ensureLeaflet_() {
            return loadVendorStyle_("leaflet-css", "js/vendor/leaflet.min.css")
                .then(() => loadVendorScript_("leaflet", "js/vendor/leaflet.min.js"));
        }

        function renderErrorLogRows_(logs) {
            if (!logs.length) return `<div style="text-align:center; padding:18px; font-size:12px; font-weight:800; color:#64748b;">कोई error नहीं — सब ठीक है ✅</div>`;
            return logs.slice().reverse().map((e) => `
                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:10px 12px; margin-bottom:8px;">
                    <div style="display:flex; justify-content:space-between; gap:8px; margin-bottom:3px;">
                        <span style="font-size:10px; font-weight:900; color:#b91c1c; background:#fee2e2; border-radius:6px; padding:1px 7px;">${escapeHtml(e.ctx || "?")}</span>
                        <span style="font-size:10px; font-weight:700; color:#64748b;">${escapeHtml(String(e.t || "").replace("T", " ").slice(0, 19))}</span>
                    </div>
                    <div style="font-size:11px; font-weight:700; color:#1e293b; word-break:break-word;">${escapeHtml(e.msg || "")}${e.extra ? ` <span style="color:#94a3b8;">[${escapeHtml(e.extra)}]</span>` : ""}</div>
                    <div style="font-size:9px; font-weight:700; color:#94a3b8; margin-top:3px;">view: ${escapeHtml(e.view || "?")}${e.dc ? ` • DC: ${escapeHtml(e.dc)}` : ""}</div>
                </div>
            `).join("");
        }

        function openErrorLogModal_() {
            const existing = document.getElementById("error-log-overlay");
            if (existing) existing.remove();

            const overlay = document.createElement("div");
            overlay.id = "error-log-overlay";
            overlay.style.cssText = "position:fixed; inset:0; background:rgba(0,0,0,0.55); z-index:9999; display:flex; align-items:flex-end; justify-content:center;";
            overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });

            const sheet = document.createElement("div");
            sheet.style.cssText = "background:#ffffff; border-radius:20px 20px 0 0; padding:18px; width:100%; max-width:480px; max-height:80vh; overflow-y:auto; box-shadow:0 -12px 30px rgba(0,0,0,0.25);";
            sheet.innerHTML = `
                <div style="font-size:14px; font-weight:900; color:#1e293b; text-transform:uppercase; margin-bottom:4px;">🐞 एरर लॉग (सिर्फ़ इस डिवाइस पर)</div>
                <div style="font-size:11px; font-weight:700; color:#64748b; margin-bottom:12px;">अगर ऐप में कुछ गड़बड़ लगे, तो यहाँ वजह दिखेगी — इसे screenshot करके भेजा जा सकता है।</div>
                <div id="error-log-list"></div>
                <div style="display:flex; gap:10px; margin-top:12px;">
                    <button id="error-log-clear-btn" style="flex:1; height:44px; border:none; border-radius:12px; background:#fee2e2; color:#b91c1c; font-size:12px; font-weight:900; text-transform:uppercase;">🗑 लॉग साफ़ करें</button>
                    <button id="error-log-close-btn" style="flex:1; height:44px; border:none; border-radius:12px; background:#e2e8f0; color:#1e293b; font-size:12px; font-weight:900; text-transform:uppercase;">बंद करें</button>
                </div>
            `;
            overlay.appendChild(sheet);
            document.body.appendChild(overlay);

            document.getElementById("error-log-list").innerHTML = trustedHtml_(renderErrorLogRows_(getErrorLogs_()));
            document.getElementById("error-log-close-btn").onclick = () => overlay.remove();
            document.getElementById("error-log-clear-btn").onclick = () => {
                clearErrorLogs_();
                document.getElementById("error-log-list").innerHTML = trustedHtml_(renderErrorLogRows_([]));
                showToast("लॉग साफ़ हो गए", true);
            };
        }

        // Global error logging — ab silent failures device par bhi save hote hain, sirf console me nahi
        window.addEventListener("error", (e) => {
            console.error("App error:", e.message, e.error || "");
            logErr_("js-error", e.error || e.message, (e.filename || "").split("/").pop() + ":" + (e.lineno || ""));
        });
        window.addEventListener("unhandledrejection", (e) => {
            console.error("Unhandled promise rejection:", e.reason);
            logErr_("promise", e.reason);
        });

        // Local (IST) date helpers — toISOString() UTC deta hai jisse subah 5:30 se
        // pehle "aaj" ki jagah "kal" ki date aa jaati thi.
        function localDateIso_(d) {
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        }
        function localTodayIso_() { return localDateIso_(new Date()); }

        // Ek hi Apps Script deployment — sab modules isi ko use karte hain.
        const APPS_SCRIPT_EXEC_URL = "https://script.google.com/macros/s/AKfycbwH7cske7TMbQHw65eBt-fkKVFYWNLGqPr5UgZ3AblevWTKgdTuOk2NDNquo-1iTL0-XQ/exec";
        // Shared secret sent with every backend request so the Apps Script can reject
        // requests that don't come from this app. Must match AUTH_TOKEN in the Apps
        // Script project exactly — if you rotate one, rotate the other too.
        const APPS_SCRIPT_AUTH_TOKEN = "NlFwg1IQv6uGZz132Fti24qeG3c2ZJF2";
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
            // ADEGAON-CB (meterNo: BS12770679) hataya gaya hai — meter reading nahi aa
            // rahi abhi. Jab reading aane lage tab is row ko wapas jod dena.
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
        const dcCsvCacheStoragePrefix = "seoni-circle-dc-csv-";
        const chhaparaFeederStorageKey = "seoni-circle-chhapara-feeder-output";
        const feederRecentSubmittedStorageKey = "seoni-circle-feeder-recent-submitted";
        const feederOperatorStorageKey = "feederOperatorProfile";
        const brokenPoleStorageKey = "seoni-circle-broken-pole-entries";
        const pdcStorageKey = "seoni-circle-pdc-nontraceable-entries";
        let bpGeoData = null;
        let dtrGeoData = null;

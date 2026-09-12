        // Poora Division Seoni abhi taiyar nahi hai (sirf Division Lakhnadon ka ADEGAON
        // kaam kar raha hai) — iski sabhi DCs list me dikhti hain (context ke liye) par
        // "Coming Soon" ke saath disabled rehti hain jab tak data ready na ho.
        const COMING_SOON_DIVISIONS = ["DIVISION SEONI"];

        function showDivision(name, colorClass) {
            activeDiv = name.trim().toUpperCase();
            resetForm();
            const divisionConfig = getDivisionConfig(activeDiv);
            activeGrad = divisionConfig?.colorClass || colorClass || "bg-teal-grad";
            document.documentElement.style.setProperty("--theme-color", divisionConfig?.themeColor || "#0d9488");
            document.documentElement.style.setProperty("--theme-grad", divisionConfig?.themeGradient || "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)");
            switchView("dc-selection");
            const menu = document.getElementById("dc-menu");
            menu.innerHTML = "";
            const divisionComingSoon = COMING_SOON_DIVISIONS.includes(activeDiv);
            getDivisionDcNames(activeDiv).forEach((dc) => {
                const isComingSoon = divisionComingSoon;
                const item = document.createElement("div");
                item.className = "option-item";
                if (isComingSoon) {
                    item.style.cssText = "display:flex; align-items:center; justify-content:space-between; gap:8px; cursor:default;";
                    item.innerHTML = trustedHtml_(`<span>${escapeHtml(dc)}</span><span style="color:#94a3b8; font-weight:700; font-size:11px; text-transform:uppercase; letter-spacing:0.3px;">Coming Soon</span>`);
                    item.onclick = () => showToast("यह DC जल्द उपलब्ध होगा", false);
                } else {
                    item.innerText = dc;
                    item.onclick = () => {
                        activeDC = normalizeDcName(dc);
                        ensureDcDataLoaded(activeDC);
                        document.getElementById("selected-dc-label").innerText = dc;
                        toggleDropdown();
                        switchView("dc-dashboard");
                    };
                }
                menu.appendChild(item);
            });
        }

        function getDcConfigByName(dcName) {
            const normalized = normalizeDcName(dcName);
            return getAllDcConfigs().find((config) => normalizeDcName(config.name) === normalized) || null;
        }

        // Sirf ek hi background refresh chale ek DC ke liye ek waqt par — warna
        // pending IVRS searches (jab tak refresh chal rahi ho) har baar apna
        // naya parallel fetch chhed dete.
        const dcCacheRefreshInFlight_ = {};

        async function fetchAndCacheDcData_(normalized, config) {
            try {
                const rawCsv = await loadRemoteText(config.csvUrl);
                const parsedRows = isLikelyCsvPayload(rawCsv) ? parseConsumerCsv(rawCsv) : [];
                if (parsedRows.length) {
                    dcCacheRaw[normalized] = rawCsv;
                    dcCacheRows[normalized] = parsedRows;
                    try {
                        localStorage.setItem(`${dcCsvCacheStoragePrefix}${normalized}`, rawCsv);
                    } catch (_) {}
                }
            } catch (_) {}
            return dcCacheRows[normalized] || [];
        }

        // Consumer master CSV (10000+ rows) har DC ke liye network se aati hai —
        // field me kamzor network par yeh download hi sabse dheema hissa hota hai
        // (parsing/search khud milliseconds me ho jaate hain). Isliye device par
        // pehle se cached CSV (pichhle session ki) ho to usse turant istemal karte
        // hain (IVRS search bina network ka wait kiye chal jaata hai), aur asli
        // fresh data background me chupchaap update hoti rehti hai. Sirf tabhi
        // network par rukna padta hai jab is DC ka is device par koi cache hi na ho.
        async function ensureDcDataLoaded(dcName) {
            const normalized = normalizeDcName(dcName);
            if (!normalized) return [];
            if (dcCacheRows[normalized]?.length) return dcCacheRows[normalized];
            const config = getDcConfigByName(normalized);
            if (!config || !config.csvUrl) return [];

            let cachedRows = [];
            try {
                const cachedRaw = localStorage.getItem(`${dcCsvCacheStoragePrefix}${normalized}`) || "";
                cachedRows = isLikelyCsvPayload(cachedRaw) ? parseConsumerCsv(cachedRaw) : [];
                if (cachedRows.length) dcCacheRaw[normalized] = cachedRaw;
            } catch (_) {}

            if (cachedRows.length) {
                dcCacheRows[normalized] = cachedRows;
                if (!dcCacheRefreshInFlight_[normalized]) {
                    dcCacheRefreshInFlight_[normalized] = fetchAndCacheDcData_(normalized, config)
                        .finally(() => { delete dcCacheRefreshInFlight_[normalized]; });
                }
                return cachedRows;
            }

            if (!dcCacheRefreshInFlight_[normalized]) {
                dcCacheRefreshInFlight_[normalized] = fetchAndCacheDcData_(normalized, config)
                    .finally(() => { delete dcCacheRefreshInFlight_[normalized]; });
            }
            const rows = await dcCacheRefreshInFlight_[normalized];
            if (!dcCacheRows[normalized]) dcCacheRows[normalized] = [];
            return rows;
        }

        function normalizeLookupDigits(value) {
            return String(value || "").replace(/\D/g, "");
        }

        function toggleDropdown() {
            document.getElementById("dc-menu").classList.toggle("show");
            document.getElementById("prof-trigger").classList.toggle("active");
        }

        // Passwords ab source code me plaintext me nahi hain — sirf SHA-256 hash
        // store hote hain. View Source karne wala password nahi padh sakta.
        async function sha256Hex_(text) {
            if (!window.crypto || !crypto.subtle) return null; // https zaroori hai
            const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(text)));
            return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
        }

        function openMpezSite() {
            const ivrs = currentData ? currentData.ivrs : "";
            // Try passing IVRS as query param — site may or may not use it
            const baseUrl = "https://mpezccc.in/mppkvvcl/updatemobile";
            const url = ivrs ? `${baseUrl}?ivrs=${encodeURIComponent(ivrs)}` : baseUrl;
            window.open(url, "_blank");
            // Show a helpful toast
            showToast("MPEZ site khul rahi hai — IVRS: " + (ivrs || "N/A"), true);
        }

        async function performSearch() {
            const v = document.getElementById("search-ivrs").value.trim();
            currentData = null;
            document.getElementById("result-box").style.display = "none";
            if (v.length !== 10) return showToast("Enter 10 digit IVRS", false);
            let rows = getConsumerRows(activeDC);
            if (!rows.length) {
                rows = await ensureDcDataLoaded(activeDC);
            }
            if (!rows.length) return showToast("Record Not Found!", false);
            const searchIvrs = normalizeLookupDigits(v);
            const found = rows.find((row) => normalizeLookupDigits(getConsumerField(row, ["IVRS", "IVRS NO", "IVRS NUMBER"])) === searchIvrs);
            if (!found) return showToast("Record Not Found!", false);
            currentData = {
                ivrs: getConsumerField(found, ["IVRS", "IVRS NO", "IVRS NUMBER", "CONSUMER NO"]),
                name: getConsumerField(found, ["NAME", "CONSUMER NAME"]),
                father: getConsumerField(found, ["FATHER", "FATHER NAME"]),
                old: getConsumerField(found, ["OLD MOBILE", "OLD MOBILE NO", "OLD MOBILE NUMBER", "MOBILE NO", "MOBILE NUMBER"]),
                addr: getConsumerField(found, ["ADDRESS", "ADDR"]),
                hq: getConsumerField(found, ["HQ", "HQ NAME", "HEADQUARTER", "HEAD QUARTER", "H.Q."]),
                tariff: getConsumerField(found, ["TARIFF"]),
                load: getConsumerField(found, ["LOAD"]),
                unit: getConsumerField(found, ["UNIT"])
            };
            document.getElementById("res-ivrs").innerText = currentData.ivrs;
            document.getElementById("res-name").innerText = currentData.name;
            document.getElementById("res-old").innerText = currentData.old || "N/A";
            document.getElementById("res-addr").innerText = currentData.addr;
            const hqNode = document.getElementById("res-hq");
            if (hqNode) hqNode.innerText = currentData.hq || "N/A";
            const tariffNode = document.getElementById("res-tariff");
            if (tariffNode) tariffNode.innerText = [currentData.tariff, currentData.load && `${currentData.load} ${currentData.unit || ""}`.trim()].filter(Boolean).join(" | ") || "N/A";
            document.getElementById("result-box").style.display = "block";
        }


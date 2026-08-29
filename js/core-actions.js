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

        async function ensureDcDataLoaded(dcName) {
            const normalized = normalizeDcName(dcName);
            if (!normalized) return [];
            if (dcCacheRows[normalized]?.length) return dcCacheRows[normalized];
            const config = getDcConfigByName(normalized);
            if (!config || !config.csvUrl) return [];
            try {
                const rawCsv = await loadRemoteText(config.csvUrl);
                const parsedRows = isLikelyCsvPayload(rawCsv) ? parseConsumerCsv(rawCsv) : [];
                if (parsedRows.length) {
                    dcCacheRaw[normalized] = rawCsv;
                    dcCacheRows[normalized] = parsedRows;
                    try {
                        localStorage.setItem(`${dcCsvCacheStoragePrefix}${normalized}`, rawCsv);
                    } catch (_) {}
                } else {
                    const cachedRaw = localStorage.getItem(`${dcCsvCacheStoragePrefix}${normalized}`) || "";
                    const cachedRows = isLikelyCsvPayload(cachedRaw) ? parseConsumerCsv(cachedRaw) : [];
                    if (cachedRows.length) {
                        dcCacheRaw[normalized] = cachedRaw;
                        dcCacheRows[normalized] = cachedRows;
                    } else {
                        dcCacheRows[normalized] = [];
                    }
                }
            } catch (_) {
                try {
                    const cachedRaw = localStorage.getItem(`${dcCsvCacheStoragePrefix}${normalized}`) || "";
                    const parsedRows = isLikelyCsvPayload(cachedRaw) ? parseConsumerCsv(cachedRaw) : [];
                    if (parsedRows.length) {
                        dcCacheRaw[normalized] = cachedRaw;
                        dcCacheRows[normalized] = parsedRows;
                    } else {
                        localStorage.removeItem(`${dcCsvCacheStoragePrefix}${normalized}`);
                        dcCacheRows[normalized] = [];
                    }
                } catch (_) {
                    dcCacheRows[normalized] = [];
                }
            }
            return dcCacheRows[normalized] || [];
        }

        function normalizeLookupDigits(value) {
            return String(value || "").replace(/\D/g, "");
        }

        function toggleDropdown() {
            document.getElementById("dc-menu").classList.toggle("show");
            document.getElementById("prof-trigger").classList.toggle("active");
        }

        function askPassword(level) {
            pendingLevel = level;
            document.getElementById("pwd-modal").style.display = "flex";
            document.getElementById("pwd-input").value = "";
        }

        function closePwdModal() {
            document.getElementById("pwd-modal").style.display = "none";
        }

        // Passwords ab source code me plaintext me nahi hain — sirf SHA-256 hash
        // store hote hain. View Source karne wala password nahi padh sakta.
        async function sha256Hex_(text) {
            if (!window.crypto || !crypto.subtle) return null; // https zaroori hai
            const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(text)));
            return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
        }
        const ROLE_PASSWORD_HASHES = { CIRCLE: "d1ee5bd5cdd590d6ba1e9f91d1d2acb4c203737212e8c41ffb0407d218fef7e5", DIVISION: "95794bf226adc49f12bdfe1640cd27cd40d49e57026194908ebb00e3bfea0ca8", DC: "4014bf32fe1f3427f4bfbfb1ee5f61631b258eaa1c61e22618f2e4bd275c647f", STOCK: "7c8fa042e2811a66d46aae4d0472ca260ff443b5bcb3d3e4c8cf578e104270a6" };

        async function verifyPassword() {
            const inputHash = await sha256Hex_(document.getElementById("pwd-input").value);
            if (inputHash === null) return showToast("Secure (https) connection zaroori hai", false);
            if (inputHash === ROLE_PASSWORD_HASHES[pendingLevel]) {
                activeViewLevel = pendingLevel;
                closePwdModal();
                switchView("summary");
                refreshSummary();
            } else {
                showToast("Invalid Password!", false);
            }
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


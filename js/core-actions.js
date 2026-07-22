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
            getDivisionDcNames(activeDiv).forEach((dc) => {
                const item = document.createElement("div");
                item.className = "option-item";
                item.innerText = dc;
                item.onclick = () => {
                    activeDC = normalizeDcName(dc);
                    ensureDcDataLoaded(activeDC);
                    document.getElementById("selected-dc-label").innerText = dc;
                    toggleDropdown();
                    switchView("dc-dashboard");
                };
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

        function getMobileUpdateStorageMap() {
            try {
                return JSON.parse(localStorage.getItem(mobileUpdateStorageKey) || "{}");
            } catch (_) {
                return {};
            }
        }

        function getMobileUpdateKey(record) {
            if (!record) return "";
            const dc = normalizeLookupValue(activeDC || "");
            const ivrs = normalizeLookupDigits(record.ivrs || "");
            return `${dc}__${ivrs}`;
        }

        function isMobileAlreadySubmitted(record) {
            const key = getMobileUpdateKey(record);
            if (!key) return false;
            const submittedMap = getMobileUpdateStorageMap();
            return !!submittedMap[key] || !!mobileSubmittedSheetMap[key];
        }

        function isMobileAlreadySubmittedByIvrs(ivrsValue, dcName = activeDC) {
            const dc = normalizeLookupValue(dcName || "");
            const ivrs = normalizeLookupDigits(ivrsValue || "");
            if (!dc || !ivrs) return false;
            const key = `${dc}__${ivrs}`;
            const submittedMap = getMobileUpdateStorageMap();
            return !!submittedMap[key] || !!mobileSubmittedSheetMap[key];
        }

        function markMobileSubmitted(record, newMobile) {
            const key = getMobileUpdateKey(record);
            if (!key) return;
            const submittedMap = getMobileUpdateStorageMap();
            submittedMap[key] = {
                submittedAt: new Date().toISOString(),
                dc: activeDC || "",
                ivrs: record.ivrs || "",
                mobile: newMobile || ""
            };
            localStorage.setItem(mobileUpdateStorageKey, JSON.stringify(submittedMap));
            mobileSubmittedSheetMap[key] = true;
        }

        async function loadSubmittedMobileSheetMap() {
            try {
                const res = await fetch(`${scriptURL}?action=getSummary&t=${Date.now()}`);
                const cloudData = await res.json();
                const nextMap = {};
                (Array.isArray(cloudData) ? cloudData : []).forEach((entry) => {
                    const dc = normalizeLookupValue(entry.dc || "");
                    const ivrs = normalizeLookupDigits(entry.ivrs || "");
                    if (!dc || !ivrs) return;
                    nextMap[`${dc}__${ivrs}`] = true;
                });
                mobileSubmittedSheetMap = nextMap;
                return nextMap;
            } catch (_) {
                return mobileSubmittedSheetMap;
            }
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
                if (pendingLevel === "STOCK") {
                    openStockDashboard();
                    return;
                }
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
            document.getElementById("submit-btn").style.display = "none";
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
                ivrs: getConsumerField(found, ["IVRS", "IVRS NO", "IVRS NUMBER"]),
                name: getConsumerField(found, ["NAME", "CONSUMER NAME"]),
                father: getConsumerField(found, ["FATHER", "FATHER NAME"]),
                old: getConsumerField(found, ["OLD MOBILE", "OLD MOBILE NO", "OLD MOBILE NUMBER", "MOBILE NO", "MOBILE NUMBER"]),
                addr: getConsumerField(found, ["ADDRESS", "ADDR"]),
                hq: getConsumerField(found, ["HQ", "HQ NAME", "HEADQUARTER", "HEAD QUARTER", "H.Q."])
            };
            document.getElementById("res-ivrs").innerText = currentData.ivrs;
            document.getElementById("res-name").innerText = currentData.name;
            document.getElementById("res-old").innerText = currentData.old || "N/A";
            document.getElementById("res-addr").innerText = currentData.addr;
            document.getElementById("result-box").style.display = "block";
            document.getElementById("submit-btn").style.display = "block";
        }

        async function submitToSheet() {
            const n = document.getElementById("new-mobile").value;
            if (n.length !== 10) return showToast("Enter 10 Digit No", false);
            const p = new URLSearchParams();
            p.append("ivrs", currentData.ivrs);
            p.append("name", currentData.name);
            p.append("father", currentData.father);
            p.append("old_mobile", currentData.old);
            p.append("address", currentData.addr);
            p.append("hq", currentData.hq);
            p.append("correct_mobile", n);
            p.append("dc", activeDC);
            p.append("division", activeDiv);
            p.append("timestamp", new Date().toLocaleDateString("en-GB"));
            try {
                const btn = document.getElementById("submit-btn");
                btn.innerText = "Submitting...";
                btn.disabled = true;
                const response = await fetch(scriptURL, {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
                    body: p.toString()
                });

                const responseText = await response.text();
                let submitOk = response.ok;
                let submitMessage = submitOk ? "Submitted Successfully!" : "Submit error aaya";

                try {
                    const parsed = JSON.parse(responseText || "{}");
                    if (parsed && parsed.status === "error") {
                        submitOk = false;
                        submitMessage = parsed.message || "Submit error aaya";
                    } else if (parsed && parsed.message) {
                        submitMessage = parsed.message;
                    }
                } catch (_) {
                    if (!submitOk && responseText) {
                        submitMessage = responseText;
                    }
                }

                showToast(submitMessage, submitOk);
                if (!submitOk) return;
                resetForm(true);
                const searchInput = document.getElementById("search-ivrs");
                if (searchInput) searchInput.focus();
            } catch (e) {
                showToast("Submit blocked ya network issue aaya", false);
            } finally {
                document.getElementById("submit-btn").innerText = "Submit";
                document.getElementById("submit-btn").disabled = false;
            }
        }

        async function downloadMisReportPdf() {
            const fromDate = document.getElementById("mis-from-date").value;
            const toDate = document.getElementById("mis-to-date").value;
            if (!fromDate || !toDate) return showToast("Pehle From aur To date select karein", false);
            if (fromDate > toDate) return showToast("From date, To date se pehle honi chahiye", false);

            const btn = document.getElementById("mis-pdf-btn");
            btn.innerText = "Loading...";
            btn.disabled = true;

            try {
                const apiUrl = `https://mpezccc.in/mppkvvcl/updatemobile?from=${fromDate}&to=${toDate}&format=json`;
                let records = [];

                try {
                    const resp = await fetch(apiUrl, { headers: { "Accept": "application/json" } });
                    if (resp.ok) {
                        const contentType = resp.headers.get("content-type") || "";
                        if (contentType.includes("json")) {
                            const data = await resp.json();
                            records = Array.isArray(data) ? data : (data.data || data.records || []);
                        } else {
                            const text = await resp.text();
                            try { records = JSON.parse(text); } catch(_) {}
                        }
                    }
                } catch(_) {}

                // Format dates for display
                const fmtDate = (iso) => {
                    if (!iso) return "";
                    const [y, m, d] = iso.split("-");
                    return `${d}/${m}/${y}`;
                };

                const { jsPDF } = window.jspdf;
                const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

                // Header
                doc.setFillColor(239, 68, 68);
                doc.rect(0, 0, 210, 22, "F");
                doc.setFontSize(13);
                doc.setTextColor(255, 255, 255);
                doc.setFont(undefined, "bold");
                doc.text("MOBILE NO UPDATE MIS REPORT", 105, 10, { align: "center" });
                doc.setFontSize(8);
                doc.setFont(undefined, "normal");
                doc.text(`SEONI CIRCLE  |  Period: ${fmtDate(fromDate)} to ${fmtDate(toDate)}`, 105, 17, { align: "center" });

                // Date generated
                doc.setTextColor(100);
                doc.setFontSize(7);
                doc.text(`Generated: ${new Date().toLocaleString("en-IN")}`, 200, 26, { align: "right" });

                if (!records || records.length === 0) {
                    // No records from API – pull from local Google Sheet summary instead
                    const cloudData = await loadRemoteJson(`${scriptURL}?action=getSummary`);
                    const fromTs = new Date(fromDate);
                    const toTs = new Date(toDate);
                    toTs.setHours(23, 59, 59, 999);

                    const filtered = (Array.isArray(cloudData) ? cloudData : []).filter((u) => {
                        if (!u.date) return false;
                        const candidates = getProgressDateCandidates(u.date);
                        return candidates.some((c) => {
                            const parts = c.split("/");
                            if (parts.length !== 3) return false;
                            const d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                            return d >= fromTs && d <= toTs;
                        });
                    });

                    // Group by DC
                    const dcMap = {};
                    filtered.forEach((u) => {
                        const dc = (u.dc || "UNKNOWN").toUpperCase();
                        if (!dcMap[dc]) dcMap[dc] = [];
                        dcMap[dc].push(u);
                    });

                    // Summary table
                    const summaryBody = Object.entries(dcMap).map(([dc, rows], i) => [
                        i + 1, dc, rows.length
                    ]);
                    summaryBody.push(["", "GRAND TOTAL", filtered.length]);

                    doc.autoTable({
                        startY: 30,
                        head: [["S.No.", "DC NAME", "MOBILE UPDATED COUNT"]],
                        body: summaryBody,
                        theme: "grid",
                        headStyles: { fillColor: [239, 68, 68], textColor: 255, halign: "center", fontStyle: "bold" },
                        columnStyles: { 0: { halign: "center", cellWidth: 15 }, 1: { halign: "left" }, 2: { halign: "center" } },
                        footStyles: { fillColor: [241, 245, 249] },
                        didParseCell(data) {
                            if (data.section === "body" && data.row.index === summaryBody.length - 1) {
                                data.cell.styles.fontStyle = "bold";
                                data.cell.styles.textColor = [190, 18, 60];
                                data.cell.styles.fillColor = [254, 226, 226];
                            }
                        }
                    });

                    // Detail table
                    if (filtered.length > 0) {
                        const detailY = doc.lastAutoTable.finalY + 8;
                        doc.setFontSize(9);
                        doc.setTextColor(30, 58, 138);
                        doc.setFont(undefined, "bold");
                        doc.text("DETAIL RECORDS", 14, detailY);

                        const detailBody = filtered.map((u, i) => [
                            i + 1,
                            u.ivrs || "",
                            u.name || "",
                            (u.old_mobile || u.old || "N/A"),
                            u.correct_mobile || "",
                            (u.dc || "").toUpperCase(),
                            u.date || ""
                        ]);

                        doc.autoTable({
                            startY: detailY + 4,
                            head: [["S.No.", "IVRS NO", "CONSUMER NAME", "OLD MOBILE", "NEW MOBILE", "DC", "DATE"]],
                            body: detailBody,
                            theme: "striped",
                            headStyles: { fillColor: [30, 58, 138], textColor: 255, halign: "center", fontSize: 7, fontStyle: "bold" },
                            bodyStyles: { fontSize: 7 },
                            columnStyles: {
                                0: { halign: "center", cellWidth: 10 },
                                1: { halign: "center", cellWidth: 22 },
                                2: { halign: "left", cellWidth: 38 },
                                3: { halign: "center", cellWidth: 22 },
                                4: { halign: "center", cellWidth: 22 },
                                5: { halign: "center", cellWidth: 24 },
                                6: { halign: "center", cellWidth: 22 }
                            }
                        });
                    }
                } else {
                    // Records came from mpezccc API
                    const dcMap = {};
                    records.forEach((u) => {
                        const dc = (u.dc_name || u.dc || u.DC || "UNKNOWN").toUpperCase();
                        if (!dcMap[dc]) dcMap[dc] = [];
                        dcMap[dc].push(u);
                    });

                    const summaryBody = Object.entries(dcMap).map(([dc, rows], i) => [i + 1, dc, rows.length]);
                    summaryBody.push(["", "GRAND TOTAL", records.length]);

                    doc.autoTable({
                        startY: 30,
                        head: [["S.No.", "DC NAME", "MOBILE UPDATED COUNT"]],
                        body: summaryBody,
                        theme: "grid",
                        headStyles: { fillColor: [239, 68, 68], textColor: 255, halign: "center", fontStyle: "bold" },
                        columnStyles: { 0: { halign: "center", cellWidth: 15 }, 1: { halign: "left" }, 2: { halign: "center" } },
                        didParseCell(data) {
                            if (data.section === "body" && data.row.index === summaryBody.length - 1) {
                                data.cell.styles.fontStyle = "bold";
                                data.cell.styles.textColor = [190, 18, 60];
                                data.cell.styles.fillColor = [254, 226, 226];
                            }
                        }
                    });

                    const detailY = doc.lastAutoTable.finalY + 8;
                    doc.setFontSize(9);
                    doc.setTextColor(30, 58, 138);
                    doc.setFont(undefined, "bold");
                    doc.text("DETAIL RECORDS", 14, detailY);

                    const detailBody = records.map((u, i) => [
                        i + 1,
                        u.ivrs_no || u.ivrs || u.IVRS || "",
                        u.consumer_name || u.name || u.NAME || "",
                        u.old_mobile || u.OLD_MOBILE || "N/A",
                        u.new_mobile || u.correct_mobile || u.NEW_MOBILE || "",
                        (u.dc_name || u.dc || u.DC || "").toUpperCase(),
                        u.date || u.DATE || u.updated_date || ""
                    ]);

                    doc.autoTable({
                        startY: detailY + 4,
                        head: [["S.No.", "IVRS NO", "CONSUMER NAME", "OLD MOBILE", "NEW MOBILE", "DC", "DATE"]],
                        body: detailBody,
                        theme: "striped",
                        headStyles: { fillColor: [30, 58, 138], textColor: 255, halign: "center", fontSize: 7, fontStyle: "bold" },
                        bodyStyles: { fontSize: 7 },
                        columnStyles: {
                            0: { halign: "center", cellWidth: 10 },
                            1: { halign: "center", cellWidth: 22 },
                            2: { halign: "left", cellWidth: 38 },
                            3: { halign: "center", cellWidth: 22 },
                            4: { halign: "center", cellWidth: 22 },
                            5: { halign: "center", cellWidth: 24 },
                            6: { halign: "center", cellWidth: 22 }
                        }
                    });
                }

                // Footer on all pages
                const totalPages = doc.internal.getNumberOfPages();
                for (let i = 1; i <= totalPages; i++) {
                    doc.setPage(i);
                    doc.setFontSize(7);
                    doc.setTextColor(150);
                    doc.text(`Page ${i} of ${totalPages}  |  SEONI CIRCLE - Mobile No Update MIS Report`, 105, 290, { align: "center" });
                }

                const filename = `MIS_Mobile_Update_${fmtDate(fromDate).replace(/\//g,"-")}_to_${fmtDate(toDate).replace(/\//g,"-")}.pdf`;
                doc.save(filename);
                showToast("PDF Downloaded!", true);
            } catch(e) {
                showToast("Report generate karne mein error aaya", false);
            } finally {
                btn.innerHTML = '<svg width="16" height="16" fill="white" viewBox="0 0 24 24"><path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm10 5.5h1v-3h-1v3z"/></svg> Download PDF MIS Report';
                btn.disabled = false;
            }
        }


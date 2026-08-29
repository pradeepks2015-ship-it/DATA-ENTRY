        async function ensureConsumerDataLoadedFor(dcNames) {
            const list = Array.from(new Set((dcNames || []).map((name) => normalizeDcName(name)).filter(Boolean)));
            await Promise.all(list.map(async (dcName) => {
                if (dcCacheRows[dcName]?.length) return;
                await ensureDcDataLoaded(dcName);
            }));
        }

        function setProgressModule(module) {
            summaryModule = module;
            document.getElementById("progress-mobile-btn").classList.toggle("active", module === "MOBILE");
            refreshSummary();
        }

        function parseSummarySelection(rawValue, mode) {
            const raw = String(rawValue || "").trim();
            if (!raw) return { daily: "", monthly: "", label: "" };

            if (mode === "DAILY") {
                if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
                    const [y, m, d] = raw.split("-");
                    return {
                        daily: `${d}/${m}/${y}`,
                        monthly: `${m}/${y}`,
                        label: `${d}/${m}/${y}`
                    };
                }
                const normalized = normalizeProgressDateValue(raw);
                const parts = normalized.split("/");
                return {
                    daily: normalized,
                    monthly: parts.length === 3 ? `${parts[1]}/${parts[2]}` : "",
                    label: normalized
                };
            }

            if (/^\d{4}-\d{2}$/.test(raw)) {
                const [y, m] = raw.split("-");
                return { daily: "", monthly: `${m}/${y}`, label: `${m}/${y}` };
            }

            const monthNameMatch = raw.match(/^([A-Za-z]+),\s*(\d{4})$/);
            if (monthNameMatch) {
                const months = {
                    january: "01", february: "02", march: "03", april: "04", may: "05", june: "06",
                    july: "07", august: "08", september: "09", october: "10", november: "11", december: "12",
                    jan: "01", feb: "02", mar: "03", apr: "04", jun: "06", jul: "07", aug: "08",
                    sep: "09", oct: "10", nov: "11", dec: "12"
                };
                const month = months[monthNameMatch[1].toLowerCase()] || "";
                const year = monthNameMatch[2];
                return { daily: "", monthly: month ? `${month}/${year}` : "", label: month ? `${month}/${year}` : raw };
            }

            return { daily: "", monthly: "", label: raw };
        }

        async function refreshSummary() {
            const refreshToken = ++summaryRefreshToken;
            const cont = document.getElementById("summary-content");
            cont.innerHTML = '<p class="text-center py-10 animate-pulse font-black text-slate-400">SYNCING ALL DC DATA...</p>';
            const raw = document.getElementById("report-date").value;
            if (!raw) return;
            const parsedSummarySelection = parseSummarySelection(raw, summaryMode);
            const dStr = parsedSummarySelection.daily;
            const mStr = parsedSummarySelection.monthly;
            const label = parsedSummarySelection.label;

            try {
                const targetMobileDcs = activeViewLevel === "DC"
                    ? [activeDC]
                    : (activeViewLevel === "DIVISION" ? getDivisionDcNames(activeDiv) : getAllDcNames());
                await ensureConsumerDataLoadedFor(targetMobileDcs);
                if (refreshToken !== summaryRefreshToken) return; // ek naya refreshSummary() beech me shuru ho chuka hai
                const cloudData = await loadRemoteJson(`${scriptURL}?action=getSummary&auth_token=${encodeURIComponent(APPS_SCRIPT_AUTH_TOKEN)}`);
                if (refreshToken !== summaryRefreshToken) return; // isi tarah — is purani response ko discard karo
                uiListSummary = [];
                grandTC = 0;
                grandTU = 0;

                const getStats = (dcName) => {
                    let tu = 0;
                    const normDc = normalizeDcName(dcName);
                    const tc = getConsumerRows(normDc).length;
                    cloudData.forEach((u) => {
                        const ts = (u.date || "").trim();
                        const uDc = (u.dc || "").trim().toUpperCase();
                        const mobileVal = u.correct_mobile || "";
                        const hasMobile = mobileVal.toString().trim().length === 10;
                        const matchesDate = matchesProgressDate(ts, summaryMode, dStr, mStr);
                        if (uDc === normDc && hasMobile && matchesDate) tu++;
                    });
                    return { tc, tu };
                };

                if (activeViewLevel === "DC") {
                    const stats = {};
                    getConsumerRows(activeDC).forEach((row) => {
                        const h = getConsumerField(row, ["HQ", "HQ NAME", "HEADQUARTER", "HEAD QUARTER", "H.Q."], "GENERAL").trim().toUpperCase() || "GENERAL";
                        stats[h] = stats[h] || { tc: 0, tu: 0 };
                        stats[h].tc++;
                    });
                    cloudData.forEach((u) => {
                        const ts = (u.date || "").trim();
                        const uDc = (u.dc || "").trim().toUpperCase();
                        const uHq = (u.hq || "GENERAL").trim().toUpperCase();
                        const mobileVal = u.correct_mobile || "";
                        const hasMobile = mobileVal.toString().trim().length === 10;
                        const matchesDate = matchesProgressDate(ts, summaryMode, dStr, mStr);
                        if (uDc === normalizeDcName(activeDC) && hasMobile && matchesDate) {
                            if (!stats[uHq]) stats[uHq] = { tc: 0, tu: 0 };
                            stats[uHq].tu++;
                        }
                    });
                    Object.keys(stats).sort().forEach((h) => {
                        uiListSummary.push({ name: h, tc: stats[h].tc, tu: stats[h].tu });
                        grandTC += stats[h].tc;
                        grandTU += stats[h].tu;
                    });
                } else {
                    const targetDivs = activeViewLevel === "DIVISION" ? [activeDiv] : Object.keys(divisionConfigs);
                    targetDivs.forEach((div) => {
                        let divTC = 0;
                        let divTU = 0;
                        getDivisionDcNames(div).forEach((dc) => {
                            const s = getStats(dc);
                            uiListSummary.push({ name: dc, tc: s.tc, tu: s.tu });
                            divTC += s.tc;
                            divTU += s.tu;
                        });
                        if (activeViewLevel === "CIRCLE") uiListSummary.push({ name: `${div} TOTAL`, tc: divTC, tu: divTU, type: "DIV_TOTAL" });
                        grandTC += divTC;
                        grandTU += divTU;
                    });
                }

                const colLabel = activeViewLevel === "DC" ? "HQ NAME" : "DC NAME";
                let html = `<div class="summary-wrapper"><div class="summary-table-header"><div>${colLabel}</div><div>TOTAL CONS.</div><div>UPDATED MOBILE NO</div></div>`;
                uiListSummary.forEach((r) => {
                    html += `<div class="summary-table-row ${r.type === "DIV_TOTAL" ? "blue-bold" : ""}"><div>${escapeHtml(r.name)}</div><div>${r.tc}</div><div class="text-teal-600 font-black">${r.tu}</div></div>`;
                });

                html += `</div><div class="summary-footer"><div class="flex justify-between font-black"><span>GRAND TOTAL (${label})</span><span class="text-rose-600 text-lg">${grandTU}</span></div>
                    <div class="btn-export-row">
                        <button class="btn-unique btn-excel-unique" onclick="doExport('XLS')">
                            <svg width="18" height="18" fill="white" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16h-8v-2h8v2zm0-4h-8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
                            Excel Report
                        </button>
                        <button class="btn-unique btn-pdf-unique" onclick="doExport('PDF')">
                            <svg width="18" height="18" fill="white" viewBox="0 0 24 24"><path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm10 5.5h1v-3h-1v3z"/></svg>
                            PDF Report
                        </button>
                    </div>
                </div>`;
                cont.innerHTML = trustedHtml_(html);
            } catch (e) {
                cont.innerHTML = '<p class="text-center text-red-500 py-10 font-black">ERROR FETCHING DATA</p>';
            }
        }

        function getFormattedDate(rawDate, mode) {
            if (!rawDate) return "";
            if (mode === "DAILY") {
                const [y, m, d] = rawDate.split("-");
                return `${d}/${m}/${y}`;
            }
            const [y, m] = rawDate.split("-");
            const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
            return `${months[parseInt(m, 10) - 1]}-${y}`;
        }

        function getProgressDateCandidates(rawValue) {
            const raw = String(rawValue || "").trim();
            if (!raw) return [];

            const candidates = new Set();
            const addCandidate = (day, month, year) => {
                const d = String(day || "").padStart(2, "0");
                const m = String(month || "").padStart(2, "0");
                const y = String(year || "").trim();
                if (!d || !m || !y || y.length !== 4) return;
                candidates.add(`${d}/${m}/${y}`);
            };

            if (/^\d{2}[/-]\d{2}[/-]\d{4}$/.test(raw)) {
                const [a, b, y] = raw.split(/[/-]/);
                addCandidate(a, b, y);
                addCandidate(b, a, y);
            }

            if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
                const [y, m, d] = raw.split("-");
                addCandidate(d, m, y);
            }

            const parsedDate = new Date(raw);
            if (!Number.isNaN(parsedDate.getTime())) {
                addCandidate(parsedDate.getDate(), parsedDate.getMonth() + 1, parsedDate.getFullYear());
            }

            if (!candidates.size && raw.includes("/")) {
                candidates.add(raw);
            }

            return Array.from(candidates);
        }

        function normalizeProgressDateValue(rawValue) {
            return getProgressDateCandidates(rawValue)[0] || "";
        }

        function matchesProgressDate(rawValue, mode, dailyValue, monthlyValue) {
            const candidates = getProgressDateCandidates(rawValue);
            if (!candidates.length) return false;
            if (mode === "DAILY") return candidates.includes(dailyValue);
            return candidates.some((normalized) => {
                const parts = normalized.split("/");
                if (parts.length !== 3) return false;
                return `${parts[1]}/${parts[2]}` === monthlyValue;
            });
        }


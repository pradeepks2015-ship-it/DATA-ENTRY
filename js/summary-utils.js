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
                const cloudData = await loadRemoteJson(`${scriptURL}?action=getSummary`);
                uiListSummary = [];
                grandTC = 0;
                grandTU = 0;

                const getStats = (dcName) => {
                    let tc = 0;
                    let tu = 0;
                    const normDc = normalizeDcName(dcName);
                    tc = getConsumerRows(normDc).length;
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
                    html += `<div class="summary-table-row ${r.type === "DIV_TOTAL" ? "blue-bold" : ""}"><div>${r.name}</div><div>${r.tc}</div><div class="text-teal-600 font-black">${r.tu}</div></div>`;
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
                cont.innerHTML = html;
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

        function getCurrentDateDDMMYYYY() {
            const date = new Date();
            const day = String(date.getDate()).padStart(2, "0");
            const month = String(date.getMonth() + 1).padStart(2, "0");
            const year = date.getFullYear();
            return `${day}-${month}-${year}`;
        }

        function getTodayIsoDate() {
            const date = new Date();
            const day = String(date.getDate()).padStart(2, "0");
            const month = String(date.getMonth() + 1).padStart(2, "0");
            const year = date.getFullYear();
            return `${year}-${month}-${day}`;
        }

        function getTodayFeederDisplayDate() {
            return getCurrentDateDDMMYYYY().replace(/-/g, "/");
        }

        function formatFeederDisplayDateFromIso(isoValue) {
            const raw = String(isoValue || "").trim();
            if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return getTodayFeederDisplayDate();
            const [year, month, day] = raw.split("-");
            return `${day}/${month}/${year}`;
        }

        function syncFeederDateInputs(isoValue) {
            const displayLabel = document.getElementById("feeder-reading-date-label");
            const safeIso = /^\d{4}-\d{2}-\d{2}$/.test(String(isoValue || "").trim()) ? String(isoValue).trim() : getTodayIsoDate();
            if (displayLabel) {
                displayLabel.innerText = formatFeederDisplayDateFromIso(safeIso);
            }
            const [year, month, day] = safeIso.split("-");
            const daySelect = document.getElementById("feeder-date-day");
            const monthSelect = document.getElementById("feeder-date-month");
            const yearSelect = document.getElementById("feeder-date-year");
            if (daySelect) daySelect.value = String(Number(day));
            if (monthSelect) monthSelect.value = String(Number(month));
            if (yearSelect) yearSelect.value = year;
            const dateButton = document.getElementById("feeder-reading-date");
            if (dateButton) {
                dateButton.dataset.iso = safeIso;
            }
        }

        function populateFeederDatePickerOptions() {
            const daySelect = document.getElementById("feeder-date-day");
            const monthSelect = document.getElementById("feeder-date-month");
            const yearSelect = document.getElementById("feeder-date-year");
            if (!daySelect || !monthSelect || !yearSelect) return;
            if (!daySelect.innerHTML) {
                daySelect.innerHTML = Array.from({ length: 31 }, (_, index) => {
                    const value = index + 1;
                    return `<option value="${value}">${String(value).padStart(2, "0")}</option>`;
                }).join("");
            }
            if (!monthSelect.innerHTML) {
                monthSelect.innerHTML = Array.from({ length: 12 }, (_, index) => {
                    const value = index + 1;
                    return `<option value="${value}">${String(value).padStart(2, "0")}</option>`;
                }).join("");
            }
            if (!yearSelect.innerHTML) {
                const currentYear = new Date().getFullYear();
                yearSelect.innerHTML = [currentYear - 1, currentYear, currentYear + 1]
                    .map((year) => `<option value="${year}">${year}</option>`)
                    .join("");
            }
        }

        function toggleFeederDatePicker(forceState) {
            const menu = document.getElementById("feeder-reading-date-menu");
            const trigger = document.getElementById("feeder-reading-date");
            if (!menu || !trigger) return;
            const shouldShow = typeof forceState === "boolean" ? forceState : !menu.classList.contains("show");
            if (shouldShow) {
                populateFeederDatePickerOptions();
                menu.classList.add("show");
                trigger.classList.add("active");
            } else {
                menu.classList.remove("show");
                trigger.classList.remove("active");
            }
        }

        function applyFeederDateSelection() {
            const daySelect = document.getElementById("feeder-date-day");
            const monthSelect = document.getElementById("feeder-date-month");
            const yearSelect = document.getElementById("feeder-date-year");
            if (!daySelect || !monthSelect || !yearSelect) return;
            const day = String(daySelect.value || "").padStart(2, "0");
            const month = String(monthSelect.value || "").padStart(2, "0");
            const year = String(yearSelect.value || "").trim();
            if (!day || !month || !year) return;
            syncFeederDateInputs(`${year}-${month}-${day}`);
            toggleFeederDatePicker(false);
            if (selectedFeederSubstation) {
                renderFeederRows();
            }
        }

        function formatFeederEntryDate(dateValue) {
            const raw = String(dateValue || "").trim();
            if (!raw) return getCurrentDateDDMMYYYY();
            if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
                const [year, month, day] = raw.split("-");
                return `${day}-${month}-${year}`;
            }
            if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
                return raw.replace(/\//g, "-");
            }
            const normalized = normalizeFeederDateInput(raw);
            if (/^\d{2}\/\d{2}\/\d{4}$/.test(normalized)) {
                return normalized.replace(/\//g, "-");
            }
            return raw.replace(/\//g, "-");
        }

        function buildFeederDateKey_(value) {
            const raw = String(value || "").trim();
            if (!raw) return "";
            if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
            const normalized = raw.replace(/\//g, "-");
            if (/^\d{2}-\d{2}-\d{4}$/.test(normalized)) {
                const [day, month, year] = normalized.split("-");
                return `${year}-${month}-${day}`;
            }
            const parsed = new Date(raw);
            if (!Number.isNaN(parsed.getTime())) {
                const day = String(parsed.getDate()).padStart(2, "0");
                const month = String(parsed.getMonth() + 1).padStart(2, "0");
                const year = parsed.getFullYear();
                return `${year}-${month}-${day}`;
            }
            return "";
        }

        function formatFeederDateLabelFromKey_(dateKey) {
            const raw = String(dateKey || "").trim();
            const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (!match) return raw;
            return `${match[3]}-${match[2]}-${match[1]}`;
        }

        function normalizeFeederSubstationKey_(value) {
            return String(value || "").replace(/\s+/g, " ").trim().toUpperCase();
        }

        function getRecentFeederSubmittedEntries_() {
            return Array.isArray(feederRecentSubmittedEntries) ? feederRecentSubmittedEntries : [];
        }

        function loadRecentFeederSubmittedEntries_() {
            try {
                const raw = localStorage.getItem(feederRecentSubmittedStorageKey);
                const parsed = JSON.parse(raw || "[]");
                feederRecentSubmittedEntries = Array.isArray(parsed) ? parsed.slice(-500) : [];
            } catch (_) {
                feederRecentSubmittedEntries = [];
            }
        }

        function persistRecentFeederSubmittedEntries_() {
            try {
                localStorage.setItem(feederRecentSubmittedStorageKey, JSON.stringify(getRecentFeederSubmittedEntries_().slice(-500)));
            } catch (_) {}
        }

        function saveRecentFeederSubmittedEntries_(entries) {
            if (!Array.isArray(entries) || !entries.length) return;
            const nextEntries = getRecentFeederSubmittedEntries_().concat(entries);
            const deduped = [];
            const seen = new Set();
            nextEntries.slice().reverse().forEach((entry) => {
                const key = [
                    normalizeFeederSubstationKey_(entry["33/11 KV SUBSTATION"] || entry.substation || ""),
                    String(entry["33 AND 11 KV FEEDER"] || entry.feeder || "").trim().toUpperCase(),
                    buildFeederDateKey_(entry["DATE(DD/MM/YYY)"] || entry.date || ""),
                    String(entry["TIME(HH/MM)"] || entry.time || "").trim(),
                    String(entry["DC NAME"] || entry.dc_name || "").trim().toUpperCase()
                ].join("|");
                if (!key || seen.has(key)) return;
                seen.add(key);
                deduped.unshift(entry);
            });
            feederRecentSubmittedEntries = deduped.slice(-500);
            persistRecentFeederSubmittedEntries_();
        }

        function getFeederSelectedDateKey_() {
            const dateButton = document.getElementById("feeder-reading-date");
            return buildFeederDateKey_(dateButton?.dataset.iso || "");
        }

        function getAllFeederHistoryEntries_() {
            const sheetRows = Array.isArray(feederReportRows) ? feederReportRows : [];
            const localRows = getRecentFeederSubmittedEntries_();
            return [...sheetRows, ...localRows];
        }

        function getFeederSubmittedEntriesForDate_(substation, selectedDateKey) {
            const substationKey = normalizeFeederSubstationKey_(substation || "");
            const targetKey = String(selectedDateKey || "").trim();
            if (!substationKey || !targetKey) return [];
            return getAllFeederHistoryEntries_().filter((entry) => {
                const entrySubstationKey = normalizeFeederSubstationKey_(entry["33/11 KV SUBSTATION"] || entry.substation || "");
                const entryDateKey = buildFeederDateKey_(entry["DATE(DD/MM/YYY)"] || entry["DATE(DD/MM/YYYY)"] || entry.date || "");
                return entrySubstationKey === substationKey && entryDateKey === targetKey;
            });
        }

        // Tracks feeder+date combos that the user has manually "unfrozen" for re-entry
        // in the current session (key format: substationKey|feederKey|dateKey)
        const unfrozenFeederEntries = new Set();

        function buildFeederUnfreezeKey_(substation, feeder, dateKey) {
            return [
                normalizeFeederSubstationKey_(substation || ""),
                String(feeder || "").trim().toUpperCase(),
                String(dateKey || "").trim()
            ].join("|");
        }

        function unfreezeFeederEntryConfirm_(substation, feeder, dateKey) {
            const existing = document.getElementById("feeder-unfreeze-overlay");
            if (existing) existing.remove();

            const overlay = document.createElement("div");
            overlay.id = "feeder-unfreeze-overlay";
            overlay.style.cssText = "position:fixed; inset:0; background:rgba(0,0,0,0.55); z-index:9999; display:flex; align-items:center; justify-content:center; padding:20px;";

            const card = document.createElement("div");
            card.style.cssText = "background:#ffffff; border-radius:18px; padding:18px; width:100%; max-width:320px; box-shadow:0 12px 30px rgba(0,0,0,0.25); text-align:center;";
            card.innerHTML = `
                <div style="font-size:14px; font-weight:900; color:#92400e; text-transform:uppercase; margin-bottom:10px;">Reading Edit Karein?</div>
                <div style="font-size:12px; font-weight:700; color:#475569; margin-bottom:6px;">
                    "${escapeHtml(feeder)}" ki ${escapeHtml(formatFeederDateLabelFromKey_(dateKey))} ki reading unfreeze ho jayegi aur aap nayi reading dobara entry kar sakenge.
                </div>
                <div style="font-size:11px; font-weight:700; color:#b91c1c; margin-bottom:16px;">
                    Note: Submit karne par ek nayi (corrected) entry add hogi. Agar MIS report me purani entry bhi dikhe to use Google Sheet se manually delete karwana padega.
                </div>
                <div style="display:flex; gap:10px;">
                    <button onclick="document.getElementById('feeder-unfreeze-overlay').remove()" style="flex:1; height:44px; border:none; border-radius:12px; background:#e2e8f0; color:#1e293b; font-size:12px; font-weight:900; text-transform:uppercase;">Cancel</button>
                    <button onclick="confirmUnfreezeFeederEntry_('${escapeHtml(substation)}', '${escapeHtml(feeder)}', '${dateKey}')" style="flex:1; height:44px; border:none; border-radius:12px; background:#f59e0b; color:#fff; font-size:12px; font-weight:900; text-transform:uppercase;">Unfreeze</button>
                </div>
            `;
            overlay.appendChild(card);
            overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
            document.body.appendChild(overlay);
        }

        function confirmUnfreezeFeederEntry_(substation, feeder, dateKey) {
            const overlay = document.getElementById("feeder-unfreeze-overlay");
            if (overlay) overlay.remove();

            // Mark this feeder+date as unfrozen for the current session
            unfrozenFeederEntries.add(buildFeederUnfreezeKey_(substation, feeder, dateKey));

            // Remove the cached local entry for this feeder+date so it doesn't
            // re-lock the fields (the remote sheet copy still exists for history).
            const substationKey = normalizeFeederSubstationKey_(substation || "");
            const feederKey = String(feeder || "").trim().toUpperCase();
            feederRecentSubmittedEntries = getRecentFeederSubmittedEntries_().filter((entry) => {
                const entrySubstationKey = normalizeFeederSubstationKey_(entry["33/11 KV SUBSTATION"] || entry.substation || "");
                const entryFeederKey = String(entry["33 AND 11 KV FEEDER"] || entry.feeder || "").trim().toUpperCase();
                const entryDateKey = buildFeederDateKey_(entry["DATE(DD/MM/YYY)"] || entry.date || "");
                const isMatch = entrySubstationKey === substationKey && entryFeederKey === feederKey && entryDateKey === dateKey;
                return !isMatch;
            });
            persistRecentFeederSubmittedEntries_();

            showToast("Reading unfreeze ho gayi - ab nayi reading entry karein", true);
            renderFeederRows();
        }

        function getFeederSubmittedRowForDate_(row, selectedDateKey) {
            const targetKey = String(selectedDateKey || "").trim();
            if (!row || !targetKey) return null;
            const substationKey = normalizeFeederSubstationKey_(row.substation || "");
            const feederKey = String(row.feeder || "").trim().toUpperCase();
            if (unfrozenFeederEntries.has(buildFeederUnfreezeKey_(row.substation, row.feeder, targetKey))) {
                return null;
            }
            const matchedEntries = getFeederSubmittedEntriesForDate_(row.substation || "", targetKey)
                .filter((entry) => {
                    const entrySubstationKey = normalizeFeederSubstationKey_(entry["33/11 KV SUBSTATION"] || entry.substation || "");
                    const entryFeederKey = String(entry["33 AND 11 KV FEEDER"] || entry.feeder || "").trim().toUpperCase();
                    return entrySubstationKey === substationKey && entryFeederKey === feederKey;
                })
                .sort((a, b) => {
                    const aTime = String(a["TIME(HH/MM)"] || a["TIME(HH:MM)"] || a.time || "");
                    const bTime = String(b["TIME(HH/MM)"] || b["TIME(HH:MM)"] || b.time || "");
                    return aTime.localeCompare(bTime);
                });
            return matchedEntries.length ? matchedEntries[matchedEntries.length - 1] : null;
        }

        function getFeederAutoPreviousReading_(row, selectedDateKey) {
            const targetKey = String(selectedDateKey || "").trim();
            if (!row || !targetKey) return "";
            const substationKey = normalizeFeederSubstationKey_(row.substation || "");
            const feederKey = String(row.feeder || "").trim().toUpperCase();
            const matchedEntries = getAllFeederHistoryEntries_()
                .filter((entry) => {
                    const entrySubstationKey = normalizeFeederSubstationKey_(entry["33/11 KV SUBSTATION"] || entry.substation || "");
                    const entryFeederKey = String(entry["33 AND 11 KV FEEDER"] || entry.feeder || "").trim().toUpperCase();
                    const entryDateKey = buildFeederDateKey_(entry["DATE(DD/MM/YYY)"] || entry["DATE(DD/MM/YYYY)"] || entry.date || "");
                    return entrySubstationKey === substationKey && entryFeederKey === feederKey && entryDateKey && entryDateKey < targetKey;
                })
                .sort((a, b) => {
                    const aDateKey = buildFeederDateKey_(a["DATE(DD/MM/YYY)"] || a["DATE(DD/MM/YYYY)"] || a.date || "");
                    const bDateKey = buildFeederDateKey_(b["DATE(DD/MM/YYY)"] || b["DATE(DD/MM/YYYY)"] || b.date || "");
                    if (aDateKey !== bDateKey) return aDateKey.localeCompare(bDateKey);
                    const aTime = String(a["TIME(HH/MM)"] || a["TIME(HH:MM)"] || a.time || "");
                    const bTime = String(b["TIME(HH/MM)"] || b["TIME(HH:MM)"] || b.time || "");
                    return aTime.localeCompare(bTime);
                });
            const latest = matchedEntries[matchedEntries.length - 1];
            return latest ? String(latest["CURRENT READING"] || latest.current_reading || "").trim() : "";
        }

        // ===== Monthly Progressive Consumption (month-start to selected date) =====
        function getFeederEntriesForFeederKey_(substationKey, feederKey) {
            return getAllFeederHistoryEntries_().filter((entry) => {
                const entrySubstationKey = normalizeFeederSubstationKey_(entry["33/11 KV SUBSTATION"] || entry.substation || "");
                const entryFeederKey = String(entry["33 AND 11 KV FEEDER"] || entry.feeder || "").trim().toUpperCase();
                return entrySubstationKey === substationKey && entryFeederKey === feederKey;
            });
        }

        // Returns { monthStartPrevious, latestCurrent, mf, consumption, hasData } for a given
        // feeder row, considering all entries within the same month (and year) as selectedDateKey,
        // up to and including selectedDateKey.
        function getFeederMonthlyProgress_(row, selectedDateKey) {
            const targetKey = String(selectedDateKey || "").trim();
            const result = { monthStartPrevious: null, latestCurrent: null, mf: Number(row?.mf || 0), consumption: 0, hasData: false };
            if (!row || !targetKey) return result;
            const monthPrefix = targetKey.slice(0, 7); // "YYYY-MM"
            const substationKey = normalizeFeederSubstationKey_(row.substation || "");
            const feederKey = String(row.feeder || "").trim().toUpperCase();

            const monthEntries = getFeederEntriesForFeederKey_(substationKey, feederKey)
                .map((entry) => ({
                    dateKey: buildFeederDateKey_(entry["DATE(DD/MM/YYY)"] || entry["DATE(DD/MM/YYYY)"] || entry.date || ""),
                    time: String(entry["TIME(HH/MM)"] || entry["TIME(HH:MM)"] || entry.time || ""),
                    previous: Number(entry["PREVIUS READING"] || entry.previous_reading || 0),
                    current: Number(entry["CURRENT READING"] || entry.current_reading || 0)
                }))
                .filter((e) => e.dateKey && e.dateKey.slice(0, 7) === monthPrefix && e.dateKey <= targetKey)
                .sort((a, b) => {
                    if (a.dateKey !== b.dateKey) return a.dateKey.localeCompare(b.dateKey);
                    return a.time.localeCompare(b.time);
                });

            if (!monthEntries.length) return result;

            result.monthStartPrevious = monthEntries[0].previous;
            result.latestCurrent = monthEntries[monthEntries.length - 1].current;
            result.hasData = true;
            const diff = result.latestCurrent - result.monthStartPrevious;
            result.consumption = Number((diff * result.mf).toFixed(2));
            return result;
        }

        function getMonthYearLabel_(dateKey) {
            const match = String(dateKey || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (!match) return "";
            const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
            const monthIdx = Number(match[2]) - 1;
            return `${months[monthIdx] || match[2]} ${match[1]}`;
        }

        // Substations that have a "33/11 KV ... SS Consumption" resultant calculated from
        // 33 KV incoming feeder meters (sum of progressive consumption of those meters).
        const SUBSTATION_33KV_INCOMING_CONFIG = {
            ADEGAON: {
                label: "33/11KV ADEGAON SS CONSUMPTION",
                meters: ["BS12775548", "BS12775550", "BS12776133"],
                // Total Resultant Consumption sirf is meter ka dikhana hai (baaki
                // meters card me dikhte rahenge, par total me nahi judenge)
                resultantMeter: "BS12775548"
            },
            MADHI: {
                label: "33/11KV MADHI SS CONSUMPTION",
                meters: ["BS12775543"]
            }
        };

        function renderFeederProgressivePanel_(rows, selectedDateKey) {
            const panel = document.getElementById("feeder-progressive-panel");
            if (!panel) return;
            if (!rows.length || !selectedDateKey) {
                panel.innerHTML = "";
                return;
            }

            const monthLabel = getMonthYearLabel_(selectedDateKey);
            const monthPrefix = selectedDateKey.slice(0, 7);
            const fromLabel = `01-${monthPrefix.slice(5,7)}-${monthPrefix.slice(0,4)}`;
            const toLabel = formatFeederDateLabelFromKey_(selectedDateKey);

            // Determine if this substation has any 11KV feeders
            const elevenKvRows = rows.filter((row) => !String(row.feederType || "").includes("33"));
            const thirtyThreeKvOnlySubstation = elevenKvRows.length === 0;
            const displayRows = thirtyThreeKvOnlySubstation
                ? rows.filter((row) => String(row.feederType || "").includes("33"))
                : elevenKvRows;
            const kvLabel = thirtyThreeKvOnlySubstation ? "33 KV Feeders" : "11 KV Feeders";

            let totalConsumption = 0;
            let anyData = false;
            const feederLines = displayRows.map((row) => {
                const progress = getFeederMonthlyProgress_(row, selectedDateKey);
                if (progress.hasData) {
                    anyData = true;
                    totalConsumption += progress.consumption;
                }
                const valueText = progress.hasData
                    ? `${formatChhaparaNumber(progress.monthStartPrevious)} → ${formatChhaparaNumber(progress.latestCurrent)} | MF: ${formatChhaparaNumber(progress.mf)} | <strong>${formatChhaparaNumber(progress.consumption)}</strong>`
                    : `Is mahine ka data nahi mila`;
                return `
                    <div style="display:flex; flex-direction:column; gap:2px; padding:8px 0; border-bottom:1px solid #f1f5f9;">
                        <div style="font-size:11px; font-weight:900; color:#1e293b; text-transform:uppercase;">${escapeHtml(row.feeder)}</div>
                        <div style="font-size:11px; font-weight:700; color:#475569;">${valueText}</div>
                    </div>
                `;
            }).join("");

            // 33 KV incoming resultant consumption for ADEGAON / MADHI
            const incomingConfig = SUBSTATION_33KV_INCOMING_CONFIG[selectedFeederSubstation];
            let incomingHtml = "";
            if (incomingConfig) {
                const allRowsForSubstation = feederRows.filter((r) => r.substation === selectedFeederSubstation);
                let incomingTotal = 0;
                let incomingHasData = false;
                const incomingMeterConsumption = {};
                const incomingLines = incomingConfig.meters.map((meterNo) => {
                    const meterRow = allRowsForSubstation.find((r) => String(r.meterNo || "").trim().toUpperCase() === meterNo.toUpperCase());
                    if (!meterRow) {
                        return `<div style="font-size:11px; font-weight:700; color:#94a3b8;">${escapeHtml(meterNo)}: Feeder configured nahi hai</div>`;
                    }
                    const progress = getFeederMonthlyProgress_(meterRow, selectedDateKey);
                    if (progress.hasData) {
                        incomingHasData = true;
                        incomingTotal += progress.consumption;
                        incomingMeterConsumption[meterNo.toUpperCase()] = progress.consumption;
                    }
                    const valueText = progress.hasData
                        ? `${formatChhaparaNumber(progress.monthStartPrevious)} → ${formatChhaparaNumber(progress.latestCurrent)} | MF: ${formatChhaparaNumber(progress.mf)} | <strong>${formatChhaparaNumber(progress.consumption)}</strong>`
                        : `Is mahine ka data nahi mila`;
                    return `
                        <div style="display:flex; flex-direction:column; gap:2px; padding:6px 0; border-bottom:1px solid #fde68a;">
                            <div style="font-size:11px; font-weight:900; color:#78350f; text-transform:uppercase;">${escapeHtml(meterRow.feeder)} (${escapeHtml(meterNo)})</div>
                            <div style="font-size:11px; font-weight:700; color:#92400e;">${valueText}</div>
                        </div>
                    `;
                }).join("");

                incomingHtml = `
                    <div style="margin-top:14px; background:linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%); border:1.5px solid #f59e0b; border-radius:14px; padding:12px;">
                        <div style="font-size:11px; font-weight:900; color:#92400e; text-transform:uppercase; margin-bottom:6px;">${escapeHtml(incomingConfig.label)}</div>
                        <div style="font-size:10px; font-weight:700; color:#b45309; margin-bottom:8px;">Period: ${escapeHtml(fromLabel)} to ${escapeHtml(toLabel)} (${escapeHtml(monthLabel)})</div>
                        ${incomingLines}
                        <div style="margin-top:8px; padding-top:8px; border-top:2px solid #f59e0b; font-size:13px; font-weight:900; color:#78350f; text-align:center;">
                            ${incomingHasData ? `Total Resultant Consumption${incomingConfig.resultantMeter ? ` (${incomingConfig.resultantMeter})` : ""}: ${formatChhaparaNumber(incomingConfig.resultantMeter ? (incomingMeterConsumption[incomingConfig.resultantMeter.toUpperCase()] || 0) : incomingTotal)}` : "Is mahine ka data abhi nahi mila"}
                        </div>
                    </div>
                `;
            }

            panel.innerHTML = `
                <div style="background:linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border:1.5px solid #10b981; border-radius:14px; padding:12px;">
                    <div style="font-size:11px; font-weight:900; color:#065f46; text-transform:uppercase; margin-bottom:4px;">📈 Monthly Progressive Consumption (${escapeHtml(kvLabel)})</div>
                    <div style="font-size:10px; font-weight:700; color:#047857; margin-bottom:8px;">Period: ${escapeHtml(fromLabel)} to ${escapeHtml(toLabel)} (${escapeHtml(monthLabel)})</div>
                    ${feederLines || `<div style="font-size:11px; font-weight:700; color:#64748b;">Koi feeder nahi mila</div>`}
                    <div style="margin-top:8px; padding-top:8px; border-top:2px solid #10b981; font-size:13px; font-weight:900; color:#065f46; text-align:center;">
                        ${anyData ? `Total ${escapeHtml(kvLabel)} Progressive Consumption: ${formatChhaparaNumber(totalConsumption)}` : "Is mahine ka data abhi nahi mila"}
                    </div>
                </div>
                ${thirtyThreeKvOnlySubstation ? "" : incomingHtml}
            `;
        }

        // Returns the required reading dates for a given year-month: 1st, 10th, 20th, last day
        function getRequiredReadingDatesForMonth_(year, month) {
            const lastDay = new Date(year, month, 0).getDate(); // last day of month
            const dates = [1, 10, 20, lastDay];
            return [...new Set(dates)].map((d) => {
                const mm = String(month).padStart(2, "0");
                const dd = String(d).padStart(2, "0");
                return `${year}-${mm}-${dd}`;
            });
        }

        function buildFeederPendingDateKeys_(substation) {
            const substationKey = normalizeFeederSubstationKey_(substation);
            if (!substationKey) return [];
            const submittedDates = new Set(
                getAllFeederHistoryEntries_()
                    .filter((entry) => normalizeFeederSubstationKey_(entry["33/11 KV SUBSTATION"] || entry.substation || "") === substationKey)
                    .map((entry) => buildFeederDateKey_(entry["DATE(DD/MM/YYY)"] || entry["DATE(DD/MM/YYYY)"] || entry.date || ""))
                    .filter(Boolean)
            );
            const pendingKeys = [];
            const todayKey = buildFeederDateKey_(getTodayIsoDate());
            if (!todayKey || todayKey <= feederAlertStartDateKey) return [];

            // Only check required dates: 1st, 10th, 20th, last day of each month
            const startDate = new Date(feederAlertStartDateKey);
            const today = new Date(todayKey);
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);

            let y = startDate.getFullYear();
            let m = startDate.getMonth() + 1; // 1-based

            while (true) {
                const requiredDates = getRequiredReadingDatesForMonth_(y, m);
                for (const dateKey of requiredDates) {
                    if (dateKey < feederAlertStartDateKey) continue;
                    if (dateKey > buildFeederDateKey_(localDateIso_(yesterday))) continue;
                    if (!submittedDates.has(dateKey)) {
                        pendingKeys.push(dateKey);
                    }
                }
                // Move to next month
                if (m === 12) { y++; m = 1; } else { m++; }
                // Stop if we've passed today's month
                if (y > today.getFullYear() || (y === today.getFullYear() && m > today.getMonth() + 1)) break;
            }
            return pendingKeys;
        }

        function getFeederBlockingPendingDateKeys_(substation, selectedDateKey) {
            const targetKey = String(selectedDateKey || "").trim();
            if (!targetKey) return [];
            return buildFeederPendingDateKeys_(substation).filter((dateKey) => dateKey < targetKey);
        }

        function buildFeederPendingAlertMessage_(pendingKeys) {
            const pendingLabels = (pendingKeys || []).map((item) => formatFeederDateLabelFromKey_(item));
            if (!pendingLabels.length) return "";
            return pendingLabels.length === 1
                ? `Alert: ${pendingLabels[0]} ki Entry Pending hai Aapki`
                : `Alert: ${pendingLabels.join(" and ")} ki Entry Pending hai Aapki`;
        }

        function updateFeederPendingAlert(substation) {
            if (!substation) {
                setFeederStatus("", false);
                return;
            }
            const pendingKeys = buildFeederPendingDateKeys_(substation);
            const todayKey = buildFeederDateKey_(getTodayIsoDate());
            if (!todayKey || todayKey <= feederAlertStartDateKey) {
                setFeederStatus("Aapke Dwara Aaj se Pahle ki Sabhi Reading Submit kar Di hai, Sirf Aaj ki Entry Kare", true, "success");
                return;
            }
            if (!pendingKeys.length) {
                setFeederStatus("Aapke Dwara Aaj se Pahle ki Sabhi Reading Submit kar Di hai, Sirf Aaj ki Entry Kare", true, "success");
                return;
            }
            const message = buildFeederPendingAlertMessage_(pendingKeys);
            setFeederStatus(message, true, "alert");
        }

        function fileToBase64(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        }

        function doExport(fmt) {
            const levelT = activeViewLevel === "DC" ? `DC - ${activeDC}` : (activeViewLevel === "DIVISION" ? activeDiv : "SEONI CIRCLE");
            const rawVal = document.getElementById("report-date").value;
            const dateLabel = summaryMode === "DAILY" ? "DATE - " + getFormattedDate(rawVal, "DAILY") : "MONTH - " + getFormattedDate(rawVal, "MONTHLY");
            const reportType = summaryMode === "DAILY" ? "DAILY" : "MONTHLY";
            const colLabel = activeViewLevel === "DC" ? "HQ NAME" : "DC NAME";
            const reportHeading = "UPDATED MOBILE NO SUMMARY";
            const valueLabel = "UPDATED MOBILE NO";

            if (fmt === "XLS") {
                let csv = `${levelT} ${reportType} PROGRESS REPORT\n${dateLabel}\n${reportHeading}\n\n`;
                csv += `${colLabel},TOTAL CONS.,${valueLabel}\n`;
                uiListSummary.forEach((r) => {
                    csv += `${r.name},${r.tc},${r.tu}\n`;
                });
                csv += `GRAND TOTAL,${grandTC},${grandTU}`;
                const link = document.createElement("a");
                link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
                link.download = `Report_${levelT}_${reportType}.csv`;
                link.click();
            } else {
                const { jsPDF } = window.jspdf;
                const doc = new jsPDF();
                doc.setFontSize(7);
                doc.setTextColor(100);
                
                doc.setFontSize(15);
                doc.setTextColor(0);
                doc.text(`${levelT} ${reportType} PROGRESS REPORT`, 105, 20, { align: "center" });
                doc.setFontSize(11);
                doc.text(dateLabel, 105, 28, { align: "center" });
                doc.setFontSize(9);
                doc.setTextColor(80);
                doc.text(reportHeading, 105, 34, { align: "center" });
                doc.autoTable({
                    startY: 40,
                    head: [[colLabel, "TOTAL CONS.", valueLabel]],
                    body: uiListSummary.map((r) => [r.name, r.tc, r.tu]),
                    foot: [["GRAND TOTAL", grandTC, grandTU]],
                    theme: "grid",
                    headStyles: { fillColor: [13, 148, 136], halign: "center" },
                    columnStyles: { 0: { halign: "left" }, 1: { halign: "center" }, 2: { halign: "center" } },
                    footStyles: { fillColor: [241, 245, 249], textColor: [190, 18, 60], fontStyle: "bold", halign: "center" },
                    didParseCell(data) {
                        if (data.section === "body") {
                            const rowValue = data.row.raw[0];
                            if (rowValue && rowValue.toString().includes("TOTAL")) {
                                data.cell.styles.fontStyle = "bold";
                                data.cell.styles.textColor = [30, 58, 138];
                            }
                        }
                    }
                });
                doc.save(`Report_${levelT}_${reportType}.pdf`);
            }
        }

        function showToast(message, ok) {
            const t = document.getElementById("toast-notif");
            t.innerText = message;
            t.style.background = ok ? "#10b981" : "#ef4444";
            t.style.display = "block";
            setTimeout(() => {
                t.style.display = "none";
            }, 3000);
        }

        function normalizeLookupValue(value) {
            return (value || "").toString().trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
        }

        function normalizeDcName(value) {
            return (value || "").toString().trim().toUpperCase();
        }

        function getDivisionConfig(divisionName) {
            return divisionConfigs[normalizeDcName(divisionName)] || null;
        }

        function getDivisionDcNames(divisionName) {
            const divisionConfig = getDivisionConfig(divisionName);
            return divisionConfig ? divisionConfig.dcs.map((dc) => dc.name) : [];
        }

        function getAllDcConfigs() {
            return Object.values(divisionConfigs).flatMap((division) => division.dcs);
        }

        function getAllDcNames() {
            return getAllDcConfigs().map((dc) => dc.name);
        }

        function splitCsvLine(line) {
            return line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map((item) => item.replace(/^"|"$/g, "").trim());
        }

        function xhrGetText(url) {
            return new Promise((resolve, reject) => {
                try {
                    const xhr = new XMLHttpRequest();
                    xhr.open("GET", url, true);
                    xhr.onreadystatechange = () => {
                        if (xhr.readyState !== 4) return;
                        if (xhr.status >= 200 && xhr.status < 300 && xhr.responseText) {
                            resolve(xhr.responseText);
                        } else {
                            reject(new Error("XHR fetch failed"));
                        }
                    };
                    xhr.onerror = () => reject(new Error("XHR network error"));
                    xhr.send();
                } catch (error) {
                    reject(error);
                }
            });
        }

        async function loadRemoteText(url) {
            const withTs = url.includes("?") ? `${url}&t=${Date.now()}` : `${url}?t=${Date.now()}`;
            try {
                const response = await fetch(withTs);
                const text = await response.text();
                if (text) return text;
            } catch (_) {}
            try {
                return await xhrGetText(withTs);
            } catch (_) {}
            try {
                return await xhrGetText(url);
            } catch (_) {}
            const fallbackResponse = await fetch(url);
            return fallbackResponse.text();
        }

        async function loadRemoteJson(url) {
            const text = await loadRemoteText(url);
            return JSON.parse(text || "null");
        }

        function isLikelyCsvPayload(rawText) {
            const raw = String(rawText || "").trim();
            if (!raw) return false;
            if (/^\s*</.test(raw)) return false;
            return raw.includes(",") && /[\r\n]/.test(raw);
        }

        function parseConsumerCsv(csvText) {
            const lines = (csvText || "").split(/\r?\n/).filter((line) => line.trim());
            if (lines.length < 2) return [];
            const headers = splitCsvLine(lines[0]).map((header) => normalizeDcName(header));
            return lines.slice(1).map((line) => {
                const cols = splitCsvLine(line);
                const row = {};
                headers.forEach((header, index) => {
                    row[header] = cols[index] || "";
                });
                return row;
            });
        }

        function getConsumerRows(dcName) {
            return dcCacheRows[normalizeDcName(dcName)] || [];
        }

        function getConsumerField(row, aliases, fallback = "") {
            if (!row) return fallback;
            for (const alias of aliases) {
                const value = row[normalizeDcName(alias)];
                if (value !== undefined && value !== null && String(value).trim() !== "") return String(value).trim();
            }
            return fallback;
        }

        function getCurrentPositionAsync() {
            return new Promise((resolve, reject) => {
                if (!navigator.geolocation) {
                    reject(new Error("Geolocation not supported"));
                    return;
                }
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 12000,
                    maximumAge: 0
                });
            });
        }

        async function reverseGeocodeLocation(latitude, longitude) {
            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`);
                const data = await response.json();
                return data.display_name || `${latitude}, ${longitude}`;
            } catch (_) {
                return `${latitude}, ${longitude}`;
            }
        }

        function resizeImageForUpload(file, maxWidth = 1280, quality = 0.78) {
            // Prefer createImageBitmap: it lets the browser decode+downscale the image
            // without holding the full-resolution bitmap in JS memory, which avoids
            // "low memory" / "unable to complete previous operation" errors on phones
            // when processing large camera photos (especially multiple in a row).
            if (typeof createImageBitmap === "function") {
                return resizeImageViaBitmap_(file, maxWidth, quality).catch(() => resizeImageViaImageElement_(file, maxWidth, quality));
            }
            return resizeImageViaImageElement_(file, maxWidth, quality);
        }

        async function resizeImageViaBitmap_(file, maxWidth, quality) {
            const bitmap = await createImageBitmap(file);
            try {
                const maxHeight = maxWidth; // cap both dimensions for portrait photos too
                const ratio = Math.min(1, maxWidth / bitmap.width, maxHeight / bitmap.height);
                const targetWidth = Math.max(1, Math.round(bitmap.width * ratio));
                const targetHeight = Math.max(1, Math.round(bitmap.height * ratio));

                const canvas = document.createElement("canvas");
                canvas.width = targetWidth;
                canvas.height = targetHeight;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
                const dataUrl = canvas.toDataURL("image/jpeg", quality);
                canvas.width = 0;
                canvas.height = 0;
                return dataUrl;
            } finally {
                bitmap.close();
            }
        }

        function resizeImageViaImageElement_(file, maxWidth, quality) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    const img = new Image();
                    img.onload = () => {
                        const maxHeight = maxWidth;
                        const ratio = Math.min(1, maxWidth / img.width, maxHeight / img.height);
                        const canvas = document.createElement("canvas");
                        canvas.width = Math.max(1, Math.round(img.width * ratio));
                        canvas.height = Math.max(1, Math.round(img.height * ratio));
                        const ctx = canvas.getContext("2d");
                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                        const dataUrl = canvas.toDataURL("image/jpeg", quality);
                        canvas.width = 0;
                        canvas.height = 0;
                        resolve(dataUrl);
                    };
                    img.onerror = () => {
                        // Fallback: image format not decodable by <img> (e.g. HEIC).
                        // Use the raw file data URL as-is so the entry still saves.
                        resolve(reader.result);
                    };
                    img.src = reader.result;
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        }

        // Fetches a remote image URL (e.g. Google Drive shared photo link) and converts
        // it to a base64 data URL so it can be embedded in a jsPDF document via addImage.
        // Returns "" on any failure (CORS, offline, etc.) so callers can fall back to a
        // text link instead of breaking the PDF generation.
        // Normalizes a Google Drive "uc?export=view&id=..." URL (unreliable for <img>/CORS)
        // to the more reliable "lh3.googleusercontent.com/d/<id>" CDN format. Leaves
        // non-Drive URLs unchanged.
        function normalizeDrivePhotoUrl_(url) {
            if (!url) return url;
            const match = String(url).match(/drive\.google\.com\/uc\?export=view&id=([^&]+)/);
            if (match) return `https://lh3.googleusercontent.com/d/${match[1]}`;
            return url;
        }

        async function fetchImageAsDataUrl_(url, timeoutMs = 8000) {
            if (!url) return "";
            url = normalizeDrivePhotoUrl_(url);
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
            try {
                const response = await fetch(url, { mode: "cors", signal: controller.signal });
                if (!response.ok) return "";
                const blob = await response.blob();
                return await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result || "");
                    reader.onerror = () => resolve("");
                    reader.readAsDataURL(blob);
                });
            } catch (_) {
                return "";
            } finally {
                clearTimeout(timeoutId);
            }
        }

        // For a list of entries that may have come from the shared cloud backend
        // (where photos are stored as Drive URLs in `photo_url` / `photos[].photo_url`
        // instead of base64 `photo_data`), this fetches each missing photo and fills
        // in `photo_data` so jsPDF's addImage can embed it. Entries are mutated in place.
        // Safe to call even when all entries already have photo_data (no-op fetches).
        async function hydratePhotoDataForPdf_(entries) {
            const tasks = [];
            entries.forEach((e) => {
                if (!e.photo_data && e.photo_url) {
                    tasks.push(fetchImageAsDataUrl_(e.photo_url).then((data) => { e.photo_data = data; }));
                }
                if (Array.isArray(e.photos)) {
                    e.photos.forEach((p) => {
                        if (!p.photo_data && p.photo_url) {
                            tasks.push(fetchImageAsDataUrl_(p.photo_url).then((data) => { p.photo_data = data; }));
                        }
                    });
                }
            });
            await Promise.all(tasks);
        }


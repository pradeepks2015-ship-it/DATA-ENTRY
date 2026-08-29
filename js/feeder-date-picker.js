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
                daySelect.innerHTML = trustedHtml_(Array.from({ length: 31 }, (_, index) => {
                    const value = index + 1;
                    return `<option value="${value}">${String(value).padStart(2, "0")}</option>`;
                }).join(""));
            }
            if (!monthSelect.innerHTML) {
                monthSelect.innerHTML = trustedHtml_(Array.from({ length: 12 }, (_, index) => {
                    const value = index + 1;
                    return `<option value="${value}">${String(value).padStart(2, "0")}</option>`;
                }).join(""));
            }
            if (!yearSelect.innerHTML) {
                const currentYear = new Date().getFullYear();
                yearSelect.innerHTML = trustedHtml_([currentYear - 1, currentYear, currentYear + 1]
                    .map((year) => `<option value="${year}">${year}</option>`)
                    .join(""));
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
                    <button onclick="confirmUnfreezeFeederEntry_('${mcJsEscape_(substation)}', '${mcJsEscape_(feeder)}', '${mcJsEscape_(dateKey)}')" style="flex:1; height:44px; border:none; border-radius:12px; background:#f59e0b; color:#fff; font-size:12px; font-weight:900; text-transform:uppercase;">Unfreeze</button>
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

            // feederLines/incomingHtml poore tarah escapeHtml() se banaye gaye pieces se
            // compose hote hain (upar verify kiya) — isliye trustedHtml_ se wrap karna safe hai.
            panel.innerHTML = trustedHtml_(`
                <div style="background:linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border:1.5px solid #10b981; border-radius:14px; padding:12px;">
                    <div style="font-size:11px; font-weight:900; color:#065f46; text-transform:uppercase; margin-bottom:4px;">📈 Monthly Progressive Consumption (${escapeHtml(kvLabel)})</div>
                    <div style="font-size:10px; font-weight:700; color:#047857; margin-bottom:8px;">Period: ${escapeHtml(fromLabel)} to ${escapeHtml(toLabel)} (${escapeHtml(monthLabel)})</div>
                    ${feederLines || `<div style="font-size:11px; font-weight:700; color:#64748b;">Koi feeder nahi mila</div>`}
                    <div style="margin-top:8px; padding-top:8px; border-top:2px solid #10b981; font-size:13px; font-weight:900; color:#065f46; text-align:center;">
                        ${anyData ? `Total ${escapeHtml(kvLabel)} Progressive Consumption: ${formatChhaparaNumber(totalConsumption)}` : "Is mahine ka data abhi nahi mila"}
                    </div>
                </div>
                ${thirtyThreeKvOnlySubstation ? "" : incomingHtml}
            `);
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

        async function doExport(fmt) {
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
                await ensureJsPdf_();
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


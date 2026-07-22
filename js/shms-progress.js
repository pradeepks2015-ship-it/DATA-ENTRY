        async function loadShmsProgressData(forceRefresh = false) {
            if (!forceRefresh && shmsProgressLoaded && shmsProgressRows.length) return true;
            try {
                loadRecentShmsSubmittedEntries_();
                const response = await fetch(`${shmsSubmitScriptUrl}?module=shms&action=getSummary&t=${Date.now()}`);
                const data = await response.json();
                const summaryRows = Array.isArray(data)
                    ? data
                    : Array.isArray(data?.data)
                        ? data.data
                        : Array.isArray(data?.rows)
                            ? data.rows
                            : Array.isArray(data?.result)
                                ? data.result
                                : [];
                shmsProgressRows = summaryRows.map((row) => {
                    const submittedAt = normalizeShmsSubmittedAt_(row.submitted_at || row.submittedAt || "");
                    const resolvedDate = resolveShmsEffectiveDate_(row.date, submittedAt);
                    const dateKey = buildShmsDateKey_(resolvedDate);
                    const expectedDateKey = getShmsExpectedDateKeyFromSubmittedAt_(submittedAt);
                    return {
                        substation: String(row.substation || row.sub_station || row.station || "").trim(),
                        feeder: String(row.feeder || "").trim(),
                        eventType: String(row.event_type || row.eventType || "").trim(),
                        date: resolvedDate,
                        timeFrom: normalizeShmsTime_(row.time_from || row.timeFrom || ""),
                        timeTo: normalizeShmsTime_(row.time_to || row.timeTo || ""),
                        totalDuration: String(row.total_duration || row.totalDuration || "").trim(),
                        reason: String(row.reason || "").trim(),
                        meterNo: String(row.meter_no || row.meterNo || "").trim(),
                        operatorName: String(row.operator_name || row.operatorName || "").trim(),
                        operatorMobile: String(row.operator_mobile || row.operatorMobile || "").trim(),
                        submittedAt: submittedAt,
                        dateKey,
                        expectedDateKey
                    };
                });
                reconcileRecentShmsSubmittedEntries_(shmsProgressRows);
                shmsProgressRows = mergeShmsProgressRows_(shmsProgressRows, getRecentShmsSubmittedRows_());
                shmsPendingTrackerRows = shmsProgressRows.slice();
                shmsProgressLoaded = true;
                return true;
            } catch (_) {
                shmsProgressRows = [];
                shmsPendingTrackerRows = [];
                shmsProgressLoaded = false;
                return false;
            }
        }

        function normalizeShmsSheetDate_(value) {
            const raw = String(value || "").trim();
            if (!raw) return "";
            if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) return raw;
            if (/^\d{2}-\d{2}-\d{4}$/.test(raw)) {
                const parts = raw.split("-");
                return `${parts[0]}/${parts[1]}/${parts[2]}`;
            }
            if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
                const parts = raw.split("-");
                return `${parts[2]}/${parts[1]}/${parts[0]}`;
            }
            return raw;
        }

        function parseShmsDateCandidates_(value) {
            const raw = String(value || "").trim();
            if (!raw) return [];

            const normalized = normalizeShmsSheetDate_(raw);
            const match = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
            if (!match) {
                const fallback = new Date(raw);
                return Number.isNaN(fallback.getTime()) ? [] : [fallback];
            }

            const first = Number(match[1]);
            const second = Number(match[2]);
            const year = Number(match[3]);
            const candidates = [];

            const ddmmyyyy = new Date(year, second - 1, first);
            if (!Number.isNaN(ddmmyyyy.getTime())) candidates.push(ddmmyyyy);

            if (first <= 12 && second <= 12 && first !== second) {
                const mmddyyyy = new Date(year, first - 1, second);
                if (!Number.isNaN(mmddyyyy.getTime())) candidates.push(mmddyyyy);
            }

            return candidates;
        }

        function formatShmsDateObject_(dateObj) {
            if (!(dateObj instanceof Date) || Number.isNaN(dateObj.getTime())) return "";
            const day = String(dateObj.getDate()).padStart(2, "0");
            const month = String(dateObj.getMonth() + 1).padStart(2, "0");
            const year = dateObj.getFullYear();
            return `${day}/${month}/${year}`;
        }

        function resolveShmsEffectiveDate_(dateValue, submittedAtValue) {
            const candidates = parseShmsDateCandidates_(dateValue);
            if (!candidates.length) return normalizeShmsSheetDate_(dateValue);

            const submittedRaw = normalizeShmsSubmittedAt_(submittedAtValue || "");
            if (submittedRaw) {
                const submittedDate = new Date(submittedRaw);
                if (!Number.isNaN(submittedDate.getTime())) {
                    const submittedOnly = new Date(
                        submittedDate.getFullYear(),
                        submittedDate.getMonth(),
                        submittedDate.getDate()
                    ).getTime();
                    const best = candidates
                        .map((candidate) => ({
                            candidate,
                            diff: Math.abs(
                                new Date(candidate.getFullYear(), candidate.getMonth(), candidate.getDate()).getTime() - submittedOnly
                            )
                        }))
                        .sort((a, b) => a.diff - b.diff)[0];
                    if (best?.candidate) return formatShmsDateObject_(best.candidate);
                }
            }

            return formatShmsDateObject_(candidates[0]);
        }

        function normalizeShmsTime_(value) {
            const raw = String(value || "").trim();
            if (!raw) return "";
            if (/^\d{2}:\d{2}$/.test(raw)) return raw;
            if (/^\d{2}:\d{2}:\d{2}$/.test(raw)) return raw.slice(0, 5);
            const isoMatch = raw.match(/T(\d{2}):(\d{2})/);
            if (isoMatch) {
                return `${isoMatch[1]}:${isoMatch[2]}`;
            }
            const directMatch = raw.match(/(\d{1,2}):(\d{2})/);
            if (directMatch) {
                return `${String(directMatch[1]).padStart(2, "0")}:${directMatch[2]}`;
            }
            return raw;
        }

        function normalizeShmsSubstationKey_(value) {
            return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
        }

        function buildShmsDateKey_(value) {
            const raw = String(value || "").trim();
            if (!raw) return "";
            const normalized = normalizeShmsSheetDate_(raw);
            const parts = normalized.split("/");
            if (parts.length === 3) {
                return `${parts[2]}-${parts[1]}-${parts[0]}`;
            }
            const fallbackDate = new Date(raw);
            if (!Number.isNaN(fallbackDate.getTime())) {
                const day = String(fallbackDate.getDate()).padStart(2, "0");
                const month = String(fallbackDate.getMonth() + 1).padStart(2, "0");
                const year = fallbackDate.getFullYear();
                return `${year}-${month}-${day}`;
            }
            return normalized;
        }

        function buildShmsDateKeyFromDateObj_(dateObj) {
            if (!(dateObj instanceof Date) || Number.isNaN(dateObj.getTime())) return "";
            const day = String(dateObj.getDate()).padStart(2, "0");
            const month = String(dateObj.getMonth() + 1).padStart(2, "0");
            const year = dateObj.getFullYear();
            return `${year}-${month}-${day}`;
        }

        function buildShmsMonthKeyFromDateKey_(dateKey) {
            const raw = String(dateKey || "").trim();
            const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (!match) return "";
            return `${match[2]}/${match[1]}`;
        }

        function getShmsExpectedDateKeyFromSubmittedAt_(value) {
            const raw = String(value || "").trim();
            if (!raw) return "";
            const submitted = new Date(raw);
            if (Number.isNaN(submitted.getTime())) return "";
            const expected = new Date(submitted.getFullYear(), submitted.getMonth(), submitted.getDate() - 1);
            return buildShmsDateKeyFromDateObj_(expected);
        }

        function getShmsCurrentDateTimeLabel() {
            const now = new Date();
            const day = String(now.getDate()).padStart(2, "0");
            const month = String(now.getMonth() + 1).padStart(2, "0");
            const year = now.getFullYear();
            const hours = String(now.getHours()).padStart(2, "0");
            const minutes = String(now.getMinutes()).padStart(2, "0");
            return `${day}/${month}/${year} ${hours}:${minutes}`;
        }

        function parseShmsSubmittedAtDate_(value) {
            const raw = String(value || "").trim();
            if (!raw) return null;

            const directDateTimeMatch = raw.match(
                /^(\d{2})[\/-](\d{2})[\/-](\d{4})(?:\s*(?:-\s*)?(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?$/i
            );
            if (directDateTimeMatch) {
                let hours = Number(directDateTimeMatch[4] || 0);
                const minutes = Number(directDateTimeMatch[5] || 0);
                const seconds = Number(directDateTimeMatch[6] || 0);
                const meridiem = String(directDateTimeMatch[7] || "").toUpperCase();
                if (meridiem === "PM" && hours < 12) hours += 12;
                if (meridiem === "AM" && hours === 12) hours = 0;
                const parsed = new Date(
                    Number(directDateTimeMatch[3]),
                    Number(directDateTimeMatch[2]) - 1,
                    Number(directDateTimeMatch[1]),
                    Number.isNaN(hours) ? 0 : hours,
                    Number.isNaN(minutes) ? 0 : minutes,
                    Number.isNaN(seconds) ? 0 : seconds,
                    0
                );
                if (!Number.isNaN(parsed.getTime())) return parsed;
            }

            const isoDateTimeMatch = raw.match(
                /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?)?/
            );
            if (isoDateTimeMatch) {
                const parsed = new Date(raw);
                if (!Number.isNaN(parsed.getTime())) return parsed;
            }

            const fallback = new Date(raw);
            if (!Number.isNaN(fallback.getTime())) return fallback;
            return null;
        }

        function normalizeShmsSubmittedAt_(value) {
            const parsed = parseShmsSubmittedAtDate_(value);
            return parsed ? parsed.toISOString() : String(value || "").trim();
        }

        function formatShmsSubmittedAtDisplay(value) {
            const raw = String(value || "").trim();
            if (!raw) return "";
            const date = parseShmsSubmittedAtDate_(raw) || new Date(raw);
            if (Number.isNaN(date.getTime())) return raw;
            const day = String(date.getDate()).padStart(2, "0");
            const month = String(date.getMonth() + 1).padStart(2, "0");
            const year = date.getFullYear();
            const hours = String(date.getHours()).padStart(2, "0");
            const minutes = String(date.getMinutes()).padStart(2, "0");
            return `${day}/${month}/${year} ${hours}:${minutes}`;
        }

        function buildShmsLocalProgressRows_(entries) {
            return (Array.isArray(entries) ? entries : []).map((entry) => {
                const submittedAt = normalizeShmsSubmittedAt_(entry.submitted_at || entry.submittedAt || "");
                const resolvedDate = resolveShmsEffectiveDate_(entry.date || entry.eventDate || "", submittedAt);
                const dateKey = buildShmsDateKey_(resolvedDate);
                const expectedDateKey = getShmsExpectedDateKeyFromSubmittedAt_(submittedAt);
                return {
                    substation: String(entry.substation || "").trim(),
                    feeder: String(entry.feeder || "").trim(),
                    eventType: String(entry.event_type || entry.eventType || "").trim(),
                    date: resolvedDate,
                    timeFrom: normalizeShmsTime_(entry.time_from || entry.timeFrom || ""),
                    timeTo: normalizeShmsTime_(entry.time_to || entry.timeTo || ""),
                    totalDuration: String(entry.total_duration || entry.totalDuration || "").trim(),
                    reason: String(entry.reason || "").trim(),
                    meterNo: String(entry.meter_no || entry.meterNo || "").trim(),
                    operatorName: String(entry.operator_name || entry.operatorName || "").trim(),
                    operatorMobile: String(entry.operator_mobile || entry.operatorMobile || "").trim(),
                    submittedAt: submittedAt,
                    dateKey,
                    expectedDateKey
                };
            }).filter((row) => row.substation && row.date);
        }

        function getShmsProgressRowKey_(row) {
            return [
                normalizeShmsSubstationKey_(row.substation),
                String(row.feeder || "").trim().toUpperCase(),
                buildShmsDateKey_(row.date),
                String(row.timeFrom || "").trim(),
                String(row.timeTo || "").trim(),
                String(row.reason || "").trim().toUpperCase(),
                String(row.submittedAt || "").trim()
            ].join("|");
        }

        function getShmsProgressSyncKey_(row) {
            if (!row) return "";
            const dateKey = String(row.dateKey || buildShmsDateKey_(row.date) || "").trim();
            const expectedDateKey = String(
                row.expectedDateKey || getShmsExpectedDateKeyFromSubmittedAt_(row.submittedAt || "")
            ).trim();
            const effectiveDateKey = dateKey || expectedDateKey || getShmsSubmittedDateKey_(row.submittedAt || "");
            return [
                normalizeShmsSubstationKey_(row.substation),
                String(row.feeder || "").trim().toUpperCase(),
                String(row.eventType || "").trim().toUpperCase(),
                effectiveDateKey,
                String(row.timeFrom || "").trim(),
                String(row.timeTo || "").trim(),
                String(row.reason || "").trim().toUpperCase()
            ].join("|");
        }

        function mergeShmsProgressRows_(baseRows, extraRows) {
            const merged = [];
            const seen = new Set();
            [...(Array.isArray(baseRows) ? baseRows : []), ...(Array.isArray(extraRows) ? extraRows : [])].forEach((row) => {
                if (!row || !row.substation) return;
                const key = getShmsProgressRowKey_(row);
                if (seen.has(key)) return;
                seen.add(key);
                merged.push(row);
            });
            return merged;
        }

        function loadRecentShmsSubmittedEntries_() {
            try {
                const raw = localStorage.getItem(shmsRecentSubmittedStorageKey);
                const parsed = JSON.parse(raw || "[]");
                const nowTs = Date.now();
                shmsRecentSubmittedEntries = Array.isArray(parsed)
                    ? parsed.filter((entry) => {
                        const submittedRaw = normalizeShmsSubmittedAt_(entry.submitted_at || entry.submittedAt || "");
                        const submittedTs = submittedRaw ? new Date(submittedRaw).getTime() : NaN;
                        return !Number.isNaN(submittedTs) && (nowTs - submittedTs) <= shmsRecentSubmittedTtlMs;
                    }).slice(-200)
                    : [];
                persistRecentShmsSubmittedEntries_();
            } catch (_) {
                shmsRecentSubmittedEntries = [];
            }
        }

        function persistRecentShmsSubmittedEntries_() {
            try {
                localStorage.setItem(shmsRecentSubmittedStorageKey, JSON.stringify(shmsRecentSubmittedEntries.slice(-200)));
            } catch (_) {}
        }

        function getRecentShmsSubmittedRows_() {
            if (!Array.isArray(shmsRecentSubmittedEntries) || !shmsRecentSubmittedEntries.length) {
                loadRecentShmsSubmittedEntries_();
            }
            return buildShmsLocalProgressRows_(shmsRecentSubmittedEntries);
        }

        function saveRecentShmsSubmittedEntries_(entries) {
            if (Array.isArray(entries) && entries.length) {
                const nextEntries = shmsRecentSubmittedEntries.concat(entries);
                const deduped = [];
                const seen = new Set();
                nextEntries.slice().reverse().forEach((entry) => {
                    const row = buildShmsLocalProgressRows_([entry])[0];
                    const key = getShmsProgressSyncKey_(row) || getShmsProgressRowKey_(row || {});
                    if (!key || seen.has(key)) return;
                    seen.add(key);
                    deduped.unshift(entry);
                });
                shmsRecentSubmittedEntries = deduped.slice(-200);
            }
            persistRecentShmsSubmittedEntries_();
        }

        function reconcileRecentShmsSubmittedEntries_(serverRows) {
            const serverKeys = new Set((Array.isArray(serverRows) ? serverRows : []).map((row) => getShmsProgressSyncKey_(row)).filter(Boolean));
            if (!serverKeys.size) return;

            const localRows = buildShmsLocalProgressRows_(shmsRecentSubmittedEntries);
            const nextEntries = [];

            shmsRecentSubmittedEntries.forEach((entry, index) => {
                const localRow = localRows[index];
                if (!localRow) {
                    nextEntries.push(entry);
                    return;
                }
                const key = getShmsProgressSyncKey_(localRow);
                if (!serverKeys.has(key)) {
                    nextEntries.push(entry);
                }
            });

            shmsRecentSubmittedEntries = nextEntries.slice(-200);
            persistRecentShmsSubmittedEntries_();
        }

        function getYesterdayDateParts() {
            const now = new Date();
            const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
            const day = String(yesterday.getDate()).padStart(2, "0");
            const month = String(yesterday.getMonth() + 1).padStart(2, "0");
            const year = yesterday.getFullYear();
            return {
                label: `${day}/${month}/${year}`,
                iso: `${year}-${month}-${day}`,
                dateObj: yesterday
            };
        }

        function getTodayDateParts() {
            const now = new Date();
            const day = String(now.getDate()).padStart(2, "0");
            const month = String(now.getMonth() + 1).padStart(2, "0");
            const year = now.getFullYear();
            return {
                label: `${day}/${month}/${year}`,
                iso: `${year}-${month}-${day}`,
                dateObj: new Date(now.getFullYear(), now.getMonth(), now.getDate())
            };
        }

        function getShmsPendingCutoff() {
            const now = new Date();
            return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 30, 0, 0);
        }

        function setShmsPendingStatus(message) {
            const node = document.getElementById("shms-pending-status");
            if (!node) return;
            node.innerText = message || "";
            node.style.display = message ? "block" : "none";
        }

        function getShmsPendingTrackerRows() {
            const baseRows = shmsPendingTrackerRows.length ? shmsPendingTrackerRows : shmsProgressRows;
            const localRows = getRecentShmsSubmittedRows_();
            return mergeShmsProgressRows_(baseRows, localRows);
        }

        function getShmsSubmittedDateKey_(value) {
            const submitted = parseShmsSubmittedAtDate_(value || "");
            if (Number.isNaN(submitted.getTime())) return "";
            return buildShmsDateKeyFromDateObj_(submitted);
        }

        function getShmsRowRelevantDateKeys_(row) {
            const keys = new Set();
            if (!row) return keys;

            const directDateKey = String(row.dateKey || buildShmsDateKey_(row.date) || "").trim();
            const submittedDateKey = String(getShmsSubmittedDateKey_(row.submittedAt || "") || "").trim();
            const expectedDateKey = String(
                row.expectedDateKey || getShmsExpectedDateKeyFromSubmittedAt_(row.submittedAt || "")
            ).trim();

            if (directDateKey) keys.add(directDateKey);
            if (submittedDateKey) keys.add(submittedDateKey);
            if (expectedDateKey) keys.add(expectedDateKey);

            return keys;
        }

        function getShmsPendingSubstations() {
            const source = shmsSubstations.length ? shmsSubstations : shmsRows.map((row) => row.substation).filter(Boolean);
            return Array.from(new Set(source.map((item) => String(item || "").trim()).filter(Boolean)));
        }

        function buildShmsPendingStatuses() {
            const today = getTodayDateParts();
            const cutoff = getShmsPendingCutoff();
            const now = new Date();
            const progressRows = getShmsPendingTrackerRows();
            const substations = getShmsPendingSubstations();
            const targetDateKey = buildShmsDateKey_(today.label);

            return substations.map((substation) => {
                const substationKey = normalizeShmsSubstationKey_(substation);
                const entries = progressRows.filter((row) => {
                    if (normalizeShmsSubstationKey_(row.substation) !== substationKey) return false;
                    const submittedDateKey = getShmsSubmittedDateKey_(row.submittedAt || "");
                    return submittedDateKey === targetDateKey;
                });
                if (!entries.length) {
                    return {
                        substation,
                        status: now <= cutoff ? "Pending" : "Pending",
                        badgeClass: now <= cutoff ? "background:#fef3c7; color:#92400e;" : "background:#fee2e2; color:#b91c1c;",
                        meta: now <= cutoff ? "Aaj 09:30 AM se pehle entry expected hai" : "by 09:30 AM Tak Entry Kare",
                        count: 0
                    };
                }

                const submittedTimes = entries
                    .map((row) => {
                        if (!row.submittedAt) return null;
                        const submitted = parseShmsSubmittedAtDate_(row.submittedAt) || new Date(row.submittedAt);
                        return Number.isNaN(submitted.getTime()) ? null : submitted;
                    })
                    .filter(Boolean);

                const firstSubmitted = submittedTimes.length
                    ? submittedTimes.sort((a, b) => a.getTime() - b.getTime())[0]
                    : null;

                const hasLate = firstSubmitted ? firstSubmitted > cutoff : false;

                return {
                    substation,
                    status: hasLate ? "Late" : "Done",
                    badgeClass: hasLate ? "background:#ffedd5; color:#c2410c;" : "background:#dcfce7; color:#166534;",
                    meta: hasLate ? "Aaj ki entry 09:30 AM ke baad submit hui" : "Aaj ki entry mil gayi",
                    count: entries.length
                };
            });
        }

        function renderShmsPendingDashboard() {
            const targetNode = document.getElementById("shms-pending-target-label");
            const deadlineNode = document.getElementById("shms-pending-deadline-label");
            const summaryNode = document.getElementById("shms-pending-summary-cards");
            const listNode = document.getElementById("shms-pending-list");
            if (!targetNode || !deadlineNode || !summaryNode || !listNode) return;

            const today = getTodayDateParts();
            const statuses = buildShmsPendingStatuses();
            const done = statuses.filter((item) => item.status === "Done").length;
            const late = statuses.filter((item) => item.status === "Late").length;
            const pending = statuses.filter((item) => item.status === "Pending").length;

            targetNode.innerText = `Expected Entry Date: ${today.label}`;
            deadlineNode.innerText = "Aaj ki entry 09:30 AM se pehle expected hai";

            summaryNode.innerHTML = [
                { label: "Done", value: done, bg: "#dcfce7", color: "#166534" },
                { label: "Late", value: late, bg: "#ffedd5", color: "#c2410c" },
                { label: "Pending", value: pending, bg: "#fee2e2", color: "#b91c1c" }
            ].map((item) => `
                <div style="background:${item.bg}; color:${item.color}; border-radius:16px; padding:12px 8px; text-align:center; font-weight:900;">
                    <div style="font-size:12px; text-transform:uppercase;">${item.label}</div>
                    <div style="font-size:24px; line-height:1.1; margin-top:4px;">${item.value}</div>
                </div>
            `).join("");

            listNode.innerHTML = statuses.map((item) => `
                <div style="background:#ffffff; border:1.5px solid #ccfbf1; border-radius:18px; padding:12px 14px; box-shadow:0 8px 20px rgba(13,148,136,0.08);">
                    <div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start;">
                        <div>
                            <div style="font-size:14px; font-weight:900; color:#0f172a;">${item.substation}</div>
                            <div style="font-size:11px; font-weight:800; color:#475569; margin-top:4px;">${item.meta}</div>
                        </div>
                        <div style="${item.badgeClass} border-radius:999px; padding:6px 12px; font-size:11px; font-weight:900; text-transform:uppercase; white-space:nowrap;">${item.status}</div>
                    </div>
                    <div style="font-size:11px; font-weight:800; color:#0d9488; margin-top:8px;">Entries Found: ${item.count}</div>
                </div>
            `).join("");
        }

        async function initShmsPendingDashboard() {
            setShmsPendingStatus("Pending tracker data load ho raha hai...");
            const [masterLoaded, progressLoaded] = await Promise.all([
                loadShmsData(true),
                loadShmsProgressData(true)
            ]);
            if (!masterLoaded) {
                setShmsPendingStatus("SHMS feeder master load nahi ho paya");
                return;
            }
            if (!progressLoaded) {
                setShmsPendingStatus("SHMS submitted data load nahi ho paya");
                return;
            }
            setShmsPendingStatus("");
            renderShmsPendingDashboard();
        }

        async function initShmsProgressDashboard() {
            const input = document.getElementById("shms-progress-date");
            const yesterday = getYesterdayDateParts();
            if (input) {
                input.type = "date";
                input.value = yesterday.iso;
                input.max = localTodayIso_();
            }
            setShmsProgressStatus("SHMS daily progress data load ho raha hai...");
            const loaded = await loadShmsProgressData(true);
            if (!loaded) {
                setShmsProgressStatus("SHMS progress data load nahi ho paya");
                const summary = document.getElementById("shms-progress-summary");
                if (summary) summary.style.display = "none";
                return;
            }
            setShmsProgressStatus("");
            setReportSource(progressReportSource);
            renderShmsProgressSummary();
        }

        function setShmsProgressStatus(message) {
            const node = document.getElementById("shms-progress-status");
            if (!node) return;
            node.innerText = message || "";
            node.style.display = message ? "block" : "none";
        }

        function setShmsProgressMode(mode) {
            shmsProgressMode = mode === "MONTHLY" ? "MONTHLY" : "DAILY";
            const input = document.getElementById("shms-progress-date");
            const dailyBtn = document.getElementById("shms-progress-daily-btn");
            const monthlyBtn = document.getElementById("shms-progress-monthly-btn");
            const today = new Date();
            const yesterday = getYesterdayDateParts();
            if (input) {
                if (shmsProgressMode === "MONTHLY") {
                    input.type = "month";
                    input.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
                } else {
                    input.type = "date";
                    input.value = yesterday.iso;
                    input.max = localDateIso_(today);
                }
            }
            if (dailyBtn) {
                dailyBtn.classList.toggle("active", shmsProgressMode === "DAILY");
            }
            if (monthlyBtn) {
                monthlyBtn.classList.toggle("active", shmsProgressMode === "MONTHLY");
            }
            renderShmsProgressSummary();
        }

        function getShmsProgressFilterLabel() {
            const raw = document.getElementById("shms-progress-date")?.value || "";
            if (!raw) return "";
            if (shmsProgressMode === "MONTHLY") {
                const [year, month] = raw.split("-");
                return `${month}/${year}`;
            }
            return formatShmsDateDisplay(raw);
        }

        function getFilteredShmsProgressRows() {
            const label = getShmsProgressFilterLabel();
            if (!label) return [];
            const sourceRows = mergeShmsProgressRows_(shmsProgressRows, getRecentShmsSubmittedRows_());
            if (shmsProgressMode === "MONTHLY") {
                return sourceRows.filter((row) => {
                    const rowMonthKey = buildShmsMonthKeyFromDateKey_(row.dateKey || buildShmsDateKey_(row.date));
                    const expectedMonthKey = buildShmsMonthKeyFromDateKey_(row.expectedDateKey || getShmsExpectedDateKeyFromSubmittedAt_(row.submittedAt));
                    return rowMonthKey === label || expectedMonthKey === label;
                });
            }
            const labelKey = buildShmsDateKey_(label);
            return sourceRows.filter((row) => {
                const rowDateKey = row.dateKey || buildShmsDateKey_(row.date);
                const submittedExpectedKey = row.expectedDateKey || getShmsExpectedDateKeyFromSubmittedAt_(row.submittedAt);
                return rowDateKey === labelKey || submittedExpectedKey === labelKey;
            });
        }

        async function renderShmsProgressSummary() {
            const summary = document.getElementById("shms-progress-summary");
            if (!summary) return;
            if (progressReportSource === "FEEDER") {
                await renderFeederReportSummary();
                return;
            }
            const filtered = getFilteredShmsProgressRows();
            const label = getShmsProgressFilterLabel();
            summary.style.display = label ? "block" : "none";
            summary.innerText = label ? `${label} ke liye ${filtered.length} entries ready hain` : "";
        }

        function triggerShmsDownload(fileName, content, mimeType) {
            const blob = new Blob([content], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = fileName;
            link.style.display = "none";
            document.body.appendChild(link);
            link.click();
            setTimeout(() => {
                try { document.body.removeChild(link); } catch (_) {}
                URL.revokeObjectURL(url);
            }, 800);
        }

        async function saveShmsBlob(fileName, blob, mimeType) {
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = fileName;
            link.target = "_blank";
            link.rel = "noopener";
            link.style.display = "none";
            document.body.appendChild(link);
            link.click();
            try {
                window.open(url, "_blank", "noopener");
            } catch (_) {}
            setTimeout(() => {
                try { document.body.removeChild(link); } catch (_) {}
                URL.revokeObjectURL(url);
            }, 800);
            return true;
        }

        function setReportSource(source) {
            progressReportSource = source === "FEEDER" ? "FEEDER" : "SHMS";
            document.getElementById("progress-shms-btn")?.classList.toggle("active", progressReportSource === "SHMS");
            document.getElementById("progress-feeder-btn")?.classList.toggle("active", progressReportSource === "FEEDER");
            const titleNode = document.querySelector("#shms-progress-view .title-text-bold");
            if (titleNode) {
                titleNode.innerText = progressReportSource === "FEEDER" ? "FEEDER READING REPORT" : "SHMS DAILY PROGRESS";
            }
            renderShmsProgressSummary();
        }

        function getFeederReportFilterLabel() {
            const raw = document.getElementById("shms-progress-date")?.value || "";
            if (!raw) return "";
            if (shmsProgressMode === "MONTHLY") {
                const [year, month] = raw.split("-");
                return `${month}/${year}`;
            }
            return formatShmsDateDisplay(raw);
        }

        function getFilteredFeederReportRows() {
            const label = getFeederReportFilterLabel();
            if (!label) return [];
            const sheetRows = Array.isArray(feederReportRows) ? feederReportRows : [];
            const localRows = getRecentFeederSubmittedEntries_();
            const allRows = [...sheetRows, ...localRows];
            if (shmsProgressMode === "MONTHLY") {
                return allRows.filter((row) => {
                    const dateKey = buildFeederDateKey_(row["DATE(DD/MM/YYY)"] || row.date || "");
                    const monthKey = buildShmsMonthKeyFromDateKey_(dateKey);
                    return monthKey === label;
                });
            }
            const dailyKey = buildShmsDateKey_(label);
            return allRows.filter((row) => buildFeederDateKey_(row["DATE(DD/MM/YYY)"] || row.date || "") === dailyKey);
        }

        async function renderFeederReportSummary() {
            const summary = document.getElementById("shms-progress-summary");
            if (!summary) return;
            loadRecentFeederSubmittedEntries_();
            await loadFeederReportData(true);
            const label = getFeederReportFilterLabel();
            const rows = getFilteredFeederReportRows();
            summary.style.display = label ? "block" : "none";
            if (!label) {
                summary.innerHTML = "";
                return;
            }
            const debugMessage = rows.length
                ? `${label} ke liye ${rows.length} feeder entries ready hain`
                : (feederReportLoadMessage
                    ? `${label} ke liye 0 feeder entries ready hain<br><span style="display:block; margin-top:6px; font-size:11px; color:#b91c1c;">${feederReportLoadMessage}</span>`
                    : `${label} ke liye 0 feeder entries ready hain`);
            summary.innerHTML = `<div style="margin-top:14px; background:#f8fafc; border:1.5px solid #cbd5e1; border-radius:16px; padding:14px; text-align:center; font-size:13px; font-weight:900; color:#0f172a;">${debugMessage}</div>`;
        }

        async function downloadFeederReport(fmt) {
            try {
                loadRecentFeederSubmittedEntries_();
                await loadFeederReportData(true);
                setShmsProgressStatus("Feeder report data ready ki ja rahi hai...");
                const rows = getFilteredFeederReportRows();
                const label = getFeederReportFilterLabel();
                setShmsProgressStatus("");
                if (!label) return showToast("Pehle date ya month select kijiye", false);

                const headers = [
                    "33/11 KV SUBSTATION",
                    "33 AND 11 KV FEEDER",
                    "METER NO",
                    "PREVIUS READING",
                    "CURRENT READING",
                    "MF",
                    "CONSUMPTION",
                    "DC NAME",
                    "DATE(DD/MM/YYY)",
                    "TIME(HH/MM)"
                ];

                const bodyRows = rows.map((row) => headers.map((key) => String(row[key] ?? row[key.toLowerCase()] ?? "")));
                const safeLabel = label.replace(/[\\/:*?\"<>|]+/g, "_");

                if (fmt === "XLS") {
                    const csvRows = [
                        ["FEEDER READING REPORT"],
                        [shmsProgressMode === "MONTHLY" ? `MONTH - ${label}` : `DATE - ${label}`],
                        [],
                        headers,
                        ...bodyRows
                    ];
                    const csv = csvRows.map((row) => row.map((cell) => {
                        const value = String(cell ?? "");
                        return /[\",\\n]/.test(value) ? `\"${value.replace(/\"/g, '\"\"')}\"` : value;
                    }).join(",")).join("\n");
                    await saveShmsBlob(`FEEDER_${shmsProgressMode}_${safeLabel}.csv`, new Blob([csv], { type: "text/csv;charset=utf-8" }), "text/csv;charset=utf-8");
                    return showToast(bodyRows.length ? "Excel report ka request bhej diya gaya. Agar preview me file na aaye to browser ya GitHub version me check kijiye." : "Blank Excel report ka request bhej diya gaya. Agar preview me file na aaye to browser ya GitHub version me check kijiye.", true);
                }

                if (!window.jspdf || !window.jspdf.jsPDF) {
                    return showToast("PDF library load nahi hui", false);
                }

                const { jsPDF } = window.jspdf;
                const doc = new jsPDF("l", "mm", "a4");
                doc.setFontSize(7);
                doc.setTextColor(100);
                
                doc.setFontSize(15);
                doc.setTextColor(0);
                doc.text("FEEDER READING REPORT", 148, 18, { align: "center" });
                doc.setFontSize(11);
                doc.text(shmsProgressMode === "MONTHLY" ? `MONTH - ${label}` : `DATE - ${label}`, 148, 25, { align: "center" });
                doc.autoTable({
                    startY: 32,
                    head: [headers],
                    body: bodyRows.length ? bodyRows : [["", "", "", "", "", "", "", "", "", ""]],
                    theme: "grid",
                    headStyles: { fillColor: [17, 24, 39], halign: "center" },
                    styles: { fontSize: 7, cellPadding: 2, halign: "center" },
                    columnStyles: {
                        0: { halign: "left" },
                        1: { halign: "left" },
                        7: { halign: "left" }
                    }
                });
                const pdfBlob = doc.output("blob");
                await saveShmsBlob(`FEEDER_${shmsProgressMode}_${safeLabel}.pdf`, pdfBlob, "application/pdf");
                showToast(bodyRows.length ? "PDF report ka request bhej diya gaya. Agar preview me file na aaye to browser ya GitHub version me check kijiye." : "Blank PDF report ka request bhej diya gaya. Agar preview me file na aaye to browser ya GitHub version me check kijiye.", true);
            } catch (error) {
                setShmsProgressStatus("");
                showToast(error?.message || "Feeder report download nahi ho paya", false);
            }
        }

        async function downloadShmsProgress(fmt) {
            if (progressReportSource === "FEEDER") {
                return downloadFeederReport(fmt);
            }
            try {
                setShmsProgressStatus("Download data load ho raha hai...");
                const loaded = await loadShmsProgressData(true);
                setShmsProgressStatus("");
                if (!loaded) return showToast("SHMS progress data load nahi ho paya", false);

                const filtered = getFilteredShmsProgressRows();
                const label = getShmsProgressFilterLabel();
                if (!label) return showToast("Pehle date ya month select kijiye", false);

                const headers = [
                    "33/11 KV Substation",
                    "33 or 11 KV Feeder",
                    "Un-Planned/Planned",
                    "Date",
                    "Time From",
                    "Time To",
                    "Total Duration",
                    "Reason",
                    "Meter No",
                    "NAME OF OPERATOR",
                    "MOBILE NO",
                    "SUBMITTED AT"
                ];

                const rows = filtered.map((row) => [
                    row.substation,
                    row.feeder,
                    row.eventType,
                    row.date,
                    row.timeFrom,
                    row.timeTo,
                    row.totalDuration,
                    row.reason,
                    row.meterNo,
                    row.operatorName,
                    row.operatorMobile,
                    formatShmsSubmittedAtDisplay(row.submittedAt)
                ]);

                const safeLabel = label.replace(/[\/\s]/g, "_");

                if (fmt === "XLS") {
                    const csvRows = [
                        ["SHMS DAILY PROGRESS REPORT"],
                        [shmsProgressMode === "MONTHLY" ? `MONTH - ${label}` : `DATE - ${label}`],
                        [],
                        headers,
                        ...rows
                    ];
                    const csv = csvRows.map((row) => row.map((cell) => {
                        const value = String(cell ?? "");
                        return /[",\n]/.test(value) ? `"${value.replace(/"/g, "\"\"")}"` : value;
                    }).join(",")).join("\n");
                    await saveShmsBlob(
                        `SHMS_${shmsProgressMode}_${safeLabel}.csv`,
                        new Blob([csv], { type: "text/csv;charset=utf-8" }),
                        "text/csv;charset=utf-8"
                    );
                    return showToast(rows.length ? "Excel report ka request bhej diya gaya. Agar preview me file na aaye to browser ya GitHub version me check kijiye." : "Blank Excel report ka request bhej diya gaya. Agar preview me file na aaye to browser ya GitHub version me check kijiye.", true);
                }

                if (!window.jspdf || !window.jspdf.jsPDF) {
                    return showToast("PDF library load nahi hui", false);
                }

                const { jsPDF } = window.jspdf;
                const doc = new jsPDF("l", "mm", "a4");
                doc.setFontSize(7);
                doc.setTextColor(100);
                
                doc.setFontSize(15);
                doc.setTextColor(0);
                doc.text("SHMS DAILY PROGRESS REPORT", 148, 18, { align: "center" });
                doc.setFontSize(11);
                doc.text(shmsProgressMode === "MONTHLY" ? `MONTH - ${label}` : `DATE - ${label}`, 148, 25, { align: "center" });
                doc.autoTable({
                    startY: 32,
                    head: [headers],
                    body: rows.length ? rows : [["", "", "", "", "", "", "", "", "", "", "", ""]],
                    theme: "grid",
                    headStyles: { fillColor: [17, 24, 39], halign: "center" },
                    styles: { fontSize: 7, cellPadding: 2, halign: "center" },
                    columnStyles: {
                        0: { halign: "left" },
                        1: { halign: "left" },
                        7: { halign: "left" },
                        9: { halign: "left" },
                        11: { halign: "left" }
                    }
                });
                const pdfBlob = doc.output("blob");
                await saveShmsBlob(
                    `SHMS_${shmsProgressMode}_${safeLabel}.pdf`,
                    pdfBlob,
                    "application/pdf"
                );
                showToast(rows.length ? "PDF report ka request bhej diya gaya. Agar preview me file na aaye to browser ya GitHub version me check kijiye." : "Blank PDF report ka request bhej diya gaya. Agar preview me file na aaye to browser ya GitHub version me check kijiye.", true);
            } catch (error) {
                setShmsProgressStatus("");
                showToast(error?.message || "Download nahi ho paya", false);
            }
        }


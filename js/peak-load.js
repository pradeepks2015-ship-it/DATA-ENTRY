        function getSavedShmsOperator() {
            try {
                const raw = localStorage.getItem("shmsOperatorProfile");
                if (!raw) return null;
                const parsed = JSON.parse(raw);
                const fullName = String(parsed?.fullName || "").replace(/\s+/g, " ").trim();
                const mobileNo = String(parsed?.mobileNo || "").replace(/\D/g, "");
                if (!fullName || mobileNo.length < 10) return null;
                return { fullName, mobileNo, remember: true };
            } catch (_) {
                return null;
            }
        }

        function updateShmsOperatorUi() {
            const loginBlock = document.getElementById("shms-operator-login-block");
            const summaryBlock = document.getElementById("shms-operator-summary-block");
            const summaryText = document.getElementById("shms-operator-summary");
            const flowBlock = document.getElementById("shms-flow-block");
            const rememberInput = document.getElementById("shms-remember-operator");

            if (activeShmsOperator) {
                if (loginBlock) loginBlock.style.display = "none";
                if (summaryBlock) summaryBlock.style.display = "block";
                if (flowBlock) flowBlock.style.display = "block";
                if (summaryText) summaryText.innerText = `${activeShmsOperator.fullName} | ${activeShmsOperator.mobileNo}`;
            } else {
                if (loginBlock) loginBlock.style.display = "block";
                if (summaryBlock) summaryBlock.style.display = "none";
                if (flowBlock) flowBlock.style.display = "none";
                if (summaryText) summaryText.innerText = "";
                if (rememberInput) rememberInput.checked = true;
            }
        }

        function saveShmsOperator() {
            const nameInput = document.getElementById("shms-operator-name");
            const mobileInput = document.getElementById("shms-operator-mobile");
            const rememberInput = document.getElementById("shms-remember-operator");

            const fullName = String(nameInput?.value || "").replace(/\s+/g, " ").trim();
            const mobileNo = String(mobileInput?.value || "").replace(/\D/g, "");

            if (!fullName) return showToast("Operator ka full name likhiye", false);
            if (mobileNo.length < 10) return showToast("Valid mobile no likhiye", false);

            activeShmsOperator = {
                fullName,
                mobileNo,
                remember: !!rememberInput?.checked
            };

            if (activeShmsOperator.remember) {
                localStorage.setItem("shmsOperatorProfile", JSON.stringify(activeShmsOperator));
            } else {
                localStorage.removeItem("shmsOperatorProfile");
            }

            updateShmsOperatorUi();
            showToast("Operator login save ho gaya", true);
        }

        function editShmsOperator() {
            const nameInput = document.getElementById("shms-operator-name");
            const mobileInput = document.getElementById("shms-operator-mobile");
            const rememberInput = document.getElementById("shms-remember-operator");

            if (nameInput) nameInput.value = activeShmsOperator?.fullName || "";
            if (mobileInput) mobileInput.value = activeShmsOperator?.mobileNo || "";
            if (rememberInput) rememberInput.checked = activeShmsOperator?.remember !== false;

            activeShmsOperator = null;
            updateShmsOperatorUi();
        }

        function getSavedFeederOperator() {
            try {
                const raw = localStorage.getItem(feederOperatorStorageKey) || localStorage.getItem("shmsOperatorProfile");
                if (!raw) return null;
                const parsed = JSON.parse(raw);
                const fullName = String(parsed?.fullName || "").replace(/\s+/g, " ").trim();
                const mobileNo = String(parsed?.mobileNo || "").replace(/\D/g, "");
                if (!fullName || mobileNo.length < 10) return null;
                return { fullName, mobileNo, remember: true };
            } catch (_) {
                return null;
            }
        }

        function updateFeederOperatorUi() {
            const loginBlock = document.getElementById("feeder-operator-login-block");
            const summaryBlock = document.getElementById("feeder-operator-summary-block");
            const summaryText = document.getElementById("feeder-operator-summary");
            const flowBlock = document.getElementById("feeder-flow-block");
            const rememberInput = document.getElementById("feeder-remember-operator");

            if (activeFeederOperator) {
                if (loginBlock) loginBlock.style.display = "none";
                if (summaryBlock) summaryBlock.style.display = "block";
                if (flowBlock) flowBlock.style.display = "flex";
                if (summaryText) summaryText.innerText = `${activeFeederOperator.fullName} | ${activeFeederOperator.mobileNo}`;
            } else {
                if (loginBlock) loginBlock.style.display = "block";
                if (summaryBlock) summaryBlock.style.display = "none";
                if (flowBlock) flowBlock.style.display = "none";
                if (summaryText) summaryText.innerText = "";
                if (rememberInput) rememberInput.checked = true;
            }
        }

        function saveFeederOperator() {
            const nameInput = document.getElementById("feeder-operator-name");
            const mobileInput = document.getElementById("feeder-operator-mobile");
            const rememberInput = document.getElementById("feeder-remember-operator");

            const fullName = String(nameInput?.value || "").replace(/\s+/g, " ").trim();
            const mobileNo = String(mobileInput?.value || "").replace(/\D/g, "");

            if (!fullName) return showToast("Operator ka full name likhiye", false);
            if (mobileNo.length < 10) return showToast("Valid mobile no likhiye", false);

            activeFeederOperator = {
                fullName,
                mobileNo,
                remember: !!rememberInput?.checked
            };

            try {
                if (activeFeederOperator.remember) {
                    localStorage.setItem(feederOperatorStorageKey, JSON.stringify(activeFeederOperator));
                } else {
                    localStorage.removeItem(feederOperatorStorageKey);
                }
            } catch (_) {}

            updateFeederOperatorUi();
            showToast("Operator login save ho gaya", true);
        }

        function editFeederOperator() {
            const nameInput = document.getElementById("feeder-operator-name");
            const mobileInput = document.getElementById("feeder-operator-mobile");
            const rememberInput = document.getElementById("feeder-remember-operator");

            if (nameInput) nameInput.value = activeFeederOperator?.fullName || "";
            if (mobileInput) mobileInput.value = activeFeederOperator?.mobileNo || "";
            if (rememberInput) rememberInput.checked = activeFeederOperator?.remember !== false;

            activeFeederOperator = null;
            updateFeederOperatorUi();
        }

        function getSavedPeakLoadOperator() {
            try {
                const raw = localStorage.getItem(peakLoadOperatorStorageKey) || localStorage.getItem("shmsOperatorProfile");
                if (!raw) return null;
                const parsed = JSON.parse(raw);
                const fullName = String(parsed?.fullName || "").replace(/\s+/g, " ").trim();
                const mobileNo = String(parsed?.mobileNo || "").replace(/\D/g, "");
                if (!fullName || mobileNo.length < 10) return null;
                return { fullName, mobileNo, remember: true };
            } catch (_) {
                return null;
            }
        }

        function updatePeakLoadOperatorUi() {
            const loginBlock = document.getElementById("peak-load-operator-login-block");
            const summaryBlock = document.getElementById("peak-load-operator-summary-block");
            const summaryText = document.getElementById("peak-load-operator-summary");
            const flowBlock = document.getElementById("peak-load-flow-block");
            const rememberInput = document.getElementById("peak-load-remember-operator");

            if (activePeakLoadOperator) {
                if (loginBlock) loginBlock.style.display = "none";
                if (summaryBlock) summaryBlock.style.display = "block";
                if (flowBlock) flowBlock.style.display = "block";
                if (summaryText) summaryText.innerText = `${activePeakLoadOperator.fullName} | ${activePeakLoadOperator.mobileNo}`;
            } else {
                if (loginBlock) loginBlock.style.display = "block";
                if (summaryBlock) summaryBlock.style.display = "none";
                if (flowBlock) flowBlock.style.display = "none";
                if (summaryText) summaryText.innerText = "";
                if (rememberInput) rememberInput.checked = true;
            }
        }

        function savePeakLoadOperator() {
            const nameInput = document.getElementById("peak-load-operator-name");
            const mobileInput = document.getElementById("peak-load-operator-mobile");
            const rememberInput = document.getElementById("peak-load-remember-operator");

            const fullName = String(nameInput?.value || "").replace(/\s+/g, " ").trim();
            const mobileNo = String(mobileInput?.value || "").replace(/\D/g, "");

            if (!fullName) return showToast("Operator ka full name likhiye", false);
            if (mobileNo.length < 10) return showToast("Valid mobile no likhiye", false);

            activePeakLoadOperator = {
                fullName,
                mobileNo,
                remember: !!rememberInput?.checked
            };

            try {
                if (activePeakLoadOperator.remember) {
                    localStorage.setItem(peakLoadOperatorStorageKey, JSON.stringify(activePeakLoadOperator));
                } else {
                    localStorage.removeItem(peakLoadOperatorStorageKey);
                }
            } catch (_) {}

            updatePeakLoadOperatorUi();
            showToast("Operator login save ho gaya", true);
        }

        function editPeakLoadOperator() {
            const nameInput = document.getElementById("peak-load-operator-name");
            const mobileInput = document.getElementById("peak-load-operator-mobile");
            const rememberInput = document.getElementById("peak-load-remember-operator");

            if (nameInput) nameInput.value = activePeakLoadOperator?.fullName || "";
            if (mobileInput) mobileInput.value = activePeakLoadOperator?.mobileNo || "";
            if (rememberInput) rememberInput.checked = activePeakLoadOperator?.remember !== false;

            activePeakLoadOperator = null;
            updatePeakLoadOperatorUi();
        }

        function getPeakLoadSubmissionDateLabel() {
            const safeIso = /^\d{4}-\d{2}-\d{2}$/.test(String(selectedPeakLoadDateIso || "").trim())
                ? String(selectedPeakLoadDateIso).trim()
                : getTodayIsoDate();
            const [year, month, day] = safeIso.split("-");
            return `${day}/${month}/${year}`;
        }

        function updatePeakLoadDateSelection(isoValue) {
            const safeIso = /^\d{4}-\d{2}-\d{2}$/.test(String(isoValue || "").trim())
                ? String(isoValue).trim()
                : getTodayIsoDate();
            selectedPeakLoadDateIso = safeIso;
            const dateInput = document.getElementById("peak-load-date");
            const dateLabel = document.getElementById("peak-load-date-label");
            if (dateInput && dateInput.value !== safeIso) {
                dateInput.value = safeIso;
            }
            if (dateLabel) {
                const [year, month, day] = safeIso.split("-");
                dateLabel.innerText = `${day}/${month}/${year}`;
            }
        }

        function getPeakLoadAvailableSubstations() {
            const rows = Array.isArray(peakLoadRows) ? peakLoadRows : [];
            const set = new Set();
            rows.forEach((row) => {
                const substation = String(row?.substation || "").replace(/\s+/g, " ").trim();
                const feeder = String(row?.feeder || "").replace(/\s+/g, " ").trim().toUpperCase();
                if (!substation || !feeder) return;
                set.add(substation);
            });
            return Array.from(set);
        }

        function getPeakLoadFeederRows(substation) {
            const substationKey = normalizeFeederSubstationKey_(substation);
            return (Array.isArray(peakLoadRows) ? peakLoadRows : [])
                .filter((row) => normalizeFeederSubstationKey_(row.substation || "") === substationKey)
                .sort((a, b) => String(a.feeder || "").localeCompare(String(b.feeder || "")));
        }

        function getPeakLoadEntryKey(feederRow) {
            const substationKey = normalizeFeederSubstationKey_(feederRow?.substation || selectedPeakLoadSubstation || "");
            const feederKey = String(feederRow?.feeder || "").trim().toUpperCase();
            return `${substationKey}|${feederKey}`;
        }

        function resetPeakLoadSelection(keepSubstation = false) {
            if (!keepSubstation) {
                selectedPeakLoadSubstation = "";
                peakLoadEntries = [];
                const substationLabel = document.getElementById("peak-load-substation-label");
                if (substationLabel) substationLabel.innerText = "Select 33/11 KV Substation";
            }

            selectedPeakLoadFeeder = null;
            const feederLabel = document.getElementById("peak-load-feeder-label");
            const feederBlock = document.getElementById("peak-load-feeder-block");
            const feederMenu = document.getElementById("peak-load-feeder-menu");
            const entryBlock = document.getElementById("peak-load-entry-block");
            if (feederLabel) feederLabel.innerText = "Select 11 KV Feeder";
            if (feederBlock) feederBlock.style.display = keepSubstation && selectedPeakLoadSubstation ? "block" : "none";
            if (feederMenu) feederMenu.innerHTML = "";
            if (entryBlock) entryBlock.style.display = "none";
            togglePeakLoadDropdown("substation", false);
            togglePeakLoadDropdown("feeder", false);
            renderPeakLoadDoneList();
            updatePeakLoadSubmitState();
        }

        function renderPeakLoadTimeGrid(feederRow) {
            const grid = document.getElementById("peak-load-time-grid");
            const heading = document.getElementById("peak-load-entry-heading");
            const subheading = document.getElementById("peak-load-entry-subheading");
            const entryBlock = document.getElementById("peak-load-entry-block");
            const addBtn = document.getElementById("peak-load-add-btn");
            if (!grid || !heading || !subheading || !entryBlock || !addBtn) return;
            if (!feederRow) {
                entryBlock.style.display = "none";
                return;
            }

            const existing = peakLoadEntries.find((item) => item.key === getPeakLoadEntryKey(feederRow));
            heading.innerText = feederRow.feeder || "";
            subheading.innerText = `Meter No: ${feederRow.meterNo || "-"}`;
            addBtn.innerText = existing ? "Update List" : "Add To List";
            grid.innerHTML = peakLoadTimeSlots.map((time) => {
                const savedValue = existing?.loads?.find((item) => item.time === time)?.value || "";
                return `
                    <div style="display:grid; grid-template-columns:86px 1fr auto; gap:10px; align-items:center;">
                        <div style="font-size:13px; font-weight:800; color:#111827;">${time}</div>
                        <input class="ivrs-input peak-load-input" data-peak-load-time="${time}" type="number" inputmode="numeric" min="0" step="1" placeholder="Load" value="${escapeHtml(savedValue)}" style="height:42px; font-size:0.9rem; border-width:1.5px; text-align:center; padding:0 12px;">
                        <div style="font-size:13px; font-weight:900; color:#166534;">Amp</div>
                    </div>
                `;
            }).join("");
            entryBlock.style.display = "block";
        }

        function renderPeakLoadDoneList() {
            const doneBlock = document.getElementById("peak-load-done-list-block");
            const doneList = document.getElementById("peak-load-done-list");
            if (!doneBlock || !doneList) return;
            if (!peakLoadEntries.length) {
                doneBlock.style.display = "none";
                doneList.innerHTML = "";
                return;
            }
            doneBlock.style.display = "block";
            doneList.innerHTML = peakLoadEntries.map((item) => `
                <div style="background:#ffffff; border:1px solid #bbf7d0; border-radius:12px; padding:7px 10px; color:#166534; font-size:10px; font-weight:800; line-height:1.1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                    <span style="display:inline-block; max-width:100%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                        ${escapeHtml(item.feederName)} | Meter No: ${escapeHtml(item.meterNo || "-")} | Peak Load entry Done
                    </span>
                </div>
            `).join("");
        }

        function updatePeakLoadSubmitState() {
            const submitBlock = document.getElementById("peak-load-submit-block");
            const submitBtn = document.getElementById("peak-load-submit-btn");
            if (!submitBlock || !submitBtn) return;
            if (!selectedPeakLoadSubstation) {
                submitBlock.style.display = "none";
                submitBtn.disabled = true;
                return;
            }
            const totalFeeders = getPeakLoadFeederRows(selectedPeakLoadSubstation).length;
            const allAdded = totalFeeders > 0 && peakLoadEntries.length >= totalFeeders;
            submitBlock.style.display = allAdded ? "block" : "none";
            submitBtn.disabled = !allAdded;
        }

        function renderPeakLoadFeederMenu() {
            const feederMenu = document.getElementById("peak-load-feeder-menu");
            const feederBlock = document.getElementById("peak-load-feeder-block");
            if (!feederMenu || !feederBlock) return;
            const rows = getPeakLoadFeederRows(selectedPeakLoadSubstation);
            feederMenu.innerHTML = "";
            feederBlock.style.display = selectedPeakLoadSubstation ? "block" : "none";
            rows.forEach((row) => {
                const item = document.createElement("div");
                item.className = "option-item";
                const isDone = peakLoadEntries.some((entry) => entry.key === getPeakLoadEntryKey(row));
                item.innerHTML = isDone
                    ? `<span>${escapeHtml(row.feeder)} - </span><span style="color:#dc2626 !important; font-weight:900 !important; text-transform:uppercase;">Done</span>`
                    : escapeHtml(row.feeder);
                item.onclick = () => selectPeakLoadFeeder(row);
                feederMenu.appendChild(item);
            });
        }

        function selectPeakLoadSubstation(substation) {
            selectedPeakLoadSubstation = substation || "";
            peakLoadEntries = [];
            selectedPeakLoadFeeder = null;
            const substationLabel = document.getElementById("peak-load-substation-label");
            if (substationLabel) substationLabel.innerText = selectedPeakLoadSubstation || "Select 33/11 KV Substation";
            togglePeakLoadDropdown("substation", false);
            renderPeakLoadFeederMenu();
            renderPeakLoadTimeGrid(null);
            renderPeakLoadDoneList();
            updatePeakLoadSubmitState();
        }

        function selectPeakLoadFeeder(row) {
            selectedPeakLoadFeeder = row || null;
            const feederLabel = document.getElementById("peak-load-feeder-label");
            if (feederLabel) feederLabel.innerText = row?.feeder || "Select 11 KV Feeder";
            togglePeakLoadDropdown("feeder", false);
            renderPeakLoadTimeGrid(row);
        }

        function togglePeakLoadDropdown(type, forceState = null) {
            const configs = {
                substation: {
                    trigger: document.getElementById("peak-load-substation-trigger"),
                    menu: document.getElementById("peak-load-substation-menu")
                },
                feeder: {
                    trigger: document.getElementById("peak-load-feeder-trigger"),
                    menu: document.getElementById("peak-load-feeder-menu")
                }
            };

            Object.entries(configs).forEach(([key, config]) => {
                if (!config.trigger || !config.menu) return;
                if (key !== type) {
                    config.trigger.classList.remove("active");
                    config.menu.classList.remove("show");
                }
            });

            const current = configs[type];
            if (!current?.trigger || !current?.menu) return;

            const shouldShow = typeof forceState === "boolean"
                ? forceState
                : !current.menu.classList.contains("show");

            if (shouldShow) {
                current.trigger.classList.add("active");
                current.menu.classList.add("show");
            } else {
                current.trigger.classList.remove("active");
                current.menu.classList.remove("show");
            }
        }

        async function initDailyHourlyPeakLoad() {
            activePeakLoadOperator = getSavedPeakLoadOperator();
            updatePeakLoadOperatorUi();
            const loaded = await loadPeakLoadData(true);
            updatePeakLoadDateSelection(selectedPeakLoadDateIso || getTodayIsoDate());

            const substationMenu = document.getElementById("peak-load-substation-menu");
            const substationLabel = document.getElementById("peak-load-substation-label");
            if (substationMenu) {
                const list = getPeakLoadAvailableSubstations();
                substationMenu.innerHTML = "";
                list.forEach((substation) => {
                    const item = document.createElement("div");
                    item.className = "option-item";
                    item.innerText = substation;
                    item.onclick = () => selectPeakLoadSubstation(substation);
                    substationMenu.appendChild(item);
                });
                if (!list.length) {
                    const item = document.createElement("div");
                    item.className = "option-item";
                    item.innerText = loaded ? "Substation list abhi available nahi hai" : "Peak load feeder data load nahi ho paya";
                    substationMenu.appendChild(item);
                }
            }

            if (!selectedPeakLoadSubstation) {
                if (substationLabel) substationLabel.innerText = "Select 33/11 KV Substation";
                resetPeakLoadSelection();
            } else {
                if (substationLabel) substationLabel.innerText = selectedPeakLoadSubstation;
                renderPeakLoadFeederMenu();
                renderPeakLoadDoneList();
                updatePeakLoadSubmitState();
            }
        }

        function addPeakLoadEntryToList() {
            if (!activePeakLoadOperator) return showToast("Pehle operator login save kijiye", false);
            if (!selectedPeakLoadSubstation) return showToast("Pehle substation select kijiye", false);
            if (!selectedPeakLoadFeeder) return showToast("Pehle 11 KV feeder select kijiye", false);

            const inputs = Array.from(document.querySelectorAll("#peak-load-time-grid .peak-load-input"));
            if (inputs.length !== peakLoadTimeSlots.length) return showToast("Peak load grid ready nahi hai", false);

            const loads = [];
            for (const input of inputs) {
                const rawValue = String(input.value || "").trim();
                if (rawValue === "") {
                    return showToast("Sabhi 24 ghante ka peak load dijiye", false);
                }
                const numeric = Number(rawValue);
                if (Number.isNaN(numeric) || numeric < 0) {
                    return showToast("Peak load me valid Amp value dijiye", false);
                }
                loads.push({
                    time: String(input.getAttribute("data-peak-load-time") || "").trim(),
                    value: String(Math.round(numeric))
                });
            }

            const entry = {
                key: getPeakLoadEntryKey(selectedPeakLoadFeeder),
                substation: selectedPeakLoadSubstation,
                feederName: selectedPeakLoadFeeder.feeder || "",
                meterNo: selectedPeakLoadFeeder.meterNo || "",
                operatorName: activePeakLoadOperator.fullName,
                operatorMobile: activePeakLoadOperator.mobileNo,
                entryDate: getPeakLoadSubmissionDateLabel(),
                loads
            };

            peakLoadEntries = peakLoadEntries.filter((item) => item.key !== entry.key).concat(entry);
            showToast(`${entry.feederName} ka peak load add ho gaya`, true);
            selectedPeakLoadFeeder = null;
            const feederLabel = document.getElementById("peak-load-feeder-label");
            if (feederLabel) feederLabel.innerText = "Select 11 KV Feeder";
            renderPeakLoadTimeGrid(null);
            renderPeakLoadFeederMenu();
            renderPeakLoadDoneList();
            updatePeakLoadSubmitState();
        }

        async function submitPeakLoadEntries() {
            if (!activePeakLoadOperator) return showToast("Pehle operator login save kijiye", false);
            if (!selectedPeakLoadSubstation) return showToast("Pehle substation select kijiye", false);

            const submitBtn = document.getElementById("peak-load-submit-btn");
            const totalFeeders = getPeakLoadFeederRows(selectedPeakLoadSubstation).length;
            if (!totalFeeders) return showToast("Is substation ke 11 KV feeders nahi mile", false);
            if (peakLoadEntries.length < totalFeeders) {
                return showToast("Pehle sabhi 11 KV feeders ka peak load add kijiye", false);
            }

            const payload = {
                substation: selectedPeakLoadSubstation,
                operator_name: activePeakLoadOperator.fullName,
                operator_mobile: activePeakLoadOperator.mobileNo,
                date: getPeakLoadSubmissionDateLabel(),
                entries: peakLoadEntries.map((item) => ({
                    feeder: item.feederName,
                    meter_no: item.meterNo,
                    loads: item.loads
                }))
            };

            try {
                const existing = JSON.parse(localStorage.getItem(peakLoadSubmissionStorageKey) || "[]");
                const next = Array.isArray(existing) ? existing : [];
                next.push(payload);
                localStorage.setItem(peakLoadSubmissionStorageKey, JSON.stringify(next));
            } catch (_) {}

            const submissionDate = getCurrentDateDDMMYYYY();
            const submissionTime = getCurrentTimeHHMM();
            const rows = [];

            peakLoadEntries.forEach((item) => {
                (item.loads || []).forEach((load) => {
                    rows.push({
                        "33/11 KV SUBSTATION": item.substation || selectedPeakLoadSubstation,
                        "11 KV FEEDER": item.feederName || "",
                        "METER NO": item.meterNo || "",
                        "DATE (DD-MM-YYYY)": getPeakLoadSubmissionDateLabel(),
                        "TIME (HH:MM)": load.time || "",
                        "PEAK LOAD (A)": String(load.value || ""),
                        "NAME OF OPERATOR": activePeakLoadOperator.fullName,
                        "SUBMISSION DATE": submissionDate,
                        "SUBMISSION TIME": submissionTime
                    });
                });
            });

            if (!rows.length) return showToast("Peak load rows ready nahi hui", false);

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerText = "Submitting...";
            }

            try {
                const formData = new URLSearchParams();
                formData.append("module", "peakload");
                formData.append("entries_json", JSON.stringify(rows));

                const response = await fetch(peakLoadSubmitScriptUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
                    body: formData.toString()
                });

                const responseText = await response.text();
                let submitOk = response.ok;
                let submitMessage = submitOk ? "Daily hourly peak load submit ho gaya" : "Peak load submit error aaya";

                try {
                    const parsed = JSON.parse(responseText || "{}");
                    if (parsed && parsed.status === "error") {
                        submitOk = false;
                        submitMessage = parsed.message || "Peak load submit error aaya";
                    } else if (parsed && parsed.message) {
                        submitMessage = parsed.message;
                    }
                } catch (_) {
                    if (!submitOk && responseText) {
                        submitMessage = responseText;
                    }
                }

                if (!submitOk) {
                    throw new Error(submitMessage);
                }

                showToast(submitMessage || "Daily hourly peak load submit ho gaya", true);
                peakLoadEntries = [];
                resetPeakLoadSelection(true);
                renderPeakLoadFeederMenu();
            } catch (error) {
                showToast(error?.message || "Peak load submit blocked ya network issue aaya", false);
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerText = "Submit";
                }
            }
        }


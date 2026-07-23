        function initFeederReading() {
            const substationMenu = document.getElementById("feeder-substation-menu");
            const substationLabel = document.getElementById("feeder-substation-label");
            const dateInput = document.getElementById("feeder-reading-date");
            const dateLabel = document.getElementById("feeder-reading-date-label");
            const statusBox = document.getElementById("feeder-status");
            const listBox = document.getElementById("feeder-list");
            const submitBtn = document.getElementById("feeder-submit-btn");
            if (!substationMenu || !substationLabel || !dateInput || !dateLabel || !statusBox || !listBox || !submitBtn) return;

            loadRecentFeederSubmittedEntries_();
            activeFeederOperator = getSavedFeederOperator();
            updateFeederOperatorUi();
            populateFeederDatePickerOptions();
            substationLabel.innerText = selectedFeederSubstation || "Select 33/11 KV Substation";
            if (!dateLabel.innerText || dateLabel.innerText === "DD/MM/YYYY") {
                syncFeederDateInputs(getTodayIsoDate());
            }
            listBox.innerHTML = "";
            submitBtn.style.display = selectedFeederSubstation ? "block" : "none";
            setFeederStatus("", false);
            substationMenu.innerHTML = "";

            loadFeederData(true).then((loaded) => {
                substationMenu.innerHTML = "";
                if (!loaded) {
                    setFeederStatus("Feeder CSV load nahi ho paya.");
                    return;
                }

                feederSubstations.forEach((substation) => {
                    const item = document.createElement("div");
                    item.className = "option-item";
                    item.innerText = substation;
                    item.onclick = () => selectFeederSubstation(substation);
                    substationMenu.appendChild(item);
                });

                if (selectedFeederSubstation) {
                    renderFeederRows();
                    return;
                }
                setFeederStatus("", false);
            });

            loadFeederReportData(true).then(() => {
                if (selectedFeederSubstation) {
                    renderFeederRows();
                }
            });
        }

        function selectFeederSubstation(substation) {
            const substationLabel = document.getElementById("feeder-substation-label");
            selectedFeederSubstation = substation || "";
            if (substationLabel) {
                substationLabel.innerText = selectedFeederSubstation || "Select 33/11 KV Substation";
            }
            toggleFeederDropdown("substation", false);
            toggleFeederDatePicker(false);
            renderFeederRows();
            loadFeederReportData(true).then(() => renderFeederRows());
        }

        function setFeederStatus(message = "", show = true, type = "alert") {
            const statusBox = document.getElementById("feeder-status");
            if (!statusBox) return;
            statusBox.innerText = message;
            statusBox.classList.toggle("is-success", type === "success");
            statusBox.style.display = show && message ? "block" : "none";
        }

        function resetFeederReading() {
            selectedFeederSubstation = "";
            const substationLabel = document.getElementById("feeder-substation-label");
            const substationMenu = document.getElementById("feeder-substation-menu");
            const dateInput = document.getElementById("feeder-reading-date");
            const listBox = document.getElementById("feeder-list");
            const submitBtn = document.getElementById("feeder-submit-btn");

            if (substationLabel) {
                substationLabel.innerText = "Select 33/11 KV Substation";
            }
            if (substationMenu) {
                substationMenu.classList.remove("show");
            }
            toggleFeederDatePicker(false);
            const trigger = document.getElementById("feeder-substation-trigger");
            if (trigger) {
                trigger.classList.remove("active");
            }
            if (listBox) {
                listBox.innerHTML = "";
            }
            if (dateInput) {
                syncFeederDateInputs(getTodayIsoDate());
            }
            if (submitBtn) {
                submitBtn.style.display = "none";
            }
            setFeederStatus("", false);
        }

        function normalizeFeederDistributionKey(feederName) {
            return String(feederName || "").replace(/\s+/g, " ").trim().toUpperCase();
        }

        function getFeederDcDistribution(row) {
            const key = normalizeFeederDistributionKey(row?.feeder || "");
            const configured = Array.isArray(feederDcDistributionConfig[key]) ? feederDcDistributionConfig[key] : [];
            const mappedRows = configured
                .map((item) => ({
                    dcName: String(item?.dcName || "").replace(/\s+/g, " ").trim(),
                    percent: Number(item?.percent || 0)
                }))
                .filter((item) => item.dcName && item.percent > 0);
            if (mappedRows.length) return mappedRows;

            const defaultDcName = String(row?.dcName || "").replace(/\s+/g, " ").trim();
            if (defaultDcName) {
                return [{ dcName: defaultDcName, percent: 100 }];
            }
            return [{ dcName: "CHHAPARA-1", percent: 100 }];
        }

        function calculateFeederConsumption(previousReading, currentReading, mfValue) {
            const previous = Number(previousReading || 0);
            const current = Number(currentReading || 0);
            const mf = Number(mfValue || 0);
            const difference = Number((current - previous).toFixed(2));
            const consumption = Number((difference * mf).toFixed(2));
            return { previous, current, mf, difference, consumption };
        }

        function getCurrentTimeHHMM() {
            const now = new Date();
            const hour = String(now.getHours()).padStart(2, "0");
            const minute = String(now.getMinutes()).padStart(2, "0");
            return `${hour}:${minute}`;
        }

        function updateFeederConsumptionPreview(rowIndex) {
            const previousInput = document.getElementById(`feeder-prev-${rowIndex}`);
            const currentInput = document.getElementById(`feeder-current-${rowIndex}`);
            const previewBox = document.getElementById(`feeder-consumption-${rowIndex}`);
            const cardNode = document.querySelector(`[data-feeder-row-index="${rowIndex}"]`);
            if (!previousInput || !currentInput || !previewBox || !cardNode) return;

            const mfValue = Number(cardNode.getAttribute("data-mf") || 0);
            const result = calculateFeederConsumption(previousInput.value, currentInput.value, mfValue);

            if (!previousInput.value && !currentInput.value) {
                previewBox.innerHTML = `Consumption: reading dalte hi yahan auto calculation dikhegi.`;
                return;
            }
            if (result.current < result.previous) {
                previewBox.innerHTML = `Check: current reading previous reading se chhoti nahi ho sakti.`;
                return;
            }

            previewBox.innerHTML = `
                Difference: ${formatChhaparaNumber(result.difference)} | MF: ${formatChhaparaNumber(result.mf)}<br>
                Consumption: ${formatChhaparaNumber(result.consumption)}
            `;
        }

        function renderFeederRows() {
            const listBox = document.getElementById("feeder-list");
            const submitBtn = document.getElementById("feeder-submit-btn");
            if (!listBox || !submitBtn) return;

            listBox.innerHTML = "";
            const progressivePanelEl = document.getElementById("feeder-progressive-panel");
            if (!selectedFeederSubstation) {
                submitBtn.style.display = "none";
                setFeederStatus("", false);
                if (progressivePanelEl) progressivePanelEl.innerHTML = "";
                return;
            }

            const rows = feederRows
                .filter((row) => row.substation === selectedFeederSubstation)
                .sort((a, b) => a.feeder.localeCompare(b.feeder));

            if (!rows.length) {
                submitBtn.style.display = "block";
                setFeederStatus("Is substation ke feeders abhi CSV me nahi mile.");
                if (progressivePanelEl) progressivePanelEl.innerHTML = "";
                return;
            }

            const selectedDateKey = getFeederSelectedDateKey_();
            const sameDateEntries = getFeederSubmittedEntriesForDate_(selectedFeederSubstation, selectedDateKey);
            const submittedFeederKeys = new Set(
                sameDateEntries.map((entry) => String(entry["33 AND 11 KV FEEDER"] || entry.feeder || "").trim().toUpperCase()).filter(Boolean)
            );
            const allRowsSubmitted = rows.length > 0 && rows.every((row) => {
                // Unfrozen feeder ko "pending" maano taaki submit button wapas dikhe
                if (unfrozenFeederEntries.has(buildFeederUnfreezeKey_(row.substation, row.feeder, selectedDateKey))) return false;
                return submittedFeederKeys.has(String(row.feeder || "").trim().toUpperCase());
            });
            const blockingPendingKeys = getFeederBlockingPendingDateKeys_(selectedFeederSubstation, selectedDateKey);

            submitBtn.style.display = allRowsSubmitted ? "none" : "block";
            if (blockingPendingKeys.length) {
                setFeederStatus(buildFeederPendingAlertMessage_(blockingPendingKeys), true, "alert");
            } else {
                updateFeederPendingAlert(selectedFeederSubstation);
            }
            if (allRowsSubmitted && !blockingPendingKeys.length) {
                setFeederStatus("Is date ki feeder reading pehle se submit ho chuki hai.", true, "success");
            }
            listBox.innerHTML = rows.map((row, index) => {
                const autoPreviousReading = getFeederAutoPreviousReading_(row, selectedDateKey);
                const submittedEntry = getFeederSubmittedRowForDate_(row, selectedDateKey);
                const lockedPreviousReading = submittedEntry ? String(submittedEntry["PREVIUS READING"] || submittedEntry.previous_reading || "").trim() : "";
                const lockedCurrentReading = submittedEntry ? String(submittedEntry["CURRENT READING"] || submittedEntry.current_reading || "").trim() : "";
                const isAlreadySubmitted = !!submittedEntry;
                const meterParts = [];
                if (row.meterNo) meterParts.push(`Meter: ${escapeHtml(row.meterNo)}`);
                if (row.mf) meterParts.push(`MF: ${escapeHtml(row.mf)}`);
                const meterDetails = meterParts.length ? meterParts.join(" | ") : "Meter details available";
                return `
                    <div class="feeder-card" data-feeder-row-index="${index}" data-feeder-name="${escapeHtml(row.feeder)}" data-mf="${escapeHtml(row.mf || "0")}" data-meter-no="${escapeHtml(row.meterNo || "")}" data-dc-name="${escapeHtml(row.dcName || "")}">
                        <div class="feeder-card-top">
                            <div class="feeder-card-name">${escapeHtml(row.feeder)}</div>
                            <div class="feeder-card-badge">${escapeHtml(row.feederType)}</div>
                        </div>
                        <div class="feeder-card-meta">${meterDetails}</div>
                        ${isAlreadySubmitted ? `
                            <div style="display:flex; justify-content:flex-end; margin-top:6px;">
                                <button type="button" onclick="unfreezeFeederEntryConfirm_('${escapeHtml(row.substation)}', '${escapeHtml(row.feeder)}', '${selectedDateKey}')" style="border:none; background:#fef3c7; color:#92400e; border-radius:999px; padding:6px 12px; font-size:10px; font-weight:900; text-transform:uppercase;">✏️ Edit / Unfreeze</button>
                            </div>
                        ` : ""}
                          <div class="feeder-reading-grid">
                              <div class="feeder-reading-field">
                                  <div class="feeder-reading-label">Previous Reading</div>
                                  <input id="feeder-prev-${index}" class="feeder-reading-box" type="number" inputmode="numeric" step="0.01" placeholder="Previous" value="${escapeHtml(lockedPreviousReading || autoPreviousReading || row.previousReading || "")}" ${isAlreadySubmitted ? "readonly" : ""} oninput="updateFeederConsumptionPreview(${index})">
                                </div>
                                <div class="feeder-reading-field">
                                    <div class="feeder-reading-label">Current Reading</div>
                                    <input id="feeder-current-${index}" class="feeder-reading-box" type="number" inputmode="numeric" step="0.01" placeholder="Current" value="${escapeHtml(lockedCurrentReading || row.currentReading || "")}" ${isAlreadySubmitted ? "readonly" : ""} oninput="updateFeederConsumptionPreview(${index})">
                                </div>
                          </div>
                        <div id="feeder-consumption-${index}" class="feeder-consumption-box">${isAlreadySubmitted ? "Is feeder ki is date ki reading pehle se submit ho chuki hai." : "Consumption: reading dalte hi yahan auto calculation dikhegi."}</div>
                      </div>
                  `;
            }).join("");
            rows.forEach((_, index) => updateFeederConsumptionPreview(index));
            renderFeederProgressivePanel_(rows, selectedDateKey);
        }

        async function submitFeederReadings() {
            if (!activeFeederOperator) {
                return showToast("Pehle operator login save kijiye", false);
            }
            if (!selectedFeederSubstation) {
                return showToast("Pehle substation select kijiye", false);
            }

            const submitBtn = document.getElementById("feeder-submit-btn");
            const dateInput = document.getElementById("feeder-reading-date");
            const rows = feederRows
                .filter((row) => row.substation === selectedFeederSubstation)
                .sort((a, b) => a.feeder.localeCompare(b.feeder));

            if (!rows.length) {
                return showToast("Is substation ke feeders nahi mile", false);
            }

            if (!dateInput?.dataset.iso) {
                return showToast("Pehle Reading Date select kijiye", false);
            }

            const selectedDateKey = getFeederSelectedDateKey_();
            const blockingPendingKeys = getFeederBlockingPendingDateKeys_(selectedFeederSubstation, selectedDateKey);
            if (blockingPendingKeys.length) {
                const firstPendingKey = blockingPendingKeys[0];
                syncFeederDateInputs(firstPendingKey);
                renderFeederRows();
                const blockMessage = buildFeederPendingAlertMessage_(blockingPendingKeys);
                setFeederStatus(blockMessage, true, "alert");
                return showToast(`Pehle ${formatFeederDateLabelFromKey_(firstPendingKey)} ki feeder reading submit kijiye`, false);
            }

            const entries = [];
            const entryDate = formatFeederEntryDate(dateInput.dataset.iso);
            const entryTime = getCurrentTimeHHMM();

            for (let index = 0; index < rows.length; index += 1) {
                const row = rows[index];
                // Jo feeder is date par pehle se submitted hai (aur unfreeze nahi kiya gaya),
                // use skip karo — warna uski duplicate entry sheet me chali jayegi.
                if (getFeederSubmittedRowForDate_(row, selectedDateKey)) {
                    continue;
                }
                const previousInput = document.getElementById(`feeder-prev-${index}`);
                const currentInput = document.getElementById(`feeder-current-${index}`);
                const previousReading = previousInput?.value || "";
                const currentReading = currentInput?.value || "";

                if (!previousReading && !currentReading) {
                    continue;
                }
                if (!previousReading || !currentReading) {
                    return showToast(`${row.feeder} me previous aur current dono reading dijiye`, false);
                }

                const calc = calculateFeederConsumption(previousReading, currentReading, row.mf);
                if (!(calc.mf > 0)) {
                    return showToast(`${row.feeder} ka MF valid nahi hai`, false);
                }
                if (calc.current < calc.previous) {
                    return showToast(`${row.feeder} me current reading previous se chhoti hai`, false);
                }

                const distribution = getFeederDcDistribution(row);
                if (!distribution.length) {
                    return showToast(`${row.feeder} ka DC mapping/percentage abhi pending hai`, false);
                }

                const totalPercent = distribution.reduce((sum, item) => sum + Number(item.percent || 0), 0);
                if (Number(totalPercent.toFixed(2)) > 100) {
                    return showToast(`${row.feeder} ka total DC percentage 100 se zyada nahi ho sakta`, false);
                }

                distribution.forEach((item) => {
                    const splitConsumption = Number((calc.consumption * item.percent / 100).toFixed(2));
                    entries.push({
                        "33/11 KV SUBSTATION": row.substation || "",
                        "33 AND 11 KV FEEDER": row.feeder || "",
                        "METER NO": row.meterNo || "",
                        "PREVIUS READING": String(previousReading),
                        "CURRENT READING": String(currentReading),
                        "MF": String(row.mf || ""),
                        "CONSUMPTION": String(splitConsumption),
                        "DC NAME": item.dcName || "",
                        "DATE(DD/MM/YYY)": entryDate,
                        "TIME(HH/MM)": entryTime,
                        substation: row.substation || "",
                        feeder: row.feeder || "",
                        meter_no: row.meterNo || "",
                        previous_reading: String(previousReading),
                        current_reading: String(currentReading),
                        mf: String(row.mf || ""),
                        consumption: String(splitConsumption),
                        dc_name: item.dcName || "",
                        dc_percent: String(item.percent || ""),
                        date: entryDate,
                        time: entryTime,
                        ...currentEmployeeTag_()
                    });
                });
            }

            if (!entries.length) {
                return showToast("Kam se kam ek feeder ki reading dijiye", false);
            }

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerText = "Submitting...";
            }

            try {
                const payload = new URLSearchParams();
                payload.append("module", "feeder");
                payload.append("entries_json", JSON.stringify(entries));
                payload.append("auth_token", APPS_SCRIPT_AUTH_TOKEN);

                let submitOk = false;
                let feederQueuedOffline = false;
                let submitMessage = "Feeder readings submit ho gayi";

                try {
                    const response = await fetch(feederSubmitScriptUrl, {
                        method: "POST",
                        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
                        body: payload.toString()
                    });

                    const responseText = await response.text();
                    submitOk = response.ok;
                    if (!submitOk) submitMessage = "Feeder submit error aaya";

                    try {
                        const parsed = JSON.parse(responseText || "{}");
                        if (parsed && parsed.status === "error") {
                            submitOk = false;
                            submitMessage = parsed.message || "Feeder submit error aaya";
                        } else if (parsed && parsed.message) {
                            submitMessage = parsed.message;
                        }
                    } catch (_) {
                        if (!submitOk && responseText) {
                            submitMessage = responseText;
                        }
                    }
                } catch (networkError) {
                    submitOk = false;
                    submitMessage = networkError?.message || "Network error";
                    // Offline — payload queue me daal do, internet aane par khud submit hoga
                    try {
                        await queueOfflineSync_({ kind: "post_form", body: payload.toString() });
                        feederQueuedOffline = true;
                    } catch (qErr) { console.error(qErr); }
                }

                // Always save locally so the reading isn't lost, even if the cloud
                // sync failed. The reading will still be usable for progressive
                // consumption / unfreeze on THIS device, and a status note is shown
                // if it didn't reach the shared backend.
                saveRecentFeederSubmittedEntries_(entries);
                entries.forEach((entry) => {
                    const dateKey = buildFeederDateKey_(entry["DATE(DD/MM/YYY)"] || entry.date || "");
                    unfrozenFeederEntries.delete(buildFeederUnfreezeKey_(entry.substation, entry.feeder, dateKey));
                });

                if (submitOk) {
                    showToast(submitMessage || "Feeder readings submit ho gayi", true);
                } else if (feederQueuedOffline) {
                    showToast("Reading device par save ho gayi 🔄 Internet aane par apne aap cloud sync ho jayegi", true);
                } else {
                    showToast(
                        `Reading is device par save ho gayi, lekin cloud sync nahi ho paya: ${getFriendlyScriptError(submitMessage)}`,
                        false
                    );
                }
                resetFeederReading();
            } catch (error) {
                showToast(getFriendlyScriptError(error?.message) || "Feeder submit blocked ya network issue aaya", false);
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerText = "Submit";
                }
            }
        }

        function toggleFeederDropdown(type, forceState = null) {
            const trigger = document.getElementById(`feeder-${type}-trigger`);
            const menu = document.getElementById(`feeder-${type}-menu`);
            if (!trigger || !menu) return;

            const willShow = forceState === null ? !menu.classList.contains("show") : forceState;
            ["substation"].forEach((name) => {
                const otherTrigger = document.getElementById(`feeder-${name}-trigger`);
                const otherMenu = document.getElementById(`feeder-${name}-menu`);
                if (otherTrigger) otherTrigger.classList.remove("active");
                if (otherMenu) otherMenu.classList.remove("show");
            });

            if (willShow) {
                trigger.classList.add("active");
                menu.classList.add("show");
            }
        }

        document.addEventListener("click", (event) => {
            ["substation"].forEach((name) => {
                const trigger = document.getElementById(`feeder-${name}-trigger`);
                const menu = document.getElementById(`feeder-${name}-menu`);
                if (!trigger || !menu) return;
                const clickedInsideTrigger = trigger.contains(event.target);
                const clickedInsideMenu = menu.contains(event.target);
                if (!clickedInsideTrigger && !clickedInsideMenu) {
                    trigger.classList.remove("active");
                    menu.classList.remove("show");
                }
            });
        });


        async function checkFeederBackendStatus() {
            const box = document.getElementById("feeder-backend-status");
            if (!box) return;
            box.style.display = "block";
            box.style.background = "rgba(255,255,255,0.18)";
            box.style.color = "#fce7f3";
            box.innerText = "Checking...";

            try {
                const url = `${feederSubmitScriptUrl}?action=getFeederReadings&auth_token=${encodeURIComponent(APPS_SCRIPT_AUTH_TOKEN)}&t=${Date.now()}`;
                const response = await fetch(url);
                const text = await response.text();

                let parsed;
                try {
                    parsed = JSON.parse(text);
                } catch (_) {
                    box.style.background = "#fee2e2";
                    box.style.color = "#7f1d1d";
                    box.innerText = `❌ Backend ne JSON nahi bheja (HTML/error page mil raha hai). Apps Script deployment check karein.\n\nResponse (first 200 chars):\n${text.slice(0, 200)}`;
                    return;
                }

                if (Array.isArray(parsed)) {
                    box.style.background = "#dcfce7";
                    box.style.color = "#14532d";
                    box.innerText = `✅ Backend connected hai. Total saved readings: ${parsed.length}`;
                    return;
                }

                if (parsed && parsed.status === "error") {
                    box.style.background = "#fee2e2";
                    box.style.color = "#7f1d1d";
                    box.innerText = `❌ Backend error: ${parsed.message || "Unknown error"}\n\n${getFriendlyScriptError(parsed.message)}`;
                    return;
                }

                box.style.background = "#fef9c3";
                box.style.color = "#713f12";
                box.innerText = `⚠️ Backend se anjaan response mila:\n${JSON.stringify(parsed).slice(0, 200)}`;
            } catch (err) {
                box.style.background = "#fee2e2";
                box.style.color = "#7f1d1d";
                box.innerText = `❌ Network error: ${err?.message || "Unknown"}\n\nURL check karein ya internet connection check karein.`;
            }
        }

        function getFriendlyScriptError(message) {
            const raw = String(message || "").trim();
            const upper = raw.toUpperCase();
            if (!raw) return "Stock submit failed";
            if (upper.includes("SCRIPT FUNCTION NOT FOUND") || upper.includes("DOGET") || upper.includes("DOPOST")) {
                return "Backend script abhi sahi se deploy nahi hua hai. Entry safe hai (is device par save ho gayi), lekin cloud sync abhi nahi ho paya. Apps Script deployment dobara check karein.";
            }
            if (upper.includes("URLFETCHAPP")) return "Script me external permission pending hai. Apps Script ko ek baar authorize kijiye.";
            if (upper.includes("DRIVE")) return "Sheet ya Drive permission issue aaya. Apps Script deployment aur access settings check kijiye.";
            if (upper.includes("EXCEPTION")) return "Script side par error aaya. Apps Script version aur permissions check kijiye.";
            if (upper.includes("FAILED TO FETCH")) return "Network ya browser block ki wajah se submit nahi ho paya (entry is device par safe hai).";
            return raw;
        }

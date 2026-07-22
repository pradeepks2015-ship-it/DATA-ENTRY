        function getSavedStmComplaintOperator() {
            try {
                const raw = localStorage.getItem(stmComplaintOperatorStorageKey) || localStorage.getItem("shmsOperatorProfile");
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

        function updateStmComplaintOperatorUi() {
            const loginBlock = document.getElementById("stm-operator-login-block");
            const summaryBlock = document.getElementById("stm-operator-summary-block");
            const summaryText = document.getElementById("stm-operator-summary");
            const flowBlock = document.getElementById("stm-complaint-flow-block");
            const rememberInput = document.getElementById("stm-remember-operator");

            if (activeStmComplaintOperator) {
                if (loginBlock) loginBlock.style.display = "none";
                if (summaryBlock) summaryBlock.style.display = "block";
                if (flowBlock) flowBlock.style.display = "block";
                if (summaryText) summaryText.innerText = `${activeStmComplaintOperator.fullName} | ${activeStmComplaintOperator.mobileNo}`;
            } else {
                if (loginBlock) loginBlock.style.display = "block";
                if (summaryBlock) summaryBlock.style.display = "none";
                if (flowBlock) flowBlock.style.display = "none";
                if (summaryText) summaryText.innerText = "";
                if (rememberInput) rememberInput.checked = true;
            }
        }

        function populateStmComplaintSubstations() {
            const menu = document.getElementById("stm-complaint-substation-menu");
            const label = document.getElementById("stm-complaint-substation-label");
            if (!menu || !label) return;
            menu.innerHTML = "";
            allFeederSubstations.forEach((substation) => {
                const item = document.createElement("div");
                item.className = "option-item";
                item.innerText = substation;
                item.onclick = () => selectStmComplaintSubstation(substation);
                menu.appendChild(item);
            });
            label.innerText = selectedStmComplaintSubstation || "Select Substation Name";
        }

        function toggleStmComplaintSubstationDropdown() {
            const trigger = document.getElementById("stm-complaint-substation-trigger");
            const menu = document.getElementById("stm-complaint-substation-menu");
            if (!trigger || !menu) return;
            const isOpen = menu.classList.contains("show");
            document.querySelectorAll(".dropdown-menu").forEach((node) => {
                if (node.id !== "stm-complaint-substation-menu") node.classList.remove("show");
            });
            document.querySelectorAll(".professional-trigger").forEach((node) => {
                if (node.id !== "stm-complaint-substation-trigger") node.classList.remove("active");
            });
            menu.classList.toggle("show", !isOpen);
            trigger.classList.toggle("active", !isOpen);
        }

        function selectStmComplaintSubstation(substation) {
            selectedStmComplaintSubstation = String(substation || "").trim();
            const label = document.getElementById("stm-complaint-substation-label");
            const menu = document.getElementById("stm-complaint-substation-menu");
            const trigger = document.getElementById("stm-complaint-substation-trigger");
            if (label) label.innerText = selectedStmComplaintSubstation || "Select Substation Name";
            if (menu) menu.classList.remove("show");
            if (trigger) trigger.classList.remove("active");
            updateStmComplaintProgressiveUi();
        }

        function updateStmComplaintProgressiveUi() {
            const sharedStep = document.getElementById("stm-shared-step");
            const dateTimeStep = document.getElementById("stm-datetime-step");
            const callingStep = document.getElementById("stm-calling-step");
            const detailsStep = document.getElementById("stm-details-step");
            const submitBtn = document.getElementById("stm-complaint-submit-btn");
            const sharedMode = String(document.getElementById("stm-complaint-shared-mode")?.value || "").trim();
            const dateValue = String(document.getElementById("stm-complaint-date")?.value || "").trim();
            const timeValue = String(document.getElementById("stm-complaint-time")?.value || "").trim();
            const callingInfo = String(document.getElementById("stm-complaint-calling-info")?.value || "").trim();
            const complaintDetails = String(document.getElementById("stm-complaint-details")?.value || "").trim();
            const needsCallingInfo = sharedMode === "CALLING";
            const callingReady = !needsCallingInfo || !!callingInfo;

            if (sharedStep) sharedStep.style.display = selectedStmComplaintSubstation ? "block" : "none";
            if (dateTimeStep) dateTimeStep.style.display = selectedStmComplaintSubstation && sharedMode ? "block" : "none";
            if (callingStep) callingStep.style.display = selectedStmComplaintSubstation && sharedMode && dateValue && timeValue && needsCallingInfo ? "block" : "none";
            if (detailsStep) detailsStep.style.display = selectedStmComplaintSubstation && sharedMode && dateValue && timeValue && callingReady ? "block" : "none";
            if (submitBtn) submitBtn.style.display = selectedStmComplaintSubstation && sharedMode && dateValue && timeValue && callingReady && complaintDetails ? "flex" : "none";
        }

        let stmComplaintGeoData = null;

        function updateStmComplaintPhotoMetaUI() {
            const metaBox = document.getElementById("stm-complaint-photo-meta");
            const latLongNode = document.getElementById("stm-complaint-photo-latlong");
            const locationNode = document.getElementById("stm-complaint-photo-location");
            if (!metaBox || !latLongNode || !locationNode) return;
            if (!stmComplaintGeoData) {
                metaBox.style.display = "none";
                latLongNode.innerHTML = "<strong>Lat-Long:</strong> Not captured";
                locationNode.innerHTML = "<strong>Location:</strong> Not captured";
                return;
            }
            metaBox.style.display = "block";
            latLongNode.innerHTML = `<strong>Lat-Long:</strong> ${stmComplaintGeoData.latitude}, ${stmComplaintGeoData.longitude}`;
            locationNode.innerHTML = `<strong>Location:</strong> ${stmComplaintGeoData.locationText || "GPS location captured"}`;
        }

        async function updateStmComplaintPhotoName() {
            const input = document.getElementById("stm-complaint-photo");
            const label = document.getElementById("stm-complaint-photo-name");
            const fileName = input?.files?.[0]?.name || "";
            if (label) label.innerText = fileName || "Camera ya gallery dono se photo select kar sakte hain";

            if (!input?.files?.[0]) {
                stmComplaintGeoData = null;
                updateStmComplaintPhotoMetaUI();
                return;
            }

            try {
                stmComplaintGeoData = {
                    latitude: "Fetching...",
                    longitude: "Fetching...",
                    locationText: "GPS location detect ki ja rahi hai"
                };
                updateStmComplaintPhotoMetaUI();
                const position = await getCurrentPositionAsync();
                const latitude = position.coords.latitude.toFixed(6);
                const longitude = position.coords.longitude.toFixed(6);
                const locationText = await reverseGeocodeLocation(latitude, longitude);
                stmComplaintGeoData = { latitude, longitude, locationText };
                updateStmComplaintPhotoMetaUI();
            } catch (_) {
                stmComplaintGeoData = {
                    latitude: "Available nahi",
                    longitude: "Available nahi",
                    locationText: "GPS permission allow nahi hui ya signal weak tha"
                };
                updateStmComplaintPhotoMetaUI();
            }
        }

        function showStmShareOptions(encodedText, fallbackMobile) {
            const existing = document.getElementById("stm-share-overlay");
            if (existing) existing.remove();

            const overlay = document.createElement("div");
            overlay.id = "stm-share-overlay";
            overlay.style.cssText = "position:fixed; inset:0; background:rgba(0,0,0,0.45); z-index:9999; display:flex; align-items:center; justify-content:center; padding:20px;";

            const card = document.createElement("div");
            card.style.cssText = "background:#ffffff; border-radius:18px; padding:18px; width:100%; max-width:320px; box-shadow:0 12px 30px rgba(0,0,0,0.25);";

            card.innerHTML = `
                <div style="font-size:14px; font-weight:900; color:#5b3a21; text-transform:uppercase; text-align:center; margin-bottom:14px;">Complaint New Adegaon DC ko bhejein</div>
                <a href="https://wa.me/?text=${encodedText}" target="_blank" rel="noopener" style="display:flex; align-items:center; justify-content:center; gap:8px; width:100%; height:48px; border-radius:12px; background:linear-gradient(135deg,#25D366,#128C7E); color:#fff; font-size:13px; font-weight:900; text-transform:uppercase; text-decoration:none; margin-bottom:10px;">
                    WhatsApp Group Pe Bhejein
                </a>
                <a href="sms:?body=${encodedText}" style="display:flex; align-items:center; justify-content:center; gap:8px; width:100%; height:48px; border-radius:12px; background:linear-gradient(135deg,#3b82f6,#1d4ed8); color:#fff; font-size:13px; font-weight:900; text-transform:uppercase; text-decoration:none; margin-bottom:10px;">
                    Message (SMS) Bhejein
                </a>
                ${fallbackMobile ? `<a href="tel:${fallbackMobile}" style="display:flex; align-items:center; justify-content:center; gap:8px; width:100%; height:48px; border-radius:12px; background:linear-gradient(135deg,#f59e0b,#b45309); color:#fff; font-size:13px; font-weight:900; text-transform:uppercase; text-decoration:none; margin-bottom:10px;">Call Karein</a>` : ""}
                <button onclick="document.getElementById('stm-share-overlay').remove()" style="width:100%; height:44px; border:none; border-radius:12px; background:#e2e8f0; color:#1e293b; font-size:13px; font-weight:900; text-transform:uppercase;">Band Karein</button>
            `;

            overlay.appendChild(card);
            overlay.addEventListener("click", (e) => {
                if (e.target === overlay) overlay.remove();
            });
            document.body.appendChild(overlay);
        }

        function formatStmComplaintTimeInput(input) {
            if (!input) return;
            const digits = String(input.value || "").replace(/\D/g, "").slice(0, 4);
            if (digits.length <= 2) {
                input.value = digits;
                return;
            }
            input.value = `${digits.slice(0, 2)}:${digits.slice(2)}`;
        }

        async function getStmComplaintEntries_() {
            const rows = await idbGetAll_("stm_complaint");
            const local = rows.slice().sort((a, b) => (a.id || 0) - (b.id || 0));
            const shared = await fetchSharedEntries_("stm_complaint");
            return mergeLocalAndSharedEntries_(local, shared);
        }

        async function submitStmComplaintStub() {
            const sharedMode = String(document.getElementById("stm-complaint-shared-mode")?.value || "").trim();
            const dateValue = String(document.getElementById("stm-complaint-date")?.value || "").trim();
            const timeValue = String(document.getElementById("stm-complaint-time")?.value || "").trim();
            const callingInfo = String(document.getElementById("stm-complaint-calling-info")?.value || "").trim();
            const complaintDetails = String(document.getElementById("stm-complaint-details")?.value || "").trim();
            const photoInput = document.getElementById("stm-complaint-photo");
            const submitBtn = document.getElementById("stm-complaint-submit-btn");
            if (!selectedStmComplaintSubstation) return showToast("Substation select kijiye", false);
            if (!sharedMode) return showToast("Information shared at select kijiye", false);
            if (!dateValue || !timeValue) return showToast("Date aur time dijiye", false);
            if (sharedMode === "CALLING" && !callingInfo) return showToast("Calling details likhiye", false);
            if (!complaintDetails) return showToast("Complaint details likhiye", false);
            if (!activeStmComplaintOperator) return showToast("Pehle signup save kijiye", false);

            const file = photoInput?.files?.[0] || null;
            let photoBase64 = "";
            let photoName = "";
            let photoMimeType = "";

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerText = "Submitting...";
            }

            try {
                if (file) {
                    photoBase64 = await resizeImageForUpload(file, 1280, 0.78);
                    photoName = file.name || `stm-complaint-${Date.now()}.jpg`;
                    photoMimeType = file.type || "image/jpeg";
                }

                 const payload = new URLSearchParams();
                 payload.append("module", "stm");
                 payload.append("substation", selectedStmComplaintSubstation);
                 payload.append("operator_name", activeStmComplaintOperator.fullName || "");
                 payload.append("mobile_no", activeStmComplaintOperator.mobileNo || "");
                 payload.append("information_shared_at", sharedMode);
                 payload.append("date", dateValue);
                 payload.append("time", timeValue);
                 payload.append("calling_info", callingInfo);
                payload.append("complaint_details", complaintDetails);
                payload.append("photo_base64", photoBase64);
                payload.append("photo_name", photoName);
                payload.append("photo_mime_type", photoMimeType);

                const response = await fetch(stmComplaintScriptUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
                    body: payload.toString()
                });

                const responseText = await response.text();
                let parsed = {};
                try {
                    parsed = JSON.parse(responseText || "{}");
                } catch (_) {}

                if (!response.ok || (parsed.status && parsed.status !== "success")) {
                    throw new Error(parsed.message || "STM complaint submit nahi ho payi");
                }

                showToast(parsed.message || "STM complaint submit ho gayi", true);

                // Save a local copy for MIS reporting (independent of remote sheet)
                try {
                    const stmEntry = {
                        date: dateValue,
                        dateKey: buildFeederDateKey_(dateValue),
                        time: timeValue,
                        substation: selectedStmComplaintSubstation,
                        information_shared_at: sharedMode,
                        calling_info: callingInfo,
                        complaint_details: complaintDetails,
                        operator_name: activeStmComplaintOperator.fullName || "",
                        mobile_no: activeStmComplaintOperator.mobileNo || "",
                        dc_name: activeDC || "",
                        photo_data: photoBase64 || "",
                        photo_name: photoName || "",
                        gps_latitude: stmComplaintGeoData?.latitude || "",
                        gps_longitude: stmComplaintGeoData?.longitude || "",
                        gps_location: stmComplaintGeoData?.locationText || "",
                        timestamp: new Date().toISOString()
                    };

                    const stmEntryId = await syncEntryToCloud_("stm_complaint", stmEntry);
                    if (stmEntryId) {
                        stmEntry.entry_id = stmEntryId;
                    } else {
                        showToast(window.__lastSyncQueued ? "Internet nahi hai — entry device par save ho gayi 🔄 Internet aane par apne aap cloud sync ho jayegi" : "Internet/sync error: entry sirf is device par save hui, doosre users ko nahi dikhegi", false);
                    }

                    await idbAdd_("stm_complaint", stmEntry);
                    const MAX_STM_ENTRIES = IDB_STORE_LIMITS.stm_complaint;
                    const stmCount = await idbCount_("stm_complaint");
                    if (stmCount > MAX_STM_ENTRIES) {
                        await idbDeleteOldest_("stm_complaint", stmCount - MAX_STM_ENTRIES);
                        showToast(`Limit ${MAX_STM_ENTRIES} entries hai — sabse purani local entry auto-delete hui (cloud mein safe hai)`, true);
                    }
                    await checkStoreCapacityWarning_("stm_complaint", "STM Complaint");
                } catch (_) {}
                refreshStmMisTotal();
                refreshStorageCounter_("stm_complaint");
                if (document.getElementById("entries-list-stm_complaint")?.style.display !== "none") {
                    renderEntriesList_("stm_complaint");
                }

                // Open WhatsApp with complaint details so the operator can share to the New Adegaon DC group
                try {
                    const waLines = [
                        "*STM COMPLAINT - NEW ADEGAON DC*",
                        `Substation: ${selectedStmComplaintSubstation}`,
                        `Date: ${dateValue}  Time: ${timeValue}`,
                        `Information Shared At: ${sharedMode}`
                    ];
                    if (sharedMode === "CALLING" && callingInfo) waLines.push(`Calling Info: ${callingInfo}`);
                    waLines.push(`Complaint: ${complaintDetails}`);
                    waLines.push(`Operator: ${activeStmComplaintOperator.fullName} (${activeStmComplaintOperator.mobileNo})`);
                    if (stmComplaintGeoData && isValidLatLon_(stmComplaintGeoData.latitude, stmComplaintGeoData.longitude)) {
                        waLines.push(`Location: ${stmComplaintGeoData.locationText || ""}`);
                        waLines.push(`Map: https://www.google.com/maps/dir/?api=1&destination=${stmComplaintGeoData.latitude},${stmComplaintGeoData.longitude}`);
                    }
                    const waText = encodeURIComponent(waLines.join("\n"));
                    showStmShareOptions(waText, activeStmComplaintOperator.mobileNo || "");
                } catch (_) {}

                const sharedModeInput = document.getElementById("stm-complaint-shared-mode");
                const dateInput = document.getElementById("stm-complaint-date");
                const timeInput = document.getElementById("stm-complaint-time");
                const callingInfoInput = document.getElementById("stm-complaint-calling-info");
                const detailsInput = document.getElementById("stm-complaint-details");
                const photoNameLabel = document.getElementById("stm-complaint-photo-name");

                selectedStmComplaintSubstation = "";
                if (sharedModeInput) sharedModeInput.value = "";
                if (dateInput) dateInput.value = "";
                if (timeInput) timeInput.value = "";
                if (callingInfoInput) callingInfoInput.value = "";
                if (detailsInput) detailsInput.value = "";
                if (photoInput) photoInput.value = "";
                if (photoNameLabel) photoNameLabel.innerText = "Camera ya gallery dono se photo select kar sakte hain";
                stmComplaintGeoData = null;
                updateStmComplaintPhotoMetaUI();
                populateStmComplaintSubstations();
                updateStmComplaintProgressiveUi();
            } catch (error) {
                showToast(error?.message || "STM complaint submit nahi ho payi", false);
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerText = "Submit";
                }
            }
        }

        function saveStmComplaintOperator() {
            const nameInput = document.getElementById("stm-operator-name");
            const mobileInput = document.getElementById("stm-operator-mobile");
            const rememberInput = document.getElementById("stm-remember-operator");

            const fullName = String(nameInput?.value || "").replace(/\s+/g, " ").trim();
            const mobileNo = String(mobileInput?.value || "").replace(/\D/g, "");

            if (!fullName) return showToast("Full name likhiye", false);
            if (mobileNo.length < 10) return showToast("Valid mobile no likhiye", false);

            activeStmComplaintOperator = {
                fullName,
                mobileNo,
                remember: !!rememberInput?.checked
            };

            if (activeStmComplaintOperator.remember) {
                localStorage.setItem(stmComplaintOperatorStorageKey, JSON.stringify(activeStmComplaintOperator));
            } else {
                localStorage.removeItem(stmComplaintOperatorStorageKey);
            }

            updateStmComplaintOperatorUi();
            showToast("STM complaint signup save ho gaya", true);
        }

        function editStmComplaintOperator() {
            const nameInput = document.getElementById("stm-operator-name");
            const mobileInput = document.getElementById("stm-operator-mobile");
            const rememberInput = document.getElementById("stm-remember-operator");

            if (nameInput) nameInput.value = activeStmComplaintOperator?.fullName || "";
            if (mobileInput) mobileInput.value = activeStmComplaintOperator?.mobileNo || "";
            if (rememberInput) rememberInput.checked = activeStmComplaintOperator?.remember !== false;

            activeStmComplaintOperator = null;
            updateStmComplaintOperatorUi();
        }

        function initStmComplaintSignup() {
            activeStmComplaintOperator = getSavedStmComplaintOperator();
            populateStmComplaintSubstations();
            const nameInput = document.getElementById("stm-operator-name");
            const mobileInput = document.getElementById("stm-operator-mobile");
            const rememberInput = document.getElementById("stm-remember-operator");
            const sharedModeInput = document.getElementById("stm-complaint-shared-mode");
            const dateInput = document.getElementById("stm-complaint-date");
            const timeInput = document.getElementById("stm-complaint-time");
            const callingInfoInput = document.getElementById("stm-complaint-calling-info");
            const detailsInput = document.getElementById("stm-complaint-details");
            const photoInput = document.getElementById("stm-complaint-photo");
            const photoName = document.getElementById("stm-complaint-photo-name");
            if (!activeStmComplaintOperator) {
                if (nameInput) nameInput.value = "";
                if (mobileInput) mobileInput.value = "";
                if (rememberInput) rememberInput.checked = true;
            }
            if (sharedModeInput) sharedModeInput.value = "";
            if (dateInput) dateInput.value = "";
            if (timeInput) timeInput.value = "";
            if (callingInfoInput) callingInfoInput.value = "";
            if (detailsInput) detailsInput.value = "";
            if (photoInput) photoInput.value = "";
            if (photoName) photoName.innerText = "Camera ya gallery dono se photo select kar sakte hain";
            updateStmComplaintOperatorUi();
            updateStmComplaintProgressiveUi();
        }


        // ===== कर्मचारी कार्य चरित्रावली (Employee Conduct Register) =====

        const KC_JE_PASSWORD_HASH = "ff071d55cdc62f596330d654a854c4d0f3f98ec276d63fda71a596df0310daad";
        let kcJeLoggedIn = false;

        const KC_OFFICE = {
            officerName: "कनिष्ठ यंत्री",
            office: "आदेगांव बिजली वितरण केंद्र",
            division: "लखनदोंन डिवीज़न",
            circle: "सर्किल सिवनी"
        };

        async function kcGetAllEmployees_() {
            try {
                const all = await idbGetAll_("karya_charitra");
                const empMap = {};
                all.forEach((r) => {
                    const key = r.emp_id;
                    if (!empMap[key]) empMap[key] = { emp_id: r.emp_id, emp_name: r.emp_name, emp_designation: r.emp_designation, emp_mobile: r.emp_mobile };
                });
                return Object.values(empMap).sort((a, b) => a.emp_name.localeCompare(b.emp_name));
            } catch (_) { return []; }
        }

        async function kcGetEmployeeRecords_(empId) {
            try {
                const all = await idbGetAll_("karya_charitra");
                return all.filter((r) => r.emp_id === empId)
                    .sort((a, b) => new Date(a.scn_date_iso) - new Date(b.scn_date_iso));
            } catch (_) { return []; }
        }

        // mode: "force" = hamesha fresh network fetch (default). "soft" = 10s
        // cache window respect karo. "cache" = jo bhi cached hai turant, koi
        // network wait nahi — list turant instant render ke liye.
        async function kcGetAllRecords_(mode = "force") {
            try {
                const cloudRecords = mode === "cache"
                    ? (sharedModuleEntriesCache["karya_charitra"] || [])
                    : await fetchSharedEntries_("karya_charitra", mode === "force");
                const cloudIds = new Set(cloudRecords.map((r) => r.entry_id).filter(Boolean));

                // Get local IDB records
                const localAll = await idbGetAll_("karya_charitra");

                // Find local records that are NOT yet in cloud (old pre-sync entries)
                const unsynced = localAll.filter((r) => !r.entry_id || !cloudIds.has(r.entry_id));

                // Auto-migrate unsynced local records to cloud (fire and forget).
                // Routed through syncEntryToCloud_ so a failed attempt here also gets
                // queued in sync_queue for automatic retry, instead of only trying
                // again the next time this list happens to be opened. "cache" mode
                // sirf turant render ke liye hai — usme koi network call nahi honi chahiye.
                if (mode !== "cache" && unsynced.length && sharedModuleSyncEnabled) {
                    unsynced.forEach(async (record) => {
                        // If this retry has to be queued for later (offline), the queue
                        // replay finds its way back to this local record by client_id —
                        // so that id has to already be saved on the record, not just
                        // held in memory on the copy we're about to sync.
                        if (!record.client_id) {
                            record.client_id = genClientId_();
                            try { await idbPut_("karya_charitra", record); } catch (_) {}
                        }
                        const entryId = await syncEntryToCloud_("karya_charitra", record);
                        if (entryId) await kcUpdateLocalEntryId_(record.id, entryId);
                    });
                }

                // Merge cloud + unsynced local (so old entries show immediately even before migration completes)
                const merged = [...cloudRecords];
                unsynced.forEach((r) => {
                    if (!merged.find((c) => c.dispatch_no === r.dispatch_no && c.emp_id === r.emp_id)) {
                        merged.push(r);
                    }
                });

                return merged.sort((a, b) => new Date(a.scn_date_iso) - new Date(b.scn_date_iso));
            } catch (_) {
                const all = await idbGetAll_("karya_charitra");
                return all.sort((a, b) => new Date(a.scn_date_iso) - new Date(b.scn_date_iso));
            }
        }

        async function kcUpdateLocalEntryId_(localId, entryId) {
            try {
                const db = await openPhotoDb_();
                return new Promise((resolve) => {
                    const tx = db.transaction("karya_charitra", "readwrite");
                    const store = tx.objectStore("karya_charitra");
                    const req = store.get(localId);
                    req.onsuccess = () => {
                        if (req.result) store.put({ ...req.result, entry_id: entryId });
                    };
                    tx.oncomplete = () => resolve(true);
                    tx.onerror = () => resolve(false);
                });
            } catch (err) { console.error(err); return false; }
        }

        async function kcSaveRecord_(record) {
            try {
                if (sharedModuleSyncEnabled) {
                    // syncEntryToCloud_ queues this in sync_queue on network failure and
                    // auto-retries it (same protection broken_pole/bijli_chori already get) —
                    // the earlier bespoke fetch here just failed silently with nothing to
                    // retry it later.
                    const entryId = await syncEntryToCloud_("karya_charitra", record);
                    if (entryId) record.entry_id = entryId;
                }
                await idbAdd_("karya_charitra", record);
                return true;
            } catch (err) { console.error(err); return false; }
        }

        async function kcUpdateRecord_(id, updates) {
            // Update cloud
            if (sharedModuleSyncEnabled) {
                try {
                    let cloudEntryId = (typeof id === "string" && id.startsWith("E")) ? id : null;
                    if (!cloudEntryId) {
                        const all = await idbGetAll_("karya_charitra");
                        cloudEntryId = all.find((r) => r.id === id)?.entry_id || null;
                    }
                    if (cloudEntryId) {
                        const payload = new URLSearchParams();
                        payload.append("module", "karya_charitra");
                        payload.append("action", "updateEntry");
                        payload.append("entry_id", cloudEntryId);
                        payload.append("updates_json", JSON.stringify(updates));
                        payload.append("auth_token", APPS_SCRIPT_AUTH_TOKEN);
                        await fetchWithTimeout_(sharedModuleSyncScriptUrl, {
                            method: "POST",
                            headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
                            body: payload.toString()
                        });
                        sharedModuleLastFetch["karya_charitra"] = 0;
                    }
                } catch (err) {
                    // Network error (offline)? Queue it — processSyncQueue_ will replay
                    // this updateEntry call once internet is back, same as new SCNs do.
                    if (navigator.onLine === false || err instanceof TypeError) {
                        try {
                            let cloudEntryId = (typeof id === "string" && id.startsWith("E")) ? id : null;
                            if (!cloudEntryId) {
                                const all = await idbGetAll_("karya_charitra");
                                cloudEntryId = all.find((r) => r.id === id)?.entry_id || null;
                            }
                            if (cloudEntryId) {
                                await queueOfflineSync_({ kind: "kc_update", entryId: cloudEntryId, updates });
                            }
                        } catch (_) {}
                    }
                }
            }
            // Update local IDB
            try {
                const db = await openPhotoDb_();
                return new Promise((resolve) => {
                    const tx = db.transaction("karya_charitra", "readwrite");
                    const store = tx.objectStore("karya_charitra");
                    const req = store.get(id);
                    req.onsuccess = () => {
                        if (req.result) {
                            store.put({ ...req.result, ...updates });
                        } else {
                            const allReq = store.getAll();
                            allReq.onsuccess = () => {
                                const found = (allReq.result || []).find((r) => r.entry_id === id);
                                if (found) store.put({ ...found, ...updates });
                            };
                        }
                    };
                    tx.oncomplete = () => resolve(true);
                    tx.onerror = () => resolve(false);
                });
            } catch (err) { console.error(err); return false; }
        }

        function kcGetNextDispatchNo_() {
            return parseInt(localStorage.getItem("kc-dispatch-counter") || "1") || 1;
        }

        function kcIncrementDispatch_() {
            const n = kcGetNextDispatchNo_();
            localStorage.setItem("kc-dispatch-counter", String(n + 1));
            return n;
        }

        function kcFormatDate_(isoOrDate) {
            if (!isoOrDate) return "";
            const d = new Date(isoOrDate);
            if (isNaN(d.getTime())) return isoOrDate;
            return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
        }

        function kcTodayISO_() { return localTodayIso_(); }

        function kcBuildScnText_(r) {
            const dispatchStr = `क्र./आदे.वि.के./SCN-${String(r.dispatch_no).padStart(4,"0")}/${new Date(r.scn_date_iso).getFullYear()}`;
            const lines = [
                dispatchStr,
                `दिनांक: ${kcFormatDate_(r.scn_date_iso)}`,
                ``,
                `प्रेषक:`,
                `${KC_OFFICE.officerName}`,
                `${KC_OFFICE.office}`,
                `${KC_OFFICE.division}, ${KC_OFFICE.circle}`,
                ``,
                `प्रति:`,
                `श्री/श्रीमती ${r.emp_name}`,
                `${r.emp_designation || "कर्मचारी"}`,
                `${KC_OFFICE.office}`,
                ``,
                `विषय: कारण बताओ नोटिस (Show Cause Notice) — ${r.violation_type || "कार्य उल्लंघन"}`,
                ``,
                `महोदय/महोदया,`,
                ``,
                `आपके विरुद्ध निम्नलिखित तथ्य संज्ञान में आये हैं:`,
                ``,
                `घटना की तिथि: ${kcFormatDate_(r.incident_date)}`,
                `उल्लंघन का प्रकार: ${r.violation_type || ""}${r.other_reason && !r.violation_type?.includes(r.other_reason) ? ` (${r.other_reason})` : ""}`,
                ``,
                `विवरण:`,
                `${r.violation_desc || ""}`,
                ``,
                `अतः आपसे अपेक्षित है कि इस नोटिस की प्राप्ति के 07 दिवस के भीतर अपना स्पष्टीकरण लिखित में प्रस्तुत करें। यदि निर्धारित समय-सीमा में उत्तर नहीं दिया गया तो यह मान लिया जायेगा कि आपको कुछ नहीं कहना है और तदनुसार नियमानुसार कार्यवाही की जायेगी।`,
                ``,
                KC_OFFICE.officerName,
                KC_OFFICE.office,
                KC_OFFICE.division,
                KC_OFFICE.circle,
            ];
            if (r.reply_text) {
                lines.push(``, `─────────────────────────────────`, ``, `कर्मचारी का स्पष्टीकरण/उत्तर (दिनांक ${kcFormatDate_(r.reply_date_iso)}):`, ``, r.reply_text);
            }
            if (r.remark_text) {
                lines.push(``, `JE रिमार्क / अंतिम टिप्पणी:`, ``, r.remark_text);
            }
            return lines.join("\n");
        }


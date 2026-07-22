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

        async function kcGetAllRecords_() {
            try {
                // Fetch from cloud
                const cloudRecords = await fetchSharedEntries_("karya_charitra", true);
                const cloudIds = new Set(cloudRecords.map((r) => r.entry_id).filter(Boolean));

                // Get local IDB records
                const localAll = await idbGetAll_("karya_charitra");

                // Find local records that are NOT yet in cloud (old pre-sync entries)
                const unsynced = localAll.filter((r) => !r.entry_id || !cloudIds.has(r.entry_id));

                // Auto-migrate unsynced local records to cloud (fire and forget).
                // Routed through syncEntryToCloud_ so a failed attempt here also gets
                // queued in sync_queue for automatic retry, instead of only trying
                // again the next time this list happens to be opened.
                if (unsynced.length && sharedModuleSyncEnabled) {
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
                        await fetch(sharedModuleSyncScriptUrl, {
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

        // ===== UI =====

        function kcSetTab(tab) {
            const vp = document.getElementById("kc-view-panel");
            const ep = document.getElementById("kc-emp-panel");
            const jp = document.getElementById("kc-je-panel");
            const tv = document.getElementById("kc-tab-view");
            const te = document.getElementById("kc-tab-emp");
            const tj = document.getElementById("kc-tab-je");
            const inactiveStyle = { background: "#e2e8f0", color: "#1e293b" };
            [vp, ep, jp].forEach((p) => { if (p) p.style.display = "none"; });
            [tv, te, tj].forEach((b) => { if (b) { b.style.background = "#e2e8f0"; b.style.color = "#1e293b"; } });

            if (tab === "view") {
                if (vp) vp.style.display = "block";
                if (tv) { tv.style.background = "linear-gradient(135deg,#1e3a5f,#0f172a)"; tv.style.color = "#fff"; }
                kcRenderAllEmployees_();
            } else if (tab === "emp") {
                if (ep) ep.style.display = "block";
                if (te) { te.style.background = "linear-gradient(135deg,#0284c7,#0c4a6e)"; te.style.color = "#fff"; }
                kcRefreshEmpSelfDropdown_();
            } else {
                if (jp) jp.style.display = "block";
                if (tj) { tj.style.background = "linear-gradient(135deg,#1e3a5f,#0f172a)"; tj.style.color = "#fff"; }
                if (!kcJeLoggedIn) {
                    document.getElementById("kc-je-login-box").style.display = "block";
                    document.getElementById("kc-je-logged-panel").style.display = "none";
                }
            }
        }


        async function kcRefreshEmpSelfDropdown_() {
            const sel = document.getElementById("kc-emp-self-select");
            if (!sel) return;
            const employees = await kcGetAllEmployees_();
            const cur = sel.value;
            sel.innerHTML = `<option value="">-- अपना नाम चुनें --</option>`;
            employees.forEach((e) => {
                const opt = document.createElement("option");
                opt.value = e.emp_id;
                opt.text = `${e.emp_name} (${e.emp_designation || "कर्मचारी"})`;
                sel.appendChild(opt);
            });
            if (cur) { sel.value = cur; if (sel.value) kcLoadMyScns(); }
        }

        async function kcLoadMyScns() {
            const empId = document.getElementById("kc-emp-self-select").value;
            const container = document.getElementById("kc-my-scns-list");
            if (!container) return;
            if (!empId) { container.innerHTML = ""; return; }
            container.innerHTML = `<div style="text-align:center; padding:16px; font-size:12px; font-weight:800; color:#0284c7;">Loading...</div>`;
            const records = (await kcGetAllRecords_()).filter((r) => r.emp_id === empId);
            if (!records.length) {
                container.innerHTML = `<div style="text-align:center; padding:18px; font-size:13px; font-weight:800; color:#64748b; background:#f8fafc; border-radius:14px;">आपके नाम पर कोई SCN जारी नहीं है।</div>`;
                return;
            }
            container.innerHTML = records.map((r) => {
                const uid = r.entry_id || String(r.id);
                const hasReplied = !!r.reply_text;
                return `
                <div style="border:2px solid ${hasReplied ? "#86efac" : "#fbbf24"}; border-radius:16px; margin-bottom:14px; overflow:hidden;">
                    <div style="background:linear-gradient(135deg,#1e3a5f,#0f172a); padding:10px 14px; display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <div style="font-size:11px; font-weight:900; color:#e2e8f0;">SCN-${String(r.dispatch_no || "").padStart(4,"0")}</div>
                            <div style="font-size:10px; font-weight:700; color:#94a3b8;">${kcFormatDate_(r.scn_date_iso)} | घटना: ${kcFormatDate_(r.incident_date)}</div>
                        </div>
                        <span style="background:${hasReplied ? "#dcfce7" : "#fef9c3"}; color:${hasReplied ? "#14532d" : "#713f12"}; border-radius:999px; padding:4px 10px; font-size:9px; font-weight:900; text-transform:uppercase;">${hasReplied ? "✅ उत्तर दिया" : "⚠️ उत्तर बाकी"}</span>
                    </div>
                    <div style="padding:12px;">
                        <div style="background:#fef2f2; border-radius:10px; padding:10px; margin-bottom:10px;">
                            <div style="font-size:10px; font-weight:900; color:#991b1b; text-transform:uppercase; margin-bottom:4px;">उल्लंघन का आरोप</div>
                            <div style="font-size:12px; font-weight:900; color:#1e293b;">${escapeHtml(r.violation_type || "")}</div>
                            <div style="font-size:12px; font-weight:700; color:#334155; margin-top:4px; line-height:1.5;">${escapeHtml(r.violation_desc || "")}</div>
                        </div>
                        <div style="background:#eff6ff; border-radius:10px; padding:10px; margin-bottom:10px;">
                            <div style="font-size:10px; font-weight:900; color:#1d4ed8; text-transform:uppercase; margin-bottom:6px;">आपका स्पष्टीकरण / उत्तर</div>
                            ${hasReplied
                                ? `<div style="font-size:12px; font-weight:700; color:#1e293b; line-height:1.5;">${escapeHtml(r.reply_text)}</div>
                                   <div style="font-size:10px; font-weight:700; color:#64748b; margin-top:4px;">(${kcFormatDate_(r.reply_date_iso)})</div>
                                   <button onclick="kcEmpEditReply('${uid}')" style="margin-top:8px; border:none; background:#dbeafe; color:#1d4ed8; border-radius:8px; padding:6px 12px; font-size:10px; font-weight:900; text-transform:uppercase;">✏️ उत्तर बदलें</button>`
                                : `<textarea id="kc-emp-self-reply-${uid}" placeholder="यहाँ अपना स्पष्टीकरण लिखें... (7 दिन के अंदर उत्तर देना अनिवार्य है)" style="width:100%; min-height:90px; border-radius:8px; border:1.5px solid #93c5fd; padding:8px; font-size:13px; font-weight:700; resize:vertical; outline:none; margin-bottom:8px;"></textarea>
                                   <button onclick="kcSaveMyReply('${uid}')" style="width:100%; height:42px; border:none; border-radius:10px; background:linear-gradient(135deg,#1d4ed8,#1e3a5f); color:#fff; font-size:12px; font-weight:900; text-transform:uppercase;">💾 स्पष्टीकरण Submit करें</button>`
                            }
                        </div>
                        ${r.remark_text ? `
                        <div style="background:#fef9c3; border-radius:10px; padding:10px; margin-bottom:10px;">
                            <div style="font-size:10px; font-weight:900; color:#713f12; text-transform:uppercase; margin-bottom:4px;">JE रिमार्क</div>
                            <div style="font-size:12px; font-weight:700; color:#334155; line-height:1.5;">${escapeHtml(r.remark_text)}</div>
                        </div>` : ""}
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:6px;">
                            <button onclick="kcOpenShareModal('${uid}')" style="height:36px; border:none; border-radius:8px; background:linear-gradient(135deg,#25D366,#128C7E); color:#fff; font-size:10px; font-weight:900; text-transform:uppercase;">📤 WhatsApp</button>
                            <button onclick="kcCopyScnText('${uid}')" style="height:36px; border:none; border-radius:8px; background:linear-gradient(135deg,#3b82f6,#1d4ed8); color:#fff; font-size:10px; font-weight:900; text-transform:uppercase;">📋 Copy</button>
                        </div>
                    </div>
                </div>`;
            }).join("");
        }

        async function kcSaveMyReply(uid) {
            const textarea = document.getElementById(`kc-emp-self-reply-${uid}`);
            const replyText = textarea?.value?.trim() || "";
            if (!replyText) return showToast("स्पष्टीकरण लिखना आवश्यक है", false);
            const ok = await kcUpdateRecord_(uid, { reply_text: replyText, reply_date_iso: kcTodayISO_() });
            if (ok) {
                showToast("स्पष्टीकरण Save हो गया — सभी को दिखेगा", true);
                sharedModuleLastFetch["karya_charitra"] = 0;
                await kcLoadMyScns();
            } else {
                showToast("Save karne mein error aaya", false);
            }
        }

        async function kcEmpEditReply(uid) {
            const overlay = document.createElement("div");
            overlay.style.cssText = "position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:20px;";
            const card = document.createElement("div");
            card.style.cssText = "background:#fff; border-radius:16px; padding:18px; width:100%; max-width:300px; text-align:center;";
            card.innerHTML = `
                <div style="font-size:13px; font-weight:900; color:#1e3a5f; margin-bottom:10px;">उत्तर बदलें?</div>
                <div style="font-size:12px; font-weight:700; color:#475569; margin-bottom:16px;">पुराना उत्तर हट जाएगा और आप नया उत्तर लिख सकेंगे।</div>
                <div style="display:flex; gap:10px;">
                    <button onclick="this.closest('[style*=fixed]').remove()" style="flex:1; height:40px; border:none; border-radius:10px; background:#e2e8f0; color:#1e293b; font-size:12px; font-weight:900;">Cancel</button>
                    <button id="kc-edit-confirm-btn" style="flex:1; height:40px; border:none; border-radius:10px; background:#1d4ed8; color:#fff; font-size:12px; font-weight:900;">हाँ, बदलें</button>
                </div>`;
            overlay.appendChild(card);
            overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
            document.body.appendChild(overlay);
            document.getElementById("kc-edit-confirm-btn").onclick = async () => {
                overlay.remove();
                await kcUpdateRecord_(uid, { reply_text: "", reply_date_iso: "" });
                sharedModuleLastFetch["karya_charitra"] = 0;
                await kcLoadMyScns();
            };
        }

        async function kcJeLogin() {
            if ((await sha256Hex_(document.getElementById("kc-je-pwd").value)) === KC_JE_PASSWORD_HASH) {
                kcJeLoggedIn = true;
                document.getElementById("kc-je-login-box").style.display = "none";
                document.getElementById("kc-je-logged-panel").style.display = "block";
                document.getElementById("kc-je-pwd").value = "";
                kcRefreshJeDropdowns_();
                kcJeSetMode("new");
                showToast("JE Login successful", true);
            } else {
                showToast("गलत पासवर्ड", false);
            }
        }

        function kcJeLogout() {
            kcJeLoggedIn = false;
            document.getElementById("kc-je-login-box").style.display = "block";
            document.getElementById("kc-je-logged-panel").style.display = "none";
            showToast("Logout ho gaye", true);
        }

        // ===== SCN Delete (JE only, password protected) =====
        const KC_DELETE_PASSWORD_HASH = "ff071d55cdc62f596330d654a854c4d0f3f98ec276d63fda71a596df0310daad";

        function kcDeleteScnConfirm_(recordId, dispatchNo) {
            if (!kcJeLoggedIn) return showToast("पहले JE लॉगिन करें", false);
            const existing = document.getElementById("kc-delete-overlay");
            if (existing) existing.remove();

            const overlay = document.createElement("div");
            overlay.id = "kc-delete-overlay";
            overlay.style.cssText = "position:fixed; inset:0; background:rgba(0,0,0,0.55); z-index:9999; display:flex; align-items:center; justify-content:center; padding:20px;";

            const card = document.createElement("div");
            card.style.cssText = "background:#ffffff; border-radius:18px; padding:18px; width:100%; max-width:320px; box-shadow:0 12px 30px rgba(0,0,0,0.25); text-align:center;";
            card.innerHTML = `
                <div style="font-size:14px; font-weight:900; color:#b91c1c; text-transform:uppercase; margin-bottom:10px;">SCN-${escapeHtml(dispatchNo)} Delete करें?</div>
                <div style="font-size:12px; font-weight:700; color:#475569; margin-bottom:10px;">
                    यह SCN स्थायी रूप से delete हो जाएगा (इस device और cloud दोनों से)। Delete करने के लिए JE delete password डालें।
                </div>
                <input id="kc-delete-pwd" type="password" placeholder="Delete Password" style="width:100%; height:44px; border-radius:10px; border:1.5px solid #dc2626; padding:0 12px; font-size:13px; font-weight:700; outline:none; margin-bottom:12px;">
                <div style="display:flex; gap:10px;">
                    <button onclick="document.getElementById('kc-delete-overlay').remove()" style="flex:1; height:44px; border:none; border-radius:12px; background:#e2e8f0; color:#1e293b; font-size:12px; font-weight:900; text-transform:uppercase;">Cancel</button>
                    <button onclick="kcConfirmDeleteScn_('${escapeHtml(String(recordId))}')" style="flex:1; height:44px; border:none; border-radius:12px; background:linear-gradient(135deg,#dc2626,#7f1d1d); color:#fff; font-size:12px; font-weight:900; text-transform:uppercase;">Delete</button>
                </div>
            `;
            overlay.appendChild(card);
            overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
            document.body.appendChild(overlay);
            setTimeout(() => document.getElementById("kc-delete-pwd")?.focus(), 50);
        }

        async function kcConfirmDeleteScn_(recordId) {
            const pwd = document.getElementById("kc-delete-pwd")?.value || "";
            if ((await sha256Hex_(pwd)) !== KC_DELETE_PASSWORD_HASH) {
                return showToast("गलत delete पासवर्ड", false);
            }
            const overlay = document.getElementById("kc-delete-overlay");
            if (overlay) overlay.remove();

            // Find matching local record (recordId may be local numeric id or cloud entry_id)
            let localRecord = null;
            try {
                const all = await idbGetAll_("karya_charitra");
                localRecord = all.find((r) => String(r.id) === String(recordId) || r.entry_id === recordId) || null;
            } catch (_) {}

            // Delete from cloud (if entry has a cloud entry_id)
            const cloudEntryId = (typeof recordId === "string" && recordId.startsWith("E"))
                ? recordId
                : (localRecord?.entry_id || null);
            let cloudOk = true;
            if (cloudEntryId) {
                cloudOk = await deleteSharedEntry_("karya_charitra", cloudEntryId);
                sharedModuleLastFetch["karya_charitra"] = 0;
            }

            // Delete from local IDB
            if (localRecord) {
                try { await idbDelete_("karya_charitra", localRecord.id); } catch (_) {}
            }

            if (cloudEntryId && !cloudOk) {
                showToast("Local se delete हुआ, लेकिन cloud sync में error आया", false);
            } else {
                showToast("SCN delete हो गया", true);
            }

            await kcRefreshJeDropdowns_();
            await kcLoadScnForRemark();
        }

        function kcJeSetMode(mode) {
            const nf = document.getElementById("kc-new-scn-form");
            const rf = document.getElementById("kc-remark-form");
            const nb = document.getElementById("kc-je-mode-new-btn");
            const rb = document.getElementById("kc-je-mode-remark-btn");
            if (mode === "new") {
                nf.style.display = "block"; rf.style.display = "none";
                nb.style.background = "linear-gradient(135deg,#1e3a5f,#0f172a)"; nb.style.color = "#fff";
                rb.style.background = "#e2e8f0"; rb.style.color = "#1e293b";
            } else {
                nf.style.display = "none"; rf.style.display = "block";
                rb.style.background = "linear-gradient(135deg,#1e3a5f,#0f172a)"; rb.style.color = "#fff";
                nb.style.background = "#e2e8f0"; nb.style.color = "#1e293b";
                kcRefreshJeDropdowns_();
            }
        }

        async function kcRefreshJeDropdowns_() {
            const employees = await kcGetAllEmployees_();
            ["kc-scn-emp", "kc-remark-emp"].forEach((id) => {
                const sel = document.getElementById(id);
                if (!sel) return;
                const cur = sel.value;
                sel.innerHTML = `<option value="">-- कर्मचारी चुनें / नया जोड़ें --</option>`;
                employees.forEach((e) => {
                    const opt = document.createElement("option");
                    opt.value = e.emp_id;
                    opt.text = `${e.emp_name} (${e.emp_designation || "कर्मचारी"})`;
                    sel.appendChild(opt);
                });
                if (cur) sel.value = cur;
            });
        }

        // Renders all employees grouped, with their SCNs below each name
        async function kcRenderAllEmployees_() {
            const container = document.getElementById("kc-all-employees-list");
            if (!container) return;
            container.innerHTML = `<div style="text-align:center; padding:16px; font-size:12px; font-weight:800; color:#64748b;">Loading...</div>`;

            const allRecords = await kcGetAllRecords_();
            if (!allRecords.length) {
                container.innerHTML = `<div style="text-align:center; padding:18px; font-size:13px; font-weight:800; color:#64748b; background:#f8fafc; border-radius:14px;">अभी तक कोई SCN दर्ज नहीं किया गया है।</div>`;
                return;
            }

            // Group by employee
            const empGroups = {};
            allRecords.forEach((r) => {
                if (!empGroups[r.emp_id]) {
                    empGroups[r.emp_id] = { emp_name: r.emp_name, emp_designation: r.emp_designation, emp_mobile: r.emp_mobile, records: [] };
                }
                empGroups[r.emp_id].records.push(r);
            });

            container.innerHTML = Object.entries(empGroups).map(([empId, group]) => `
                <div style="border:2px solid #1e3a5f; border-radius:16px; margin-bottom:16px; overflow:hidden;">
                    <!-- Employee Header -->
                    <div style="background:linear-gradient(135deg,#1e3a5f,#0f172a); padding:12px 14px; display:flex; align-items:center; justify-content:space-between;">
                        <div>
                            <div style="font-size:14px; font-weight:900; color:#e2e8f0;">${escapeHtml(group.emp_name)}</div>
                            <div style="font-size:11px; font-weight:700; color:#94a3b8;">${escapeHtml(group.emp_designation || "कर्मचारी")}</div>
                        </div>
                        <div style="background:${group.records.length > 1 ? "#fee2e2" : "#fef9c3"}; color:${group.records.length > 1 ? "#991b1b" : "#713f12"}; border-radius:999px; padding:4px 12px; font-size:11px; font-weight:900;">${group.records.length} SCN</div>
                    </div>

                    <!-- SCN Cards for this employee -->
                    <div style="padding:10px;">
                        ${group.records.map((r, idx) => `
                            <div style="border:1px solid ${r.reply_text ? "#bbf7d0" : "#fde68a"}; border-radius:12px; padding:10px; margin-bottom:${idx < group.records.length - 1 ? "10px" : "0"}; background:${r.reply_text ? "#f0fdf4" : "#fffbeb"};">
                                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:6px; margin-bottom:6px;">
                                    <div>
                                        <div style="font-size:10px; font-weight:900; color:#1e3a5f; text-transform:uppercase;">SCN-${String(r.dispatch_no || "").padStart(4,"0")} | ${kcFormatDate_(r.scn_date_iso)}</div>
                                        <div style="font-size:12px; font-weight:900; color:#334155;">${escapeHtml(r.violation_type || "")}</div>
                                        <div style="font-size:10px; font-weight:700; color:#64748b;">घटना: ${kcFormatDate_(r.incident_date)}</div>
                                    </div>
                                    <span style="flex-shrink:0; background:${r.reply_text ? "#dcfce7" : "#fee2e2"}; color:${r.reply_text ? "#14532d" : "#991b1b"}; border-radius:999px; padding:3px 8px; font-size:9px; font-weight:900; text-transform:uppercase;">${r.reply_text ? "उत्तर दिया" : "उत्तर बाकी"}</span>
                                </div>

                                <div style="font-size:12px; font-weight:700; color:#334155; line-height:1.5; margin-bottom:8px; padding:8px; background:#f8fafc; border-radius:8px;">${escapeHtml(r.violation_desc || "")}</div>

                                <!-- Employee Reply Section (no password needed) -->
                                <div style="background:#eff6ff; border-radius:8px; padding:8px; margin-bottom:8px;">
                                    <div style="font-size:10px; font-weight:900; color:#1d4ed8; margin-bottom:6px;">कर्मचारी का स्पष्टीकरण/उत्तर:</div>
                                    ${r.reply_text
                                        ? `<div style="font-size:12px; font-weight:700; color:#1e293b; line-height:1.5; margin-bottom:6px;">${escapeHtml(r.reply_text)}</div><div style="font-size:10px; font-weight:700; color:#64748b;">(${kcFormatDate_(r.reply_date_iso)})</div>`
                                        : `<textarea id="kc-emp-reply-${r.entry_id || r.id}" placeholder="यहाँ अपना स्पष्टीकरण / उत्तर लिखें..." style="width:100%; min-height:70px; border-radius:8px; border:1.5px solid #bfdbfe; padding:8px; font-size:12px; font-weight:700; resize:vertical; outline:none; margin-bottom:6px;"></textarea>
                                        <button onclick="kcSaveEmpReply('${r.entry_id || r.id}')" style="width:100%; height:36px; border:none; border-radius:8px; background:linear-gradient(135deg,#1d4ed8,#1e3a5f); color:#fff; font-size:11px; font-weight:900; text-transform:uppercase;">💾 उत्तर Save करें</button>`
                                    }
                                </div>

                                <!-- JE Remark (read-only display here) -->
                                ${r.remark_text ? `
                                    <div style="background:#fef9c3; border-radius:8px; padding:8px; margin-bottom:8px;">
                                        <div style="font-size:10px; font-weight:900; color:#713f12; margin-bottom:4px;">JE रिमार्क:</div>
                                        <div style="font-size:12px; font-weight:700; color:#334155; line-height:1.5;">${escapeHtml(r.remark_text)}</div>
                                    </div>
                                ` : ""}

                                <!-- Share buttons -->
                                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:6px;">
                                    <button onclick="kcOpenShareModal('${r.entry_id || r.id}')" style="height:36px; border:none; border-radius:8px; background:linear-gradient(135deg,#25D366,#128C7E); color:#fff; font-size:10px; font-weight:900; text-transform:uppercase;">📤 WhatsApp</button>
                                    <button onclick="kcCopyScnText('${r.entry_id || r.id}')" style="height:36px; border:none; border-radius:8px; background:linear-gradient(135deg,#3b82f6,#1d4ed8); color:#fff; font-size:10px; font-weight:900; text-transform:uppercase;">📋 Word Copy</button>
                                </div>
                            </div>
                        `).join("")}
                    </div>
                </div>
            `).join("");
        }

        async function kcSaveEmpReply(recordId) {
            const textarea = document.getElementById(`kc-emp-reply-${recordId}`);
            const replyText = textarea?.value?.trim() || "";
            if (!replyText) return showToast("उत्तर लिखना आवश्यक है", false);
            const ok = await kcUpdateRecord_(recordId, { reply_text: replyText, reply_date_iso: kcTodayISO_() });
            if (ok) {
                showToast("स्पष्टीकरण Save हो गया", true);
                await kcRenderAllEmployees_();
            } else {
                showToast("Save karne mein error aaya", false);
            }
        }

        function kcToggleOtherReason() {
            const sel = document.getElementById("kc-violation-type");
            const box = document.getElementById("kc-other-reason-box");
            if (!sel || !box) return;
            box.style.display = sel.value === "अन्य" ? "block" : "none";
            if (sel.value !== "अन्य") {
                const inp = document.getElementById("kc-other-reason");
                if (inp) inp.value = "";
            }
        }

        async function kcSaveScn() {
            const empSelect = document.getElementById("kc-scn-emp").value;
            const newEmpName = document.getElementById("kc-new-emp-name").value.trim();
            const designation = document.getElementById("kc-new-emp-designation").value.trim();
            const mobile = document.getElementById("kc-new-emp-mobile").value.trim();
            const violationType = document.getElementById("kc-violation-type").value;
            const otherReason = document.getElementById("kc-other-reason").value.trim();
            const incidentDate = document.getElementById("kc-incident-date").value;
            const desc = document.getElementById("kc-violation-desc").value.trim();

            if (!newEmpName && !empSelect) return showToast("कर्मचारी का नाम या चयन करें", false);
            if (!violationType) return showToast("उल्लंघन का प्रकार चुनें", false);
            if (violationType === "अन्य" && !otherReason) return showToast("अन्य कारण विस्तार से लिखें", false);
            if (!incidentDate) return showToast("घटना की तिथि भरें", false);
            if (!desc) return showToast("उल्लंघन का विवरण लिखें", false);

            // Build final violation type label (includes other reason if "अन्य")
            const finalViolationType = violationType === "अन्य"
                ? `अन्य: ${otherReason}`
                : violationType;

            let empId = empSelect;
            let empName = empSelect;
            let empDes = designation;
            let empMob = mobile;

            if (newEmpName) {
                empId = newEmpName.toUpperCase().replace(/\s+/g, "_");
                empName = newEmpName;
            } else if (empSelect) {
                const employees = await kcGetAllEmployees_();
                const found = employees.find((e) => e.emp_id === empSelect);
                if (found) { empName = found.emp_name; empDes = found.emp_designation; empMob = found.emp_mobile; }
            }

            const dispatchNo = kcIncrementDispatch_();
            const record = {
                emp_id: empId,
                emp_name: empName,
                emp_designation: empDes || "",
                emp_mobile: empMob || "",
                dispatch_no: dispatchNo,
                scn_date_iso: kcTodayISO_(),
                incident_date: incidentDate,
                violation_type: finalViolationType,
                other_reason: otherReason,
                violation_desc: desc,
                created_at: new Date().toISOString(),
                reply_text: "",
                reply_date_iso: "",
                remark_text: ""
            };

            const ok = await kcSaveRecord_(record);
            if (!ok) return showToast("Save karne mein error aaya", false);

            showToast(`SCN-${String(dispatchNo).padStart(4,"0")} दर्ज हो गया`, true);
            document.getElementById("kc-scn-emp").value = "";
            document.getElementById("kc-new-emp-name").value = "";
            document.getElementById("kc-new-emp-designation").value = "";
            document.getElementById("kc-new-emp-mobile").value = "";
            document.getElementById("kc-violation-type").value = "";
            document.getElementById("kc-other-reason").value = "";
            document.getElementById("kc-other-reason-box").style.display = "none";
            document.getElementById("kc-incident-date").value = kcTodayISO_();
            document.getElementById("kc-violation-desc").value = "";
            await kcRefreshJeDropdowns_();
        }

        async function kcGetFilteredRecords_(fromDate, toDate) {
            const all = await kcGetAllRecords_();
            if (!fromDate && !toDate) return all;
            return all.filter((r) => {
                const d = r.scn_date_iso || "";
                if (fromDate && d < fromDate) return false;
                if (toDate && d > toDate) return false;
                return true;
            });
        }

        async function downloadKcMisReport() {
            const fromDate = document.getElementById("kc-mis-from").value;
            const toDate = document.getElementById("kc-mis-to").value;
            const records = await kcGetFilteredRecords_(fromDate, toDate);
            if (!records.length) return showToast("चुनी गई तिथि सीमा में कोई SCN नहीं मिला", false);

            showToast("Report तैयार हो रही है...", true);

            try {
                // Group by employee
                const empGroups = {};
                records.forEach((r) => {
                    if (!empGroups[r.emp_id]) {
                        empGroups[r.emp_id] = { emp_name: r.emp_name, emp_designation: r.emp_designation, records: [] };
                    }
                    empGroups[r.emp_id].records.push(r);
                });

                const { jsPDF } = window.jspdf;
                const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

                // Header
                doc.setFillColor(30, 58, 95);
                doc.rect(0, 0, 210, 24, "F");
                doc.setFontSize(13); doc.setTextColor(255,255,255); doc.setFont(undefined, "bold");
                doc.text("कर्मचारी कार्य चरित्रावली — SCN MIS रिपोर्ट", 105, 10, { align: "center" });
                doc.setFontSize(8); doc.setFont(undefined, "normal");
                doc.text(`${KC_OFFICE.officerName}, ${KC_OFFICE.office}, ${KC_OFFICE.division}`, 105, 17, { align: "center" });
                doc.setTextColor(100); doc.setFontSize(7);
                doc.text(`अवधि: ${fromDate ? kcFormatDate_(fromDate) : "सभी"} से ${toDate ? kcFormatDate_(toDate) : "सभी"} | Generated: ${new Date().toLocaleString("en-IN")}`, 105, 25, { align: "center" });

                // Summary table — employee wise SCN count
                doc.setFontSize(10); doc.setTextColor(30,58,95); doc.setFont(undefined, "bold");
                doc.text("कर्मचारी-वार SCN सारांश", 14, 34);

                doc.autoTable({
                    startY: 38,
                    head: [["क्र.", "कर्मचारी का नाम", "पदनाम", "कुल SCN", "उत्तर दिए", "उत्तर बाकी"]],
                    body: Object.values(empGroups).map((g, i) => [
                        i + 1,
                        g.emp_name,
                        g.emp_designation || "",
                        g.records.length,
                        g.records.filter((r) => r.reply_text).length,
                        g.records.filter((r) => !r.reply_text).length
                    ]),
                    theme: "striped",
                    headStyles: { fillColor: [30,58,95], textColor: 255, fontSize: 8, fontStyle: "bold", halign: "center" },
                    bodyStyles: { fontSize: 8 },
                    columnStyles: { 0: { halign: "center", cellWidth: 10 }, 3: { halign: "center" }, 4: { halign: "center" }, 5: { halign: "center" } }
                });

                // Detail section — each SCN
                doc.addPage();
                let y = 14;
                doc.setFontSize(10); doc.setTextColor(30,58,95); doc.setFont(undefined, "bold");
                doc.text("SCN विस्तृत विवरण", 14, y); y += 8;

                Object.values(empGroups).forEach((g) => {
                    // Employee name header
                    if (y > 255) { doc.addPage(); y = 14; }
                    doc.setFillColor(30, 58, 95);
                    doc.rect(14, y, 182, 7, "F");
                    doc.setFontSize(9); doc.setTextColor(255,255,255); doc.setFont(undefined, "bold");
                    doc.text(`${g.emp_name} (${g.emp_designation || "कर्मचारी"}) — कुल SCN: ${g.records.length}`, 16, y + 5);
                    y += 10;

                    g.records.forEach((r) => {
                        const rows = [
                            ["SCN No", `SCN-${String(r.dispatch_no).padStart(4,"0")}`, "दिनांक", kcFormatDate_(r.scn_date_iso)],
                            ["उल्लंघन प्रकार", { content: r.violation_type || "", colSpan: 3 }],
                            ["घटना विवरण", { content: r.violation_desc || "", colSpan: 3 }],
                            ["कर्मचारी उत्तर", { content: r.reply_text || "उत्तर नहीं दिया गया", colSpan: 3 }],
                            ["JE रिमार्क", { content: r.remark_text || "—", colSpan: 3 }]
                        ];

                        doc.autoTable({
                            startY: y,
                            body: rows,
                            theme: "grid",
                            bodyStyles: { fontSize: 7, cellPadding: 2 },
                            columnStyles: {
                                0: { fontStyle: "bold", cellWidth: 32, fillColor: [241,245,249] },
                                2: { fontStyle: "bold", cellWidth: 20, fillColor: [241,245,249] }
                            },
                            didParseCell: (data) => {
                                if (data.row.index === 3 && data.column.index === 1) {
                                    data.cell.styles.textColor = r.reply_text ? [20,83,45] : [153,27,27];
                                }
                            }
                        });
                        y = doc.lastAutoTable.finalY + 5;
                        if (y > 270) { doc.addPage(); y = 14; }
                    });
                    y += 4;
                });

                const totalPages = doc.internal.getNumberOfPages();
                for (let i = 1; i <= totalPages; i++) {
                    doc.setPage(i);
                    doc.setFontSize(7); doc.setTextColor(150);
                    doc.text(`Page ${i} of ${totalPages} | कर्मचारी कार्य चरित्रावली MIS`, 105, 290, { align: "center" });
                }

                doc.save(`KC_MIS_${kcFormatDate_(kcTodayISO_()).replace(/\//g,"-")}.pdf`);
                showToast("PDF Downloaded!", true);
            } catch (err) {
                showToast("Report generate karne mein error aaya", false);
            }
        }

        async function downloadKcMisExcel() {
            const fromDate = document.getElementById("kc-mis-from").value;
            const toDate = document.getElementById("kc-mis-to").value;
            const records = await kcGetFilteredRecords_(fromDate, toDate);
            if (!records.length) return showToast("चुनी गई तिथि सीमा में कोई SCN नहीं मिला", false);

            const headers = ["SCN No", "SCN दिनांक", "कर्मचारी नाम", "पदनाम", "मोबाइल", "घटना दिनांक", "उल्लंघन प्रकार", "अन्य कारण", "विवरण", "कर्मचारी उत्तर", "उत्तर दिनांक", "JE रिमार्क"];
            const rows = records.map((r) => [
                `SCN-${String(r.dispatch_no).padStart(4,"0")}`,
                kcFormatDate_(r.scn_date_iso),
                r.emp_name,
                r.emp_designation || "",
                r.emp_mobile || "",
                kcFormatDate_(r.incident_date),
                r.violation_type || "",
                r.other_reason || "",
                r.violation_desc || "",
                r.reply_text || "उत्तर नहीं दिया गया",
                r.reply_date_iso ? kcFormatDate_(r.reply_date_iso) : "",
                r.remark_text || ""
            ]);

            let csv = `कर्मचारी कार्य चरित्रावली MIS Report\n`;
            csv += `${KC_OFFICE.officerName}, ${KC_OFFICE.office}, ${KC_OFFICE.division}, ${KC_OFFICE.circle}\n`;
            csv += `अवधि: ${fromDate ? kcFormatDate_(fromDate) : "सभी"} से ${toDate ? kcFormatDate_(toDate) : "सभी"}\n\n`;
            csv += headers.join(",") + "\n";
            rows.forEach((row) => {
                csv += row.map((cell) => `"${String(cell || "").replace(/"/g, '""')}"`).join(",") + "\n";
            });

            const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `KC_MIS_${kcFormatDate_(kcTodayISO_()).replace(/\//g,"-")}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            showToast("Excel (CSV) Downloaded!", true);
        }



        async function kcLoadScnForRemark() {
            const empId = document.getElementById("kc-remark-emp").value;
            const container = document.getElementById("kc-scn-list-for-remark");
            if (!empId) { container.innerHTML = ""; return; }

            const records = await kcGetEmployeeRecords_(empId);
            if (!records.length) {
                container.innerHTML = `<div style="text-align:center; padding:12px; font-size:12px; font-weight:800; color:#64748b;">कोई SCN नहीं मिला।</div>`;
                return;
            }

            container.innerHTML = records.map((r) => `
                <div style="border:1.5px solid #1e3a5f; border-radius:10px; padding:10px; margin-bottom:10px; background:#f8fafc;">
                    <div style="font-size:11px; font-weight:900; color:#1e3a5f;">SCN-${String(r.dispatch_no || "").padStart(4,"0")} | ${kcFormatDate_(r.scn_date_iso)} — ${escapeHtml(r.violation_type || "")}</div>
                    <div style="font-size:11px; font-weight:700; color:#334155; margin:4px 0 8px 0;">${escapeHtml((r.violation_desc || "").slice(0, 80))}...</div>
                    ${r.reply_text ? `<div style="font-size:11px; font-weight:700; color:#1d4ed8; background:#eff6ff; border-radius:6px; padding:6px; margin-bottom:8px;">कर्मचारी उत्तर: ${escapeHtml(r.reply_text.slice(0, 60))}...</div>` : ""}
                    <textarea id="kc-je-remark-${r.entry_id || r.id}" placeholder="JE रिमार्क / अंतिम टिप्पणी (वैकल्पिक)..." style="width:100%; min-height:60px; border-radius:8px; border:1.5px solid #cbd5e1; padding:8px; font-size:12px; font-weight:700; resize:vertical; outline:none; margin-bottom:6px;">${escapeHtml(r.remark_text || "")}</textarea>
                    <div style="display:grid; grid-template-columns:1fr auto; gap:8px;">
                        <button onclick="kcSaveJeRemark('${r.entry_id || r.id}')" style="height:36px; border:none; border-radius:8px; background:linear-gradient(135deg,#1e3a5f,#0f172a); color:#fff; font-size:11px; font-weight:900; text-transform:uppercase;">💾 JE रिमार्क Save करें</button>
                        <button onclick="kcDeleteScnConfirm_('${r.entry_id || r.id}', '${String(r.dispatch_no || "").padStart(4,"0")}')" style="height:36px; border:none; border-radius:8px; background:linear-gradient(135deg,#dc2626,#7f1d1d); color:#fff; font-size:11px; font-weight:900; text-transform:uppercase; padding:0 14px;">🗑 Delete</button>
                    </div>
                </div>
            `).join("");
        }

        async function kcSaveJeRemark(recordId) {
            const remarkText = document.getElementById(`kc-je-remark-${recordId}`)?.value?.trim() || "";
            const ok = await kcUpdateRecord_(recordId, { remark_text: remarkText });
            if (ok) showToast("JE रिमार्क Save हो गया", true);
            else showToast("Save karne mein error aaya", false);
        }

        async function kcGetRecordById_(id) {
            // Check cloud cache first
            const cloudRecords = sharedModuleEntriesCache["karya_charitra"] || [];
            const cloudFound = cloudRecords.find((r) => r.id === id || r.entry_id === id || String(r.id) === String(id));
            if (cloudFound) return cloudFound;
            // Fallback to local IDB
            const all = await idbGetAll_("karya_charitra");
            return all.find((r) => r.id === id || r.entry_id === id) || null;
        }

        async function kcOpenShareModal(recordId) {
            const r = await kcGetRecordById_(recordId);
            if (!r) return showToast("Record nahi mila", false);
            const text = kcBuildScnText_(r);
            const encoded = encodeURIComponent(text);
            const dispStr = `SCN-${String(r.dispatch_no).padStart(4,"0")}`;

            const overlay = document.createElement("div");
            overlay.style.cssText = "position:fixed; inset:0; background:rgba(0,0,0,0.55); z-index:9999; display:flex; align-items:center; justify-content:center; padding:20px;";
            const card = document.createElement("div");
            card.style.cssText = "background:#fff; border-radius:18px; padding:18px; width:100%; max-width:340px; box-shadow:0 12px 30px rgba(0,0,0,0.25);";
            card.innerHTML = `
                <div style="font-size:13px; font-weight:900; color:#1e3a5f; text-align:center; margin-bottom:12px;">${dispStr} — ${escapeHtml(r.emp_name)}</div>
                ${r.emp_mobile ? `<a href="https://wa.me/91${r.emp_mobile.replace(/\D/g,"")}?text=${encoded}" target="_blank" rel="noopener" style="display:flex; align-items:center; justify-content:center; gap:6px; width:100%; height:44px; border-radius:12px; background:linear-gradient(135deg,#25D366,#128C7E); color:#fff; font-size:12px; font-weight:900; text-decoration:none; margin-bottom:8px;">📱 Direct WhatsApp (${escapeHtml(r.emp_mobile)})</a>` : ""}
                <a href="https://wa.me/?text=${encoded}" target="_blank" rel="noopener" style="display:flex; align-items:center; justify-content:center; gap:6px; width:100%; height:44px; border-radius:12px; background:linear-gradient(135deg,#128C7E,#075e54); color:#fff; font-size:12px; font-weight:900; text-decoration:none; margin-bottom:8px;">WhatsApp Group Share</a>
                <button onclick="kcCopyAndClose(${recordId}, this)" style="width:100%; height:44px; border:none; border-radius:12px; background:linear-gradient(135deg,#3b82f6,#1d4ed8); color:#fff; font-size:12px; font-weight:900; text-transform:uppercase; margin-bottom:8px;">📋 Word हेतु Copy करें</button>
                <button onclick="this.closest('[style*=fixed]').remove()" style="width:100%; height:40px; border:none; border-radius:12px; background:#e2e8f0; color:#1e293b; font-size:12px; font-weight:900; text-transform:uppercase;">बंद करें</button>
            `;
            overlay.appendChild(card);
            overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
            document.body.appendChild(overlay);
        }

        async function kcCopyScnText(recordId) {
            const r = await kcGetRecordById_(recordId);
            if (!r) return showToast("Record nahi mila", false);
            await kcCopyToClipboard_(kcBuildScnText_(r));
            showToast("SCN text copy ho gaya — Word me Ctrl+V se paste karein", true);
        }

        async function kcCopyAndClose(recordId, btn) {
            const r = await kcGetRecordById_(recordId);
            if (!r) return;
            await kcCopyToClipboard_(kcBuildScnText_(r));
            showToast("SCN text copy ho gaya — Word me Ctrl+V se paste karein", true);
            btn?.closest("[style*='position:fixed']")?.remove();
        }

        async function kcCopyToClipboard_(text) {
            try {
                await navigator.clipboard.writeText(text);
            } catch (_) {
                const ta = document.createElement("textarea");
                ta.value = text;
                ta.style.cssText = "position:fixed; top:-9999px;";
                document.body.appendChild(ta);
                ta.select();
                document.execCommand("copy");
                document.body.removeChild(ta);
            }
        }

        async function kcInitView_() {
            await kcRefreshJeDropdowns_();
            const dateField = document.getElementById("kc-incident-date");
            if (dateField && !dateField.value) dateField.value = kcTodayISO_();
            const now = new Date();
            const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01`;
            const today = kcTodayISO_();
            const mf = document.getElementById("kc-mis-from");
            const mt = document.getElementById("kc-mis-to");
            if (mf && !mf.value) mf.value = firstOfMonth;
            if (mt && !mt.value) mt.value = today;
            // Default to employee self-service tab
            kcSetTab("emp");
        }



        async function kcInitView_() {
            await kcRefreshEmployeeDropdowns_();
            document.getElementById("kc-incident-date").value = kcTodayISO_();
            kcSetTab("view");
        }

        function setDefaultMisDates_(fromId, toId) {
            const fromInput = document.getElementById(fromId);
            const toInput = document.getElementById(toId);
            if (!fromInput || !toInput) return;
            if (fromInput.value && toInput.value) return;
            const today = localTodayIso_();
            const now = new Date();
            const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01`;
            fromInput.value = firstOfMonth;
            toInput.value = today;
        }


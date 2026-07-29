        // ===== गलत मोबाइल नंबर ट्रैकर (Mobile Correction) =====
        // Workflow: IVRS search करके officer को पता चलता है कि नंबर पर कॉल गलत जा रहा
        // है — वो सिर्फ़ "flag" करता है (नाम/पता/HQ खोज से अपने-आप आता है)। सही नंबर बाद
        // में मिलने पर उसी entry में डाल दिया जाता है — तब entry "corrected" हो जाती है।
        // Storage broken_pole/bijli_chori jaisa hi robust (IndexedDB + offline queue) hai.

        const MC_MODULE = "mobile_correction";

        async function getMobileCorrectionEntries_() {
            const rows = await idbGetAll_(MC_MODULE);
            const local = rows.slice().sort((a, b) => (a.id || 0) - (b.id || 0));
            const shared = await fetchSharedEntries_(MC_MODULE, true);
            return mergeLocalAndSharedEntries_(local, shared);
        }

        async function flagWrongMobile_() {
            if (!currentData || !currentData.ivrs) {
                return showToast("पहले IVRS सर्च करें", false);
            }
            const btn = document.getElementById("mc-flag-btn");
            if (btn) { btn.innerText = "Saving..."; btn.disabled = true; }
            try {
                const existing = await getMobileCorrectionEntries_();
                const dup = existing.find((e) => e.ivrs === currentData.ivrs && e.dc_name === (activeDC || "") && e.status === "pending");
                if (dup) {
                    showToast("यह IVRS पहले से पेंडिंग सूची में है", false);
                    return;
                }

                const entry = {
                    ivrs: currentData.ivrs,
                    name: currentData.name || "",
                    father: currentData.father || "",
                    address: currentData.addr || "",
                    hq: currentData.hq || "सामान्य",
                    tariff: currentData.tariff || "",
                    load: currentData.load || "",
                    dc_name: activeDC || "",
                    division: activeDiv || "",
                    old_mobile: currentData.old || "",
                    correct_mobile: "",
                    status: "pending",
                    flagged_date: getCurrentDateDDMMYYYY(),
                    corrected_date: "",
                    timestamp: new Date().toISOString(),
                    corrected_by_id: "",
                    corrected_by_name: "",
                    ...currentEmployeeTag_()
                };

                const entryId = await syncEntryToCloud_(MC_MODULE, entry);
                if (entryId) entry.entry_id = entryId;
                await idbAdd_(MC_MODULE, entry);
                showToast(entryId ? "गलत नंबर के रूप में फ़्लैग हो गया" : "Internet नहीं है — device पर save हुआ, internet आने पर अपने-आप sync होगा 🔄", true);
                resetForm(true);
                const searchInput = document.getElementById("search-ivrs");
                if (searchInput) searchInput.focus();
            } catch (_) {
                showToast("Save करने में समस्या आई, दोबारा कोशिश करें", false);
            } finally {
                if (btn) { btn.innerText = "❌ यह नंबर गलत है — Flag करें"; btn.disabled = false; }
            }
        }

        let mcListOpen_ = false;
        async function toggleMobileCorrectionList_() {
            const container = document.getElementById("mc-pending-list");
            if (!container) return;
            mcListOpen_ = !mcListOpen_;
            if (!mcListOpen_) {
                container.style.display = "none";
                container.innerHTML = "";
                return;
            }
            container.style.display = "block";
            container.innerHTML = `<div style="text-align:center; padding:14px; font-size:12px; font-weight:800; color:#ffffff;">लोड हो रहा है...</div>`;
            await renderMobileCorrectionList_();
        }

        function mcGroupByHq_(entries) {
            const groups = {};
            entries.forEach((e) => {
                const hq = e.hq || "सामान्य";
                groups[hq] = groups[hq] || [];
                groups[hq].push(e);
            });
            return groups;
        }

        // Har HQ me master consumer list (DC ki CSV) me kul kitne consumers hain —
        // "corrected / total consumers" progress isi se banti hai, sirf flagged count se nahi.
        function mcTotalConsumersByHq_() {
            const counts = {};
            getConsumerRows(activeDC).forEach((row) => {
                const hq = getConsumerField(row, ["HQ", "HQ NAME", "HEADQUARTER", "HEAD QUARTER", "H.Q."], "सामान्य");
                counts[hq] = (counts[hq] || 0) + 1;
            });
            return counts;
        }

        async function renderMobileCorrectionList_() {
            const container = document.getElementById("mc-pending-list");
            if (!container) return;
            const dcFilter = activeDC || "";
            const all = await getMobileCorrectionEntries_();
            const entries = all.filter((e) => !dcFilter || e.dc_name === dcFilter);

            if (!entries.length) {
                container.innerHTML = `<div style="text-align:center; padding:14px; font-size:12px; font-weight:800; color:#ffffff; background:rgba(0,0,0,0.12); border-radius:12px;">इस DC में अभी कोई flag की हुई entry नहीं है।</div>`;
                return;
            }

            const groups = mcGroupByHq_(entries);
            const hqNames = Object.keys(groups).sort();
            const totalConsumersByHq = mcTotalConsumersByHq_();

            container.innerHTML = hqNames.map((hq) => {
                const rows = groups[hq];
                const corrected = rows.filter((r) => r.status === "corrected").length;
                const hqTotal = totalConsumersByHq[hq];
                const rowsHtml = rows.slice().reverse().map((e) => {
                    const uid = getEntryUid_(e);
                    const isPending = e.status !== "corrected";
                    return `
                        <div style="padding:10px; border-radius:10px; margin-bottom:8px; background:${isPending ? "#fee2e2" : "#f0fdf4"}; border:1.5px solid ${isPending ? "#fca5a5" : "#bbf7d0"};">
                            <div style="font-size:11.5px; font-weight:900; color:#1e293b;">${escapeHtml(e.name || "नाम अनुपलब्ध")} <span style="color:#64748b; font-weight:700;">(${escapeHtml(e.ivrs || "")})</span></div>
                            <div style="font-size:10px; font-weight:700; color:#64748b; margin-top:2px;">पिता: ${escapeHtml(e.father || "-")} | ${escapeHtml(e.address || "-")}</div>
                            <div style="font-size:10px; font-weight:700; color:#991b1b; margin-top:4px;">पुराना (गलत) नंबर: ${escapeHtml(e.old_mobile || "N/A")}</div>
                            ${isPending ? `
                                <div style="display:flex; gap:6px; margin-top:8px;">
                                    <input type="tel" id="mc-correct-${uid}" placeholder="सही मोबाइल नंबर (10 अंक)" oninput="this.value=this.value.replace(/[^0-9]/g,'').slice(0,10)" style="flex:1; height:36px; border-radius:8px; border:1.5px solid #fca5a5; padding:0 8px; font-size:11px; font-weight:700; box-sizing:border-box;">
                                    <button onclick="saveCorrectMobile_('${uid}')" style="border:none; background:#16a34a; color:#ffffff; border-radius:8px; padding:0 12px; font-size:10px; font-weight:900; text-transform:uppercase; flex-shrink:0;">सेव करें</button>
                                </div>
                            ` : `
                                <div style="font-size:11px; font-weight:900; color:#15803d; margin-top:6px;">✅ सही नंबर: ${escapeHtml(e.correct_mobile || "")} (${escapeHtml(e.corrected_date || "")})</div>
                            `}
                        </div>
                    `;
                }).join("");

                return `
                    <div style="margin-bottom:14px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                            <div style="font-size:12px; font-weight:900; color:#ffffff;">📍 ${escapeHtml(hq)}</div>
                            <div style="font-size:10px; font-weight:900; color:#fef3c7; text-align:right;">
                                ${corrected}/${rows.length} ठीक हुए
                                ${hqTotal ? `<div style="font-size:9px; font-weight:700; color:#fecaca;">कुल ${hqTotal} उपभोक्ता में से ${corrected} सही (${((corrected / hqTotal) * 100).toFixed(1)}%)</div>` : ""}
                            </div>
                        </div>
                        <div>${rowsHtml}</div>
                    </div>
                `;
            }).join("");
        }

        async function saveCorrectMobile_(uid) {
            const input = document.getElementById(`mc-correct-${uid}`);
            const value = input?.value || "";
            if (value.length !== 10) return showToast("10 अंक का मोबाइल नंबर डालें", false);

            const all = await getMobileCorrectionEntries_();
            const entry = all.find((e) => getEntryUid_(e) === uid);
            if (!entry) return showToast("Entry नहीं मिली", false);

            const localId = entry.entry_id ? entry.entry_id : entry.id;
            const empTag = currentEmployeeTag_();
            const updates = {
                correct_mobile: value,
                status: "corrected",
                corrected_date: getCurrentDateDDMMYYYY(),
                corrected_by_id: empTag.submitted_by_id,
                corrected_by_name: empTag.submitted_by_name
            };
            const ok = await updateSharedEntry_(MC_MODULE, localId, updates);
            if (!ok) return showToast("Save करने में समस्या आई", false);
            showToast("सही नंबर सेव हो गया ✅", true);
            await renderMobileCorrectionList_();
        }

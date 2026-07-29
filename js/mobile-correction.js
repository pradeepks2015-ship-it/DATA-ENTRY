        // ===== गलत मोबाइल नंबर ट्रैकर (Mobile Correction) =====
        // Workflow: IVRS search करके officer को पता चलता है कि नंबर पर कॉल गलत जा रहा
        // है — वो सिर्फ़ "flag" करता है (नाम/पता/HQ खोज से अपने-आप आता है)। सही नंबर बाद
        // में मिलने पर उसी entry में डाल दिया जाता है — तब entry "corrected" हो जाती है।
        // Storage broken_pole/bijli_chori jaisa hi robust (IndexedDB + offline queue) hai.

        const MC_MODULE = "mobile_correction";

        // employee-auth.js (login) abhi production par nahi hai — is helper se yeh
        // file bina us feature ke bhi kaam karti hai (khaali submitted_by fields ke saath).
        function mcEmployeeTag_() {
            return typeof currentEmployeeTag_ === "function" ? currentEmployeeTag_() : { submitted_by_id: "", submitted_by_name: "" };
        }

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
                    ...mcEmployeeTag_()
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

        function mcTableCellStyle_(extra) {
            return `border:1px solid #fecaca; padding:6px 8px; font-size:10.5px; font-weight:700; color:#1e293b; white-space:nowrap; ${extra || ""}`;
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
            const totalFlagged = entries.length;
            const totalCorrected = entries.filter((e) => e.status === "corrected").length;

            const summaryHtml = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; padding:0 2px;">
                    <div style="font-size:11px; font-weight:900; color:#fef3c7;">कुल फ़्लैग: ${totalFlagged}</div>
                    <div style="font-size:11px; font-weight:900; color:#bbf7d0;">ठीक हुए: ${totalCorrected}</div>
                    <div style="font-size:11px; font-weight:900; color:#fecaca;">बाकी: ${totalFlagged - totalCorrected}</div>
                </div>
            `;

            const thStyle = "border:1px solid #7f1d1d; background:#991b1b; color:#ffffff; padding:7px 8px; font-size:10px; font-weight:900; text-transform:uppercase; white-space:nowrap; position:sticky; top:0;";
            const theadHtml = `<tr>
                <th style="${thStyle}">क्र</th>
                <th style="${thStyle}">IVRS No</th>
                <th style="${thStyle}">नाम</th>
                <th style="${thStyle}">पिता का नाम</th>
                <th style="${thStyle}">पता</th>
                <th style="${thStyle}">HQ</th>
                <th style="${thStyle}">टैरिफ / लोड</th>
                <th style="${thStyle}">पुराना (गलत) नंबर</th>
                <th style="${thStyle}">स्थिति</th>
                <th style="${thStyle}">सही मोबाइल नंबर</th>
                <th style="${thStyle}">फ़्लैग किया</th>
            </tr>`;

            let sNo = 0;
            const bodyHtml = hqNames.map((hq) => {
                const rows = groups[hq].slice().reverse();
                return rows.map((e) => {
                    sNo++;
                    const uid = getEntryUid_(e);
                    const isPending = e.status !== "corrected";
                    const rowBg = isPending ? "#fee2e2" : "#f0fdf4";
                    return `<tr style="background:${rowBg};">
                        <td style="${mcTableCellStyle_()}">${sNo}</td>
                        <td style="${mcTableCellStyle_("font-weight:900;")}">${escapeHtml(e.ivrs || "")}</td>
                        <td style="${mcTableCellStyle_("text-align:left;")}">${escapeHtml(e.name || "-")}</td>
                        <td style="${mcTableCellStyle_("text-align:left;")}">${escapeHtml(e.father || "-")}</td>
                        <td style="${mcTableCellStyle_("text-align:left; white-space:normal; min-width:120px;")}">${escapeHtml(e.address || "-")}</td>
                        <td style="${mcTableCellStyle_()}">${escapeHtml(e.hq || hq)}</td>
                        <td style="${mcTableCellStyle_()}">${escapeHtml([e.tariff, e.load].filter(Boolean).join(" / ") || "-")}</td>
                        <td style="${mcTableCellStyle_("color:#991b1b; font-weight:900;")}">${escapeHtml(e.old_mobile || "N/A")}</td>
                        <td style="${mcTableCellStyle_(isPending ? "color:#b91c1c; font-weight:900;" : "color:#15803d; font-weight:900;")}">${isPending ? "⏳ पेंडिंग" : "✅ ठीक हुआ"}</td>
                        <td style="${mcTableCellStyle_()}">
                            ${isPending ? `
                                <div style="display:flex; gap:4px; align-items:center;">
                                    <input type="tel" id="mc-correct-${uid}" placeholder="10 अंक" oninput="this.value=this.value.replace(/[^0-9]/g,'').slice(0,10)" style="width:90px; height:30px; border-radius:6px; border:1.5px solid #fca5a5; padding:0 6px; font-size:10.5px; font-weight:700; box-sizing:border-box;">
                                    <button onclick="saveCorrectMobile_('${uid}')" style="border:none; background:#16a34a; color:#ffffff; border-radius:6px; padding:0 8px; height:30px; font-size:9.5px; font-weight:900; text-transform:uppercase; flex-shrink:0;">सेव</button>
                                </div>
                            ` : `<span style="color:#15803d; font-weight:900;">${escapeHtml(e.correct_mobile || "")}</span> <span style="color:#64748b; font-weight:700;">(${escapeHtml(e.corrected_date || "")})</span>`}
                        </td>
                        <td style="${mcTableCellStyle_()}">${escapeHtml(e.flagged_date || "")}${e.submitted_by_name ? `<br><span style="color:#64748b; font-weight:700;">${escapeHtml(e.submitted_by_name)}</span>` : ""}</td>
                    </tr>`;
                }).join("");
            }).join("");

            container.innerHTML = `
                ${summaryHtml}
                <div style="overflow-x:auto; border-radius:10px; background:#ffffff;">
                    <table style="border-collapse:collapse; width:100%;">
                        <thead>${theadHtml}</thead>
                        <tbody>${bodyHtml}</tbody>
                    </table>
                </div>
            `;
        }

        async function saveCorrectMobile_(uid) {
            const input = document.getElementById(`mc-correct-${uid}`);
            const value = input?.value || "";
            if (value.length !== 10) return showToast("10 अंक का मोबाइल नंबर डालें", false);

            const all = await getMobileCorrectionEntries_();
            const entry = all.find((e) => getEntryUid_(e) === uid);
            if (!entry) return showToast("Entry नहीं मिली", false);

            const localId = entry.entry_id ? entry.entry_id : entry.id;
            const empTag = mcEmployeeTag_();
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

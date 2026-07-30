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

        function toggleMobileUpdateMenu_() {
            const menu = document.getElementById("mu-menu-dropdown");
            if (!menu) return;
            menu.style.display = menu.style.display === "block" ? "none" : "block";
        }

        // ===== IVRS copy + मोबाइल नंबर पर tap करके Call/SMS/WhatsApp (result card + pending list दोनों में) =====
        // inline onclick='...' attribute ke andar safely embed karne ke liye —
        // IVRS/mobile master CSV se aate hain, isliye ' ya \ jaisa stray character
        // ho sakta hai jo attribute todd sakta hai.
        function mcJsEscape_(s) {
            return String(s || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");
        }

        async function mcCopyText_(text, label) {
            if (!text) return;
            try {
                await navigator.clipboard.writeText(text);
            } catch (_) {
                try {
                    const ta = document.createElement("textarea");
                    ta.value = text;
                    ta.style.cssText = "position:fixed; top:-9999px;";
                    document.body.appendChild(ta);
                    ta.select();
                    document.execCommand("copy");
                    document.body.removeChild(ta);
                } catch (_) {
                    return showToast("कॉपी नहीं हो पाया", false);
                }
            }
            showToast(`${label || "टेक्स्ट"} कॉपी हो गया 📋`, true);
        }

        function mcCopyIvrsField_() {
            const val = document.getElementById("res-ivrs")?.innerText?.trim();
            if (val) mcCopyText_(val, "IVRS नंबर");
        }

        function mcShowMobileActionsField_() {
            const val = document.getElementById("res-old")?.innerText?.trim();
            if (val && val !== "N/A") mcShowMobileActions_(val, currentData?.name, currentData?.father);
        }

        function mcActionCardHtml_(href, target, iconBg, icon, title, subtitle) {
            return `<a href="${href}"${target ? ` target="${target}" rel="noopener"` : ""} style="display:flex; align-items:center; gap:14px; width:100%; padding:14px; border:1.5px solid ${iconBg.border}; border-radius:16px; background:#ffffff; text-decoration:none; margin-bottom:12px; box-sizing:border-box;">
                <span style="width:46px; height:46px; border-radius:14px; background:${iconBg.bg}; display:flex; align-items:center; justify-content:center; font-size:20px; flex-shrink:0;">${icon}</span>
                <span>
                    <div style="font-size:14px; font-weight:900; color:#1e293b;">${title}</div>
                    <div style="font-size:11px; font-weight:600; color:#64748b; margin-top:2px;">${subtitle}</div>
                </span>
            </a>`;
        }

        function mcShowMobileActions_(mobile, name, father) {
            const digits = String(mobile || "").replace(/\D/g, "");
            if (digits.length !== 10) return showToast("मोबाइल नंबर उपलब्ध नहीं है", false);
            const existing = document.getElementById("mc-mobile-actions-overlay");
            if (existing) existing.remove();

            const overlay = document.createElement("div");
            overlay.id = "mc-mobile-actions-overlay";
            overlay.style.cssText = "position:fixed; inset:0; background:rgba(0,0,0,0.55); z-index:9999; display:flex; align-items:flex-end; justify-content:center;";
            overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });

            const sheet = document.createElement("div");
            sheet.style.cssText = "background:#ffffff; border-radius:24px 24px 0 0; padding:20px; width:100%; max-width:420px; box-shadow:0 -12px 30px rgba(0,0,0,0.25); box-sizing:border-box;";
            sheet.innerHTML = `
                <div style="width:36px; height:4px; background:#cbd5e1; border-radius:99px; margin:0 auto 16px auto;"></div>
                ${name ? `<div style="font-size:15px; font-weight:900; color:#1e3a5f;">${escapeHtml(name)}${father ? ` <span style="font-weight:700; color:#64748b;">(पिता/पति: ${escapeHtml(father)})</span>` : ""}</div>` : ""}
                <div style="display:flex; align-items:center; gap:6px; font-size:14px; font-weight:700; color:#334155; margin:4px 0 18px 0;">📞 ${escapeHtml(digits)}</div>
                ${mcActionCardHtml_(`tel:+91${digits}`, "", { bg: "#d1fae5", border: "#a7f3d0" }, "📞", "कॉल करें", "सीधे फोन लगाएं")}
                ${mcActionCardHtml_(`sms:+91${digits}`, "", { bg: "#dbeafe", border: "#bfdbfe" }, "💬", "SMS भेजें", "Text Message भेजें")}
                ${mcActionCardHtml_(`https://wa.me/91${digits}`, "_blank", { bg: "#dcfce7", border: "#bbf7d0" }, "🟢", "WhatsApp करें", "WhatsApp Message भेजें")}
                <button id="mc-mobile-actions-close-btn" style="width:100%; height:52px; border:1.5px solid #e2e8f0; border-radius:16px; background:#ffffff; color:#1e293b; font-size:14px; font-weight:900;">रद्द करें</button>
            `;
            overlay.appendChild(sheet);
            document.body.appendChild(overlay);
            document.getElementById("mc-mobile-actions-close-btn").onclick = () => overlay.remove();
        }

        document.addEventListener("click", (e) => {
            const menu = document.getElementById("mu-menu-dropdown");
            const btn = document.getElementById("mu-menu-btn");
            if (!menu || menu.style.display !== "block") return;
            if (e.target === btn || menu.contains(e.target)) return;
            menu.style.display = "none";
        });

        async function downloadMobileCorrectionExcel_() {
            if (!window.XLSX) return showToast("Excel library load नहीं हुई, फिर कोशिश करें", false);
            const btn = document.getElementById("mc-excel-btn");
            if (btn) { btn.innerText = "बन रहा है..."; btn.disabled = true; }
            try {
                const dcFilter = activeDC || "";
                // Jo HQ pending-list dropdown me currently select hai, sirf usi ki
                // list download hoti hai — "सभी HQ" select ho to poore DC ki.
                const hqFilter = document.getElementById("mc-hq-filter")?.value || "";
                const all = await getMobileCorrectionEntries_();
                const entries = all.filter((e) => (!dcFilter || e.dc_name === dcFilter) && (!hqFilter || (e.hq || "सामान्य") === hqFilter));
                if (!entries.length) {
                    showToast(hqFilter ? `${hqFilter} में अभी कोई flag की हुई entry नहीं है` : "इस DC में अभी कोई flag की हुई entry नहीं है", false);
                    return;
                }

                // Screen par jo columns dikhte hain (mobile-correction table), Excel
                // bhi bilkul usi format me — naam+pita aur mobile+date ek hi cell me.
                const headers = ["क्र", "IVRS No", "नाम", "पता", "टैरिफ / लोड", "पुराना (गलत) नंबर", "स्थिति", "सही मोबाइल नंबर"];
                const rows = entries.map((e, i) => [
                    i + 1,
                    e.ivrs || "",
                    e.name ? `${e.name}${e.father ? ` / ${e.father}` : ""}` : "",
                    e.address || "",
                    [e.tariff, e.load].filter(Boolean).join(" / "),
                    `${e.old_mobile || "N/A"}${e.flagged_date ? ` (${e.flagged_date})` : ""}`,
                    e.status === "corrected" ? "ठीक हुआ" : "पेंडिंग",
                    e.correct_mobile ? `${e.correct_mobile}${e.corrected_date ? ` (${e.corrected_date})` : ""}` : ""
                ]);

                const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "Mobile Correction");
                const filenameHq = (hqFilter || dcFilter || "all").replace(/[^a-zA-Z0-9]+/g, "_");
                const filename = `Mobile_Correction_${filenameHq}_${localTodayIso_().replace(/-/g, "")}.xlsx`;
                XLSX.writeFile(wb, filename);
                showToast("Excel Downloaded!", true);
            } catch (_) {
                showToast("Excel generate करने में error आया", false);
            } finally {
                if (btn) { btn.innerText = "📥 मुख्यालय-वार Excel में Download करें"; btn.disabled = false; }
            }
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
                // Sirf local IndexedDB se dedup check karte hain (shared entries ka
                // forced network fetch nahi) — isse save turant hota hai, network
                // slow/Apps Script cold-start ke wait ka intezaar nahi karna padta.
                const localRows = await idbGetAll_(MC_MODULE);
                const dup = localRows.find((e) => e.ivrs === currentData.ivrs && e.dc_name === (activeDC || "") && e.status === "pending");
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
                if (btn) { btn.innerText = "❌ गलत मोबाइल नंबर मार्क करें"; btn.disabled = false; }
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

        // Master consumer list ke HQ + jo bhi HQ flag ki hui entries me hain — dono
        // milakar dropdown banate hain, taaki bina flag ke HQ bhi chuna ja sake.
        function mcPopulateHqFilter_(entries) {
            const select = document.getElementById("mc-hq-filter");
            if (!select) return;
            const prevValue = select.value;
            const hqSet = new Set(Object.keys(mcTotalConsumersByHq_()));
            (entries || []).forEach((e) => hqSet.add(e.hq || "सामान्य"));
            const hqNames = Array.from(hqSet).sort();
            select.innerHTML = `<option value="">सभी HQ</option>` + hqNames.map((hq) => `<option value="${escapeHtml(hq)}">${escapeHtml(hq)}</option>`).join("");
            if (hqNames.includes(prevValue)) select.value = prevValue;
        }

        function mcHqFilterChanged_() {
            const container = document.getElementById("mc-pending-list");
            if (container && container.style.display === "block") renderMobileCorrectionList_();
        }

        async function renderMobileCorrectionList_() {
            const container = document.getElementById("mc-pending-list");
            if (!container) return;
            const dcFilter = activeDC || "";
            const all = await getMobileCorrectionEntries_();
            const dcEntries = all.filter((e) => !dcFilter || e.dc_name === dcFilter);
            mcPopulateHqFilter_(dcEntries);
            const hqFilter = document.getElementById("mc-hq-filter")?.value || "";
            const entries = dcEntries.filter((e) => !hqFilter || (e.hq || "सामान्य") === hqFilter);

            if (!entries.length) {
                const msg = hqFilter ? "इस HQ में अभी कोई flag की हुई entry नहीं है।" : "इस DC में अभी कोई flag की हुई entry नहीं है।";
                container.innerHTML = `<div style="text-align:center; padding:14px; font-size:12px; font-weight:800; color:#ffffff; background:rgba(0,0,0,0.12); border-radius:12px;">${msg}</div>`;
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
                <th style="${thStyle}">पता</th>
                <th style="${thStyle}">टैरिफ / लोड</th>
                <th style="${thStyle}">पुराना (गलत) नंबर</th>
                <th style="${thStyle}">स्थिति</th>
                <th style="${thStyle}">सही मोबाइल नंबर</th>
            </tr>`;

            let sNo = 0;
            const bodyHtml = hqNames.map((hq) => {
                const rows = groups[hq].slice().reverse();
                return rows.map((e) => {
                    sNo++;
                    const uid = getEntryUid_(e);
                    const isPending = e.status !== "corrected";
                    const rowBg = isPending ? "#fee2e2" : "#f0fdf4";
                    const ivrsJs = mcJsEscape_(e.ivrs || "");
                    const oldMobileJs = mcJsEscape_(e.old_mobile || "");
                    const correctMobileJs = mcJsEscape_(e.correct_mobile || "");
                    const nameJs = mcJsEscape_(e.name || "");
                    const fatherJs = mcJsEscape_(e.father || "");
                    return `<tr style="background:${rowBg};">
                        <td style="${mcTableCellStyle_()}">${sNo}</td>
                        <td style="${mcTableCellStyle_("font-weight:900;")}" class="mc-tap-copy" onclick="mcCopyText_('${ivrsJs}','IVRS नंबर')">${escapeHtml(e.ivrs || "")}</td>
                        <td style="${mcTableCellStyle_("text-align:left;")}">${escapeHtml(e.name || "-")}${e.father ? `<br><span style="color:#94a3b8; font-weight:600;">/ ${escapeHtml(e.father)}</span>` : ""}</td>
                        <td style="${mcTableCellStyle_("text-align:left; white-space:normal; min-width:120px;")}">${escapeHtml(e.address || "-")}</td>
                        <td style="${mcTableCellStyle_()}">${escapeHtml([e.tariff, e.load].filter(Boolean).join(" / ") || "-")}</td>
                        <td style="${mcTableCellStyle_("color:#991b1b; font-weight:900;")}"${e.old_mobile ? ` class="mc-tap-copy" onclick="mcShowMobileActions_('${oldMobileJs}','${nameJs}','${fatherJs}')"` : ""}>${escapeHtml(e.old_mobile || "N/A")}${e.flagged_date ? `<br><span style="color:#64748b; font-weight:700; text-decoration:none;">${escapeHtml(e.flagged_date)}</span>` : ""}</td>
                        <td style="${mcTableCellStyle_(isPending ? "color:#b91c1c; font-weight:900;" : "color:#15803d; font-weight:900;")}">${isPending ? "⏳ पेंडिंग" : "✅ ठीक हुआ"}</td>
                        <td style="${mcTableCellStyle_()}">
                            ${isPending ? `
                                <div style="display:flex; gap:4px; align-items:center;">
                                    <input type="tel" id="mc-correct-${uid}" placeholder="10 अंक" oninput="this.value=this.value.replace(/[^0-9]/g,'').slice(0,10)" style="width:90px; height:30px; border-radius:6px; border:1.5px solid #fca5a5; padding:0 6px; font-size:10.5px; font-weight:700; box-sizing:border-box;">
                                    <button onclick="saveCorrectMobile_('${uid}')" style="border:none; background:#16a34a; color:#ffffff; border-radius:6px; padding:0 8px; height:30px; font-size:9.5px; font-weight:900; text-transform:uppercase; flex-shrink:0;">सेव</button>
                                </div>
                            ` : `<span class="mc-tap-copy" onclick="mcShowMobileActions_('${correctMobileJs}','${nameJs}','${fatherJs}')" style="color:#15803d; font-weight:900;">${escapeHtml(e.correct_mobile || "")}</span>${e.corrected_date ? `<br><span style="color:#94a3b8; font-weight:600; text-decoration:none;">${escapeHtml(e.corrected_date)}</span>` : ""}`}
                        </td>
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

        // ===== मुख्यालय वार मोबाइल नंबर करेक्शन स्कोरकार्ड (⋮ मेनू) =====
        // flagged_date "DD-MM-YYYY" format me store hoti hai (getCurrentDateDDMMYYYY se) —
        // isi ko time-period filter ke liye Date object me parse karte hain.
        function mcParseFlaggedDate_(str) {
            if (!str) return null;
            const parts = String(str).split("-");
            if (parts.length !== 3) return null;
            const [d, m, y] = parts;
            const dt = new Date(`${y}-${m}-${d}`);
            return isNaN(dt.getTime()) ? null : dt;
        }

        function mcOpenScorecard_() {
            const menu = document.getElementById("mu-menu-dropdown");
            if (menu) menu.style.display = "none";
            const existing = document.getElementById("mc-scorecard-overlay");
            if (existing) existing.remove();

            const today = localTodayIso_();
            const now = new Date();
            const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

            const overlay = document.createElement("div");
            overlay.id = "mc-scorecard-overlay";
            overlay.style.cssText = "position:fixed; inset:0; background:rgba(0,0,0,0.55); z-index:9999; display:flex; align-items:flex-end; justify-content:center;";
            overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });

            const sheet = document.createElement("div");
            sheet.style.cssText = "background:#ffffff; border-radius:20px 20px 0 0; padding:18px; width:100%; max-width:480px; max-height:82vh; overflow-y:auto; box-shadow:0 -12px 30px rgba(0,0,0,0.25);";
            sheet.innerHTML = `
                <div style="font-size:14px; font-weight:900; color:#1e293b; text-align:center; text-transform:uppercase; margin-bottom:2px;">📊 मुख्यालय वार मोबाइल नंबर करेक्शन स्कोरकार्ड</div>
                <div style="font-size:10.5px; font-weight:700; color:#64748b; text-align:center; margin-bottom:14px;">${escapeHtml(activeDC || "")}</div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:14px;">
                    <div>
                        <div style="font-size:10px; font-weight:800; color:#64748b; text-transform:uppercase; margin-bottom:4px;">From Date</div>
                        <input type="date" id="mc-sc-from" value="${firstOfMonth}" style="width:100%; height:38px; border-radius:10px; border:1.5px solid #cbd5e1; padding:0 6px; font-size:0.75rem; font-weight:700; color:#1e3a5f; background:#eff6ff; outline:none; box-sizing:border-box;">
                    </div>
                    <div>
                        <div style="font-size:10px; font-weight:800; color:#64748b; text-transform:uppercase; margin-bottom:4px;">To Date</div>
                        <input type="date" id="mc-sc-to" value="${today}" style="width:100%; height:38px; border-radius:10px; border:1.5px solid #cbd5e1; padding:0 6px; font-size:0.75rem; font-weight:700; color:#1e3a5f; background:#eff6ff; outline:none; box-sizing:border-box;">
                    </div>
                </div>
                <div id="mc-scorecard-body"><div style="text-align:center; padding:14px; font-size:12px; font-weight:800; color:#64748b;">लोड हो रहा है...</div></div>
                <button id="mc-scorecard-close-btn" style="width:100%; height:42px; border:none; border-radius:12px; background:#e2e8f0; color:#1e293b; font-size:12px; font-weight:900; text-transform:uppercase; margin-top:14px;">बंद करें</button>
            `;
            overlay.appendChild(sheet);
            document.body.appendChild(overlay);

            document.getElementById("mc-scorecard-close-btn").onclick = () => overlay.remove();
            document.getElementById("mc-sc-from").onchange = mcRefreshScorecard_;
            document.getElementById("mc-sc-to").onchange = mcRefreshScorecard_;
            mcRefreshScorecard_();
        }

        async function mcRefreshScorecard_() {
            const body = document.getElementById("mc-scorecard-body");
            if (!body) return;
            const fromDate = document.getElementById("mc-sc-from")?.value || "";
            const toDate = document.getElementById("mc-sc-to")?.value || "";
            if (fromDate && toDate && fromDate > toDate) {
                body.innerHTML = `<div style="text-align:center; padding:14px; font-size:12px; font-weight:800; color:#b91c1c;">From date, To date से पहले होनी चाहिए</div>`;
                return;
            }

            const fromTs = fromDate ? new Date(fromDate) : null;
            const toTs = toDate ? new Date(toDate) : null;
            if (toTs) toTs.setHours(23, 59, 59, 999);

            const dcFilter = activeDC || "";
            const all = await getMobileCorrectionEntries_();
            const entries = all.filter((e) => {
                if (dcFilter && e.dc_name !== dcFilter) return false;
                if (!fromTs && !toTs) return true;
                const d = mcParseFlaggedDate_(e.flagged_date);
                if (!d) return false;
                if (fromTs && d < fromTs) return false;
                if (toTs && d > toTs) return false;
                return true;
            });

            if (!entries.length) {
                body.innerHTML = `<div style="text-align:center; padding:14px; font-size:12px; font-weight:800; color:#64748b; background:#f8fafc; border-radius:12px;">इस अवधि में इस DC में कोई flag की हुई entry नहीं है।</div>`;
                return;
            }

            const groups = mcGroupByHq_(entries);
            const hqNames = Object.keys(groups).sort();

            const thStyle = "border:1px solid #1e3a5f; background:#1e3a5f; color:#ffffff; padding:6px 4px; font-size:8.5px; font-weight:900; text-transform:uppercase; white-space:normal; word-break:break-word; line-height:1.25;";
            const tdStyle = "border:1px solid #cbd5e1; padding:6px 4px; font-size:12px; font-weight:700; color:#1e293b; white-space:normal; text-align:center;";

            let totalFlagged = 0, totalCorrected = 0;
            const rowsHtml = hqNames.map((hq) => {
                const rows = groups[hq];
                const flagged = rows.length;
                const corrected = rows.filter((e) => e.status === "corrected").length;
                const pending = flagged - corrected;
                totalFlagged += flagged;
                totalCorrected += corrected;
                return `<tr>
                    <td style="${tdStyle} text-align:left; font-weight:900;">${escapeHtml(hq)}</td>
                    <td style="${tdStyle}">${flagged}</td>
                    <td style="${tdStyle} color:#15803d; font-weight:900;">${corrected}</td>
                    <td style="${tdStyle} color:#b91c1c; font-weight:900;">${pending}</td>
                </tr>`;
            }).join("");

            const totalPending = totalFlagged - totalCorrected;
            const totalsRow = `<tr style="background:#eff6ff;">
                <td style="${tdStyle} text-align:left; font-weight:900;">कुल योग</td>
                <td style="${tdStyle} font-weight:900;">${totalFlagged}</td>
                <td style="${tdStyle} color:#15803d; font-weight:900;">${totalCorrected}</td>
                <td style="${tdStyle} color:#b91c1c; font-weight:900;">${totalPending}</td>
            </tr>`;

            body.innerHTML = `
                <div style="border-radius:10px;">
                    <table style="border-collapse:collapse; width:100%; table-layout:fixed;">
                        <colgroup>
                            <col style="width:30%;"><col style="width:24%;"><col style="width:24%;"><col style="width:22%;">
                        </colgroup>
                        <thead><tr>
                            <th style="${thStyle} text-align:left;">मुख्यालय</th>
                            <th style="${thStyle}">किये गये wrong mb. no. फ्लैग</th>
                            <th style="${thStyle}">सही किए गए मोबाइल नंबर</th>
                            <th style="${thStyle}">पेंडिंग</th>
                        </tr></thead>
                        <tbody>${rowsHtml}${totalsRow}</tbody>
                    </table>
                </div>
            `;
        }

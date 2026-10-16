        // ===== Admin Dashboard (Phase-1: read-only report view) =====
        // Access: ⋮ header menu → "Admin Dashboard" (also: 700ms long-press on the
        // header title from Home screen) → PIN prompt. PIN check is client-side
        // (same trust model as the other role passwords in this app — a deterrent
        // for casual access, not real auth). PIN stored as a SHA-256 hash only,
        // never in plaintext.
        const ADMIN_PIN_HASH = "ab6b744b516e5f052f03c8ed6eaf9b617495aaee266ceeb9a1f4d96fa08d419f";
        let adminDashboardUnlocked_ = false;

        function toggleHeaderMenu_() {
            const menu = document.getElementById("header-menu-dropdown");
            if (!menu) return;
            menu.style.display = menu.style.display === "block" ? "none" : "block";
        }

        function closeHeaderMenu_() {
            const menu = document.getElementById("header-menu-dropdown");
            if (menu) menu.style.display = "none";
        }

        document.addEventListener("click", (e) => {
            const menu = document.getElementById("header-menu-dropdown");
            const btn = document.getElementById("header-menu-btn");
            if (!menu || menu.style.display !== "block") return;
            if (e.target === btn || menu.contains(e.target)) return;
            menu.style.display = "none";
        });

        function openAdminDashboardGate_() {
            if (adminDashboardUnlocked_) {
                switchView("admin-dashboard");
                renderAdminDashboardShell_();
                return;
            }
            promptAdminPin_();
        }

        function promptAdminPin_() {
            const existing = document.getElementById("admin-pin-overlay");
            if (existing) existing.remove();

            const overlay = document.createElement("div");
            overlay.id = "admin-pin-overlay";
            overlay.style.cssText = "position:fixed; inset:0; background:rgba(0,0,0,0.55); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;";
            overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });

            const box = document.createElement("div");
            box.style.cssText = "background:#ffffff; border-radius:18px; padding:20px; width:100%; max-width:320px; box-shadow:0 12px 30px rgba(0,0,0,0.25);";
            box.innerHTML = `
                <div style="font-size:14px; font-weight:900; color:#1e293b; text-transform:uppercase; margin-bottom:12px; text-align:center;">🔑 Admin PIN डालें</div>
                <input type="password" id="admin-pin-input" inputmode="text" style="width:100%; height:46px; border-radius:10px; border:1.5px solid #cbd5e1; padding:0 12px; font-size:14px; font-weight:700; margin-bottom:12px; box-sizing:border-box;" placeholder="PIN">
                <div style="display:flex; gap:10px;">
                    <button id="admin-pin-cancel-btn" style="flex:1; height:44px; border:none; border-radius:12px; background:#e2e8f0; color:#1e293b; font-size:12px; font-weight:900; text-transform:uppercase;">रद्द करें</button>
                    <button id="admin-pin-submit-btn" style="flex:1; height:44px; border:none; border-radius:12px; background:#2f74ad; color:#ffffff; font-size:12px; font-weight:900; text-transform:uppercase;">खोलें</button>
                </div>
            `;
            overlay.appendChild(box);
            document.body.appendChild(overlay);

            const input = document.getElementById("admin-pin-input");
            input.focus();
            const submit = async () => {
                const hash = await sha256Hex_(input.value);
                if (hash === null) return showToast("Secure (https) connection zaroori hai", false);
                if (hash === ADMIN_PIN_HASH) {
                    adminDashboardUnlocked_ = true;
                    overlay.remove();
                    switchView("admin-dashboard");
                    renderAdminDashboardShell_();
                } else {
                    showToast("गलत PIN", false);
                }
            };
            document.getElementById("admin-pin-submit-btn").onclick = submit;
            document.getElementById("admin-pin-cancel-btn").onclick = () => overlay.remove();
            input.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
        }

        function lockAdminDashboard_() {
            adminDashboardUnlocked_ = false;
            switchView("home");
        }

        function admDateKey_(raw) {
            return buildFeederDateKey_(raw);
        }

        function admInRange_(dateKey, fromKey, toKey) {
            if (!dateKey) return false;
            if (fromKey && dateKey < fromKey) return false;
            if (toKey && dateKey > toKey) return false;
            return true;
        }

        function admDefaultFromDate_() {
            const now = new Date();
            return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
        }

        function renderAdminDashboardShell_() {
            const container = document.getElementById("admin-dashboard-content");
            if (!container) return;
            const fromDefault = admDefaultFromDate_();
            const toDefault = localTodayIso_();
            container.innerHTML = `
                <div style="display:flex; gap:8px; margin-bottom:12px;">
                    <button type="button" onclick="lockAdminDashboard_()" style="flex:1; height:40px; border:none; border-radius:10px; background:rgba(0,0,0,0.15); color:#ffffff; font-size:10px; font-weight:900; text-transform:uppercase;">🔒 लॉक</button>
                    <button type="button" onclick="refreshAdminDashboardData_()" style="flex:1; height:40px; border:none; border-radius:10px; background:rgba(0,0,0,0.15); color:#ffffff; font-size:10px; font-weight:900; text-transform:uppercase;">🔄 Refresh</button>
                    <button type="button" onclick="admExportExcel_()" style="flex:1; height:40px; border:none; border-radius:10px; background:rgba(0,0,0,0.15); color:#ffffff; font-size:10px; font-weight:900; text-transform:uppercase;">📥 Excel</button>
                </div>
                <div style="margin-bottom:12px;">
                    <button type="button" onclick="admOpenDiagnostics_()" style="width:100%; height:40px; border:none; border-radius:10px; background:rgba(0,0,0,0.15); color:#ffffff; font-size:10px; font-weight:900; text-transform:uppercase;">🩺 Field Devices पर क्या गड़बड़ हुई (Diagnostics)</button>
                </div>
                <div style="margin-bottom:12px;">
                    <button type="button" onclick="admOpenIncidentMap_()" style="width:100%; height:40px; border:none; border-radius:10px; background:rgba(0,0,0,0.15); color:#ffffff; font-size:10px; font-weight:900; text-transform:uppercase;">📍 घटना मैप (Broken Pole / बिजली चोरी / DTR)</button>
                </div>
                ${trustedHtml_(watermarkAdminSectionHtml_())}
                <div style="background:rgba(255,255,255,0.95); border-radius:14px; padding:12px; margin-bottom:12px;">
                    <div style="font-size:11px; font-weight:900; color:#1e293b; margin-bottom:8px;">🔑 नए कर्मचारी के लिए PIN Hash बनाएं</div>
                    <div style="font-size:10px; font-weight:700; color:#64748b; margin-bottom:8px;">PIN डालें, hash कॉपी करके Employees sheet के pin_hash column में डालें — असली PIN कहीं save नहीं होता।</div>
                    <div style="display:flex; gap:8px; margin-bottom:8px;">
                        <input type="text" id="admin-pin-hash-input" placeholder="PIN" style="flex:1; height:38px; border-radius:10px; border:1.5px solid #cbd5e1; padding:0 10px; font-size:0.8rem; font-weight:700; color:#1e293b; box-sizing:border-box;">
                        <button type="button" onclick="admGeneratePinHash_()" style="height:38px; padding:0 14px; border:none; border-radius:10px; background:#1e293b; color:#ffffff; font-size:10px; font-weight:900; text-transform:uppercase;">Hash बनाएं</button>
                    </div>
                    <input type="text" id="admin-pin-hash-output" readonly placeholder="यहाँ hash दिखेगा" onclick="this.select()" style="width:100%; height:38px; border-radius:10px; border:1.5px dashed #94a3b8; padding:0 10px; font-size:0.7rem; font-weight:700; color:#075985; box-sizing:border-box; background:#f0f9ff;">
                </div>
                <div style="background:rgba(255,255,255,0.95); border-radius:14px; padding:12px; margin-bottom:12px;">
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                        <div>
                            <div style="font-size:10px; font-weight:800; color:#64748b; text-transform:uppercase; margin-bottom:4px;">From Date</div>
                            <input type="date" id="admin-from-date" value="${trustedHtml_(fromDefault)}" onchange="refreshAdminDashboardData_()" style="width:100%; height:38px; border-radius:10px; border:1.5px solid #cbd5e1; padding:0 8px; font-size:0.8rem; font-weight:700; color:#1e293b; box-sizing:border-box;">
                        </div>
                        <div>
                            <div style="font-size:10px; font-weight:800; color:#64748b; text-transform:uppercase; margin-bottom:4px;">To Date</div>
                            <input type="date" id="admin-to-date" value="${trustedHtml_(toDefault)}" onchange="refreshAdminDashboardData_()" style="width:100%; height:38px; border-radius:10px; border:1.5px solid #cbd5e1; padding:0 8px; font-size:0.8rem; font-weight:700; color:#1e293b; box-sizing:border-box;">
                        </div>
                    </div>
                </div>
                <div id="admin-dashboard-body"><div style="text-align:center; padding:20px; font-size:12px; font-weight:800; color:#ffffff;">लोड हो रहा है...</div></div>
            `;
            renderWatermarkAdminPreview_();
            refreshAdminDashboardData_();
        }

        async function admGeneratePinHash_() {
            const input = document.getElementById("admin-pin-hash-input");
            const output = document.getElementById("admin-pin-hash-output");
            const pin = input?.value || "";
            if (!pin) return showToast("पहले PIN डालें", false);
            const hash = await sha256Hex_(pin);
            if (output) output.value = hash || "";
            if (!hash) showToast("Secure (https) connection ज़रूरी है", false);
        }

        async function admFetchFeederRows_(fromKey, toKey) {
            try {
                await loadFeederReportData(true);
                return (feederReportRows || []).filter((row) => admInRange_(admDateKey_(row["DATE(DD/MM/YYY)"]), fromKey, toKey));
            } catch (_) { return []; }
        }

        // Dashboard kholne par sirf GINTI aati hai (ek chhota getCounts), poori
        // entry nahi — dekhein apps-script/Code.gs ka "ADMIN DASHBOARD" hissa.
        // Pehle teen module ki saari entry + saari feeder pankti har baar poori
        // utarti thi, aur taarikh ka filter utarne ke BAAD phone me lagta tha —
        // yaani taarikh badalne par poora data dobara. Woh bojh har mahine
        // badhta hi jaata, kabhi ghatta nahi.
        async function admFetchCounts_(fromKey, toKey) {
            try {
                const url = `${scriptURL}?action=getCounts&from=${encodeURIComponent(fromKey)}&to=${encodeURIComponent(toKey)}&auth_token=${encodeURIComponent(APPS_SCRIPT_AUTH_TOKEN)}&t=${Date.now()}`;
                const res = await fetchWithTimeout_(url);
                const data = await res.json();
                if (data && data.status === "success") return data;
                logErr_("admin-getCounts", new Error(data?.message || "getCounts failed"));
                return null;
            } catch (err) {
                logErr_("admin-getCounts", err);
                return null;
            }
        }

        let admLastData_ = null;

        // Excel ke liye poori entry chahiye hi — par woh sirf is button par
        // utarti hai, dashboard kholne par nahi.
        async function admFetchFullRows_(fromKey, toKey) {
            const [bp, bc, kc, feederRows, mobileRows] = await Promise.all([
                fetchSharedEntries_("broken_pole", true),
                fetchSharedEntries_("bijli_chori", true),
                fetchSharedEntries_("karya_charitra", true),
                admFetchFeederRows_(fromKey, toKey),
                fetchSharedEntries_("mobile_correction", true)
            ]);
            return {
                feederRows,
                bpInRange: bp.filter((e) => admInRange_(admDateKey_(e.date), fromKey, toKey)),
                bcInRange: bc.filter((e) => admInRange_(admDateKey_(e.date), fromKey, toKey)),
                kcInRange: kc.filter((e) => admInRange_(admDateKey_(e.scn_date_iso), fromKey, toKey)),
                mobileRows,
                fromKey,
                toKey
            };
        }

        async function admExportExcel_() {
            const fromKey = document.getElementById("admin-from-date")?.value || "";
            const toKey = document.getElementById("admin-to-date")?.value || "";
            try {
                showToast("Excel के लिए पूरी एंट्री लाई जा रही है...", true);
                await ensureXlsx_();
                const { feederRows, bpInRange, bcInRange, kcInRange, mobileRows } = await admFetchFullRows_(fromKey, toKey);
                const wb = XLSX.utils.book_new();

                const addSheet = (name, headers, rows) => {
                    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
                    XLSX.utils.book_append_sheet(wb, ws, name);
                };

                addSheet("Feeder Reading", ["Date", "Substation", "Feeder", "Meter No", "Previous", "Current", "Consumption", "DC Name", "Submitted By"], feederRows.map((r) => [
                    r["DATE(DD/MM/YYY)"] || "", r["33/11 KV SUBSTATION"] || "", r["33 AND 11 KV FEEDER"] || "", r["METER NO"] || "",
                    r["PREVIUS READING"] || "", r["CURRENT READING"] || "", r["CONSUMPTION"] || "", r["DC NAME"] || "", r.submitted_by_name || ""
                ]));
                addSheet("Broken Pole", ["Date", "Remark 1", "Remark 2", "Location", "Submitted By"], bpInRange.map((e) => [e.date || "", e.remark1 || "", e.remark2 || "", e.gps_location || "", e.submitted_by_name || ""]));
                addSheet("Bijli Chori", ["Date", "Name/IVRS", "Remark", "Submitted By"], bcInRange.map((e) => [e.date || "", e.name || e.ivrs || "", e.remark || "", e.submitted_by_name || ""]));
                addSheet("Karya Charitra", ["Date", "Employee", "SCN No", "Submitted By"], kcInRange.map((r) => [kcFormatDate_ ? kcFormatDate_(r.scn_date_iso) : (r.scn_date_iso || ""), r.emp_name || "", `SCN-${String(r.dispatch_no || "").padStart(4, "0")}`, r.submitted_by_name || ""]));
                // Purane khane (r.dc / r.mobile) kabhi aate hi nahi the — woh band
                // ho chuke getSummary ki shakal the. mobile_correction module jo
                // asal me bhejta hai, wahi yahan likha hai.
                addSheet("Mobile Update", ["DC", "HQ", "IVRS", "पुराना मोबाइल", "सही मोबाइल", "स्थिति"], (mobileRows || []).map((r) => [
                    r.dc_name || "", r.hq || "", r.ivrs || "", r.old_mobile || "", r.correct_mobile || "", r.status || ""
                ]));

                const filename = `Admin_Dashboard_${(fromKey || "all").replace(/-/g, "")}_${(toKey || "all").replace(/-/g, "")}.xlsx`;
                XLSX.writeFile(wb, filename);
                showToast("Excel Downloaded!", true);
            } catch (err) {
                logErr_("admin-excel", err);
                showToast("Excel नहीं बन पाया — नेटवर्क देखकर दोबारा कोशिश करें", false);
            }
        }

        // Field devices se error-logs — pehle sirf us device ke localStorage me
        // bandh rehte the, admin ko kabhi pata nahi chalta tha ki kis DC/device par
        // kya gadbad ho rahi hai. Ab yahan ek jagah dikhte hain (device_diagnostics
        // module se, mobile_correction jaisi hi generic backend mechanism).
        function admOpenDiagnostics_() {
            const menu = document.getElementById("header-menu-dropdown");
            if (menu) menu.style.display = "none";
            const existing = document.getElementById("adm-diag-overlay");
            if (existing) existing.remove();

            const overlay = document.createElement("div");
            overlay.id = "adm-diag-overlay";
            overlay.style.cssText = "position:fixed; inset:0; background:rgba(0,0,0,0.55); z-index:9999; display:flex; align-items:flex-end; justify-content:center;";
            overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });

            const sheet = document.createElement("div");
            sheet.style.cssText = "background:#ffffff; border-radius:20px 20px 0 0; padding:18px; width:100%; max-width:480px; max-height:82vh; overflow-y:auto; box-shadow:0 -12px 30px rgba(0,0,0,0.25);";
            sheet.innerHTML = `
                <div style="font-size:14px; font-weight:900; color:#1e293b; text-align:center; text-transform:uppercase; margin-bottom:10px;">🩺 Field Devices Diagnostics</div>
                <div id="adm-diag-body"><div style="text-align:center; padding:14px; font-size:12px; font-weight:800; color:#64748b;">लोड हो रहा है...</div></div>
                <button id="adm-diag-close-btn" style="width:100%; height:42px; border:none; border-radius:12px; background:#e2e8f0; color:#1e293b; font-size:12px; font-weight:900; text-transform:uppercase; margin-top:14px;">बंद करें</button>
            `;
            overlay.appendChild(sheet);
            document.body.appendChild(overlay);
            document.getElementById("adm-diag-close-btn").onclick = () => overlay.remove();

            admRefreshDiagnostics_();
        }

        async function admRefreshDiagnostics_() {
            const body = document.getElementById("adm-diag-body");
            if (!body) return;
            let entries = [];
            try {
                entries = await fetchSharedEntries_(DIAGNOSTICS_MODULE, true);
            } catch (_) {}

            if (!entries.length) {
                body.innerHTML = `<div style="text-align:center; padding:18px; font-size:12px; font-weight:800; color:#64748b; background:#f8fafc; border-radius:14px;">कोई device error report नहीं हुआ (ya backend module abhi register nahi hua).</div>`;
                return;
            }

            const sorted = entries.slice().sort((a, b) => new Date(b.timestamp || b.t || 0) - new Date(a.timestamp || a.t || 0)).slice(0, 60);
            body.innerHTML = `
                <div style="font-size:10.5px; font-weight:800; color:#64748b; margin-bottom:8px;">पिछले ${trustedHtml_(sorted.length)} errors (सबसे नया पहले)</div>
                ${trustedHtml_(sorted.map((e) => `
                    <div style="border:1px solid #fca5a5; border-radius:10px; padding:8px 10px; margin-bottom:8px; background:#fef2f2;">
                        <div style="display:flex; justify-content:space-between; gap:8px; margin-bottom:3px;">
                            <span style="font-size:10px; font-weight:900; color:#991b1b; text-transform:uppercase;">${escapeHtml(e.ctx || "?")}</span>
                            <span style="font-size:9.5px; font-weight:700; color:#94a3b8; flex-shrink:0;">${escapeHtml((e.timestamp || e.t || "").slice(0, 16).replace("T", " "))}</span>
                        </div>
                        <div style="font-size:11.5px; font-weight:700; color:#1e293b; line-height:1.4; margin-bottom:4px;">${escapeHtml(e.msg || "")}${e.extra ? ` <span style="color:#94a3b8;">[${escapeHtml(e.extra)}]</span>` : ""}</div>
                        <!-- Karmchari ka naam sabse pehle — "Device: Dm2k3j4x" se kabhi pata nahi chalta tha ki kiska phone hai -->
                        <div style="font-size:9.5px; font-weight:700; color:#64748b;">${e.emp ? `<span style="color:#0f766e; font-weight:900;">${escapeHtml(e.emp)}</span> | ` : ""}DC: ${escapeHtml(e.dc || "-")} | View: ${escapeHtml(e.view || "-")} | Device: ${escapeHtml((e.device_id || "").slice(0, 10))}</div>
                    </div>
                `).join(""))}
            `;
        }

        function admSummaryCard_(icon, label, count, note) {
            return `
                <div style="background:rgba(255,255,255,0.95); border-radius:14px; padding:14px; text-align:center;">
                    <div style="font-size:22px; margin-bottom:4px;">${icon}</div>
                    <div style="font-size:20px; font-weight:900; color:#1e293b;">${count === null ? "—" : count}</div>
                    <div style="font-size:10px; font-weight:800; color:#64748b; text-transform:uppercase; margin-top:2px;">${escapeHtml(label)}</div>
                    ${note ? `<div style="font-size:9px; font-weight:700; color:#94a3b8; margin-top:2px;">${escapeHtml(note)}</div>` : ""}
                </div>
            `;
        }

        async function refreshAdminDashboardData_() {
            const body = document.getElementById("admin-dashboard-body");
            if (!body) return;
            body.innerHTML = `<div style="text-align:center; padding:20px; font-size:12px; font-weight:800; color:#ffffff;">लोड हो रहा है...</div>`;

            const fromKey = document.getElementById("admin-from-date")?.value || "";
            const toKey = document.getElementById("admin-to-date")?.value || "";

            const data = await admFetchCounts_(fromKey, toKey);
            if (!data) {
                body.innerHTML = `<div style="background:rgba(255,255,255,0.9); border-radius:14px; padding:16px; text-align:center; font-size:11.5px; font-weight:800; color:#991b1b;">गिनती नहीं आ सकी — नेटवर्क देखकर 🔄 Refresh दबाएं</div>`;
                admLastData_ = null;
                return;
            }

            const c = data.counts || {};
            const employees = Array.isArray(data.employees) ? data.employees : [];
            admLastData_ = { counts: c, employees, fromKey, toKey };

            const cards = [
                admSummaryCard_("🔌", "Feeder Reading", c.feeder ?? null),
                admSummaryCard_("⚡", "Broken Pole", c.broken_pole ?? null),
                admSummaryCard_("⚠️", "बिजली चोरी", c.bijli_chori ?? null),
                admSummaryCard_("📋", "कर्मचारी SCN", c.karya_charitra ?? null),
                admSummaryCard_("📱", "Mobile Update", c.mobile_correction ?? null, "कुल अब तक (date filter लागू नहीं)")
            ].join("");

            const employeeBreakdownHtml = employees.length ? `
                <div style="margin-bottom:12px;">
                    <div style="font-size:12px; font-weight:900; color:#ffffff; margin-bottom:6px;">👤 कर्मचारी अनुसार (कुल entries)</div>
                    <div style="background:rgba(255,255,255,0.92); border-radius:14px; padding:8px; max-height:200px; overflow-y:auto;">
                        ${employees.map((e) => `
                            <div style="display:flex; align-items:center; justify-content:space-between; padding:7px 8px; border-bottom:1px solid #e5e7eb;">
                                <div style="font-size:11px; font-weight:800; color:#1e293b;">${escapeHtml(e.name || "")}</div>
                                <div style="font-size:11px; font-weight:900; color:#075985;">${escapeHtml(String(e.count ?? 0))}</div>
                            </div>
                        `).join("")}
                    </div>
                </div>
            ` : "";

            body.innerHTML = trustedHtml_(`
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:14px;">${trustedHtml_(cards)}</div>
                ${employeeBreakdownHtml}
                <div style="background:rgba(255,255,255,0.9); border-radius:14px; padding:12px; font-size:10.5px; font-weight:700; color:#475569; line-height:1.5;">
                    यहाँ सिर्फ़ गिनती आती है — एंट्री की सूची और फ़ोटो जान-बूझकर नहीं लाई जातीं, ताकि मोबाइल डेटा बचे।
                    एक-एक एंट्री देखनी हो तो <b>📍 घटना मैप</b>, और पूरा ब्यौरा चाहिए तो <b>📥 Excel</b> — दोनों तभी डेटा लाते हैं जब आप दबाते हैं।
                </div>
            `);
        }

        // Long-press (700ms) on the header title, only from Home screen, opens the
        // admin gate. No visible UI hint by design — this is an internal tool, not
        // a field-officer feature.
        (function setupAdminLongPress_() {
            let pressTimer = null;
            const start = () => {
                if (!document.getElementById("home-view")?.classList.contains("active")) return;
                pressTimer = setTimeout(() => { openAdminDashboardGate_(); }, 700);
            };
            const cancel = () => { if (pressTimer) clearTimeout(pressTimer); pressTimer = null; };
            const attach = () => {
                const el = document.getElementById("main-header-title");
                if (!el) return;
                el.addEventListener("pointerdown", start);
                el.addEventListener("pointerup", cancel);
                el.addEventListener("pointerleave", cancel);
                el.addEventListener("pointercancel", cancel);
            };
            if (document.readyState === "loading") {
                document.addEventListener("DOMContentLoaded", attach);
            } else {
                attach();
            }
        })();

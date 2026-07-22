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
                <div style="display:flex; gap:10px; margin-bottom:12px;">
                    <button type="button" onclick="lockAdminDashboard_()" style="flex:1; height:40px; border:none; border-radius:10px; background:rgba(0,0,0,0.15); color:#ffffff; font-size:11px; font-weight:900; text-transform:uppercase;">🔒 लॉक करें</button>
                    <button type="button" onclick="refreshAdminDashboardData_()" style="flex:1; height:40px; border:none; border-radius:10px; background:rgba(0,0,0,0.15); color:#ffffff; font-size:11px; font-weight:900; text-transform:uppercase;">🔄 Refresh</button>
                </div>
                <div style="background:rgba(255,255,255,0.95); border-radius:14px; padding:12px; margin-bottom:12px;">
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                        <div>
                            <div style="font-size:10px; font-weight:800; color:#64748b; text-transform:uppercase; margin-bottom:4px;">From Date</div>
                            <input type="date" id="admin-from-date" value="${fromDefault}" onchange="refreshAdminDashboardData_()" style="width:100%; height:38px; border-radius:10px; border:1.5px solid #cbd5e1; padding:0 8px; font-size:0.8rem; font-weight:700; color:#1e293b; box-sizing:border-box;">
                        </div>
                        <div>
                            <div style="font-size:10px; font-weight:800; color:#64748b; text-transform:uppercase; margin-bottom:4px;">To Date</div>
                            <input type="date" id="admin-to-date" value="${toDefault}" onchange="refreshAdminDashboardData_()" style="width:100%; height:38px; border-radius:10px; border:1.5px solid #cbd5e1; padding:0 8px; font-size:0.8rem; font-weight:700; color:#1e293b; box-sizing:border-box;">
                        </div>
                    </div>
                </div>
                <div id="admin-dashboard-body"><div style="text-align:center; padding:20px; font-size:12px; font-weight:800; color:#ffffff;">लोड हो रहा है...</div></div>
            `;
            refreshAdminDashboardData_();
        }

        async function admFetchFeederRows_(fromKey, toKey) {
            try {
                await loadFeederReportData(true);
                return (feederReportRows || []).filter((row) => admInRange_(admDateKey_(row["DATE(DD/MM/YYY)"]), fromKey, toKey));
            } catch (_) { return []; }
        }

        async function admFetchMobileUpdateCount_() {
            try {
                const res = await fetch(`${scriptURL}?action=getSummary&auth_token=${encodeURIComponent(APPS_SCRIPT_AUTH_TOKEN)}&t=${Date.now()}`);
                const data = await res.json();
                return Array.isArray(data) ? data.length : 0;
            } catch (_) { return null; }
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

        function admEntrySection_(title, rows) {
            if (!rows.length) {
                return `
                    <div style="margin-bottom:12px;">
                        <div style="font-size:12px; font-weight:900; color:#ffffff; margin-bottom:6px;">${escapeHtml(title)}</div>
                        <div style="background:rgba(255,255,255,0.85); border-radius:12px; padding:12px; text-align:center; font-size:11px; font-weight:700; color:#64748b;">इस दिनांक सीमा में कोई एंट्री नहीं</div>
                    </div>
                `;
            }
            return `
                <div style="margin-bottom:12px;">
                    <div style="font-size:12px; font-weight:900; color:#ffffff; margin-bottom:6px;">${escapeHtml(title)} (${rows.length})</div>
                    <div style="background:rgba(255,255,255,0.92); border-radius:14px; padding:8px; max-height:280px; overflow-y:auto;">
                        ${rows.join("")}
                    </div>
                </div>
            `;
        }

        function admEntryRow_(dateStr, titleText, subtitleText, viewOnClick) {
            return `
                <div style="display:flex; align-items:center; gap:10px; padding:8px; border-bottom:1px solid #e5e7eb;">
                    <div style="flex:1; min-width:0;">
                        <div style="font-size:11px; font-weight:900; color:#1e293b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(dateStr)} — ${escapeHtml(titleText)}</div>
                        <div style="font-size:10px; font-weight:700; color:#64748b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(subtitleText)}</div>
                    </div>
                    ${viewOnClick ? `<button onclick="${viewOnClick}" style="border:none; background:#e0f2fe; color:#075985; border-radius:999px; padding:6px 10px; font-size:10px; font-weight:900; text-transform:uppercase; flex-shrink:0;">देखें</button>` : ""}
                </div>
            `;
        }

        async function refreshAdminDashboardData_() {
            const body = document.getElementById("admin-dashboard-body");
            if (!body) return;
            body.innerHTML = `<div style="text-align:center; padding:20px; font-size:12px; font-weight:800; color:#ffffff;">लोड हो रहा है...</div>`;

            const fromInput = document.getElementById("admin-from-date");
            const toInput = document.getElementById("admin-to-date");
            const fromKey = fromInput?.value || "";
            const toKey = toInput?.value || "";

            const [brokenPole, bijliChori, karyaCharitra, feederRows, mobileCount] = await Promise.all([
                fetchSharedEntries_("broken_pole", true),
                fetchSharedEntries_("bijli_chori", true),
                fetchSharedEntries_("karya_charitra", true),
                admFetchFeederRows_(fromKey, toKey),
                admFetchMobileUpdateCount_()
            ]);

            const bpInRange = brokenPole.filter((e) => admInRange_(admDateKey_(e.date), fromKey, toKey));
            const bcInRange = bijliChori.filter((e) => admInRange_(admDateKey_(e.date), fromKey, toKey));
            const kcInRange = karyaCharitra.filter((e) => admInRange_(admDateKey_(e.scn_date_iso), fromKey, toKey));

            const cards = [
                admSummaryCard_("🔌", "Feeder Reading", feederRows.length),
                admSummaryCard_("⚡", "Broken Pole", bpInRange.length),
                admSummaryCard_("⚠️", "बिजली चोरी", bcInRange.length),
                admSummaryCard_("📋", "कर्मचारी SCN", kcInRange.length),
                admSummaryCard_("📱", "Mobile Update", mobileCount, "कुल अब तक (date filter लागू नहीं)")
            ].join("");

            const bpRows = bpInRange.slice().reverse().slice(0, 30).map((e) =>
                admEntryRow_(e.date || "", e.remark1 || "Entry", e.gps_location || e.remark2 || "", `viewEntryDetail_('broken_pole','${getEntryUid_(e)}')`)
            );
            const bcRows = bcInRange.slice().reverse().slice(0, 30).map((e) =>
                admEntryRow_(e.date || "", e.name || e.ivrs || "Entry", e.remark || "", `viewEntryDetail_('bijli_chori','${getEntryUid_(e)}')`)
            );
            const kcRows = kcInRange.slice().reverse().slice(0, 30).map((r) =>
                admEntryRow_(kcFormatDate_ ? kcFormatDate_(r.scn_date_iso) : (r.scn_date_iso || ""), r.emp_name || "", `SCN-${String(r.dispatch_no || "").padStart(4, "0")}`)
            );
            const feederRowsHtml = feederRows.slice().reverse().slice(0, 30).map((row) =>
                admEntryRow_(row["DATE(DD/MM/YYY)"] || "", `${row["33/11 KV SUBSTATION"] || ""} / ${row["33 AND 11 KV FEEDER"] || ""}`, `Consumption: ${row["CONSUMPTION"] || "-"}`)
            );

            const photoEntries = [
                ...bpInRange.map((e) => ({ storeName: "broken_pole", entry: e, thumb: ENTRY_STORE_CONFIG.broken_pole.getThumb(e) })),
                ...bcInRange.map((e) => ({ storeName: "bijli_chori", entry: e, thumb: ENTRY_STORE_CONFIG.bijli_chori.getThumb(e) }))
            ].filter((p) => p.thumb).slice(0, 40);

            const photoGridHtml = photoEntries.length ? `
                <div style="margin-bottom:12px;">
                    <div style="font-size:12px; font-weight:900; color:#ffffff; margin-bottom:6px;">📷 Photos (${photoEntries.length})</div>
                    <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:6px; background:rgba(255,255,255,0.92); border-radius:14px; padding:8px;">
                        ${photoEntries.map((p) => `<img src="${p.thumb}" alt="एंट्री फोटो" referrerpolicy="no-referrer" onclick="viewEntryDetail_('${p.storeName}','${getEntryUid_(p.entry)}')" style="width:100%; aspect-ratio:1; object-fit:cover; border-radius:8px; cursor:pointer;">`).join("")}
                    </div>
                </div>
            ` : "";

            body.innerHTML = `
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:14px;">${cards}</div>
                ${photoGridHtml}
                ${admEntrySection_("🔌 Feeder Reading", feederRowsHtml)}
                ${admEntrySection_("⚡ Broken Pole", bpRows)}
                ${admEntrySection_("⚠️ बिजली चोरी", bcRows)}
                ${admEntrySection_("📋 कर्मचारी कार्य चरित्रावली", kcRows)}
            `;
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

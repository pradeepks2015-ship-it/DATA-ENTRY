        function saveOriginalBalances_() {
            const map = {};
            stockMaterials.forEach((m) => {
                if (m.originalBalance !== undefined) map[m.name] = m.originalBalance;
            });
            try { localStorage.setItem("stock-original-balances", JSON.stringify(map)); } catch(_) {}
        }

        function loadOriginalBalances_() {
            try { return JSON.parse(localStorage.getItem("stock-original-balances") || "{}"); } catch(_) { return {}; }
        }

        function getStockBalance(item) {
            if (item && typeof item.currentBalance === "number" && !Number.isNaN(item.currentBalance)) {
                return item.currentBalance;
            }
            return item.inward - item.issue;
        }

        function getStockStatus(item) {
            const balance = getStockBalance(item);
            if (balance <= item.min) return { label: "Low Stock", className: "chip-danger" };
            if (balance <= item.min + 15) return { label: "Watch", className: "chip-warn" };
            return { label: "Healthy", className: "chip-ok" };
        }

        function renderStockDashboard() {

            document.getElementById("stock-dashboard-content").innerHTML = `

                <!-- ===== SECTION 1: STOCK AVAILABILITY ===== -->
                <div style="margin-bottom:18px;">
                    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
                        <div style="display:flex; align-items:center; gap:8px;">
                            <div style="width:4px; height:20px; background:#16a34a; border-radius:2px;"></div>
                            <div style="font-size:13px; font-weight:900; color:#14532d; text-transform:uppercase; letter-spacing:0.5px;">📦 उपलब्ध सामग्री</div>
                        </div>
                        <div style="display:flex; gap:6px;">
                            <button onclick="showBulkStockUpdate()" style="border:none; background:#0284c7; color:#fff; border-radius:8px; padding:6px 10px; font-size:11px; font-weight:900; cursor:pointer;">📝 All Update</button>
                            <button onclick="showAddMaterialModal()" style="border:none; background:#16a34a; color:#fff; border-radius:8px; padding:6px 10px; font-size:11px; font-weight:900; cursor:pointer;">➕ जोड़ें</button>
                        </div>
                    </div>
                    ${stockMaterials.length === 0
                        ? `<div style="text-align:center; padding:20px; background:#f8fafc; border-radius:12px; font-size:12px; font-weight:700; color:#64748b; border:2px dashed #e2e8f0;">कोई material नहीं मिला।</div>`
                        : `<div style="display:flex; flex-direction:column; gap:8px;">
                            ${stockMaterials.map((item) => {
                                const bal  = getStockBalance(item);
                                // Calculate total issued from issue log for this material
                                const issLog = getIssueLog_().filter((e) => e.material_name === item.name && !e.returned);
                                const totalIssued = issLog.reduce((s, e) => s + (Number(e.qty)||0), 0);
                                // Total = fixed (set by All Update or ✏️ edit)
                                // Balance = Total - Issue (dynamically calculated)
                                const total = item.originalBalance ?? (bal + totalIssued);
                                const balance = Math.max(0, total - totalIssued);
                                // Sync currentBalance with calculated balance
                                if (item.currentBalance !== balance) item.currentBalance = balance;
                                const color  = balance <= 0 ? "#ef4444" : "#16a34a";
                                const bg     = balance <= 0 ? "#fef2f2" : "#f0fdf4";
                                const border = balance <= 0 ? "#fca5a5" : "#86efac";
                                return `<div style="background:${bg}; border:1.5px solid ${border}; border-radius:14px; padding:12px;">
                                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                                        <div style="font-size:13px; font-weight:900; color:#1e293b;">${escapeHtml(item.name)}</div>
                                        <button onclick="deleteStockMaterial('${item.id}')" style="border:none; background:rgba(239,68,68,0.12); color:#ef4444; border-radius:6px; width:26px; height:26px; font-size:13px; cursor:pointer; padding:0; flex-shrink:0;">🗑</button>
                                    </div>
                                    <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px;">
                                        <div style="background:rgba(239,68,68,0.08); border-radius:8px; padding:6px; text-align:center;">
                                            <div style="font-size:9px; font-weight:900; color:#b91c1c; text-transform:uppercase; margin-bottom:2px;">Issue</div>
                                            <div style="font-size:18px; font-weight:900; color:#ef4444; line-height:1;">${totalIssued}</div>
                                            <div style="font-size:9px; font-weight:700; color:#94a3b8;">${escapeHtml(item.unit)}</div>
                                        </div>
                                        <div style="background:rgba(37,99,235,0.08); border-radius:8px; padding:6px; text-align:center;">
                                            <div style="font-size:9px; font-weight:900; color:#1d4ed8; text-transform:uppercase; margin-bottom:2px;">बाकी</div>
                                            <div style="font-size:18px; font-weight:900; color:#2563eb; line-height:1;">${balance}</div>
                                            <div style="font-size:9px; font-weight:700; color:#94a3b8;">${escapeHtml(item.unit)}</div>
                                        </div>
                                        <div onclick="editMaterialBalance('${item.id}')" style="background:${bg}; border:1.5px solid ${border}; border-radius:8px; padding:6px; text-align:center; cursor:pointer;">
                                            <div style="font-size:9px; font-weight:900; color:${color}; text-transform:uppercase; margin-bottom:2px;">Total ✏️</div>
                                            <div style="font-size:18px; font-weight:900; color:${color}; line-height:1;">${total}</div>
                                            <div style="font-size:9px; font-weight:700; color:#94a3b8;">${escapeHtml(item.unit)}</div>
                                        </div>
                                    </div>
                                </div>`;
                            }).join("")}
                        </div>`
                    }
                </div>

                <!-- ===== SECTION 2: ISSUE HISTORY BUTTON ===== -->
                <div style="margin-bottom:18px;">
                    <button onclick="openStockSection('stock-issue-history'); renderIssueHistoryView();" style="width:100%; height:50px; border:none; border-radius:14px; background:linear-gradient(135deg,#0284c7,#0c4a6e); color:#fff; font-size:13px; font-weight:900; text-transform:uppercase; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:10px;">
                        📋 Issue इतिहास देखें
                        <span style="background:rgba(255,255,255,0.2); border-radius:999px; padding:2px 10px; font-size:11px;">${getIssueLog_().length} entries</span>
                    </button>
                </div>

                <!-- ===== SECTION 3: TODAY'S ACTIVITY ===== -->
                ${(() => {
                    const todayDate = getCurrentDateDDMMYYYY().replace(/-/g, "/");
                    const rec = stockMovements.filter((m) => m.type === "RECEIVE" && m.date === todayDate).slice(0,5);
                    const iss = stockMovements.filter((m) => m.type === "ISSUE" && m.date === todayDate).slice(0,5);
                    if (!rec.length && !iss.length) return "";
                    return `<div style="margin-bottom:14px;">
                        <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
                            <div style="width:4px; height:20px; background:#8b5cf6; border-radius:2px;"></div>
                            <div style="font-size:13px; font-weight:900; color:#4c1d95; text-transform:uppercase; letter-spacing:0.5px;">📅 आज की गतिविधि</div>
                        </div>
                        <div class="stock-mini-summary">
                            <div class="stock-summary-box">
                                <h4>Received</h4>
                                ${rec.length ? rec.map((m) => `<div class="stock-summary-line"><span>${escapeHtml(m.material)}</span><span>${m.qty}</span></div>`).join("") : `<div class="stock-summary-empty">—</div>`}
                            </div>
                            <div class="stock-summary-box">
                                <h4>Issued</h4>
                                ${iss.length ? iss.map((m) => `<div class="stock-summary-line"><span>${escapeHtml(m.material)}</span><span>${m.qty}</span></div>`).join("") : `<div class="stock-summary-empty">—</div>`}
                            </div>
                        </div>
                    </div>`;
                })()}
            `;
            renderMaterialList();
            renderLiveStock();
            renderLowStock();
            renderStockReport();
            renderPendingStockList("receive");
            renderPendingStockList("issue");
            refreshStockDropdowns_();
        }

        function showBulkStockUpdate() {
            document.getElementById("bulk-stock-overlay")?.remove();
            const authOverlay = document.createElement("div");
            authOverlay.id = "bulk-stock-overlay";
            authOverlay.style.cssText = "position:fixed; inset:0; background:rgba(0,0,0,0.6); z-index:9999; display:flex; align-items:center; justify-content:center; padding:20px;";
            authOverlay.innerHTML = `
                <div style="background:#fff; border-radius:18px; padding:18px; width:100%; max-width:300px; text-align:center;">
                    <div style="font-size:14px; font-weight:900; color:#0284c7; margin-bottom:8px;">🔐 Stock Update</div>
                    <div style="font-size:11px; font-weight:700; color:#64748b; margin-bottom:12px;">JE Password डालें</div>
                    <input type="password" id="bulk-pwd" placeholder="Password..." style="width:100%; height:46px; border-radius:12px; border:2px solid #0284c7; padding:0 14px; font-size:16px; font-weight:900; text-align:center; outline:none; margin-bottom:12px;">
                    <div style="display:flex; gap:10px;">
                        <button onclick="document.getElementById('bulk-stock-overlay').remove()" style="flex:1; height:42px; border:none; border-radius:10px; background:#e2e8f0; color:#1e293b; font-size:12px; font-weight:900;">Cancel</button>
                        <button id="bulk-auth-ok" style="flex:1; height:42px; border:none; border-radius:10px; background:linear-gradient(135deg,#0284c7,#0c4a6e); color:#fff; font-size:12px; font-weight:900;">OK</button>
                    </div>
                </div>`;
            document.body.appendChild(authOverlay);
            const proceed = () => {
                if ((document.getElementById("bulk-pwd")?.value || "") !== "JE123") return showToast("गलत पासवर्ड", false);
                authOverlay.remove();
                showBulkStockForm_();
            };
            document.getElementById("bulk-auth-ok").onclick = proceed;
            document.getElementById("bulk-pwd").onkeydown = (e) => { if (e.key === "Enter") proceed(); };
        }

        function showBulkStockForm_() {
            const overlay = document.createElement("div");
            overlay.style.cssText = "position:fixed; inset:0; background:rgba(0,0,0,0.6); z-index:9999; display:flex; align-items:flex-start; justify-content:center; padding:16px; overflow-y:auto;";
            const rows = stockMaterials.map((item) => `
                <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
                    <div style="flex:1; font-size:13px; font-weight:900; color:#1e293b;">${escapeHtml(item.name)}<br><span style="font-size:10px; font-weight:700; color:#64748b;">${escapeHtml(item.unit)} | अभी: ${getStockBalance(item)}</span></div>
                    <input type="number" min="0" value="0" id="bulk-${item.id}" style="width:80px; height:38px; border-radius:8px; border:1.5px solid #16a34a; padding:0 10px; font-size:14px; font-weight:900; text-align:center; outline:none;">
                </div>`).join("");
            overlay.innerHTML = `
                <div style="background:#fff; border-radius:18px; padding:18px; width:100%; max-width:360px; margin-top:20px; box-shadow:0 12px 30px rgba(0,0,0,0.3);">
                    <div style="font-size:14px; font-weight:900; color:#0284c7; margin-bottom:10px;">📝 Stock Update</div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:10px;">
                        <button id="mode-add-btn" onclick="window._bulkMode='add'; document.getElementById('mode-add-btn').style.background='linear-gradient(135deg,#16a34a,#15803d)'; document.getElementById('mode-add-btn').style.color='#fff'; document.getElementById('mode-set-btn').style.background='#e2e8f0'; document.getElementById('mode-set-btn').style.color='#1e293b'; document.getElementById('bulk-mode-desc').innerHTML='➕ <b>जोड़ें:</b> मात्रा existing में add होगी'; stockMaterials.forEach(m=>{var i=document.getElementById('bulk-'+m.id); if(i) i.value='0';});" style="height:40px; border:none; border-radius:10px; background:linear-gradient(135deg,#16a34a,#15803d); color:#fff; font-size:12px; font-weight:900;">➕ जोड़ें</button>
                        <button id="mode-set-btn" onclick="window._bulkMode='set'; document.getElementById('mode-set-btn').style.background='linear-gradient(135deg,#0284c7,#0c4a6e)'; document.getElementById('mode-set-btn').style.color='#fff'; document.getElementById('mode-add-btn').style.background='#e2e8f0'; document.getElementById('mode-add-btn').style.color='#1e293b'; document.getElementById('bulk-mode-desc').innerHTML='🔄 <b>Set करें:</b> पुरानी मात्रा बदल जाएगी'; stockMaterials.forEach(m=>{var i=document.getElementById('bulk-'+m.id); if(i) i.value=String(${JSON.stringify(0)});});" style="height:40px; border:none; border-radius:10px; background:#e2e8f0; color:#1e293b; font-size:12px; font-weight:900;">🔄 Set करें</button>
                    </div>
                    <div id="bulk-mode-desc" style="font-size:11px; font-weight:700; color:#16a34a; background:#f0fdf4; border-radius:8px; padding:8px; margin-bottom:12px; text-align:center;">➕ <b>जोड़ें:</b> मात्रा existing में add होगी</div>
                    ${rows}
                    <div style="display:flex; gap:10px; margin-top:14px;">
                        <button onclick="this.closest('[style*=fixed]').remove()" style="flex:1; height:44px; border:none; border-radius:12px; background:#e2e8f0; color:#1e293b; font-size:12px; font-weight:900;">Cancel</button>
                        <button id="bulk-save-btn" style="flex:1; height:44px; border:none; border-radius:12px; background:linear-gradient(135deg,#16a34a,#15803d); color:#fff; font-size:12px; font-weight:900;">💾 Save</button>
                    </div>
                </div>`;
            document.body.appendChild(overlay);
            window._bulkMode = "add";
            overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
            document.getElementById("bulk-save-btn").onclick = async () => {
                const mode = window._bulkMode || "add";
                const updates = [];
                stockMaterials.forEach((item) => {
                    const val = parseFloat(document.getElementById(`bulk-${item.id}`)?.value);
                    if (!isNaN(val) && (mode === "add" ? val > 0 : val >= 0)) {
                        const newBal = mode === "add" ? getStockBalance(item) + val : val;
                        item.currentBalance = newBal;
                        item.originalBalance = newBal;
                        updates.push({ name: item.name, bal: newBal });
                    }
                });
                saveOriginalBalances_(); // Persist to localStorage
                overlay.remove();
                if (!updates.length) { showToast("कोई मात्रा नहीं डाली गई", false); return; }
                try {
                    const p = new URLSearchParams();
                    p.append("module","stock"); p.append("action","bulkUpdateBalance");
                    p.append("updates_json", JSON.stringify(updates));
                    await fetch(stockSubmitScriptUrl, { method:"POST", headers:{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"}, body: p.toString() });
                    showToast(`✅ ${updates.length} materials ${mode==="add"?"में जोड़ा":"set हो गया"}`, true);
                } catch(_) { showToast("Locally update ho gaya", true); }
                renderStockDashboard(); refreshStockDropdowns_();
            };
        }

        function editMaterialBalance(itemId) {
            const item = stockMaterials.find((m) => m.id === itemId);
            if (!item) return;
            // Require JE123 password
            const pwd = prompt("🔐 JE Password डालें:");
            if (pwd !== "JE123") { if (pwd !== null) showToast("गलत पासवर्ड", false); return; }
            const cur = getStockBalance(item);
            document.getElementById("del-mat-overlay")?.remove();
            const overlay = document.createElement("div");
            overlay.id = "del-mat-overlay";
            overlay.style.cssText = "position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:20px;";
            overlay.innerHTML = `
                <div style="background:#fff; border-radius:18px; padding:18px; width:100%; max-width:320px; box-shadow:0 12px 30px rgba(0,0,0,0.25);">
                    <div style="font-size:14px; font-weight:900; color:#1d4ed8; margin-bottom:4px;">✏️ Stock मात्रा Update करें</div>
                    <div style="font-size:12px; font-weight:700; color:#475569; margin-bottom:12px;"><strong>${escapeHtml(item.name)}</strong> | Current: ${cur} ${escapeHtml(item.unit)}</div>
                    <input type="number" id="edit-bal-input" value="${cur}" min="0" style="width:100%; height:48px; border-radius:12px; border:2px solid #1d4ed8; padding:0 14px; font-size:18px; font-weight:900; outline:none; margin-bottom:8px; text-align:center;">
                    <div style="font-size:10px; font-weight:700; color:#94a3b8; text-align:center; margin-bottom:12px;">नई मात्रा (${escapeHtml(item.unit)}) दर्ज करें</div>
                    <div style="display:flex; gap:10px;">
                        <button id="edit-bal-cancel" style="flex:1; height:42px; border:none; border-radius:10px; background:#e2e8f0; color:#1e293b; font-size:12px; font-weight:900;">Cancel</button>
                        <button id="edit-bal-ok" style="flex:1; height:42px; border:none; border-radius:10px; background:linear-gradient(135deg,#1d4ed8,#1e3a5f); color:#fff; font-size:12px; font-weight:900;">Update करें</button>
                    </div>
                </div>`;
            document.body.appendChild(overlay);
            document.getElementById("edit-bal-cancel").onclick = () => overlay.remove();
            overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
            document.getElementById("edit-bal-input").focus();
            document.getElementById("edit-bal-ok").onclick = async () => {
                const newBal = parseFloat(document.getElementById("edit-bal-input").value);
                if (isNaN(newBal) || newBal < 0) return showToast("सही मात्रा दर्ज करें", false);
                overlay.remove();
                item.currentBalance = newBal;
                item.originalBalance = newBal; // Fix Total
                saveOriginalBalances_(); // Persist
                try {
                    const payload = new URLSearchParams();
                    payload.append("module", "stock");
                    payload.append("action", "updateBalance");
                    payload.append("material_name", item.name);
                    payload.append("balance_stock", String(newBal));
                    await fetch(stockSubmitScriptUrl, { method:"POST", headers:{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"}, body: payload.toString() });
                } catch(_) {}
                showToast(`${item.name}: Total ${newBal} ${item.unit} set ho gaya`, true);
                renderStockDashboard();
                refreshStockDropdowns_();
            };
        }
        function renderIssueHistoryView() {
            const log = getIssueLog_().slice().reverse();
            const container = document.getElementById("issue-history-list");
            const countEl = document.getElementById("issue-history-count");
            if (!container) return;
            if (countEl) countEl.textContent = `${log.length} entries`;
            if (!log.length) {
                container.innerHTML = `<div style="text-align:center; padding:20px; font-size:12px; font-weight:700; color:#64748b; border:2px dashed #e2e8f0; border-radius:12px;">कोई Issue entry नहीं है।</div>`;
                return;
            }
            container.innerHTML = log.map((e) => {
                const statusColor = e.returned ? "#14532d" : e.return_type === "non_returnable" ? "#475569" : "#b45309";
                const statusBg    = e.returned ? "#dcfce7" : e.return_type === "non_returnable" ? "#f1f5f9" : "#fef9c3";
                const statusText  = e.returned ? "✅ वापस" : e.return_type === "non_returnable" ? "🚫 Non-Ret." : "⏳ Pending";
                const cardBorder  = e.returned ? "#86efac" : e.return_type === "non_returnable" ? "#cbd5e1" : "#fcd34d";
                const cardBg      = e.returned ? "#f0fdf4" : e.return_type === "non_returnable" ? "#f8fafc" : "#fffbeb";
                return `
                <div style="background:${cardBg}; border:1.5px solid ${cardBorder}; border-radius:12px; padding:12px; margin-bottom:10px;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">
                        <div>
                            <div style="font-size:13px; font-weight:900; color:#1e293b;">${escapeHtml(e.issued_to)}</div>
                            <div style="font-size:10px; font-weight:700; color:#64748b;">${escapeHtml(e.issue_date)} | ${escapeHtml(e.issue_time)}</div>
                        </div>
                        <span style="font-size:9px; font-weight:900; border-radius:999px; padding:3px 10px; background:${statusBg}; color:${statusColor}; text-transform:uppercase; flex-shrink:0;">${statusText}</span>
                    </div>
                    <div style="background:rgba(0,0,0,0.04); border-radius:8px; padding:8px; margin-bottom:8px;">
                        <div style="font-size:12px; font-weight:700; color:#334155;">${escapeHtml(e.material_name)}</div>
                        <div style="font-size:13px; font-weight:900; color:#1e293b;">मात्रा: <strong>${e.qty} ${escapeHtml(e.unit)}</strong></div>
                        ${e.remark ? `<div style="font-size:10px; font-weight:700; color:#94a3b8; margin-top:2px;">📝 ${escapeHtml(e.remark)}</div>` : ""}
                        ${e.returned ? `<div style="font-size:10px; font-weight:700; color:#16a34a; margin-top:2px;">वापसी: ${escapeHtml(e.return_date)} ${escapeHtml(e.return_time)}</div>` : ""}
                        ${!e.returned && e.expected_return_date ? `<div style="font-size:10px; font-weight:700; color:#b45309; margin-top:2px;">Expected: ${escapeHtml(e.expected_return_date)}</div>` : ""}
                    </div>
                    <div style="display:grid; grid-template-columns:${!e.returned && e.return_type === "returnable" ? "1fr 1fr" : "1fr"}; gap:8px;">
                        ${!e.returned && e.return_type === "returnable"
                            ? `<button onclick="markMaterialReturned('${e.id}'); renderIssueHistoryView(); renderStockDashboard();" style="height:36px; border:none; border-radius:8px; background:linear-gradient(135deg,#16a34a,#15803d); color:#fff; font-size:11px; font-weight:900; cursor:pointer;">↩️ Mark Return</button>`
                            : ""}
                        <button onclick="deleteIssueLogEntry('${e.id}')" style="height:36px; border:none; border-radius:8px; background:#fee2e2; color:#b91c1c; font-size:11px; font-weight:900; cursor:pointer;">🗑️ हटाएं</button>
                    </div>
                </div>`;
            }).join("");
        }

        function deleteIssueLogEntry(logId) {
            const entry = getIssueLog_().find((e) => e.id === logId);
            const isNonReturnable = entry && entry.return_type === "non_returnable";

            document.getElementById("del-mat-overlay")?.remove();
            const overlay = document.createElement("div");
            overlay.id = "del-mat-overlay";
            overlay.style.cssText = "position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:20px;";
            const card = document.createElement("div");
            card.style.cssText = "background:#fff; border-radius:16px; padding:18px; width:100%; max-width:300px; text-align:center;";
            card.innerHTML = `
                <div style="font-size:13px; font-weight:900; color:#991b1b; margin-bottom:8px;">🗑️ Issue Entry हटाएं?</div>
                ${entry ? `<div style="font-size:12px; font-weight:700; color:#1e293b; margin-bottom:6px;">${escapeHtml(entry.material_name)} | मात्रा: ${entry.qty} ${entry.unit||""}</div>` : ""}
                <div style="font-size:11px; font-weight:700; color:${isNonReturnable ? "#b45309" : "#475569"}; background:${isNonReturnable ? "#fef9c3" : "#f8fafc"}; border-radius:8px; padding:8px; margin-bottom:14px;">
                    ${isNonReturnable
                        ? "🚫 Non-Returnable है — हटाने पर Stock में वापस नहीं जुड़ेगा"
                        : "Stock balance प्रभावित नहीं होगा।"}
                </div>
                <div style="display:flex; gap:10px;">
                    <button id="del-log-cancel" style="flex:1; height:40px; border:none; border-radius:10px; background:#e2e8f0; color:#1e293b; font-size:12px; font-weight:900;">Cancel</button>
                    <button id="del-log-confirm" style="flex:1; height:40px; border:none; border-radius:10px; background:#ef4444; color:#fff; font-size:12px; font-weight:900;">हाँ, हटाएं</button>
                </div>`;
            overlay.appendChild(card);
            overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
            document.body.appendChild(overlay);
            document.getElementById("del-log-cancel").onclick = () => overlay.remove();
            document.getElementById("del-log-confirm").onclick = () => {
                overlay.remove();
                // Remove from log ONLY — do NOT touch stockMaterials balance
                const log = getIssueLog_().filter((e) => e.id !== logId);
                saveIssueLog_(log);
                showToast("Entry हट गई — Stock balance unchanged", true);
                renderStockDashboard();
                renderIssueHistoryView();
            };
        }



        function showAddMaterialModal() {
            const overlay = document.createElement("div");
            overlay.style.cssText = "position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:20px;";
            const card = document.createElement("div");
            card.style.cssText = "background:#fff; border-radius:18px; padding:18px; width:100%; max-width:340px; box-shadow:0 12px 30px rgba(0,0,0,0.25);";
            card.innerHTML = `
                <div style="font-size:14px; font-weight:900; color:#15803d; text-transform:uppercase; margin-bottom:12px;">➕ नया Material जोड़ें</div>
                <input type="text" id="new-mat-name" placeholder="Material का नाम *" style="width:100%; height:42px; border-radius:10px; border:1.5px solid #16a34a; padding:0 12px; font-size:13px; font-weight:700; outline:none; margin-bottom:10px;">
                <input type="text" id="new-mat-unit" placeholder="Unit (Nos, Mtr, Kg, Set...)" style="width:100%; height:42px; border-radius:10px; border:1.5px solid #cbd5e1; padding:0 12px; font-size:13px; font-weight:700; outline:none; margin-bottom:10px;">
                <input type="number" id="new-mat-opening" placeholder="Opening Stock (शुरुआती मात्रा)" min="0" style="width:100%; height:42px; border-radius:10px; border:1.5px solid #cbd5e1; padding:0 12px; font-size:13px; font-weight:700; outline:none; margin-bottom:14px;">
                <div style="display:flex; gap:10px;">
                    <button onclick="this.closest('[style*=fixed]').remove()" style="flex:1; height:44px; border:none; border-radius:12px; background:#e2e8f0; color:#1e293b; font-size:12px; font-weight:900; text-transform:uppercase;">Cancel</button>
                    <button onclick="confirmAddNewMaterialDirect()" style="flex:1; height:44px; border:none; border-radius:12px; background:linear-gradient(135deg,#16a34a,#15803d); color:#fff; font-size:12px; font-weight:900; text-transform:uppercase;">जोड़ें</button>
                </div>`;
            overlay.appendChild(card);
            overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
            document.body.appendChild(overlay);
            document.getElementById("new-mat-name").focus();
        }

        async function confirmAddNewMaterialDirect() {
            const materialName = document.getElementById("new-mat-name")?.value?.trim() || "";
            if (!materialName) return showToast("Material का नाम ज़रूरी है", false);
            await confirmAddNewMaterial("receive", materialName);
        }

        function refreshStockDropdowns_() {
            ["receive-dropdown", "issue-dropdown"].forEach((id) => {
                const sel = document.getElementById(id);
                if (!sel) return;
                const cur = sel.value;
                const isIssue = id.startsWith("issue");
                sel.innerHTML = `<option value="">-- Dropdown से Material चुनें --</option>`;
                stockMaterials.forEach((item) => {
                    const opt = document.createElement("option");
                    opt.value = item.id;
                    const bal = getStockBalance(item);
                    opt.text = `${item.name} (${bal} ${item.unit})`;
                    if (isIssue && bal <= 0) opt.style.color = "#ef4444";
                    sel.appendChild(opt);
                });
                if (cur) sel.value = cur;
            });
        }

        function selectFromDropdown(type) {
            const sel = document.getElementById(`${type}-dropdown`);
            if (!sel || !sel.value) return;
            selectStockSuggestion(type, sel.value);
            // Reset dropdown visual
            sel.value = "";
        }


        function renderIssueDcDropdown() {
            const menu = document.getElementById("issue-dc-menu");
            if (!menu) return;
            menu.innerHTML = "";
            activeSubDnDcs.forEach((dc) => {
                const item = document.createElement("div");
                item.className = "option-item";
                item.innerText = dc;
                item.onclick = () => {
                    activeIssueDc = dc;
                    document.getElementById("issue-dc-label").innerText = dc;
                    toggleIssueDcDropdown();
                };
                menu.appendChild(item);
            });
        }

        function toggleIssueDcDropdown() {
            document.getElementById("issue-dc-menu").classList.toggle("show");
            document.getElementById("issue-dc-trigger").classList.toggle("active");
        }

        function setupStockEntrySearch(type) {
            const searchInput = document.getElementById(`${type}-search`);
            if (!searchInput) return;
            searchInput.addEventListener("input", () => {
                renderStockSuggestions(type, searchInput.value);
            });
            searchInput.addEventListener("focus", () => {
                renderStockSuggestions(type, searchInput.value);
            });
        }

        function renderMaterialList() {
            document.getElementById("material-list-content").innerHTML = `
                <div class="stock-table-head"><div>Material Name</div><div>Unit</div><div>Total Stock</div></div>
                ${stockMaterials.map((item) => `
                    <div class="stock-table-row">
                        <div>${item.name}<div class="stock-row-sub">${item.id}</div></div>
                        <div>${item.unit}</div>
                        <div>${getStockBalance(item)}</div>
                    </div>
                `).join("")}
            `;
        }

        function renderStockSuggestions(type, keyword) {
            const suggestionBox = document.getElementById(`${type}-suggestions`);
            if (!suggestionBox) return;
            const query = (keyword || "").trim().toLowerCase();
            if (!query) {
                suggestionBox.classList.remove("show");
                suggestionBox.innerHTML = "";
                return;
            }
            const matches = stockMaterials.filter((item) => item.name.toLowerCase().includes(query)).slice(0, 12);
            suggestionBox.classList.add("show");

            const addNewBtn = `
                <div class="stock-suggestion-item" style="background:#f0fdf4; border-top:1.5px dashed #16a34a;" onclick="addNewStockMaterial('${type}', '${keyword.replace(/'/g, "\\'")}')">
                    <div class="stock-suggestion-title" style="color:#15803d;">➕ नया Material जोड़ें: "<strong>${escapeHtml(keyword)}</strong>"</div>
                    <div class="stock-suggestion-sub" style="color:#16a34a;">Unit और Opening Stock भरें</div>
                </div>`;

            if (!matches.length) {
                suggestionBox.innerHTML = `
                    <div class="stock-suggestion-item"><div class="stock-suggestion-title">No matching material</div><div class="stock-suggestion-sub">Dusra keyword try kijiye</div></div>
                    ${addNewBtn}`;
                return;
            }
            suggestionBox.innerHTML = matches.map((item) => `
                <div class="stock-suggestion-item" onclick="selectStockSuggestion('${type}', '${item.id}')">
                    <div class="stock-suggestion-title">${item.name}</div>
                    <div class="stock-suggestion-sub">${item.unit} | Available ${getStockBalance(item)}</div>
                </div>
            `).join("") + addNewBtn;
        }

        function addNewStockMaterial(type, materialName) {
            // Close suggestions
            const suggestionBox = document.getElementById(`${type}-suggestions`);
            if (suggestionBox) { suggestionBox.classList.remove("show"); suggestionBox.innerHTML = ""; }

            // Show modal to get unit and opening stock
            const overlay = document.createElement("div");
            overlay.style.cssText = "position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:20px;";
            const card = document.createElement("div");
            card.style.cssText = "background:#fff; border-radius:18px; padding:18px; width:100%; max-width:340px; box-shadow:0 12px 30px rgba(0,0,0,0.25);";
            card.innerHTML = `
                <div style="font-size:14px; font-weight:900; color:#15803d; text-transform:uppercase; margin-bottom:12px;">➕ नया Material जोड़ें</div>
                <div style="font-size:13px; font-weight:700; color:#1e293b; margin-bottom:10px;">Material: <strong>${escapeHtml(materialName)}</strong></div>
                <input type="text" id="new-mat-unit" placeholder="Unit (जैसे: Nos, Mtr, Kg, Set...)" style="width:100%; height:42px; border-radius:10px; border:1.5px solid #cbd5e1; padding:0 12px; font-size:13px; font-weight:700; outline:none; margin-bottom:10px;">
                <input type="number" id="new-mat-opening" placeholder="Opening Stock (शुरुआती स्टॉक)" min="0" style="width:100%; height:42px; border-radius:10px; border:1.5px solid #cbd5e1; padding:0 12px; font-size:13px; font-weight:700; outline:none; margin-bottom:14px;">
                <div style="display:flex; gap:10px;">
                    <button onclick="this.closest('[style*=fixed]').remove()" style="flex:1; height:44px; border:none; border-radius:12px; background:#e2e8f0; color:#1e293b; font-size:12px; font-weight:900; text-transform:uppercase;">Cancel</button>
                    <button id="new-mat-save-btn" onclick="confirmAddNewMaterial('${type}', '${materialName.replace(/'/g, "\\'")}')" style="flex:1; height:44px; border:none; border-radius:12px; background:linear-gradient(135deg,#16a34a,#15803d); color:#fff; font-size:12px; font-weight:900; text-transform:uppercase;">जोड़ें</button>
                </div>
            `;
            overlay.appendChild(card);
            overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
            document.body.appendChild(overlay);
            document.getElementById("new-mat-unit").focus();
        }

        async function confirmAddNewMaterial(type, materialName) {
            const unit = document.getElementById("new-mat-unit").value.trim() || "Nos";
            const opening = parseFloat(document.getElementById("new-mat-opening").value) || 0;

            if (!materialName) return showToast("Material का नाम ज़रूरी है", false);

            // Create new material object
            const newId = `M${String(stockMaterials.length + 1).padStart(3, "0")}_${Date.now()}`;
            const newItem = {
                id: newId,
                name: materialName,
                unit: unit,
                opening: opening,
                currentBalance: opening,
                inward: 0,
                issue: 0,
                min: 0
            };

            // Add to local list immediately
            stockMaterials.push(newItem);

            // Save to backend (Google Sheet MasterStock tab)
            try {
                const payload = new URLSearchParams();
                payload.append("module", "stock");
                payload.append("action", "addMaterial");
                payload.append("material_name", materialName);
                payload.append("unit", unit);
                payload.append("opening_stock", String(opening));
                payload.append("balance_stock", String(opening));
                await fetch(stockSubmitScriptUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
                    body: payload.toString()
                });
            } catch (_) {}

            // Close overlay
            document.querySelector("[style*='position:fixed'][style*='z-index:9999']")?.remove();

            showToast(`"${materialName}" material जोड़ा गया`, true);
            refreshStockDropdowns_();

            // Auto-select this new material
            selectStockSuggestion(type, newId);

            // Re-render dashboard
            renderStockDashboard();
        }

        function selectStockSuggestion(type, itemId) {
            const item = stockMaterials.find((stockItem) => stockItem.id === itemId);
            if (!item) return;
            if (type === "receive") selectedStockReceiveItem = item;
            else selectedStockIssueItem = item;
            const chip = document.getElementById(`${type}-selected-chip`);
            const input = document.getElementById(`${type}-search`);
            const qtyInput = document.getElementById(`${type}-qty`);
            document.getElementById(`${type}-suggestions`).classList.remove("show");
            document.getElementById(`${type}-suggestions`).innerHTML = "";
            input.value = item.name;
            chip.style.display = "block";
            chip.innerText = `${item.name} | Unit ${item.unit} | Available ${getStockBalance(item)}`;
            qtyInput.focus();
        }

        function addStockEntryToList(type) {
            const selectedItem = type === "receive" ? selectedStockReceiveItem : selectedStockIssueItem;
            const qtyInput = document.getElementById(`${type}-qty`);
            const qty = Number(qtyInput.value);
            if (!selectedItem) return showToast("Pehle material select kariye", false);
            if (!qty || qty <= 0) return showToast("Valid quantity darj kariye", false);
            if (type === "issue" && getStockBalance(selectedItem) <= 0) return showToast("Stock Not Available", false);
            if (type === "issue" && qty > getStockBalance(selectedItem)) return showToast("Available stock se jyada issue nahi ho sakta", false);
            const list = type === "receive" ? pendingReceiveItems : pendingIssueItems;
            const existing = list.find((entry) => entry.item.id === selectedItem.id);
            if (existing) existing.qty += qty;
            else list.push({ item: selectedItem, qty });
            renderPendingStockList(type);
            resetStockSearchSelection(type);
            qtyInput.value = "";
            document.getElementById(`${type}-search`).focus();
        }

        function renderPendingStockList(type) {
            const listNode = document.getElementById(`${type}-added-list`);
            if (!listNode) return;
            const list = type === "receive" ? pendingReceiveItems : pendingIssueItems;
            if (!list.length) {
                listNode.innerHTML = `<div class="stock-empty">Abhi koi material list me add nahi hua hai.</div>`;
                return;
            }
            listNode.innerHTML = list.map((entry) => `
                <div class="stock-added-row">
                    <div>
                        <div class="stock-added-main">${entry.item.name}</div>
                        <div class="stock-added-sub">${entry.item.unit} | Available ${getStockBalance(entry.item)}</div>
                    </div>
                    <div class="stock-added-qty">${entry.qty}</div>
                    <button class="stock-remove-btn" onclick="removePendingStockItem('${type}', '${entry.item.id}')">Remove</button>
                </div>
            `).join("");
        }

        function toggleReturnDateField() {
            const isReturnable = document.getElementById("issue-returnable")?.checked;
            const field = document.getElementById("return-date-field");
            if (field) field.style.display = isReturnable ? "block" : "none";
        }

        // Store pending delete itemId globally to avoid closure issues in template literals
        let _pendingDeleteMatId = null;

        function deleteStockMaterial(itemId) {
            const item = stockMaterials.find((m) => m.id === itemId);
            if (!item) return;
            _pendingDeleteMatId = itemId;
            document.getElementById("del-mat-overlay")?.remove();
            const overlay = document.createElement("div");
            overlay.id = "del-mat-overlay";
            overlay.style.cssText = "position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:20px;";
            overlay.innerHTML = `
                <div style="background:#fff; border-radius:18px; padding:18px; width:100%; max-width:300px; text-align:center;">
                    <div style="font-size:13px; font-weight:900; color:#991b1b; margin-bottom:8px;">🗑️ Material हटाएं?</div>
                    <div style="font-size:13px; font-weight:700; color:#1e293b; margin-bottom:4px;"><strong>${item.name}</strong></div>
                    <div style="font-size:11px; font-weight:700; color:#64748b; margin-bottom:16px;">Balance: ${getStockBalance(item)} ${item.unit}</div>
                    <div style="display:flex; gap:10px;">
                        <button id="del-mat-cancel" style="flex:1; height:40px; border:none; border-radius:10px; background:#e2e8f0; color:#1e293b; font-size:12px; font-weight:900;">Cancel</button>
                        <button id="del-mat-ok" style="flex:1; height:40px; border:none; border-radius:10px; background:#ef4444; color:#fff; font-size:12px; font-weight:900;">हाँ, हटाएं</button>
                    </div>
                </div>`;
            document.body.appendChild(overlay);
            document.getElementById("del-mat-cancel").onclick = () => overlay.remove();
            document.getElementById("del-mat-ok").onclick = () => { overlay.remove(); confirmDeleteMaterial(_pendingDeleteMatId); };
            overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
        }

        async function confirmDeleteMaterial(itemId) {
            const item = stockMaterials.find((m) => m.id === itemId);
            if (!item) return;
            stockMaterials = stockMaterials.filter((m) => m.id !== itemId);
            showToast(item.name + " हटा दिया गया", true);
            try {
                const payload = new URLSearchParams();
                payload.append("module", "stock");
                payload.append("action", "deleteMaterial");
                payload.append("material_name", item.name);
                await fetch(stockSubmitScriptUrl, { method:"POST", headers:{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"}, body: payload.toString() });
            } catch(_) {}
            renderStockDashboard();
            refreshStockDropdowns_();
        }

        // Issue Tracking — stored in localStorage
        function getIssueLog_() {
            try { return JSON.parse(localStorage.getItem("stock-issue-log") || "[]"); } catch(_) { return []; }
        }
        function saveIssueLog_(log) {
            try { localStorage.setItem("stock-issue-log", JSON.stringify(log)); } catch(_) {}
        }

        function addToIssueLog_(items, issueTo, issueDate, issueTime, returnType, expectedReturn, remark) {
            const log = getIssueLog_();
            items.forEach((entry) => {
                log.push({
                    id: Date.now() + "_" + Math.random().toString(36).slice(2),
                    material_name: entry.item.name,
                    material_id: entry.item.id,
                    unit: entry.item.unit,
                    qty: entry.qty,
                    issued_to: issueTo,
                    issue_date: issueDate,
                    issue_time: issueTime,
                    return_type: returnType,
                    expected_return_date: expectedReturn,
                    remark: remark,
                    returned: false,
                    return_date: "",
                    return_time: ""
                });
            });
            saveIssueLog_(log);
        }

        function renderStockReturnList() {
            const container = document.getElementById("stock-return-list");
            if (!container) return;
            const log = getIssueLog_().filter((e) => e.return_type === "returnable" && !e.returned);
            if (!log.length) {
                container.innerHTML = `<div class="stock-empty">कोई pending return नहीं है।</div>`;
                return;
            }
            container.innerHTML = log.map((entry) => `
                <div style="border:1.5px solid #f59e0b; border-radius:12px; padding:12px; margin-bottom:10px; background:#fffbeb;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">
                        <div>
                            <div style="font-size:13px; font-weight:900; color:#1e293b;">${escapeHtml(entry.material_name)}</div>
                            <div style="font-size:11px; font-weight:700; color:#64748b;">Qty: ${entry.qty} ${escapeHtml(entry.unit)} | किसे: ${escapeHtml(entry.issued_to)}</div>
                            <div style="font-size:11px; font-weight:700; color:#64748b;">Issue: ${escapeHtml(entry.issue_date)} ${escapeHtml(entry.issue_time)}</div>
                            ${entry.expected_return_date ? `<div style="font-size:11px; font-weight:700; color:#b45309;">Expected Return: ${escapeHtml(entry.expected_return_date)}</div>` : ""}
                        </div>
                        <span style="background:#fef3c7; color:#b45309; border-radius:999px; padding:3px 10px; font-size:9px; font-weight:900; text-transform:uppercase; flex-shrink:0;">Pending</span>
                    </div>
                    <button onclick="markMaterialReturned('${entry.id}')" style="width:100%; height:40px; border:none; border-radius:10px; background:linear-gradient(135deg,#16a34a,#15803d); color:#fff; font-size:12px; font-weight:900; text-transform:uppercase;">✅ वापस आ गया — Mark Return</button>
                </div>
            `).join("");
        }

        async function markMaterialReturned(logId) {
            const log = getIssueLog_();
            const entry = log.find((e) => e.id === logId);
            if (!entry) return;

            // Find the material to check current balance
            const item = stockMaterials.find((m) => m.id === entry.material_id || m.name === entry.material_name);
            const currentBal = item ? getStockBalance(item) : 0;
            const maxReturn = entry.qty; // can't return more than was issued

            // Show return confirmation with qty input
            const confirmed = await new Promise((resolve) => {
                const overlay = document.createElement("div");
                overlay.style.cssText = "position:fixed; inset:0; background:rgba(0,0,0,0.55); z-index:9999; display:flex; align-items:center; justify-content:center; padding:20px;";
                overlay.innerHTML = `
                    <div style="background:#fff; border-radius:18px; padding:18px; width:100%; max-width:320px; box-shadow:0 12px 30px rgba(0,0,0,0.25);">
                        <div style="font-size:14px; font-weight:900; color:#15803d; margin-bottom:4px;">↩️ वापसी — ${escapeHtml(entry.material_name)}</div>
                        <div style="font-size:11px; font-weight:700; color:#64748b; margin-bottom:12px;">Issue: <strong>${entry.qty} ${entry.unit||""}</strong> → <strong>${escapeHtml(entry.issued_to)}</strong></div>
                        <div style="font-size:11px; font-weight:700; color:#64748b; margin-bottom:10px;">वापस आई मात्रा (अधिकतम ${maxReturn} ${entry.unit||""}):</div>
                        <input type="number" id="return-qty-input" min="1" max="${maxReturn}" value="${maxReturn}" style="width:100%; height:46px; border-radius:12px; border:2px solid #16a34a; padding:0 14px; font-size:18px; font-weight:900; text-align:center; outline:none; margin-bottom:8px;">
                        <div style="font-size:10px; font-weight:700; color:#94a3b8; margin-bottom:10px; text-align:center;">Current Stock: ${currentBal} ${entry.unit||""}</div>
                        <div style="font-size:11px; font-weight:700; color:#475569; margin-bottom:12px;">🔐 GP Password डालें:</div>
                        <input type="password" id="return-pwd-input" placeholder="Password..." style="width:100%; height:42px; border-radius:10px; border:1.5px solid #cbd5e1; padding:0 14px; font-size:14px; font-weight:700; text-align:center; outline:none; margin-bottom:12px;">
                        <div style="display:flex; gap:10px;">
                            <button id="return-cancel" style="flex:1; height:42px; border:none; border-radius:10px; background:#e2e8f0; color:#1e293b; font-size:12px; font-weight:900;">Cancel</button>
                            <button id="return-ok" style="flex:1; height:42px; border:none; border-radius:10px; background:linear-gradient(135deg,#16a34a,#15803d); color:#fff; font-size:12px; font-weight:900;">✅ Confirm</button>
                        </div>
                    </div>`;
                document.body.appendChild(overlay);
                document.getElementById("return-cancel").onclick = () => { overlay.remove(); resolve(null); };
                overlay.onclick = (e) => { if (e.target === overlay) { overlay.remove(); resolve(null); } };
                document.getElementById("return-ok").onclick = async () => {
                    const pwd = document.getElementById("return-pwd-input")?.value || "";
                    if ((await sha256Hex_(pwd)) !== ISSUE_PASSWORD_HASH) { showToast("गलत पासवर्ड", false); return; }
                    const retQty = parseFloat(document.getElementById("return-qty-input")?.value) || 0;
                    if (retQty <= 0) { showToast("वापसी मात्रा 0 से अधिक होनी चाहिए", false); return; }
                    if (retQty > maxReturn) { showToast(`अधिकतम ${maxReturn} ${entry.unit||""} ही वापस हो सकते हैं`, false); return; }
                    overlay.remove();
                    resolve(retQty);
                };
            });

            if (!confirmed) return;

            const now = new Date();
            entry.returned = true;
            entry.return_qty = confirmed;
            entry.return_date = `${String(now.getDate()).padStart(2,"0")}/${String(now.getMonth()+1).padStart(2,"0")}/${now.getFullYear()}`;
            entry.return_time = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
            saveIssueLog_(log);

            if (item) {
                const maxAllowed = item.originalBalance || item.currentBalance;
                const newBal = Math.min(maxAllowed, getStockBalance(item) + confirmed);
                item.currentBalance = newBal;
                stockMovements.unshift({ type:"RECEIVE", material: entry.material_name, qty: confirmed, date: entry.return_date, note:`Return from ${entry.issued_to}` });
                try {
                    // Record the return as a RECEIVE transaction
                    const payload = new URLSearchParams();
                    payload.append("module", "stock");
                    payload.append("receved_from", "RETURN");
                    payload.append("receive_person_name", entry.issued_to);
                    payload.append("remark", `Return: ${entry.material_name} from ${entry.issued_to}`);
                    payload.append("items_json", JSON.stringify([{ material_name: entry.material_name, unit: entry.unit || "", qty: confirmed }]));
                    await fetch(stockSubmitScriptUrl, { method:"POST", headers:{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"}, body: payload.toString() });
                    // Update balance in sheet
                    const bp = new URLSearchParams();
                    bp.append("module","stock"); bp.append("action","updateBalance");
                    bp.append("material_name", entry.material_name);
                    bp.append("balance_stock", String(newBal));
                    await fetch(stockSubmitScriptUrl, { method:"POST", headers:{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"}, body: bp.toString() });
                } catch(_) {}
            }

            showToast(`"${entry.material_name}" ${confirmed} ${entry.unit||""} वापस आ गई`, true);
            renderStockReturnList();
            renderStockDashboard();
        }


        function removePendingStockItem(type, itemId) {
            if (type === "receive") pendingReceiveItems = pendingReceiveItems.filter((entry) => entry.item.id !== itemId);
            else pendingIssueItems = pendingIssueItems.filter((entry) => entry.item.id !== itemId);
            renderPendingStockList(type);
        }

        function resetStockSearchSelection(type) {
            if (type === "receive") selectedStockReceiveItem = null;
            else selectedStockIssueItem = null;
            document.getElementById(`${type}-search`).value = "";
            document.getElementById(`${type}-qty`).value = "";
            document.getElementById(`${type}-suggestions`).classList.remove("show");
            document.getElementById(`${type}-suggestions`).innerHTML = "";
            const chip = document.getElementById(`${type}-selected-chip`);
            chip.style.display = "none";
            chip.innerText = "";
        }

        async function submitStockEntriesToSheet(type) {
            const isReceive = type === "receive";
            const items = (isReceive ? pendingReceiveItems : pendingIssueItems).map((entry) => ({
                material_name: entry.item.name,
                unit: entry.item.unit,
                qty: entry.qty
            }));
            const returnType = !isReceive && document.getElementById("issue-returnable")?.checked ? "returnable" : "non_returnable";
            const expectedReturn = !isReceive ? (document.getElementById("issue-expected-return")?.value || "") : "";
            const payload = new URLSearchParams();
            payload.append("module", "stock");
            payload.append("receved_from", isReceive ? document.getElementById("receive-source").value.trim() : "");
            payload.append("receive_person_name", isReceive ? document.getElementById("receive-person").value.trim() : "");
            payload.append("issue_to_dc_name", isReceive ? "" : (activeIssueDc || "ADEGAON"));
            payload.append("issue_to_person_name", isReceive ? "" : document.getElementById("issue-to").value.trim());
            payload.append("remark", isReceive ? "" : document.getElementById("issue-remark").value.trim());
            payload.append("return_type", returnType);
            payload.append("expected_return_date", expectedReturn);
            payload.append("items_json", JSON.stringify(items));
            const response = await fetch(stockSubmitScriptUrl, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
                body: payload.toString()
            });
            const responseText = await response.text();
            let parsed = {};
            try { parsed = JSON.parse(responseText || "{}"); } catch (_) {}
            if (!response.ok || (parsed.status && parsed.status !== "success")) {
                throw new Error(getFriendlyScriptError(parsed.message || "Stock submit failed"));
            }
            return parsed;
        }

        async function checkFeederBackendStatus() {
            const box = document.getElementById("feeder-backend-status");
            if (!box) return;
            box.style.display = "block";
            box.style.background = "rgba(255,255,255,0.18)";
            box.style.color = "#fce7f3";
            box.innerText = "Checking...";

            try {
                const url = `${feederSubmitScriptUrl}?action=getFeederReadings&t=${Date.now()}`;
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

        function renderLiveStock() {
            document.getElementById("live-stock-content").innerHTML = stockMaterials.map((item) => {
                const status = getStockStatus(item);
                return `
                    <div class="stock-row">
                        <div>
                            <div class="stock-row-main">${item.name}</div>
                            <div class="stock-row-sub">Opening ${item.opening} | Inward ${item.inward} | Issue ${item.issue}</div>
                        </div>
                        <div style="text-align:right;">
                            <div class="stock-row-main">${getStockBalance(item)} ${item.unit}</div>
                            <div class="stock-chip ${status.className}" style="margin-top:6px;">${status.label}</div>
                        </div>
                    </div>
                `;
            }).join("");
        }

        function renderLowStock() {
            const lowItems = stockMaterials.filter((item) => getStockBalance(item) <= item.min + 15);
            document.getElementById("low-stock-content").innerHTML = lowItems.length ? lowItems.map((item) => {
                const status = getStockStatus(item);
                return `
                    <div class="stock-row">
                        <div>
                            <div class="stock-row-main">${item.name}</div>
                            <div class="stock-row-sub">Balance ${getStockBalance(item)} ${item.unit} | Minimum ${item.min}</div>
                        </div>
                        <div class="stock-chip ${status.className}">${status.label}</div>
                    </div>
                `;
            }).join("") : `<div class="stock-note">Abhi koi low stock item nahi hai.</div>`;
        }

        function renderStockReport() {
            // MIS Report removed
            return;
            document.getElementById("stock-report-content").innerHTML = `
                <div class="stock-section-stack">
                    <div class="stock-banner">
                        <div>
                            <strong>Report Summary</strong>
                            <span>Total inward, total issue aur latest movement ek jagah dekhne ke liye yeh screen useful rahegi.</span>
                        </div>
                        <div class="stock-badge-dark">Auto View</div>
                    </div>
                    <div class="stock-mini-grid">
                        <div class="stock-mini-card">
                            <h4>Total Receive</h4>
                            <p>${stockMovements.filter((entry) => entry.type === "RECEIVE").reduce((sum, entry) => sum + entry.qty, 0)} quantity inward register me dikh rahi hai.</p>
                        </div>
                        <div class="stock-mini-card">
                            <h4>Total Issue</h4>
                            <p>${stockMovements.filter((entry) => entry.type === "ISSUE").reduce((sum, entry) => sum + entry.qty, 0)} quantity issue register me dikh rahi hai.</p>
                        </div>
                    </div>
                </div>
                <div style="margin-top:14px;">
                    ${stockMovements.map((entry) => `
                        <div class="stock-ledger-item">
                            <div class="stock-ledger-top">
                                <div class="stock-ledger-title">${entry.material}</div>
                                <div class="stock-type-pill ${entry.type === "RECEIVE" ? "pill-receive" : "pill-issue"}">${entry.type}</div>
                            </div>
                            <div class="stock-ledger-meta">${entry.date} | ${entry.note}</div>
                            <div class="stock-ledger-meta">Quantity: ${entry.qty}</div>
                        </div>
                    `).join("")}
                </div>
            `;
        }

        function openStockDashboard() {
            renderStockDashboard();
            switchView("stock-material");
        }

        function openStockSection(id) {
            switchView(id);
        }

        const ISSUE_PASSWORD_HASH = "56a1c1a068daacd4c40fa20e86a0028a161b263fda7e65183fd5eb2dcafcb64d"; // Gatepass issuer password (SHA-256)

        function verifyIssuerPassword_() {
            return new Promise((resolve) => {
                const overlay = document.createElement("div");
                overlay.style.cssText = "position:fixed; inset:0; background:rgba(0,0,0,0.55); z-index:9999; display:flex; align-items:center; justify-content:center; padding:20px;";
                const card = document.createElement("div");
                card.style.cssText = "background:#fff; border-radius:18px; padding:18px; width:100%; max-width:320px; box-shadow:0 12px 30px rgba(0,0,0,0.25);";
                card.innerHTML = `
                    <div style="font-size:13px; font-weight:900; color:#1e3a5f; text-align:center; margin-bottom:12px;">🔐 Issue करने की अनुमति</div>
                    <div style="font-size:11px; font-weight:700; color:#64748b; text-align:center; margin-bottom:12px;">Gatepass जारी करने के लिए पासवर्ड डालें</div>
                    <input type="password" id="issuer-pwd-input" placeholder="Issue Password..." style="width:100%; height:44px; border-radius:10px; border:1.5px solid #1e3a5f; padding:0 12px; font-size:14px; font-weight:700; outline:none; margin-bottom:12px;">
                    <div style="display:flex; gap:10px;">
                        <button onclick="this.closest('[style*=fixed]').remove(); arguments[0].resolve(false);" style="flex:1; height:42px; border:none; border-radius:10px; background:#e2e8f0; color:#1e293b; font-size:12px; font-weight:900;">Cancel</button>
                        <button id="issuer-pwd-ok" style="flex:1; height:42px; border:none; border-radius:10px; background:linear-gradient(135deg,#1e3a5f,#0f172a); color:#fff; font-size:12px; font-weight:900;">OK</button>
                    </div>`;
                overlay.appendChild(card);
                document.body.appendChild(overlay);
                const check = async () => {
                    if ((await sha256Hex_(document.getElementById("issuer-pwd-input")?.value || "")) === ISSUE_PASSWORD_HASH) {
                        overlay.remove(); resolve(true);
                    } else {
                        showToast("गलत पासवर्ड", false);
                    }
                };
                document.getElementById("issuer-pwd-ok").onclick = check;
                document.getElementById("issuer-pwd-input").onkeydown = (e) => { if (e.key === "Enter") check(); };
                overlay.onclick = (e) => { if (e.target === overlay) { overlay.remove(); resolve(false); } };
            });
        }

        function getNextGatepassNo_() {
            const n = parseInt(localStorage.getItem("gatepass-counter") || "0") + 1;
            localStorage.setItem("gatepass-counter", String(n));
            return `GP-${String(n).padStart(4,"0")}/${new Date().getFullYear()}`;
        }

        function showGatepassModal_(gpNo, issueTo, issueDate, issueTime, returnType, expectedReturn, items, remark) {
            const itemLines = items.map((e) => `${e.item.name}: ${e.qty} ${e.item.unit}`).join("\n");
            const returnLabel = returnType === "returnable"
                ? `↩️ Returnable${expectedReturn ? " | वापसी तिथि: "+expectedReturn : ""}`
                : "🚫 Non-Returnable";

            const gpText =
`गेटपास / GATE PASS
आदेगांव बिजली वितरण केंद्र
लखनदोंन डिवीज़न, सर्किल सिवनी
━━━━━━━━━━━━━━━━━━━━━
गेटपास नं: ${gpNo}
दिनांक: ${issueDate}  समय: ${issueTime}
━━━━━━━━━━━━━━━━━━━━━
जारी किया गया: ${issueTo}
━━━━━━━━━━━━━━━━━━━━━
सामग्री विवरण:
${itemLines}
━━━━━━━━━━━━━━━━━━━━━
प्रकार: ${returnLabel}
${remark ? "रिमार्क: " + remark : ""}
━━━━━━━━━━━━━━━━━━━━━
जारीकर्ता: कनिष्ठ यंत्री
आदेगांव बिजली वितरण केंद्र`;

            const encoded = encodeURIComponent(gpText);
            const overlay = document.createElement("div");
            overlay.style.cssText = "position:fixed; inset:0; background:rgba(0,0,0,0.6); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px; overflow-y:auto;";
            const card = document.createElement("div");
            card.style.cssText = "background:#fff; border-radius:18px; padding:18px; width:100%; max-width:360px; box-shadow:0 12px 30px rgba(0,0,0,0.3);";
            card.innerHTML = `
                <div style="background:linear-gradient(135deg,#1e3a5f,#0f172a); border-radius:12px; padding:14px; margin-bottom:14px; text-align:center;">
                    <div style="font-size:14px; font-weight:900; color:#e2e8f0; text-transform:uppercase; margin-bottom:4px;">🧾 गेटपास जारी</div>
                    <div style="font-size:18px; font-weight:900; color:#fbbf24;">${escapeHtml(gpNo)}</div>
                </div>
                <div style="background:#f8fafc; border-radius:10px; padding:12px; margin-bottom:12px; font-size:12px; font-weight:700; color:#334155; line-height:1.8; white-space:pre-wrap;">${escapeHtml(gpText)}</div>
                <a href="https://wa.me/?text=${encoded}" target="_blank" rel="noopener" style="display:flex; align-items:center; justify-content:center; gap:8px; width:100%; height:46px; border-radius:12px; background:linear-gradient(135deg,#25D366,#128C7E); color:#fff; font-size:13px; font-weight:900; text-decoration:none; margin-bottom:8px;">📱 WhatsApp पर भेजें</a>
                <button onclick="navigator.clipboard?.writeText(document.querySelector('[style*=white-space]').innerText).then(()=>showToast('Copy ho gaya',true))" style="width:100%; height:44px; border:none; border-radius:12px; background:linear-gradient(135deg,#3b82f6,#1d4ed8); color:#fff; font-size:12px; font-weight:900; margin-bottom:8px;">📋 Copy करें (Print/Word)</button>
                <button onclick="this.closest('[style*=fixed]').remove()" style="width:100%; height:40px; border:none; border-radius:12px; background:#e2e8f0; color:#1e293b; font-size:12px; font-weight:900;">बंद करें</button>`;
            overlay.appendChild(card);
            overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
            document.body.appendChild(overlay);
        }

        async function submitStockDemo(type) {
            if (type === "receive") {
                const source = document.getElementById("receive-source").value.trim();
                const person = document.getElementById("receive-person").value.trim();
                if (!pendingReceiveItems.length) return showToast("Pehle material list me add kariye", false);
                if (!source) return showToast("Received From darj kariye", false);
                if (!person) return showToast("Receive Person Name darj kariye", false);
                const submitBtn = document.querySelector("#material-receive-view .stock-submit");
                submitBtn.innerText = "Submitting..."; submitBtn.disabled = true;
                try {
                    await submitStockEntriesToSheet("receive");
                    for (const entry of pendingReceiveItems) {
                        entry.item.inward += entry.qty;
                        entry.item.currentBalance = getStockBalance(entry.item) + entry.qty;
                        stockMovements.unshift({ type:"RECEIVE", material:entry.item.name, qty:entry.qty, date:getCurrentDateDDMMYYYY().replace(/-/g,"/"), note:`${source} | Received By ${person}` });
                        // Update balance in cloud sheet so all users see updated Total
                        try {
                            const bp = new URLSearchParams();
                            bp.append("module","stock"); bp.append("action","updateBalance");
                            bp.append("material_name", entry.item.name);
                            bp.append("balance_stock", String(entry.item.currentBalance));
                            await fetch(stockSubmitScriptUrl, { method:"POST", headers:{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"}, body: bp.toString() });
                        } catch(_) {}
                    }
                    pendingReceiveItems = [];
                    document.getElementById("receive-source").value = "";
                    document.getElementById("receive-person").value = "";
                    resetStockSearchSelection("receive");
                    renderStockDashboard(); refreshStockDropdowns_();
                    showToast("Receive entry save ho gayi", true);
                } catch(err) { showToast(err.message || "Receive submit failed", false); }
                finally { submitBtn.innerText = "Save Receive Entry"; submitBtn.disabled = false; }

            } else {
                // Issue — requires password + gatepass
                const issueTo  = document.getElementById("issue-to").value.trim();
                const remark   = document.getElementById("issue-remark").value.trim();
                const issueDate = document.getElementById("issue-date").value || localTodayIso_();
                const issueTime = document.getElementById("issue-time").value || `${String(new Date().getHours()).padStart(2,"0")}:${String(new Date().getMinutes()).padStart(2,"0")}`;
                const returnType = document.getElementById("issue-returnable")?.checked ? "returnable" : "non_returnable";
                const expectedReturn = document.getElementById("issue-expected-return")?.value || "";

                if (!pendingIssueItems.length) return showToast("Pehle material list me add kariye", false);
                if (!issueTo) return showToast("किसे Issue किया — नाम ज़रूरी है", false);
                for (const entry of pendingIssueItems) {
                    if (getStockBalance(entry.item) < entry.qty) return showToast(`${entry.item.name} ka stock kam hai`, false);
                }

                // Verify issuer password
                const ok = await verifyIssuerPassword_();
                if (!ok) return;

                const submitBtn = document.querySelector("#material-issue-view .stock-submit");
                submitBtn.innerText = "Submitting..."; submitBtn.disabled = true;
                try {
                    await submitStockEntriesToSheet("issue");
                    const gpNo = getNextGatepassNo_();
                    const issueDateDisplay = issueDate.split("-").reverse().join("/");

                    pendingIssueItems.forEach((entry) => {
                        entry.item.issue += entry.qty;
                        entry.item.currentBalance = Math.max(0, getStockBalance(entry.item) - entry.qty);
                        stockMovements.unshift({ type:"ISSUE", material:entry.item.name, qty:entry.qty, date:issueDateDisplay, note:`${issueTo} | GP: ${gpNo}${remark ? " | "+remark : ""}` });
                    });

                    // Save to issue log
                    addToIssueLog_(pendingIssueItems, issueTo, issueDateDisplay, issueTime, returnType, expectedReturn, remark);

                    const itemsForGp = [...pendingIssueItems];
                    pendingIssueItems = [];
                    document.getElementById("issue-to").value = "";
                    document.getElementById("issue-remark").value = "";
                    if (document.getElementById("issue-date")) document.getElementById("issue-date").value = "";
                    if (document.getElementById("issue-time")) document.getElementById("issue-time").value = "";
                    resetStockSearchSelection("issue");
                    renderStockDashboard(); refreshStockDropdowns_();

                    // Show gatepass modal
                    showGatepassModal_(gpNo, issueTo, issueDateDisplay, issueTime, returnType, expectedReturn, itemsForGp, remark);

                } catch(err) { showToast(err.message || "Issue submit failed", false); }
                finally { submitBtn.innerText = "Save Issue Entry"; submitBtn.disabled = false; }
            }
        }


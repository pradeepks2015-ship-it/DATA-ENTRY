        // ===== Feeder-wise Month-over-Month Consumption Trend =====
        // Yeh AT&C loss (input vs consumer-billed units) NAHI hai — is app ke paas
        // consumer-billed data kahin se load nahi hota, isliye asli AT&C loss % dikhana
        // galat/bhramak hota. Yahaan sirf feeder INPUT readings (jo pehle se available
        // hain) ke aadhar par mahina-dar-mahina badlaav aur usme se anomaly (achanak
        // badi girawat/badhotri, jo feeder fault/tampering ka signal ho sakti hai)
        // flag ki jaati hai — poori tarah verifiable, kisi bahri data source ki
        // zaroorat nahi.
        const FEEDER_TREND_ANOMALY_PCT = 25; // ±25% se zyada badlaav "anomaly" maana jaata hai

        async function feederOpenTrendAnalysis_() {
            const menu = document.getElementById("feeder-menu-dropdown");
            if (menu) menu.style.display = "none";
            const existing = document.getElementById("feeder-trend-overlay");
            if (existing) existing.remove();

            const overlay = document.createElement("div");
            overlay.id = "feeder-trend-overlay";
            overlay.style.cssText = "position:fixed; inset:0; background:rgba(0,0,0,0.55); z-index:9999; display:flex; align-items:flex-end; justify-content:center;";
            overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });

            const sheet = document.createElement("div");
            sheet.style.cssText = "background:#ffffff; border-radius:20px 20px 0 0; padding:18px; width:100%; max-width:480px; max-height:82vh; overflow-y:auto; box-shadow:0 -12px 30px rgba(0,0,0,0.25);";
            sheet.innerHTML = trustedHtml_(`
                <div style="font-size:14px; font-weight:900; color:#14532d; text-align:center; text-transform:uppercase; margin-bottom:2px;">📈 फीडर ट्रेंड / असामान्य बदलाव</div>
                <div style="font-size:10.5px; font-weight:700; color:#64748b; text-align:center; margin-bottom:10px;">पिछला महीना बनाम उससे पिछला महीना (दोनों पूरे महीने — तुलना सटीक रहे)</div>
                <div id="feeder-trend-body"><div style="text-align:center; padding:14px; font-size:12px; font-weight:800; color:#64748b;">लोड हो रहा है...</div></div>
                <button id="feeder-trend-close-btn" style="width:100%; height:42px; border:none; border-radius:12px; background:#e2e8f0; color:#1e293b; font-size:12px; font-weight:900; text-transform:uppercase; margin-top:14px;">बंद करें</button>
            `);
            overlay.appendChild(sheet);
            document.body.appendChild(overlay);
            document.getElementById("feeder-trend-close-btn").onclick = () => overlay.remove();

            const body = document.getElementById("feeder-trend-body");
            try {
                await loadFeederReportData(true);
                const allRows = getAllFeederHistoryEntries_();
                feederRenderTrendBody_(allRows);
            } catch (err) {
                body.innerHTML = `<div style="text-align:center; padding:18px; font-size:12px; font-weight:800; color:#b91c1c;">Trend banane me error aaya, dobara try karein</div>`;
            }
        }

        function feederRenderTrendBody_(allRows) {
            const body = document.getElementById("feeder-trend-body");
            if (!body) return;

            const lastMonth = feederScorecardPeriod_(1, 0);
            const monthBeforeLast = feederScorecardPeriod_(2, 0);
            const mapLastMonth = feederAggregateBySubstationFeeder_(feederDedupeLatestByReading_(feederFilterRowsByDcAndDate_(allRows, lastMonth.from, lastMonth.to)));
            const mapMonthBeforeLast = feederAggregateBySubstationFeeder_(feederDedupeLatestByReading_(feederFilterRowsByDcAndDate_(allRows, monthBeforeLast.from, monthBeforeLast.to)));

            const rows = [];
            const ssNames = new Set([...Object.keys(mapLastMonth), ...Object.keys(mapMonthBeforeLast)]);
            ssNames.forEach((ss) => {
                const feederNames = new Set([...Object.keys(mapLastMonth[ss] || {}), ...Object.keys(mapMonthBeforeLast[ss] || {})]);
                feederNames.forEach((fdr) => {
                    const curr = mapLastMonth[ss]?.[fdr] ?? null;
                    const prev = mapMonthBeforeLast[ss]?.[fdr] ?? null;
                    let pct = null;
                    if (curr !== null && prev !== null && prev > 0) {
                        pct = ((curr - prev) / prev) * 100;
                    }
                    rows.push({ ss, fdr, curr, prev, pct });
                });
            });

            if (!rows.length) {
                body.innerHTML = `<div style="text-align:center; padding:18px; font-size:13px; font-weight:800; color:#64748b; background:#f8fafc; border-radius:14px;">${escapeHtml(lastMonth.label)} या ${escapeHtml(monthBeforeLast.label)} में कोई feeder reading नहीं मिली।</div>`;
                return;
            }

            // Sabse bade badlaav (anomaly) sabse upar — jinpar sabse pehle dhyan dena hai
            rows.sort((a, b) => Math.abs(b.pct ?? 0) - Math.abs(a.pct ?? 0));

            const fmt = (n) => (n === null ? "—" : Math.round(n).toLocaleString("en-IN"));
            const anomalyCount = rows.filter((r) => r.pct !== null && Math.abs(r.pct) >= FEEDER_TREND_ANOMALY_PCT).length;

            const summaryHtml = anomalyCount
                ? `<div style="text-align:center; font-size:11px; font-weight:900; color:#991b1b; background:#fef2f2; border:1px solid #fecaca; border-radius:10px; padding:8px 10px; margin-bottom:10px;">⚠️ ${anomalyCount} feeder(s) में ±${FEEDER_TREND_ANOMALY_PCT}% से ज़्यादा बदलाव — जांच लायक</div>`
                : `<div style="text-align:center; font-size:11px; font-weight:900; color:#166534; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; padding:8px 10px; margin-bottom:10px;">✅ कोई असामान्य बदलाव नहीं मिला (±${FEEDER_TREND_ANOMALY_PCT}% के अंदर)</div>`;

            const rowsHtml = rows.map((r) => {
                const isAnomaly = r.pct !== null && Math.abs(r.pct) >= FEEDER_TREND_ANOMALY_PCT;
                const isDrop = r.pct !== null && r.pct < 0;
                const pctColor = r.pct === null ? "#94a3b8" : isAnomaly ? (isDrop ? "#b91c1c" : "#b45309") : "#16a34a";
                const pctLabel = r.pct === null ? "—" : `${r.pct >= 0 ? "▲" : "▼"} ${Math.abs(r.pct).toFixed(1)}%`;
                return `
                    <div style="display:flex; align-items:center; gap:8px; padding:8px 10px; margin-bottom:6px; border-radius:10px; background:${isAnomaly ? "#fffbeb" : "#f8fafc"}; border:1px solid ${isAnomaly ? "#fde68a" : "#e2e8f0"};">
                        <div style="flex:1; min-width:0;">
                            <div style="font-size:11px; font-weight:900; color:#1e293b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(r.fdr)}</div>
                            <div style="font-size:9.5px; font-weight:700; color:#64748b;">${escapeHtml(r.ss)} — ${fmt(r.prev)} → ${fmt(r.curr)} kWh</div>
                        </div>
                        <div style="flex-shrink:0; font-size:12px; font-weight:900; color:${pctColor};">${pctLabel}</div>
                    </div>`;
            }).join("");

            body.innerHTML = trustedHtml_(`
                <div style="font-size:11px; font-weight:800; color:#166534; text-align:center; margin-bottom:8px;">${escapeHtml(monthBeforeLast.label)} → ${escapeHtml(lastMonth.label)}</div>
                ${summaryHtml}
                ${rowsHtml}
            `);
        }

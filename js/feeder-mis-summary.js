        // ===== Generic Module MIS Reports (Feeder) =====
        function misDateInRange_(dateKey, fromDate, toDate) {
            if (!dateKey) return false;
            if (!fromDate || !toDate) return true;
            return dateKey >= fromDate && dateKey <= toDate;
        }

        async function showFeederSummaryCard() {
            const fromDate = document.getElementById("feeder-mis-from-date")?.value || "";
            const toDate   = document.getElementById("feeder-mis-to-date")?.value || "";
            const card = document.getElementById("feeder-summary-card");
            if (!card) return;

            card.innerHTML = `<div style="text-align:center; padding:12px; font-size:12px; font-weight:800; color:#9d174d;">Loading...</div>`;
            card.style.display = "block";

            let rows = [];
            try { rows = await getFeederMisRows_(fromDate, toDate); } catch(_) {}

            if (!rows.length) {
                card.innerHTML = `<div style="background:#fdf2f8; border:1.5px solid #fbcfe8; border-radius:14px; padding:14px; text-align:center; font-size:12px; font-weight:700; color:#9d174d;">इस अवधि में कोई feeder reading नहीं मिली।</div>`;
                return;
            }

            // Helper: get total consumption for a meter number from rows
            const getMeterConsumption = (meterNo) => {
                const mRows = rows.filter((r) => (r["METER NO"] || "").trim() === meterNo);
                return Math.abs(mRows.reduce((s, r) => {
                    const prev = Number(r["PREVIUS READING"]) || 0;
                    const curr = Number(r["CURRENT READING"]) || 0;
                    let mf   = Number(r["MF"]) || 1;
                    // BS12775548 ka sahi MF 24000 hai — purani entries me galat MF stored ho
                    // sakta hai, isliye readings se dobara calculate karte hain.
                    if (meterNo === "BS12775548") {
                        mf = 24000;
                        if (curr || prev) return s + Math.abs(curr - prev) * mf;
                    }
                    const con  = Number(r["CONSUMPTION"]) || (Math.abs(curr - prev) * mf);
                    return s + Math.abs(con);
                }, 0));
            };

            // Group by substation — only 11KV feeders in ssMap (33KV incoming excluded)
            // 33KV incoming meters: BS12775548, BS12775550, BS12776133, BS12775543, BS12775544
            const INCOMING_33KV_METERS = ["BS12775548","BS12775550","BS12776133","BS12775543","BS12775544","MPP28230"];
            // ADEGAON-CB (BS12770679) meter reading nahi aa rahi — jab tak theek na ho, ise
            // summary/loss-calc se bahar rakha hai. Reading aane par yahan se hata dena.
            const EXCLUDED_FEEDER_METERS = ["BS12770679"];
            const ssMap = {};
            rows.forEach((r) => {
                const ss   = r["33/11 KV SUBSTATION"] || "";
                const fdr  = r["33 AND 11 KV FEEDER"] || "";
                const mNo  = (r["METER NO"] || "").trim();
                // Skip 33KV incoming/outgoing meters — only include 11KV feeders
                if (INCOMING_33KV_METERS.includes(mNo)) return;
                if (EXCLUDED_FEEDER_METERS.includes(mNo)) return;
                const prev = Number(r["PREVIUS READING"]) || 0;
                const curr = Number(r["CURRENT READING"]) || 0;
                const mf   = Number(r["MF"]) || 1;
                const con  = Math.abs(Number(r["CONSUMPTION"]) || Math.abs(curr - prev) * mf);
                if (!ssMap[ss]) ssMap[ss] = { feeders11kv: 0, feeders: {} };
                if (!ssMap[ss].feeders[fdr]) ssMap[ss].feeders[fdr] = 0;
                ssMap[ss].feeders[fdr] += con;
                ssMap[ss].feeders11kv  += con;
            });

            const fmtDate = (iso) => iso ? iso.split("-").reverse().join("/") : "";
            const period  = fromDate && toDate ? `${fmtDate(fromDate)} – ${fmtDate(toDate)}` : "सभी";
            const fmt = (n) => Math.round(n).toLocaleString("en-IN");

            // === ELECTRICAL CALCULATIONS ===
            const BS12775548 = getMeterConsumption("BS12775548"); // 33KV ADEGAON INCOMING (Total Input)
            const BS12775550 = getMeterConsumption("BS12775550"); // 33KV ADEGAON-CHAMARI outgoing
            const BS12776133 = getMeterConsumption("BS12776133"); // 33KV MADI OUTGOING to Madhi
            const BS12775543 = getMeterConsumption("BS12775543"); // 33KV MADHI INCOMING
            const BS12774695 = getMeterConsumption("BS12774695"); // 11KV ADEGAON MIX
            const BS12776368 = getMeterConsumption("BS12776368"); // 11KV BIBI DL
            const BS12774694 = getMeterConsumption("BS12774694"); // 11KV BIBI AG
            const BS12774693 = getMeterConsumption("BS12774693"); // 11KV MADI (ADEGAON) MIX
            const BS12775542 = getMeterConsumption("BS12775542"); // 11KV PATAN
            const BS12775541 = getMeterConsumption("BS12775541"); // 11KV MADHI
            const BS12775540 = getMeterConsumption("BS12775540"); // 11KV PINDRAI

            // ADEGAON-CB (BS12770679) is excluded — meter reading nahi aa rahi abhi.
            const adegaon11KVTotal = BS12774695 + BS12776368 + BS12774694 + BS12774693;
            const madhiFeederTotal = BS12775542 + BS12775541 + BS12775540;

            // Network diagram ke hisaab se formulas:
            // BS12775548 = Adegaon SS ka TOTAL incoming (isi se BS550 Chamari aur BS133 Madhi lines nikalti hain)
            // Adegaon SS Net Input = BS548 − (BS550 + BS133)
            // Adegaon SS Loss = Net Input − Σ 11KV feeders of Adegaon
            const adegaonNetInput      = BS12775548 - (BS12775550 + BS12776133);
            const adegaonSSInput       = adegaonNetInput;  // Adegaon SS ka net input
            const adegaonSSLineLoss    = adegaonNetInput - adegaon11KVTotal;
            const adegaonMadhiLineLoss = Math.abs(BS12776133 - BS12775543);
            const madhiSSLineLoss      = Math.abs(BS12775543 - madhiFeederTotal);

            const pct = (n, base) => base > 0 ? (n / base * 100).toFixed(2) + "%" : "—";

            // SS_INCOMING for each substation (33KV input to SS)
            const SS_INCOMING = { "ADEGAON": adegaonSSInput, "MADHI": BS12775543, "CHAMARI": BS12775550 }; // adegaonSSInput = BS548

            // Substation summary HTML — SS Total = Σ 11KV feeders + SS Loss
            let ssHtml = Object.entries(ssMap).map(([ss, data]) => {
                const feeder11total = data.feeders11kv;
                const incoming = SS_INCOMING[ss] || 0;
                const ssLoss  = incoming > 0 ? Math.abs(incoming - feeder11total) : 0;
                const ssTotal = feeder11total + ssLoss;
                const feederRows = Object.entries(data.feeders).map(([fdr, con]) =>
                    `<div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid #fce7f3; font-size:11px;">
                        <span style="font-weight:700; color:#334155; flex:1;">${escapeHtml(fdr)}</span>
                        <span style="font-weight:900; color:#9d174d;">${fmt(con)} kWh</span>
                    </div>`
                ).join("");
                const incomingRow = incoming > 0 ? `
                    <div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px dashed #fce7f3; font-size:11px;">
                        <span style="font-weight:700; color:#ef4444;">SS Loss</span>
                        <span style="font-weight:900; color:#ef4444;">${fmt(ssLoss)} kWh (${pct(ssLoss,incoming)})</span>
                    </div>` : "";
                return `<div style="background:#fff; border-radius:10px; padding:10px; margin-bottom:8px; border:1px solid #fbcfe8;">
                    <div style="font-size:12px; font-weight:900; color:#9d174d; margin-bottom:6px; text-transform:uppercase;">🔌 ${escapeHtml(ss)}</div>
                    ${feederRows}
                    ${incomingRow}
                    <div style="display:flex; justify-content:space-between; margin-top:6px; padding-top:4px; border-top:2px solid #ec4899;">
                        <span style="font-size:11px; font-weight:900; color:#1e293b;">SS Total</span>
                        <span style="font-size:12px; font-weight:900; color:#ec4899;">${fmt(ssTotal)} kWh</span>
                    </div>
                    <div style="font-size:9px; font-weight:700; color:#64748b; margin-top:2px; text-align:right;">Σ 11KV (${fmt(feeder11total)}) + Loss (${fmt(ssLoss)})</div>
                </div>`;
            }).join("");
            const grandTotal = BS12775548 + BS12775543; // Adegaon SS + Madhi SS total input

            // Loss calculation HTML
            const lossRow = (label, formula, val) => `
                <div style="background:#fff; border-radius:8px; padding:8px 10px; margin-bottom:8px; border-left:4px solid #ef4444;">
                    <div style="font-size:11px; font-weight:900; color:#1e293b; margin-bottom:2px;">${label}</div>
                    <div style="font-size:10px; font-weight:700; color:#64748b; margin-bottom:4px;">${formula}</div>
                    <span style="background:#fef2f2; border-radius:6px; padding:3px 8px; font-size:12px; font-weight:900; color:#ef4444;">${fmt(val)} kWh</span>
                </div>`;

            const lossHtml = `
                <div style="background:#fff; border-radius:10px; padding:10px; margin-bottom:8px; border:1.5px solid #fbbf24;">
                    <div style="font-size:12px; font-weight:900; color:#b45309; margin-bottom:4px; text-transform:uppercase;">⚡ Input & Loss Analysis</div>
                    <div style="font-size:10px; font-weight:700; color:#64748b; margin-bottom:8px;">
                        BS12775548 (Total Incoming, MF 24000): <strong style="color:#1e293b;">${fmt(BS12775548)} kWh</strong><br>
                        <span style="font-size:9px; color:#94a3b8;">BS548 se hi BS550 (Chamari line) aur BS133 (Madhi line) nikalti hain — isliye BS548 ≈ BS550 + BS133 + Adegaon SS consumption</span>
                    </div>

                    <!-- ROW 1: Adegaon SS Net Input -->
                    ${lossRow("1. Adegaon SS Net Input", `BS548 − (BS550 + BS133) = ${fmt(BS12775548)} − (${fmt(BS12775550)} + ${fmt(BS12776133)})`, adegaonNetInput)}
                    ${lossRow("   ↳ Adegaon SS Loss", `Net Input − Σ 11KV Feeders = ${fmt(adegaonNetInput)} − ${fmt(adegaon11KVTotal)}`, adegaonSSLineLoss)}
                    <div style="background:#f0fdf4; border-radius:8px; padding:6px 10px; margin-bottom:8px; border-left:3px solid #16a34a; font-size:10px; font-weight:700; color:#14532d;">
                        ✅ Adegaon SS Loss = {BS548 − (BS550 + BS133)} − Σ 11KV = {${fmt(BS12775548)} − ${fmt(BS12775550 + BS12776133)}} − ${fmt(adegaon11KVTotal)} = <strong>${fmt(adegaonSSLineLoss)} kWh</strong>
                    </div>

                    <!-- ROW 2: Chamari Line Input -->
                    ${lossRow("2. Chamari-Adegaon 33KV Line Input", `BS550 = ${fmt(BS12775550)} kWh`, BS12775550)}

                    <!-- ROW 3: Adegaon→Madhi Line Loss -->
                    ${lossRow("3. Adegaon→Madhi 33KV Line Loss", `BS133 − BS543 = ${fmt(BS12776133)} − ${fmt(BS12775543)}`, adegaonMadhiLineLoss)}

                    <!-- ROW 4: Madhi SS Input -->
                    ${lossRow("4. Madhi SS Input", `BS543 = ${fmt(BS12775543)} kWh`, BS12775543)}
                    ${lossRow("   ↳ Madhi SS T&D Loss", `BS543 − Σ 3×11KV = ${fmt(BS12775543)} − ${fmt(madhiFeederTotal)}`, madhiSSLineLoss)}
                    <div style="background:#f0fdf4; border-radius:8px; padding:6px 10px; margin-bottom:8px; border-left:3px solid #16a34a; font-size:10px; font-weight:700; color:#14532d;">
                        ✅ Madhi SS Total = Σ 3×11KV + SS Loss = ${fmt(madhiFeederTotal)} + ${fmt(madhiSSLineLoss)} = <strong>${fmt(madhiFeederTotal + madhiSSLineLoss)} kWh</strong> = BS543 ✓
                    </div>



                    <!-- Total T&D Losses -->
                    <div style="background:#fef2f2; border-radius:8px; padding:8px 10px; display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:11px; font-weight:900; color:#1e293b;">Total T&D Losses</span>
                        <div style="text-align:right;">
                            <div style="font-size:13px; font-weight:900; color:#ef4444;">${fmt(adegaonSSLineLoss + adegaonMadhiLineLoss + madhiSSLineLoss)} kWh</div>
                        </div>
                    </div>
                </div>`;

            // period (date-input value), ssHtml/lossHtml (numbers + hardcoded labels +
            // escapeHtml'd feeder/substation names) sabhi upar verify kiye — safe.
            card.innerHTML = trustedHtml_(`
                <div style="background:linear-gradient(135deg,#9d174d,#ec4899); border-radius:16px; padding:14px; color:#fff;">
                    <div style="font-size:13px; font-weight:900; text-transform:uppercase; text-align:center; margin-bottom:4px;">📊 Feeder Monthly Summary</div>
                    <div style="font-size:10px; font-weight:700; text-align:center; margin-bottom:12px; opacity:0.85;">अवधि: ${period}</div>
                    ${ssHtml}
                    ${lossHtml}
                    <div style="background:rgba(255,255,255,0.15); border-radius:12px; padding:12px; text-align:center; margin-top:4px;">
                        <div style="font-size:11px; font-weight:800; opacity:0.9; margin-bottom:4px;">GRAND TOTAL INPUT</div>
                        <div style="font-size:24px; font-weight:900;">${fmt(grandTotal)}</div>
                        <div style="font-size:11px; font-weight:700; opacity:0.8;">kWh</div>
                    </div>
                    <button onclick="document.getElementById('feeder-summary-card').style.display='none'" style="width:100%; height:36px; border:none; border-radius:10px; background:rgba(255,255,255,0.2); color:#fff; font-size:11px; font-weight:900; margin-top:10px;">✕ बंद करें</button>
                </div>`);
        }

        function feederFilterRowsByDcAndDate_(rows, fromDate, toDate) {
            const activeDcKey = normalizeDcName(activeDC || "");
            return rows.filter((r) => {
                // Scorecard remark ek asli feeder reading nahi hai — kisi bhi
                // report/export/loss-calculation me kabhi nahi aani chahiye.
                if ((r["METER NO"] || r.meter_no || "").trim().toUpperCase() === "REMARK") return false;
                const dateKey = buildFeederDateKey_(r["DATE(DD/MM/YYY)"] || r.date || "");
                if (!misDateInRange_(dateKey, fromDate, toDate)) return false;
                if (!activeDcKey) return true;
                const rowDcKey = normalizeDcName(r["DC NAME"] || r.dc_name || "");
                return rowDcKey === activeDcKey;
            });
        }

        // Unfreeze karke reading correct karne par purani entry sheet me reh jaati
        // hai — ek hi feeder+meter+date ki multiple entries me sirf SABSE LATEST
        // (corrected) entry use karo, warna consumption double count ho jaata hai.
        function feederDedupeLatestByReading_(rows) {
            const latestByKey = new Map();
            rows.forEach((r, idx) => {
                const key = [
                    (r["33/11 KV SUBSTATION"] || "").trim().toUpperCase(),
                    (r["33 AND 11 KV FEEDER"] || "").trim().toUpperCase(),
                    (r["METER NO"] || "").trim().toUpperCase(),
                    buildFeederDateKey_(r["DATE(DD/MM/YYY)"] || r.date || "")
                ].join("|");
                const t = String(r["TIME(HH/MM)"] || r.time || "").trim();
                const existing = latestByKey.get(key);
                // Baad ki time jeetegi; time same/khali ho to baad wali entry (sheet me
                // correction hamesha baad me append hoti hai) jeetegi.
                if (!existing || t > existing.t || (t === existing.t && idx > existing.idx)) {
                    latestByKey.set(key, { row: r, t, idx });
                }
            });
            return Array.from(latestByKey.values())
                .sort((a, b) => a.idx - b.idx)
                .map((item) => item.row);
        }

        async function getFeederMisRows_(fromDate, toDate) {
            await loadFeederReportData(true);
            const rows = getAllFeederHistoryEntries_();
            const filtered = feederFilterRowsByDcAndDate_(rows, fromDate, toDate);
            return feederDedupeLatestByReading_(filtered);
        }


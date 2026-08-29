        // employee-auth.js (login) abhi production par nahi hai — is helper se yeh
        // file bina us feature ke bhi kaam karti hai (khaali submitted_by fields ke saath).
        function feederEmployeeTag_() {
            return typeof currentEmployeeTag_ === "function" ? currentEmployeeTag_() : { submitted_by_id: "", submitted_by_name: "" };
        }

        // ===== Substation / 11KV Feeder-wise Monthly Input Scorecard =====
        // Is mahine, pichhle mahine, aur pichhle saal isi mahine ka input (kWh)
        // ek saath dikhata hai — mahine ke aakhri din check karne par teeno
        // periods ki poori tulna mil jaati hai.
        const FEEDER_INCOMING_33KV_METERS = ["BS12775548", "BS12775550", "BS12776133", "BS12775543", "BS12775544", "MPP28230"];
        // ADEGAON-CB (BS12770679) meter reading nahi aa rahi — jab tak theek na ho,
        // scorecard se bahar rakha hai. Reading aane par yahan se hata dena.
        const FEEDER_EXCLUDED_METERS = ["BS12770679"];

        // baseYearMonth ("YYYY-MM") diya ho to usi ko "is mahina" maan kar period
        // nikalta hai — nahi diya to aaj ki tareekh se. Isi se scorecard me
        // manually koi bhi mahina select kiya ja sakta hai.
        function feederScorecardPeriod_(monthsAgo, yearsAgo, baseYearMonth) {
            let baseYear, baseMonthIdx;
            if (baseYearMonth) {
                const [y, m] = baseYearMonth.split("-").map(Number);
                baseYear = y; baseMonthIdx = (m || 1) - 1;
            } else {
                const now = new Date();
                baseYear = now.getFullYear(); baseMonthIdx = now.getMonth();
            }
            const first = new Date(baseYear - yearsAgo, baseMonthIdx - monthsAgo, 1);
            const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
            const toIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
            return { from: toIso(first), to: toIso(last), label: first.toLocaleDateString("hi-IN", { month: "long", year: "numeric" }) };
        }

        // Sirf 11KV feeders (33KV incoming/outgoing meters exclude) — substation
        // ke andar feeder-wise kWh input jod deta hai.
        function feederAggregateBySubstationFeeder_(rows) {
            const map = {};
            rows.forEach((r) => {
                const meterNo = (r["METER NO"] || "").trim();
                if (FEEDER_INCOMING_33KV_METERS.includes(meterNo)) return;
                if (FEEDER_EXCLUDED_METERS.includes(meterNo)) return;
                const ss = r["33/11 KV SUBSTATION"] || "";
                const fdr = r["33 AND 11 KV FEEDER"] || "";
                if (!ss || !fdr) return;
                const prev = Number(r["PREVIUS READING"]) || 0;
                const curr = Number(r["CURRENT READING"]) || 0;
                const mf = Number(r["MF"]) || 1;
                const con = Math.abs(Number(r["CONSUMPTION"]) || Math.abs(curr - prev) * mf);
                if (!map[ss]) map[ss] = {};
                map[ss][fdr] = (map[ss][fdr] || 0) + con;
            });
            return map;
        }

        // Bade totals (Lakh unit, 2 dashamlav) dikhane ke liye shared helper —
        // scorecard ke कुल/GRAND TOTAL aur progressive consumption dono me istemaal.
        function feederFmtLakh_(n) {
            return (n === null || n === undefined) ? "—" : (n / 100000).toFixed(2) + " L";
        }

        // "महीना चुनें" ke neeche — selected mahine ki 1 tareekh se dikhata hai:
        // agar wahi asli chalu mahina hai to "aaj tak" (progressive/running),
        // agar koi pichhla (poora ho chuka) mahina select kiya hai to us mahine
        // ki aakhri tareekh tak (poora mahina) — jo bhi pehle aaye.
        function feederRenderProgressiveConsumption_(allRows, thisMonthPeriod) {
            const box = document.getElementById("feeder-scorecard-progressive");
            if (!box) return;
            const now = new Date();
            const toIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
            const todayIso = toIso(now);
            const fromIso = thisMonthPeriod.from;
            const toIsoVal = thisMonthPeriod.to < todayIso ? thisMonthPeriod.to : todayIso;
            if (fromIso > toIsoVal) { box.innerHTML = ""; return; }

            const filtered = feederDedupeLatestByReading_(feederFilterRowsByDcAndDate_(allRows || [], fromIso, toIsoVal));
            const map = feederAggregateBySubstationFeeder_(filtered);
            let total = 0;
            Object.values(map).forEach((feeders) => Object.values(feeders).forEach((v) => { total += v; }));
            const parseIso = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); };
            const fmtDateHi = (iso) => parseIso(iso).toLocaleDateString("hi-IN", { day: "numeric", month: "long" });
            const label = toIsoVal === thisMonthPeriod.to ? "पूरे महीने की खपत" : "प्रोग्रेसिव खपत";
            box.innerHTML = trustedHtml_(`📈 ${label}: ${fmtDateHi(fromIso)} से ${fmtDateHi(toIsoVal)} तक: <strong>${feederFmtLakh_(total)}</strong>`);
        }

        function toggleFeederMenu_() {
            const menu = document.getElementById("feeder-menu-dropdown");
            if (!menu) return;
            menu.style.display = menu.style.display === "block" ? "none" : "block";
        }

        document.addEventListener("click", (e) => {
            const menu = document.getElementById("feeder-menu-dropdown");
            const btn = document.getElementById("feeder-menu-btn");
            if (!menu || menu.style.display !== "block") return;
            if (e.target === btn || menu.contains(e.target)) return;
            menu.style.display = "none";
        });

        let feederScorecardCsvRows_ = null; // last computed scorecard — download ke liye reuse
        let feederScorecardState_ = null;   // ek baar fetch kiya hua data — manual edit/remark par dobara network call na ho
        let feederScorecardAllRows_ = null; // poori history — mahina badalne par dobara network call na ho, sirf client-side re-filter
        let feederScorecardBaseYearMonth_ = null; // user ne "month" picker se chuna hua "YYYY-MM" (isi ko "is mahina" maante hain), null = aaj ka mahina

        // "Pichhle saal ka mahina" ke jo cell abhi is baar khole gaye scorecard me
        // "✏️ Edit" dabaakar unfreeze kiye gaye hain (feeder reading wale unfreeze
        // jaisa hi) — tabhi tak editable rahenge, warna already-saved value frozen
        // dikhti hai. Overlay band-khol hone par reset ho jaata hai.
        const feederScorecardUnfrozenCells_ = new Set();
        function feederScorecardCellKey_(ss, fdr) {
            return `${String(ss || "").trim().toUpperCase()}|${String(fdr || "").trim().toUpperCase()}`;
        }

        // Remark bhi ab feeder submission endpoint ke through hi cloud par save
        // hota hai (ek sentinel "REMARK" meter-no wali row, jo feederFilterRowsByDcAndDate_
        // me hamesha exclude ho jaati hai — kisi report/calc me nahi ghusti).
        // Diye gaye period (thisMonth) ke andar sabse latest wali entry hi asli remark hai.
        function feederExtractRemarkForPeriod_(allRows, period) {
            const matches = (allRows || []).filter((r) => {
                if ((r["METER NO"] || r.meter_no || "").trim().toUpperCase() !== "REMARK") return false;
                const dateKey = buildFeederDateKey_(r["DATE(DD/MM/YYY)"] || r.date || "");
                return misDateInRange_(dateKey, period.from, period.to);
            }).sort((a, b) => String(a["TIME(HH/MM)"] || a.time || "").localeCompare(String(b["TIME(HH/MM)"] || b.time || "")));
            if (!matches.length) return "";
            const latest = matches[matches.length - 1];
            return latest["REMARK_TEXT"] || latest.remark_text || "";
        }

        async function feederOpenMonthlyScorecard_() {
            const menu = document.getElementById("feeder-menu-dropdown");
            if (menu) menu.style.display = "none";
            const existing = document.getElementById("feeder-scorecard-overlay");
            if (existing) existing.remove();

            const overlay = document.createElement("div");
            overlay.id = "feeder-scorecard-overlay";
            overlay.style.cssText = "position:fixed; inset:0; background:rgba(0,0,0,0.55); z-index:9999; display:flex; align-items:flex-end; justify-content:center;";
            overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });

            const sheet = document.createElement("div");
            sheet.style.cssText = "background:#ffffff; border-radius:20px 20px 0 0; padding:18px; width:100%; max-width:480px; max-height:82vh; overflow-y:auto; box-shadow:0 -12px 30px rgba(0,0,0,0.25);";
            const nowYearMonth = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; })();
            feederScorecardBaseYearMonth_ = nowYearMonth;
            feederScorecardUnfrozenCells_.clear();

            sheet.innerHTML = trustedHtml_(`
                <div style="font-size:14px; font-weight:900; color:#1e293b; text-align:center; text-transform:uppercase; margin-bottom:2px;">📊 सब स्टेशन / फीडर वाइज मासिक इनपुट स्कोरकार्ड</div>
                <div style="display:flex; align-items:center; justify-content:center; gap:8px; margin:8px 0;">
                    <label for="feeder-scorecard-month-select" style="font-size:11px; font-weight:800; color:#64748b;">महीना चुनें:</label>
                    <input type="month" id="feeder-scorecard-month-select" value="${nowYearMonth}" style="border:1.5px solid #ec4899; border-radius:8px; padding:5px 8px; font-size:12px; font-weight:700; color:#831843; background:#fdf2f8; outline:none;">
                </div>
                <div id="feeder-scorecard-progressive" style="text-align:center; font-size:11px; font-weight:800; color:#166534; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; padding:6px 10px; margin-bottom:10px;"></div>
                <div id="feeder-scorecard-heading" style="font-size:12px; font-weight:800; color:#9d174d; text-align:center; margin-bottom:10px;"></div>
                <div id="feeder-scorecard-body"><div style="text-align:center; padding:14px; font-size:12px; font-weight:800; color:#64748b;">लोड हो रहा है...</div></div>
                <div style="display:flex; gap:10px; margin-top:14px;">
                    <button id="feeder-scorecard-close-btn" style="flex:1; height:42px; border:none; border-radius:12px; background:#e2e8f0; color:#1e293b; font-size:12px; font-weight:900; text-transform:uppercase;">बंद करें</button>
                    <button id="feeder-scorecard-download-btn" onclick="feederDownloadMonthlyScorecardCsv_()" style="flex:1; height:42px; border:none; border-radius:12px; background:linear-gradient(135deg,#16a34a,#15803d); color:#fff; font-size:12px; font-weight:900; text-transform:uppercase;">📥 Download</button>
                </div>
            `);
            overlay.appendChild(sheet);
            document.body.appendChild(overlay);
            document.getElementById("feeder-scorecard-close-btn").onclick = () => {
                feederFlushScorecardRemarkSave_();
                overlay.remove();
            };
            document.getElementById("feeder-scorecard-month-select").onchange = (e) => {
                feederFlushScorecardRemarkSave_();
                feederScorecardBaseYearMonth_ = e.target.value || nowYearMonth;
                feederRecomputeScorecardPeriods_();
            };

            const body = document.getElementById("feeder-scorecard-body");
            try {
                // Ek hi baar network se poori history laate hain, phir teeno periods
                // ke liye client-side hi filter karte hain — 3x redundant fetch nahi.
                // Remark edit hone par, ya month picker se mahina badalne par bhi
                // yahi rows dobara istemaal hoti hain, dobara network call nahi lagti.
                // (Pichhle saal ki manual entry cloud par save hoti hai — usme
                // network call lagti hai, phir yahi allRows local-refresh hoti hai.)
                await loadFeederReportData(true);
                feederScorecardAllRows_ = getAllFeederHistoryEntries_();
                feederRecomputeScorecardPeriods_();
            } catch (err) {
                body.innerHTML = `<div style="text-align:center; padding:18px; font-size:12px; font-weight:800; color:#b91c1c;">Scorecard banane me error aaya, dobara try karein</div>`;
                feederScorecardCsvRows_ = null;
                feederScorecardState_ = null;
            }
        }

        // Chuna hua mahina ("feederScorecardBaseYearMonth_") base maan kar teeno
        // periods (is mahina / pichhla mahina / pichhle saal ka yahi mahina)
        // dobara nikalta hai — client-side hi, koi network call nahi.
        function feederRecomputeScorecardPeriods_() {
            const allRows = feederScorecardAllRows_ || [];
            const baseYM = feederScorecardBaseYearMonth_;
            const thisMonth = feederScorecardPeriod_(0, 0, baseYM);
            const lastYear = feederScorecardPeriod_(0, 1, baseYM);
            const lastMonth = feederScorecardPeriod_(1, 0, baseYM);

            const mapFor = (p) => feederAggregateBySubstationFeeder_(feederDedupeLatestByReading_(feederFilterRowsByDcAndDate_(allRows, p.from, p.to)));
            feederScorecardState_ = {
                thisMonth, lastYear, lastMonth,
                mapThisMonth: mapFor(thisMonth),
                mapLastYear: mapFor(lastYear),
                mapLastMonth: mapFor(lastMonth),
                remarkText: feederExtractRemarkForPeriod_(allRows, thisMonth)
            };
            feederRenderProgressiveConsumption_(allRows, thisMonth);
            feederRenderScorecardBody_();
        }

        // State (fetch ki hui) se HTML dobara banata hai — remark badalne par ya
        // manual last-year entry unfreeze/cancel karne par (network ke bina) isi
        // ko dobara call karte hain; manual entry save hone par recompute hota hai
        // (kyunki wo naye rows allRows me judte hain).
        function feederRenderScorecardBody_() {
            const st = feederScorecardState_;
            const body = document.getElementById("feeder-scorecard-body");
            const heading = document.getElementById("feeder-scorecard-heading");
            if (!st || !body) return;

            const { thisMonth, lastYear, lastMonth, mapThisMonth, mapLastYear, mapLastMonth, remarkText } = st;
            if (heading) heading.innerText = `${thisMonth.label} बनाम ${lastYear.label} (पिछला महीना: ${lastMonth.label})`;

            const ssNames = new Set();
            [mapThisMonth, mapLastMonth, mapLastYear].forEach((m) => Object.keys(m).forEach((ss) => ssNames.add(ss)));

            if (!ssNames.size) {
                body.innerHTML = `<div style="text-align:center; padding:18px; font-size:13px; font-weight:800; color:#64748b; background:#f8fafc; border-radius:14px;">इन periods में कोई feeder reading नहीं मिली। नीचे "${escapeHtml(lastYear.label)}" का data मैन्युअल भी भरा जा सकता है, entries आने के बाद यहाँ dobara khol kar dekhein।</div>`;
                feederScorecardCsvRows_ = null;
                return;
            }

            const fmt = (n) => (n === null ? "—" : Math.round(n).toLocaleString("en-IN"));
            // "कुल" aur GRAND TOTAL rows me hi Lakh unit (2 dashamlav) me dikhate
            // hain (jaise 9,13,900 kWh → "9.14 L") — individual feeder values poore
            // number me hi rehti hain. CSV me hamesha poora raw kWh number hi jaata hai.
            const fmtLakh = feederFmtLakh_;
            const csvRows = [["Substation", "Feeder", thisMonth.label, `${lastYear.label} (मैन्युअल हो सकता है)`, lastMonth.label]];
            const grandTotal = [0, 0, 0];

            let bodyHtml = `
                <div style="display:grid; grid-template-columns:1.3fr 1fr 1fr 1fr; gap:4px; padding:0 10px 6px 10px; font-size:9.5px; font-weight:900; color:#64748b; text-transform:uppercase; border-bottom:2px solid #f472b6;">
                    <span>Feeder</span>
                    <span style="text-align:center; color:#16a34a;">${escapeHtml(thisMonth.label)}</span>
                    <span style="text-align:center; color:#1d4ed8;">${escapeHtml(lastYear.label)}</span>
                    <span style="text-align:center; color:#b45309;">${escapeHtml(lastMonth.label)}</span>
                </div>
            `;
            Array.from(ssNames).sort().forEach((ss) => {
                const feederNames = new Set();
                [mapThisMonth, mapLastMonth, mapLastYear].forEach((m) => Object.keys(m[ss] || {}).forEach((f) => feederNames.add(f)));

                const ssTotal = [0, 0, 0];
                const feederRowsHtml = Array.from(feederNames).sort().map((fdr) => {
                    const valThisMonth = mapThisMonth[ss]?.[fdr] ?? null;
                    const valLastMonth = mapLastMonth[ss]?.[fdr] ?? null;
                    const valLastYear = mapLastYear[ss]?.[fdr] ?? null;

                    if (valThisMonth !== null) ssTotal[0] += valThisMonth;
                    if (valLastYear !== null) ssTotal[1] += valLastYear;
                    if (valLastMonth !== null) ssTotal[2] += valLastMonth;
                    csvRows.push([ss, fdr, valThisMonth ?? "", valLastYear ?? "", valLastMonth ?? ""]);

                    // Pehle se saved value ho aur abhi unfreeze na ki gayi ho to
                    // frozen (read-only) dikhao, ✏️ Edit se hi dobara bhara ja
                    // sakta hai — bilkul feeder reading ke unfreeze jaisa. Khali
                    // cell seedhe editable rehti hai (pehli baar bharne me confirm
                    // ki zaroorat nahi).
                    const isUnfrozen = feederScorecardUnfrozenCells_.has(feederScorecardCellKey_(ss, fdr));
                    const lastYearCellHtml = (valLastYear !== null && !isUnfrozen)
                        ? `<span style="display:flex; align-items:center; justify-content:center; gap:4px;">
                                <span style="font-weight:900; color:#1d4ed8;">${fmt(valLastYear)}</span>
                                <button type="button" onclick="feederUnfreezeLastYearCell_('${escapeHtml(ss)}','${escapeHtml(fdr)}')" title="Edit" style="border:none; background:#eff6ff; color:#1d4ed8; border-radius:6px; padding:2px 5px; font-size:9px; font-weight:900; cursor:pointer; line-height:1.4;">✏️</button>
                           </span>`
                        : `<span style="display:flex; align-items:center; justify-content:center; gap:3px;">
                                <input type="number" inputmode="decimal" value="${valLastYear !== null ? valLastYear : ""}" placeholder="भरें"
                                    data-ss="${escapeHtml(ss)}" data-fdr="${escapeHtml(fdr)}" onchange="feederSubmitManualLastYearEntry_(this)"
                                    style="width:100%; min-width:0; text-align:center; border:1.3px solid #93c5fd; border-radius:6px; font-size:10px; font-weight:900; color:#1d4ed8; padding:3px 2px; background:#eff6ff; box-sizing:border-box;">
                                <button type="button" onclick="feederSubmitManualLastYearEntry_(this.previousElementSibling)" title="Save" style="flex-shrink:0; border:none; background:#dcfce7; color:#15803d; border-radius:6px; padding:2px 5px; font-size:9px; font-weight:900; cursor:pointer; line-height:1.4;">✔</button>
                           </span>`;

                    return `
                        <div style="display:grid; grid-template-columns:1.3fr 1fr 1fr 1fr; gap:4px; padding:5px 0; border-bottom:1px solid #fce7f3; font-size:10.5px; align-items:center;">
                            <span style="font-weight:700; color:#334155;">${escapeHtml(fdr)}</span>
                            <span style="font-weight:900; color:#16a34a; text-align:center;">${fmt(valThisMonth)}</span>
                            ${lastYearCellHtml}
                            <span style="font-weight:900; color:#b45309; text-align:center;">${fmt(valLastMonth)}</span>
                        </div>`;
                }).join("");
                grandTotal[0] += ssTotal[0]; grandTotal[1] += ssTotal[1]; grandTotal[2] += ssTotal[2];
                bodyHtml += `
                    <div style="background:#fdf2f8; border-radius:10px; padding:10px; margin-bottom:10px; border:1px solid #fbcfe8;">
                        <div style="font-size:12px; font-weight:900; color:#9d174d; margin-bottom:6px; text-transform:uppercase;">🔌 ${escapeHtml(ss)}</div>
                        ${feederRowsHtml}
                        <div style="display:grid; grid-template-columns:1.3fr 1fr 1fr 1fr; gap:4px; padding-top:6px; margin-top:4px; border-top:2px solid #ec4899;">
                            <span style="font-weight:900; color:#1e293b; font-size:10.5px;">कुल</span>
                            <span style="font-weight:900; color:#16a34a; text-align:center; font-size:10.5px;">${fmtLakh(ssTotal[0])}</span>
                            <span style="font-weight:900; color:#1d4ed8; text-align:center; font-size:10.5px;">${fmtLakh(ssTotal[1])}</span>
                            <span style="font-weight:900; color:#b45309; text-align:center; font-size:10.5px;">${fmtLakh(ssTotal[2])}</span>
                        </div>
                    </div>`;
            });

            csvRows.push(["", "GRAND TOTAL", grandTotal[0], grandTotal[1], grandTotal[2]]);
            bodyHtml += `
                <div style="background:#4a044e; border-radius:10px; padding:10px; margin-bottom:12px;">
                    <div style="display:grid; grid-template-columns:1.3fr 1fr 1fr 1fr; gap:4px; align-items:center;">
                        <span style="font-weight:900; color:#fce7f3; font-size:11px; text-transform:uppercase;">GRAND TOTAL</span>
                        <span style="font-weight:900; color:#86efac; text-align:center; font-size:11px;">${fmtLakh(grandTotal[0])}</span>
                        <span style="font-weight:900; color:#93c5fd; text-align:center; font-size:11px;">${fmtLakh(grandTotal[1])}</span>
                        <span style="font-weight:900; color:#fde68a; text-align:center; font-size:11px;">${fmtLakh(grandTotal[2])}</span>
                    </div>
                </div>
                <div>
                    <div style="font-size:10.5px; font-weight:900; color:#9d174d; text-transform:uppercase; margin-bottom:6px;">📝 रिमार्क (विशेष परिस्थितियां जो इनपुट को प्रभावित करती हैं)</div>
                    <textarea id="feeder-scorecard-remark" oninput="feederSaveScorecardRemark_(this)" placeholder="जैसे: इस महीने 8 दिन बारिश हुई, 5 दिन ब्रेकडाउन ज्यादा रहा..." style="width:100%; min-height:70px; border-radius:10px; border:1.5px solid #fbcfe8; padding:8px; font-size:11px; font-weight:700; color:#1e293b; resize:vertical; outline:none; box-sizing:border-box;">${escapeHtml(remarkText || "")}</textarea>
                    <button type="button" id="feeder-scorecard-remark-save-btn" onclick="feederSaveScorecardRemarkNow_()" style="width:100%; height:38px; margin-top:8px; border:none; border-radius:10px; background:linear-gradient(135deg,#16a34a,#15803d); color:#fff; font-size:11px; font-weight:900; text-transform:uppercase; cursor:pointer;">✔ रिमार्क Save करें</button>
                </div>
            `;
            body.innerHTML = trustedHtml_(bodyHtml);
            feederScorecardCsvRows_ = csvRows;
        }

        // Pehle se saved "pichhle saal" ki entry par ✏️ Edit dabane par confirm
        // maang kar cell unfreeze karta hai — bilkul feeder reading ke
        // "Edit / Unfreeze" jaisa, taaki galti se real data overwrite na ho.
        function feederUnfreezeLastYearCell_(ss, fdr) {
            const existing = document.getElementById("feeder-scorecard-unfreeze-overlay");
            if (existing) existing.remove();
            const label = feederLastYearLabelSafe_();

            const overlay = document.createElement("div");
            overlay.id = "feeder-scorecard-unfreeze-overlay";
            overlay.style.cssText = "position:fixed; inset:0; background:rgba(0,0,0,0.55); z-index:10000; display:flex; align-items:center; justify-content:center; padding:20px;";
            overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });

            const card = document.createElement("div");
            card.style.cssText = "background:#ffffff; border-radius:18px; padding:18px; width:100%; max-width:320px; box-shadow:0 12px 30px rgba(0,0,0,0.25); text-align:center;";
            card.innerHTML = `
                <div style="font-size:14px; font-weight:900; color:#92400e; text-transform:uppercase; margin-bottom:10px;">Entry Edit करें?</div>
                <div style="font-size:12px; font-weight:700; color:#475569; margin-bottom:16px;">
                    "${escapeHtml(fdr)}" (${escapeHtml(ss)}) की ${escapeHtml(label)} की entry unfreeze हो जाएगी और आप नई value दोबारा भर सकेंगे।
                </div>
                <div style="display:flex; gap:10px;">
                    <button id="feeder-scorecard-unfreeze-cancel-btn" style="flex:1; height:44px; border:none; border-radius:12px; background:#e2e8f0; color:#1e293b; font-size:12px; font-weight:900; text-transform:uppercase;">Cancel</button>
                    <button id="feeder-scorecard-unfreeze-confirm-btn" style="flex:1; height:44px; border:none; border-radius:12px; background:#f59e0b; color:#fff; font-size:12px; font-weight:900; text-transform:uppercase;">Unfreeze</button>
                </div>
            `;
            overlay.appendChild(card);
            document.body.appendChild(overlay);
            document.getElementById("feeder-scorecard-unfreeze-cancel-btn").onclick = () => overlay.remove();
            document.getElementById("feeder-scorecard-unfreeze-confirm-btn").onclick = () => {
                overlay.remove();
                feederScorecardUnfrozenCells_.add(feederScorecardCellKey_(ss, fdr));
                feederRenderScorecardBody_();
            };
        }

        // "Pichhle saal" ke cell ki value cloud par save karta hai — feeder reading
        // ki normal submission jaisa hi (module=feeder, offline ho to sync_queue me
        // chala jaata hai). Isi liye yeh entry sab devices se dikhti hai aur app
        // ka data clear hone par bhi nahi khoti.
        async function feederSubmitManualLastYearEntry_(inputEl) {
            if (!feederScorecardState_) return;
            const ss = inputEl.dataset.ss;
            const fdr = inputEl.dataset.fdr;
            const cellKey = feederScorecardCellKey_(ss, fdr);
            const val = inputEl.value.trim();

            if (!val) {
                // Khali chhodkar cancel — jo pehle se saved thi wahi frozen value wapas dikha do
                feederScorecardUnfrozenCells_.delete(cellKey);
                feederRenderScorecardBody_();
                return;
            }

            const period = feederScorecardState_.lastYear;
            const [y, m] = period.from.split("-");
            const entryDate = `01/${m}/${y}`; // period ka fixed pehla din — edit par isi date par dobara submit hota hai, taaki dedupe latest-wins se replace ho, double-count na ho
            const entryTime = getCurrentTimeHHMM();
            const dcName = activeDC || "ADEGAON";
            const entry = {
                "33/11 KV SUBSTATION": ss, "33 AND 11 KV FEEDER": fdr, "METER NO": "MANUAL",
                "PREVIUS READING": "0", "CURRENT READING": String(val), "MF": "1", "CONSUMPTION": String(val),
                "DC NAME": dcName, "DATE(DD/MM/YYY)": entryDate, "TIME(HH/MM)": entryTime,
                substation: ss, feeder: fdr, meter_no: "MANUAL",
                previous_reading: "0", current_reading: String(val), mf: "1", consumption: String(val),
                dc_name: dcName, date: entryDate, time: entryTime,
                ...feederEmployeeTag_()
            };

            inputEl.disabled = true;
            try {
                const payload = new URLSearchParams();
                payload.append("module", "feeder");
                payload.append("entries_json", JSON.stringify([entry]));
                payload.append("auth_token", APPS_SCRIPT_AUTH_TOKEN);

                let submitOk = false;
                let queuedOffline = false;
                try {
                    const response = await fetchWithTimeout_(feederSubmitScriptUrl, {
                        method: "POST",
                        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
                        body: payload.toString()
                    });
                    submitOk = response.ok;
                } catch (networkError) {
                    try {
                        await queueOfflineSync_({ kind: "post_form", body: payload.toString() });
                        queuedOffline = true;
                    } catch (_) {}
                }

                // Local-first: turant dikhe, cloud sync fail ho tab bhi entry khoye nahi
                saveRecentFeederSubmittedEntries_([entry]);
                feederScorecardAllRows_ = getAllFeederHistoryEntries_();
                feederScorecardUnfrozenCells_.delete(cellKey);
                feederRecomputeScorecardPeriods_();

                if (submitOk) {
                    showToast(`${feederLastYearLabelSafe_()} की entry cloud पर save हो गई`, true);
                } else if (queuedOffline) {
                    showToast("Entry device पर save हो गई 🔄 Internet आने पर cloud sync हो जाएगी", true);
                } else {
                    showToast("Entry device पर save हो गई, लेकिन cloud sync अभी नहीं हो पाया", false);
                }
            } catch (err) {
                showToast("Entry save करने में error आया, दोबारा try करें", false);
            } finally {
                inputEl.disabled = false;
            }
        }

        function feederLastYearLabelSafe_() {
            return feederScorecardState_ ? feederScorecardState_.lastYear.label : "पिछले साल";
        }

        // Har keystroke par cloud call nahi lagti — typing rukne ke 800ms baad
        // (ya scorecard band/month badalne par turant flush) hi submit hoti hai.
        // Yeh auto-save chup-chaap (silent) hoti hai — taaki typing ke beech baar
        // baar toast na aaye; confirmation ke liye "✔ रिमार्क Save करें" button hai.
        let feederRemarkSaveTimer_ = null;
        function feederSaveScorecardRemark_(textareaEl) {
            if (!feederScorecardState_) return;
            feederScorecardState_.remarkText = textareaEl.value; // state/CSV turant reflect ho
            clearTimeout(feederRemarkSaveTimer_);
            feederRemarkSaveTimer_ = setTimeout(() => feederSubmitScorecardRemarkToCloud_(textareaEl.value, { silent: true }), 800);
        }

        function feederFlushScorecardRemarkSave_() {
            if (!feederRemarkSaveTimer_) return;
            clearTimeout(feederRemarkSaveTimer_);
            feederRemarkSaveTimer_ = null;
            if (feederScorecardState_) feederSubmitScorecardRemarkToCloud_(feederScorecardState_.remarkText || "", { silent: true });
        }

        // "✔ रिमार्क Save करें" button — turant submit karta hai aur hamesha
        // confirmation toast dikhata hai (chahe save ho jaaye ya offline queue ho jaaye).
        function feederSaveScorecardRemarkNow_() {
            const textareaEl = document.getElementById("feeder-scorecard-remark");
            const btn = document.getElementById("feeder-scorecard-remark-save-btn");
            if (!textareaEl || !feederScorecardState_) return;
            clearTimeout(feederRemarkSaveTimer_);
            feederRemarkSaveTimer_ = null;
            feederScorecardState_.remarkText = textareaEl.value;
            if (btn) { btn.disabled = true; btn.innerText = "Saving..."; }
            feederSubmitScorecardRemarkToCloud_(textareaEl.value, { silent: false }).finally(() => {
                if (btn) { btn.disabled = false; btn.innerText = "✔ रिमार्क Save करें"; }
            });
        }

        // Remark ko bhi feeder submission endpoint ke through cloud par save karta
        // hai — ek sentinel "REMARK" meter-no wali row, jo kabhi feeder aggregation/
        // reports me nahi ginti (feederFilterRowsByDcAndDate_ me exclude hoti hai).
        async function feederSubmitScorecardRemarkToCloud_(text, { silent = true } = {}) {
            if (!feederScorecardState_) return;
            const period = feederScorecardState_.thisMonth;
            const [y, m] = period.from.split("-");
            const entryDate = `01/${m}/${y}`;
            const entryTime = getCurrentTimeHHMM();
            const dcName = activeDC || "ADEGAON";
            const entry = {
                "33/11 KV SUBSTATION": "_SCORECARD_", "33 AND 11 KV FEEDER": "_REMARK_", "METER NO": "REMARK",
                "PREVIUS READING": "0", "CURRENT READING": "0", "MF": "1", "CONSUMPTION": "0",
                "DC NAME": dcName, "DATE(DD/MM/YYY)": entryDate, "TIME(HH/MM)": entryTime, "REMARK_TEXT": text,
                substation: "_SCORECARD_", feeder: "_REMARK_", meter_no: "REMARK",
                previous_reading: "0", current_reading: "0", mf: "1", consumption: "0",
                dc_name: dcName, date: entryDate, time: entryTime, remark_text: text,
                ...feederEmployeeTag_()
            };
            try {
                const payload = new URLSearchParams();
                payload.append("module", "feeder");
                payload.append("entries_json", JSON.stringify([entry]));
                payload.append("auth_token", APPS_SCRIPT_AUTH_TOKEN);

                let submitOk = false;
                let queuedOffline = false;
                try {
                    const response = await fetchWithTimeout_(feederSubmitScriptUrl, {
                        method: "POST",
                        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
                        body: payload.toString()
                    });
                    submitOk = response.ok;
                } catch (networkError) {
                    try {
                        await queueOfflineSync_({ kind: "post_form", body: payload.toString() });
                        queuedOffline = true;
                    } catch (_) {}
                }
                saveRecentFeederSubmittedEntries_([entry]);
                feederScorecardAllRows_ = getAllFeederHistoryEntries_();

                if (!silent) {
                    if (submitOk) {
                        showToast("रिमार्क cloud पर save हो गई", true);
                    } else if (queuedOffline) {
                        showToast("रिमार्क device पर save हो गई 🔄 Internet आने पर cloud sync हो जाएगी", true);
                    } else {
                        showToast("रिमार्क device पर save हो गई, लेकिन cloud sync अभी नहीं हो पाया", false);
                    }
                }
            } catch (err) {
                if (!silent) showToast("रिमार्क save करने में error आया, दोबारा try करें", false);
            }
        }

        function feederDownloadMonthlyScorecardCsv_() {
            if (!feederScorecardCsvRows_ || feederScorecardCsvRows_.length < 2) {
                return showToast("पहले scorecard load होने दें", false);
            }
            const rows = feederScorecardCsvRows_.slice();
            const remark = feederScorecardState_ ? (feederScorecardState_.remarkText || "") : "";
            if (remark.trim()) rows.push(["", "", "", "", ""], ["रिमार्क", remark, "", "", ""]);
            const csv = rows.map((row) =>
                row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
            ).join("\n");
            const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            const today = new Date();
            a.download = `Feeder_Monthly_Scorecard_${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            showToast("Scorecard (CSV) Downloaded!", true);
        }

        function getMisModuleConfig_(moduleType) {
            const configs = {
                feeder: {
                    title: "FEEDER READING MIS REPORT",
                    color: [157, 23, 77],
                    fromId: "feeder-mis-from-date",
                    toId: "feeder-mis-to-date",
                    headers: ["Substation", "Feeder", "Meter No", "Previous Reading", "Current Reading", "MF", "Consumption", "DC Name", "Date", "Time"],
                    rowMapper: (r) => [
                        r["33/11 KV SUBSTATION"] || "", r["33 AND 11 KV FEEDER"] || "", r["METER NO"] || "",
                        r["PREVIUS READING"] || "", r["CURRENT READING"] || "", r["MF"] || "",
                        r["CONSUMPTION"] || "", r["DC NAME"] || "", r["DATE(DD/MM/YYY)"] || "", r["TIME(HH/MM)"] || ""
                    ],
                    fetcher: getFeederMisRows_,
                    filename: "Feeder_Reading_MIS"
                }
            };
            return configs[moduleType] || null;
        }

        async function downloadModuleMisReport(moduleType, format) {
            const config = getMisModuleConfig_(moduleType);
            if (!config) return;

            const fromInput = document.getElementById(config.fromId);
            const toInput = document.getElementById(config.toId);
            const fromDate = fromInput?.value || "";
            const toDate = toInput?.value || "";
            if (fromDate && toDate && fromDate > toDate) {
                return showToast("From date, To date se pehle honi chahiye", false);
            }

            showToast("Report taiyar ho raha hai...", true);

            let rows = [];
            try {
                rows = await config.fetcher(fromDate, toDate);
            } catch (_) {
                rows = [];
            }

            const fmtDate = (iso) => {
                if (!iso) return "";
                const [y, m, d] = iso.split("-");
                return `${d}/${m}/${y}`;
            };
            const periodLabel = (fromDate && toDate) ? `${fmtDate(fromDate)} to ${fmtDate(toDate)}` : "All Records";

            if (format === "EXCEL") {
                try {
                    await ensureXlsx_();
                    const wsData = [config.headers, ...rows.map(config.rowMapper)];
                    const ws = XLSX.utils.aoa_to_sheet(wsData);
                    const wb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(wb, ws, "MIS Report");
                    const filename = `${config.filename}_${(fromDate || "all").replace(/-/g,"")}_${(toDate || "all").replace(/-/g,"")}.xlsx`;
                    XLSX.writeFile(wb, filename);
                    showToast("Excel Downloaded!", true);
                } catch (_) {
                    showToast("Excel generate karne mein error aaya", false);
                }
            } else {
                try {
                    await ensureJsPdf_();
                    const { jsPDF } = window.jspdf;
                    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

                    doc.setFillColor(...config.color);
                    doc.rect(0, 0, 297, 18, "F");
                    doc.setFontSize(13);
                    doc.setTextColor(255, 255, 255);
                    doc.setFont(undefined, "bold");
                    doc.text(config.title, 148.5, 8, { align: "center" });
                    doc.setFontSize(8);
                    doc.setFont(undefined, "normal");
                    doc.text(`DC: ${activeDC || "-"}  |  Period: ${periodLabel}`, 148.5, 14, { align: "center" });

                    doc.setTextColor(100);
                    doc.setFontSize(7);
                    doc.text(`Generated: ${new Date().toLocaleString("en-IN")}  |  Total Records: ${rows.length}`, 287, 22, { align: "right" });

                    let nextY = 26;

                    // === FEEDER SUMMARY SECTION (only for feeder module) ===
                    if (moduleType === "feeder" && rows.length) {
                        const ssMap = {};
                        rows.forEach((r) => {
                            const ss  = r["33/11 KV SUBSTATION"] || "";
                            const fdr = r["33 AND 11 KV FEEDER"] || "";
                            const prev = Number(r["PREVIUS READING"]) || 0;
                            const curr = Number(r["CURRENT READING"]) || 0;
                            const mf   = Number(r["MF"]) || 1;
                            const con  = Math.abs(Number(r["CONSUMPTION"]) || Math.abs(curr - prev) * mf);
                            if (!ssMap[ss]) ssMap[ss] = { total: 0, feeders: {} };
                            if (!ssMap[ss].feeders[fdr]) ssMap[ss].feeders[fdr] = 0;
                            ssMap[ss].feeders[fdr] += con;
                            ssMap[ss].total += con;
                        });
                        const grandTotal = Object.values(ssMap).reduce((s, v) => s + v.total, 0);

                        // Summary heading
                        doc.setFontSize(9); doc.setTextColor(157,23,77); doc.setFont(undefined, "bold");
                        doc.text("📊 Substation / Feeder-wise Monthly Consumption Summary", 8, nextY + 4);

                        // Build summary table body
                        const summaryBody = [];
                        Object.entries(ssMap).forEach(([ss, data]) => {
                            // SS header row
                            summaryBody.push([{ content: ss, colSpan: 2, styles: { fillColor: [253,242,248], fontStyle:"bold", textColor:[157,23,77] } }, { content: `SS Total: ${data.total.toLocaleString("en-IN")} kWh`, styles: { fontStyle:"bold", textColor:[157,23,77], fillColor:[253,242,248], halign:"right" } }]);
                            Object.entries(data.feeders).forEach(([fdr, con]) => {
                                summaryBody.push(["", fdr, `${con.toLocaleString("en-IN")} kWh`]);
                            });
                        });
                        summaryBody.push([{ content: "GRAND TOTAL INPUT", colSpan: 2, styles: { fillColor:[157,23,77], textColor:255, fontStyle:"bold" } }, { content: `${grandTotal.toLocaleString("en-IN")} kWh`, styles: { fillColor:[157,23,77], textColor:255, fontStyle:"bold", halign:"right" } }]);

                        doc.autoTable({
                            startY: nextY + 7,
                            margin: { left: 8, right: 8 },
                            head: [["क्र.", "Feeder / Substation", "Consumption (kWh)"]],
                            body: summaryBody,
                            theme: "grid",
                            headStyles: { fillColor: [157,23,77], textColor: 255, fontSize: 8, fontStyle: "bold", halign: "center" },
                            bodyStyles: { fontSize: 8 },
                            columnStyles: { 0: { cellWidth: 12, halign:"center" }, 2: { halign:"right", cellWidth:40 } }
                        });
                        nextY = doc.lastAutoTable.finalY + 6;

                        // === Electrical Calculations in PDF ===
                        const getMC = (mNo) => Math.abs(rows.filter((r) => (r["METER NO"]||"").trim()===mNo).reduce((s,r)=>{
                            const p=Number(r["PREVIUS READING"])||0, c=Number(r["CURRENT READING"])||0, mf=Number(r["MF"])||1;
                            return s+Math.abs(Number(r["CONSUMPTION"])||Math.abs(c-p)*mf);
                        },0));
                        const M548=getMC("BS12775548"), M133=getMC("BS12776133");
                        const M543=getMC("BS12775543");
                        const M695=getMC("BS12774695"), M368=getMC("BS12776368"), M694=getMC("BS12774694");
                        const M693=getMC("BS12774693");
                        const M542=getMC("BS12775542"), M541=getMC("BS12775541"), M540=getMC("BS12775540");
                        // ADEGAON-CB (BS12770679) excluded — meter reading nahi aa rahi abhi.
                        const adg11Total = M695+M368+M694+M693;
                        const madhiTotal = M542+M541+M540;
                        const adInput    = Math.abs(M548-M133); // BS548 - BS133 only
                        const adSSLoss   = Math.abs(adInput - adg11Total);
                        const lineLoss   = Math.abs(M133-M543);
                        const madhiLoss  = Math.abs(M543-madhiTotal);
                        const totalLoss  = adSSLoss+lineLoss+madhiLoss;
                        const fmt2=(n)=>Math.round(n).toLocaleString("en-IN");
                        const pct2=(n,base)=>base>0?(n/base*100).toFixed(2)+"%":"—";
                        const pctI=(n)=>pct2(n,M548);

                        if (nextY > 160) { doc.addPage(); nextY = 14; }
                        doc.setFontSize(9); doc.setTextColor(157,23,77); doc.setFont(undefined,"bold");
                        doc.text("⚡ Loss Analysis  |  Total Incoming (BS12775548): "+fmt2(M548)+" kWh", 8, nextY+4);
                        doc.autoTable({
                            startY: nextY+7,
                            margin: { left: 8, right: 8 },
                            head: [["Loss Type", "Formula", "Value (kWh)", "% of Base", "% of Total Input"]],
                            body: [
                                ["Adegaon SS Input",
                                 `BS548-BS133\n=${fmt2(M548)}-${fmt2(M133)}`,
                                 fmt2(adInput), pct2(adInput,M548), pctI(adInput)],
                                ["Adegaon SS Line Loss",
                                 `AdSS Input - Σ 11KV\n=${fmt2(adInput)}-${fmt2(adg11Total)}`,
                                 fmt2(adSSLoss), pct2(adSSLoss,adInput), pctI(adSSLoss)],
                                [{ content:"Adegaon SS Total Input", colSpan:2, styles:{fontStyle:"bold",fillColor:[240,253,244],textColor:[21,128,61]} },
                                 { content:`${fmt2(adg11Total+adSSLoss)} = BS548 ✓`, styles:{fontStyle:"bold",fillColor:[240,253,244],textColor:[21,128,61],halign:"right"} },
                                 "",""],
                                ["Adegaon→Madhi Line Loss",
                                 `BS133-BS543\n=${fmt2(M133)}-${fmt2(M543)}`,
                                 fmt2(lineLoss), pct2(lineLoss,M133), pctI(lineLoss)],
                                ["Madhi SS T&D Loss",
                                 `BS543-Σ 11KV\n=${fmt2(M543)}-${fmt2(madhiTotal)}`,
                                 fmt2(madhiLoss), pct2(madhiLoss,M543), pctI(madhiLoss)],
                                [{ content:"Madhi SS Total Input", colSpan:2, styles:{fontStyle:"bold",fillColor:[240,253,244],textColor:[21,128,61]} },
                                 { content:`${fmt2(madhiTotal+madhiLoss)} = BS543 ✓`, styles:{fontStyle:"bold",fillColor:[240,253,244],textColor:[21,128,61],halign:"right"} },
                                 "",""],
                                [{ content:"TOTAL LOSSES", colSpan:2, styles:{fontStyle:"bold",fillColor:[254,242,242]} },
                                 { content:fmt2(totalLoss), styles:{fontStyle:"bold",fillColor:[254,242,242],halign:"right"} },
                                 "",
                                 { content:pctI(totalLoss), styles:{fontStyle:"bold",fillColor:[254,242,242],halign:"center"} }]
                            ],
                            theme: "grid",
                            headStyles: { fillColor:[180,83,9], textColor:255, fontSize:7, fontStyle:"bold", halign:"center" },
                            bodyStyles: { fontSize:7 },
                            columnStyles: { 2:{halign:"right"}, 3:{halign:"center"}, 4:{halign:"center",fontStyle:"bold"} }
                        });
                        nextY = doc.lastAutoTable.finalY + 8;

                        // Page break if needed
                        if (nextY > 170) { doc.addPage(); nextY = 14; }

                        doc.setFontSize(9); doc.setTextColor(157,23,77); doc.setFont(undefined, "bold");
                        doc.text("विस्तृत Reading विवरण (Detail)", 8, nextY);
                        nextY += 4;
                    }

                    doc.autoTable({
                        startY: nextY,
                        margin: { left: 5, right: 5 },
                        tableWidth: "auto",
                        head: [config.headers],
                        body: rows.length ? rows.map(config.rowMapper) : [config.headers.map((_, i) => i === 0 ? "No records found" : "-")],
                        theme: "striped",
                        headStyles: { fillColor: config.color, textColor: 255, halign: "center", fontSize: 7, fontStyle: "bold" },
                        bodyStyles: { fontSize: 7 },
                        styles: { halign: "center", overflow: "linebreak", cellWidth: "wrap" }
                    });

                    const totalPages = doc.internal.getNumberOfPages();
                    for (let i = 1; i <= totalPages; i++) {
                        doc.setPage(i);
                        doc.setFontSize(7);
                        doc.setTextColor(150);
                        doc.text(`Page ${i} of ${totalPages}  |  ${config.title}`, 148.5, 205, { align: "center" });
                    }

                    const filename = `${config.filename}_${(fromDate || "all").replace(/-/g,"")}_${(toDate || "all").replace(/-/g,"")}.pdf`;
                    doc.save(filename);
                    showToast("PDF Downloaded!", true);
                } catch (_) {
                    showToast("PDF generate karne mein error aaya", false);
                }
            }
        }


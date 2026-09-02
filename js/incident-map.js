        // ===== Admin Dashboard: घटना मैप (Incident Map) — Leaflet + OpenStreetMap =====
        // Broken Pole / बिजली चोरी / DTR Health teeno modules ki GPS-tagged entries ek
        // hi map par pin ke roop me dikhata hai (currently selected admin date-range).
        // Leaflet vendored locally hai (js/vendor/leaflet.min.js) — sirf map-tile images
        // (OpenStreetMap) live network se aati hain, isliye _headers CSP me un tile
        // domains ko explicitly allow kiya gaya hai.
        const INCIDENT_MAP_COLORS_ = { broken_pole: "#b45309", bijli_chori: "#dc2626", dtr_health: "#7c3aed" };
        const INCIDENT_MAP_LABELS_ = { broken_pole: "टूटा खंभा", bijli_chori: "बिजली चोरी", dtr_health: "DTR समस्या" };
        let incidentMapInstance_ = null;

        function admIncidentMapPoints_(storeName, entries) {
            if (storeName === "bijli_chori") {
                // GPS har entry par nahi, uske photos[] me hoti hai — pehli valid-GPS
                // photo ko us entry ki location maan lete hain.
                return entries.map((e) => {
                    const photo = (e.photos || []).find((p) => isValidLatLon_(p.gps_latitude, p.gps_longitude));
                    if (!photo) return null;
                    return {
                        lat: Number(photo.gps_latitude), lon: Number(photo.gps_longitude),
                        dateStr: e.date || "", title: e.name || e.ivrs || "Entry", subtitle: e.remark || "",
                        entry: e
                    };
                }).filter(Boolean);
            }
            const titleField = storeName === "broken_pole" ? "remark1" : "dtr_no";
            const subtitleField = storeName === "broken_pole" ? "remark2" : "issue_type";
            return entries
                .filter((e) => isValidLatLon_(e.gps_latitude, e.gps_longitude))
                .map((e) => ({
                    lat: Number(e.gps_latitude), lon: Number(e.gps_longitude),
                    dateStr: e.date || "", title: e[titleField] || "Entry", subtitle: e[subtitleField] || "",
                    entry: e
                }));
        }

        async function admOpenIncidentMap_() {
            const fromKey = document.getElementById("admin-from-date")?.value || "";
            const toKey = document.getElementById("admin-to-date")?.value || "";

            const existing = document.getElementById("incident-map-overlay");
            if (existing) existing.remove();

            const overlay = document.createElement("div");
            overlay.id = "incident-map-overlay";
            overlay.style.cssText = "position:fixed; inset:0; background:#0b1220; z-index:9999; display:flex; flex-direction:column;";

            overlay.innerHTML = trustedHtml_(`
                <div style="background:linear-gradient(135deg,#1e3a5f,#0f172a); color:#fff; padding:12px 14px; display:flex; align-items:center; gap:10px; flex-shrink:0;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8" style="flex-shrink:0;"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>
                    <div style="flex:1; min-width:0;">
                        <div style="font-size:13px; font-weight:900; text-transform:uppercase;">घटना मैप</div>
                        <div id="incident-map-period" style="font-size:10px; font-weight:700; opacity:0.75;"></div>
                    </div>
                    <button id="incident-map-close-btn" style="border:none; background:rgba(255,255,255,0.15); color:#fff; width:34px; height:34px; border-radius:10px; font-size:16px; font-weight:900;">✕</button>
                </div>
                <div id="incident-map-canvas" style="flex:1; min-height:0; background:#e2e8f0;"></div>
                <div id="incident-map-legend" style="display:flex; gap:12px; justify-content:center; flex-wrap:wrap; padding:10px 14px; background:#111827; flex-shrink:0;"></div>
            `);
            document.body.appendChild(overlay);
            document.getElementById("incident-map-close-btn").onclick = () => {
                if (incidentMapInstance_) { try { incidentMapInstance_.remove(); } catch (_) {} incidentMapInstance_ = null; }
                overlay.remove();
            };

            const canvas = document.getElementById("incident-map-canvas");
            canvas.innerHTML = `<div style="display:flex; align-items:center; justify-content:center; height:100%; font-size:12px; font-weight:800; color:#64748b;">मैप लोड हो रहा है...</div>`;

            try {
                const [bpAll, bcAll, dtrAll] = await Promise.all([
                    getBrokenPoleEntries_("force"),
                    getBijliChoriEntries_("force"),
                    getDtrHealthEntries_("force")
                ]);
                const bpInRange = bpAll.filter((e) => admInRange_(admDateKey_(e.date), fromKey, toKey));
                const bcInRange = bcAll.filter((e) => admInRange_(admDateKey_(e.date), fromKey, toKey));
                const dtrInRange = dtrAll.filter((e) => admInRange_(admDateKey_(e.date), fromKey, toKey));

                const points = [
                    ...admIncidentMapPoints_("broken_pole", bpInRange).map((p) => ({ ...p, storeName: "broken_pole" })),
                    ...admIncidentMapPoints_("bijli_chori", bcInRange).map((p) => ({ ...p, storeName: "bijli_chori" })),
                    ...admIncidentMapPoints_("dtr_health", dtrInRange).map((p) => ({ ...p, storeName: "dtr_health" }))
                ];

                const periodNode = document.getElementById("incident-map-period");
                if (periodNode) periodNode.innerText = `${fromKey || "…"} से ${toKey || "…"} तक — ${points.length} GPS-tagged घटना(एं)`;

                const legend = document.getElementById("incident-map-legend");
                if (legend) {
                    legend.innerHTML = trustedHtml_(Object.keys(INCIDENT_MAP_COLORS_).map((k) => {
                        const count = points.filter((p) => p.storeName === k).length;
                        return `<span style="display:flex; align-items:center; gap:6px; font-size:10.5px; font-weight:800; color:#e2e8f0;"><span style="width:10px; height:10px; border-radius:50%; background:${INCIDENT_MAP_COLORS_[k]}; display:inline-block; box-shadow:0 0 0 2px #111827;"></span>${escapeHtml(INCIDENT_MAP_LABELS_[k])} (${count})</span>`;
                    }).join(""));
                }

                await ensureLeaflet_();
                if (!document.getElementById("incident-map-canvas")) return; // overlay band ho chuki (user turant close kar chuka)

                canvas.innerHTML = "";
                // Adegaon/Lakhnadon area ka fallback center — koi bhi valid GPS point na
                // mile tab hi istemal hota hai, warna sabhi points par auto-fit hota hai.
                const map = L.map("incident-map-canvas").setView([22.617, 79.600], 12);
                incidentMapInstance_ = map;
                L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                    attribution: "&copy; OpenStreetMap contributors",
                    maxZoom: 19
                }).addTo(map);

                if (points.length) {
                    const markers = points.map((p) => {
                        const uidJs = mcJsEscape_(getEntryUid_(p.entry));
                        // Popup HTML Leaflet ke andar seedhe innerHTML ban jaata hai (no-unsanitized
                        // isse trace nahi kar pata) — isliye har dynamic field manually escapeHtml()
                        // se guzara hai, bilkul entry-list-shared.js jaisa hi.
                        const popupHtml = `
                            <div style="font-family:inherit; min-width:160px;">
                                <div style="font-size:11px; font-weight:900; color:#1e293b;">${escapeHtml(INCIDENT_MAP_LABELS_[p.storeName])} — ${escapeHtml(p.dateStr)}</div>
                                <div style="font-size:11px; font-weight:700; color:#334155; margin:4px 0;">${escapeHtml(p.title)}</div>
                                ${p.subtitle ? `<div style="font-size:10px; font-weight:600; color:#64748b; margin-bottom:6px;">${escapeHtml(p.subtitle)}</div>` : ""}
                                <button onclick="viewEntryDetail_('${escapeHtml(p.storeName)}','${uidJs}')" style="border:none; background:#e0f2fe; color:#075985; border-radius:8px; padding:5px 9px; font-size:10px; font-weight:900; text-transform:uppercase; cursor:pointer;">देखें</button>
                            </div>`;
                        return L.circleMarker([p.lat, p.lon], {
                            radius: 8, color: "#fff", weight: 2, fillColor: INCIDENT_MAP_COLORS_[p.storeName], fillOpacity: 0.95
                        }).addTo(map).bindPopup(trustedHtml_(popupHtml));
                    });
                    const group = L.featureGroup(markers);
                    map.fitBounds(group.getBounds().pad(0.2), { maxZoom: 15 });
                } else {
                    canvas.style.position = "relative";
                    canvas.insertAdjacentHTML("beforeend", `<div style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); background:rgba(17,24,39,0.85); color:#fff; padding:10px 16px; border-radius:12px; font-size:12px; font-weight:800; z-index:500;">इस अवधि में कोई GPS-tagged घटना नहीं मिली</div>`);
                }
                setTimeout(() => map.invalidateSize(), 100);
            } catch (err) {
                canvas.innerHTML = `<div style="display:flex; align-items:center; justify-content:center; height:100%; font-size:12px; font-weight:800; color:#b91c1c; text-align:center; padding:20px;">मैप लोड करने में error आया, दोबारा try करें</div>`;
            }
        }

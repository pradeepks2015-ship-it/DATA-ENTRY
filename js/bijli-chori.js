        // ===== Bijli Chori Ki Jankari feature =====

        let bcPhotoSlots = [null, null]; // each: { name, photoData, geo } or null
        const bcDefaultPhotoNames = ["Photo 1 - Site / Evidence", "Photo 2 - Site / Evidence"];

        function renderBcPhotoSlots() {
            const container = document.getElementById("bc-photo-slots");
            if (!container) return;
            container.innerHTML = bcPhotoSlots.map((slot, idx) => `
                <div style="border:1.6px solid #fecaca; border-radius:14px; padding:10px 12px; margin-bottom:10px; background:#fff5f5;">
                    <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
                        <label for="bc-photo-${idx}" style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:0.78rem; font-weight:900; color:#991b1b; text-transform:uppercase;">
                            <div style="width:32px; height:32px; border-radius:50%; background:linear-gradient(135deg,#ef4444,#7f1d1d); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                                <svg width="16" height="16" fill="none" stroke="white" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 8.5A2.5 2.5 0 0 1 5.5 6H8l1.3-1.6A2 2 0 0 1 10.86 4h2.28a2 2 0 0 1 1.56.74L16 6h2.5A2.5 2.5 0 0 1 21 8.5v8A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5z"></path><circle cx="12" cy="12.5" r="3.5"></circle></svg>
                            </div>
                            ${slot ? "Photo " + (idx + 1) + " (Tap to change)" : "Add Photo " + (idx + 1)}
                        </label>
                        ${slot ? `<button type="button" onclick="removeBcPhoto(${idx})" style="border:none; background:#fee2e2; color:#b91c1c; border-radius:999px; padding:6px 10px; font-size:0.66rem; font-weight:900; text-transform:uppercase;">Remove</button>` : ""}
                    </div>
                    <input type="file" id="bc-photo-${idx}" accept="image/*" capture="environment" style="display:none;" onchange="handleBcPhotoChange(${idx})">
                    ${slot ? `
                        <div style="margin-top:8px;">
                            <img src="${slot.photoData}" alt="चुनी गई फोटो" style="width:100%; max-height:140px; object-fit:cover; border-radius:10px; border:1px solid #fecaca;">
                            <input type="text" value="${escapeHtml(slot.name || "")}" placeholder="Photo Name (e.g. Site Photo, Evidence)" oninput="updateBcPhotoName(${idx}, this.value)" style="width:100%; margin-top:8px; height:40px; border-radius:10px; border:1.5px solid #fecaca; padding:0 10px; font-size:0.8rem; font-weight:700; color:#7f1d1d; background:#ffffff; outline:none;">
                            <div class="photo-meta-box" style="display:block; margin-top:8px;">
                                <div class="photo-meta-row"><strong>Lat-Long:</strong> ${slot.geo ? `${slot.geo.latitude}, ${slot.geo.longitude}` : "Not captured"}</div>
                                <div class="photo-meta-row"><strong>Location:</strong> ${slot.geo ? escapeHtml(slot.geo.locationText || "GPS location captured") : "Not captured"}</div>
                                ${slot.geo && isValidLatLon_(slot.geo.latitude, slot.geo.longitude) ? `
                                    <div style="margin-top:8px;">
                                        <a href="https://www.google.com/maps/dir/?api=1&destination=${slot.geo.latitude},${slot.geo.longitude}" target="_blank" rel="noopener" style="display:inline-flex; align-items:center; gap:6px; background:linear-gradient(135deg,#16a34a,#15803d); color:#fff; font-size:11px; font-weight:900; text-transform:uppercase; padding:8px 14px; border-radius:10px; text-decoration:none; box-shadow:0 4px 10px rgba(21,128,61,0.25);">
                                            <svg width="14" height="14" fill="white" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>
                                            Get Directions (Google Maps)
                                        </a>
                                    </div>
                                ` : ""}
                            </div>
                        </div>
                    ` : ""}
                </div>
            `).join("");
        }

        async function handleBcPhotoChange(idx) {
            const input = document.getElementById(`bc-photo-${idx}`);
            if (!input.files || !input.files[0]) return;
            try {
                const photoData = await resizeImageForUpload(input.files[0]);
                bcPhotoSlots[idx] = {
                    name: bcPhotoSlots[idx]?.name || bcDefaultPhotoNames[idx] || "",
                    photoData,
                    geo: {
                        latitude: "Fetching...",
                        longitude: "Fetching...",
                        locationText: "GPS location detect ki ja rahi hai"
                    }
                };
                renderBcPhotoSlots();

                try {
                    const position = await getCurrentPositionAsync();
                    const latitude = position.coords.latitude.toFixed(6);
                    const longitude = position.coords.longitude.toFixed(6);
                    const locationText = await reverseGeocodeLocation(latitude, longitude);
                    if (bcPhotoSlots[idx]) {
                        bcPhotoSlots[idx].geo = { latitude, longitude, locationText };
                        renderBcPhotoSlots();
                    }
                } catch (_) {
                    if (bcPhotoSlots[idx]) {
                        bcPhotoSlots[idx].geo = {
                            latitude: "Available nahi",
                            longitude: "Available nahi",
                            locationText: "GPS permission allow nahi hui ya signal weak tha"
                        };
                        renderBcPhotoSlots();
                    }
                }
            } catch (_) {
                showToast("Photo load karne mein error aaya", false);
            }
        }

        function updateBcPhotoName(idx, value) {
            if (bcPhotoSlots[idx]) {
                bcPhotoSlots[idx].name = value;
            }
        }

        function removeBcPhoto(idx) {
            bcPhotoSlots[idx] = null;
            renderBcPhotoSlots();
        }

        async function getBijliChoriEntries_(mode = "force") {
            return getModuleEntries_("bijli_chori", mode);
        }

        async function saveBijliChoriEntry_(entry) {
            try {
                await idbAdd_("bijli_chori", entry);
                const MAX_BC_ENTRIES = IDB_STORE_LIMITS.bijli_chori;
                const count = await idbCount_("bijli_chori");
                if (count > MAX_BC_ENTRIES) {
                    await idbDeleteOldest_("bijli_chori", count - MAX_BC_ENTRIES);
                    showToast(`Limit ${MAX_BC_ENTRIES} entries hai — sabse purani local entry auto-delete hui (cloud mein safe hai)`, true);
                }
                await checkStoreCapacityWarning_("bijli_chori", "Bijli Chori Ki Jankari");
                return true;
            } catch (_) {
                return false;
            }
        }

        async function submitBijliChoriEntry() {
            const ivrs = document.getElementById("bc-ivrs").value.trim();
            const name = document.getElementById("bc-name").value.trim();
            const remark = document.getElementById("bc-remark").value.trim();
            const photos = bcPhotoSlots.filter(Boolean);

            if (!ivrs && !name) return showToast("IVRS No ya Naam/Sthan darj kariye", false);
            if (!photos.length) return showToast("Kam se kam 1 photo add kariye", false);
            if (!remark) return showToast("Remark darj kariye", false);

            const submitBtn = document.getElementById("bc-submit-btn");
            submitBtn.innerText = "Saving...";
            submitBtn.disabled = true;

            try {
                const entry = {
                    date: getCurrentDateDDMMYYYY(),
                    dateKey: buildFeederDateKey_(getCurrentDateDDMMYYYY()),
                    timestamp: new Date().toISOString(),
                    dc_name: activeDC || "",
                    ivrs,
                    name,
                    remark,
                    photos: photos.map((p) => ({
                        name: p.name || "",
                        photo_data: p.photoData,
                        gps_latitude: p.geo?.latitude || "",
                        gps_longitude: p.geo?.longitude || "",
                        gps_location: p.geo?.locationText || ""
                    })),
                    ...currentEmployeeTag_()
                };

                // Show upload progress since photo uploads are awaited (may take 10-30 sec for 3 photos)
                const photoCount = photos.filter((p) => p.photoData).length;
                if (photoCount > 0) {
                    submitBtn.innerText = `📤 ${photoCount} photo${photoCount > 1 ? "s" : ""} cloud par upload ho rahi hai...`;
                }

                const entryId = await syncEntryToCloud_("bijli_chori", entry);
                if (entryId) {
                    entry.entry_id = entryId;
                } else {
                    showToast(window.__lastSyncQueued ? "Internet nahi hai — entry device par save ho gayi 🔄 Internet aane par apne aap cloud sync ho jayegi" : "Internet/sync error: entry sirf is device par save hui, doosre users ko nahi dikhegi", false);
                }

                submitBtn.innerText = "Device par save ho rahi hai...";

                const saved = await saveBijliChoriEntry_(entry);
                if (!saved) {
                    return showToast("Save karne mein error aaya, dobara try karein", false);
                }

                showToast("Entry Saved! Photos sabhi users ko dikh sakti hain.", true);

                // Reset form
                document.getElementById("bc-ivrs").value = "";
                document.getElementById("bc-name").value = "";
                document.getElementById("bc-remark").value = "";
                bcPhotoSlots = [null, null];
                renderBcPhotoSlots();
                await refreshBijliChoriMisTotal();
                await refreshStorageCounter_("bijli_chori");
                if (document.getElementById("entries-list-bijli_chori")?.style.display !== "none") {
                    await renderEntriesList_("bijli_chori");
                }
            } catch (_) {
                showToast("Save karne mein error aaya", false);
            } finally {
                submitBtn.innerText = "Submit";
                submitBtn.disabled = false;
            }
        }

        async function refreshBijliChoriMisTotal(mode = "force") {
            const fromDate = document.getElementById("bc-mis-from-date")?.value;
            const toDate = document.getElementById("bc-mis-to-date")?.value;
            const totalNode = document.getElementById("bc-mis-total");
            if (!totalNode) return;
            const filtered = await filterBijliChoriEntries_(fromDate, toDate, mode);
            totalNode.innerText = filtered.length;
        }

        async function filterBijliChoriEntries_(fromDate, toDate, mode = "force") {
            const entries = await getBijliChoriEntries_(mode);
            if (!fromDate || !toDate) return entries;
            const fromTs = new Date(fromDate);
            const toTs = new Date(toDate);
            toTs.setHours(23, 59, 59, 999);
            return entries.filter((e) => {
                const parts = String(e.date || "").split(/[-/]/);
                if (parts.length !== 3) return false;
                const d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                return d >= fromTs && d <= toTs;
            });
        }

        async function downloadBijliChoriMisPdf() {
            const fromDate = document.getElementById("bc-mis-from-date").value;
            const toDate = document.getElementById("bc-mis-to-date").value;
            if (!fromDate || !toDate) return showToast("Pehle From aur To date select karein", false);
            if (fromDate > toDate) return showToast("From date, To date se pehle honi chahiye", false);

            const btn = document.getElementById("bc-mis-pdf-btn");
            btn.innerText = "Generating...";
            btn.disabled = true;

            let holder = null;
            try {
                btn.innerText = "PDF library load ho rahi hai...";
                await Promise.all([ensureJsPdf_(), ensureHtml2Canvas_()]);
                btn.innerText = "Generating...";

                const filtered = await filterBijliChoriEntries_(fromDate, toDate);
                await refreshBijliChoriMisTotal();
                await hydratePhotoDataForPdf_(filtered);

                const fmtDate = (iso) => {
                    if (!iso) return "";
                    const [y, m, d] = iso.split("-");
                    return `${d}/${m}/${y}`;
                };

                const { jsPDF } = window.jspdf;
                const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

                // Report ko HTML me banakar image ke roop me PDF me lagate hain —
                // isse Hindi/English dono bilkul screen jaisa saaf render hota hai.
                holder = document.createElement("div");
                holder.style.cssText = "position:fixed; left:-12000px; top:0; width:760px; background:#ffffff; font-family:'Noto Sans Devanagari','Mangal','Nirmala UI',Arial,sans-serif; color:#1e293b;";
                document.body.appendChild(holder);

                const renderBlock = async (innerHtml) => {
                    const el = document.createElement("div");
                    el.style.cssText = "width:760px; background:#ffffff; padding:4px 2px; box-sizing:border-box;";
                    el.innerHTML = innerHtml;
                    holder.appendChild(el);
                    const canvas = await html2canvas(el, { scale: 2, backgroundColor: "#ffffff", logging: false });
                    holder.removeChild(el);
                    return { dataUrl: canvas.toDataURL("image/jpeg", 0.92), wPx: canvas.width, hPx: canvas.height };
                };

                let y = 10;
                const addBlock = (img, gapMm = 3) => {
                    const hMm = img.hPx * (182 / img.wPx);
                    if (y + hMm > 278 && y > 10) { doc.addPage(); y = 10; }
                    doc.addImage(img.dataUrl, "JPEG", 14, y, 182, hMm);
                    y += hMm + gapMm;
                };

                // ----- Header block -----
                const headerHtml = `
                    <div style="background:#dc2626; color:#ffffff; border-radius:8px; padding:16px 12px; text-align:center;">
                        <div style="font-size:24px; font-weight:900; letter-spacing:0.5px;">बिजली चोरी की जानकारी — MIS REPORT</div>
                        <div style="font-size:14px; font-weight:700; margin-top:6px;">DC: ${escapeHtml(activeDC || "-")} &nbsp;|&nbsp; Period: ${fmtDate(fromDate)} to ${fmtDate(toDate)} &nbsp;|&nbsp; v2.5</div>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px; padding:0 2px;">
                        <div style="color:#dc2626; font-weight:900; font-size:16px;">TOTAL ENTRIES: ${filtered.length}</div>
                        <div style="font-size:12px; font-weight:700; color:#64748b;">Generated: ${new Date().toLocaleString("en-IN")}</div>
                    </div>`;
                addBlock(await renderBlock(headerHtml), 4);

                // ----- Table blocks (chunks me, taaki page-break saaf rahe) -----
                const cellTh = "border:1px solid #b91c1c; background:#dc2626; color:#ffffff; padding:7px 5px; font-size:12px; font-weight:900; text-align:center;";
                const cellTd = "border:1px solid #e2e8f0; padding:7px 5px; font-size:12.5px; font-weight:600; text-align:center; vertical-align:top;";
                const theadHtml = `<tr>
                    <th style="${cellTh} width:44px;">S.No.</th>
                    <th style="${cellTh} width:82px;">Date</th>
                    <th style="${cellTh} width:90px;">DC</th>
                    <th style="${cellTh} width:106px;">IVRS/Acc No</th>
                    <th style="${cellTh}">Name/Location</th>
                    <th style="${cellTh}">Remark</th>
                    <th style="${cellTh} width:52px;">Photos</th>
                </tr>`;
                const rowHtml = (e, i) => `<tr style="background:${i % 2 ? "#fef2f2" : "#ffffff"};">
                    <td style="${cellTd}">${i + 1}</td>
                    <td style="${cellTd}">${escapeHtml(e.date || "")}</td>
                    <td style="${cellTd}">${escapeHtml(e.dc_name || "")}</td>
                    <td style="${cellTd}">${escapeHtml(e.ivrs || "")}</td>
                    <td style="${cellTd} text-align:left;">${escapeHtml(e.name || "")}</td>
                    <td style="${cellTd} text-align:left;">${escapeHtml(e.remark || "")}</td>
                    <td style="${cellTd}">${(e.photos || []).length}</td>
                </tr>`;

                if (!filtered.length) {
                    addBlock(await renderBlock(`<table style="width:100%; border-collapse:collapse;"><thead>${theadHtml}</thead><tbody><tr><td colspan="7" style="${cellTd} padding:14px;">No entries found</td></tr></tbody></table>`));
                } else {
                    const CHUNK = 12;
                    for (let s = 0; s < filtered.length; s += CHUNK) {
                        const rows = filtered.slice(s, s + CHUNK).map((e, k) => rowHtml(e, s + k)).join("");
                        addBlock(await renderBlock(`<table style="width:100%; border-collapse:collapse;"><thead>${theadHtml}</thead><tbody>${rows}</tbody></table>`), 2);
                    }
                }

                // ----- Photo blocks -----
                for (let i = 0; i < filtered.length; i++) {
                    const e = filtered[i];
                    const photos = e.photos || [];
                    for (let pIdx = 0; pIdx < photos.length; pIdx++) {
                        const p = photos[pIdx];
                        if (!p.photo_data) continue;
                        const gpsLine = (p.gps_latitude && p.gps_longitude) ? `${escapeHtml(String(p.gps_latitude))}, ${escapeHtml(String(p.gps_longitude))}` : "N/A";
                        const photoHtml = `
                            <div style="border:1.5px solid #fecaca; border-radius:10px; padding:10px; background:#fffbfb;">
                                <div style="font-size:14px; font-weight:900; color:#1e293b; margin-bottom:8px;">Entry ${i + 1} — ${escapeHtml(e.date || "")} — ${escapeHtml(e.name || e.ivrs || "")} — ${escapeHtml(p.name || ("Photo " + (pIdx + 1)))}</div>
                                <div style="display:flex; gap:12px; align-items:flex-start;">
                                    <img src="${p.photo_data}" alt="अपलोड की गई फोटो" style="width:330px; height:248px; object-fit:cover; border-radius:8px; border:1px solid #e2e8f0; flex-shrink:0;">
                                    <div style="font-size:13px; font-weight:700; color:#475569; line-height:1.7;">
                                        <div><span style="color:#1e293b; font-weight:900;">GPS:</span> ${gpsLine}</div>
                                        <div style="margin-top:4px;"><span style="color:#1e293b; font-weight:900;">Location:</span> ${escapeHtml(p.gps_location || "N/A")}</div>
                                    </div>
                                </div>
                            </div>`;
                        addBlock(await renderBlock(photoHtml), 1);
                        if (isValidLatLon_(p.gps_latitude, p.gps_longitude)) {
                            if (y > 274) { doc.addPage(); y = 10; }
                            const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${p.gps_latitude},${p.gps_longitude}`;
                            doc.setFontSize(9);
                            doc.setTextColor(21, 128, 61);
                            doc.setFont(undefined, "bold");
                            doc.text("Open Map (Directions)", 15, y + 2);
                            doc.link(15, y - 1.5, 48, 5.5, { url: mapsUrl });
                            y += 8;
                        }
                    }
                }

                holder.remove();
                holder = null;

                const totalPages = doc.internal.getNumberOfPages();
                for (let i = 1; i <= totalPages; i++) {
                    doc.setPage(i);
                    doc.setFontSize(7);
                    doc.setTextColor(150);
                    doc.text(`Page ${i} of ${totalPages}  |  Bijli Chori Ki Jankari MIS Report`, 105, 290, { align: "center" });
                }

                const filename = `Bijli_Chori_MIS_${fmtDate(fromDate).replace(/\//g,"-")}_to_${fmtDate(toDate).replace(/\//g,"-")}.pdf`;
                doc.save(filename);
                showToast("PDF Downloaded!", true);
            } catch (_) {
                showToast("Report generate karne mein error aaya", false);
            } finally {
                if (holder) { try { holder.remove(); } catch (_) {} }
                btn.innerHTML = '<svg width="16" height="16" fill="white" viewBox="0 0 24 24"><path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm10 5.5h1v-3h-1v3z"/></svg> Download PDF MIS Report';
                btn.disabled = false;
            }
        }



        // ===== Broken Pole / Damage Line feature =====
        function updateBpPhotoMetaUI() {
            const metaBox = document.getElementById("bp-photo-meta");
            const latLongNode = document.getElementById("bp-photo-latlong");
            const locationNode = document.getElementById("bp-photo-location");
            const directionsNode = document.getElementById("bp-photo-directions");
            if (!metaBox || !latLongNode || !locationNode) return;
            if (!bpGeoData) {
                metaBox.style.display = "none";
                latLongNode.innerHTML = "<strong>Lat-Long:</strong> Not captured";
                locationNode.innerHTML = "<strong>Location:</strong> Not captured";
                if (directionsNode) directionsNode.innerHTML = "";
                return;
            }
            metaBox.style.display = "block";
            latLongNode.innerHTML = `<strong>Lat-Long:</strong> ${bpGeoData.latitude}, ${bpGeoData.longitude}`;
            locationNode.innerHTML = `<strong>Location:</strong> ${bpGeoData.locationText || "GPS location captured"}`;
            if (directionsNode) {
                const lat = bpGeoData.latitude;
                const lon = bpGeoData.longitude;
                const isValidCoord = /^-?\d+(\.\d+)?$/.test(String(lat)) && /^-?\d+(\.\d+)?$/.test(String(lon));
                if (isValidCoord) {
                    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
                    directionsNode.innerHTML = `<a href="${mapsUrl}" target="_blank" rel="noopener" style="display:inline-flex; align-items:center; gap:6px; background:linear-gradient(135deg,#16a34a,#15803d); color:#fff; font-size:11px; font-weight:900; text-transform:uppercase; padding:8px 14px; border-radius:10px; text-decoration:none; box-shadow:0 4px 10px rgba(21,128,61,0.25);">
                        <svg width="14" height="14" fill="white" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>
                        Get Directions (Google Maps)
                    </a>`;
                } else {
                    directionsNode.innerHTML = "";
                }
            }
        }

        async function captureBpGeoLocation() {
            try {
                bpGeoData = {
                    latitude: "Fetching...",
                    longitude: "Fetching...",
                    locationText: "GPS location detect ki ja rahi hai"
                };
                updateBpPhotoMetaUI();
                const position = await getCurrentPositionAsync();
                const latitude = position.coords.latitude.toFixed(6);
                const longitude = position.coords.longitude.toFixed(6);
                const locationText = await reverseGeocodeLocation(latitude, longitude);
                bpGeoData = { latitude, longitude, locationText };
                updateBpPhotoMetaUI();
            } catch (_) {
                bpGeoData = {
                    latitude: "Available nahi",
                    longitude: "Available nahi",
                    locationText: "GPS permission allow nahi hui ya signal weak tha"
                };
                updateBpPhotoMetaUI();
            }
        }

        async function updateBrokenPolePhoto() {
            const input = document.getElementById("bp-photo");
            const label = document.getElementById("bp-photo-name");
            const previewWrap = document.getElementById("bp-photo-preview-wrap");
            const previewImg = document.getElementById("bp-photo-preview");
            label.innerText = input.files && input.files[0] ? input.files[0].name : "No photo selected";
            if (input.files && input.files[0]) {
                // Show photo preview immediately
                try {
                    const reader = new FileReader();
                    reader.onload = () => {
                        previewImg.src = reader.result;
                        previewWrap.style.display = "block";
                    };
                    reader.readAsDataURL(input.files[0]);
                } catch (_) {}
                await captureBpGeoLocation();
            } else {
                previewWrap.style.display = "none";
                previewImg.src = "";
                bpGeoData = null;
                updateBpPhotoMetaUI();
            }
        }

        async function getBrokenPoleEntries_() {
            const rows = await idbGetAll_("broken_pole");
            const local = rows.slice().sort((a, b) => (a.id || 0) - (b.id || 0));
            const shared = await fetchSharedEntries_("broken_pole");
            return mergeLocalAndSharedEntries_(local, shared);
        }

        async function saveBrokenPoleEntry_(entry) {
            try {
                await idbAdd_("broken_pole", entry);
                const MAX_BP_ENTRIES = IDB_STORE_LIMITS.broken_pole;
                const count = await idbCount_("broken_pole");
                if (count > MAX_BP_ENTRIES) {
                    await idbDeleteOldest_("broken_pole", count - MAX_BP_ENTRIES);
                    showToast(`Limit ${MAX_BP_ENTRIES} entries hai — sabse purani local entry auto-delete hui (cloud mein safe hai)`, true);
                }
                await checkStoreCapacityWarning_("broken_pole", "Broken Pole");
                return true;
            } catch (_) {
                return false;
            }
        }

        async function submitBrokenPoleEntry() {
            const photoInput = document.getElementById("bp-photo");
            const remark1 = document.getElementById("bp-remark1").value.trim();
            const remark2 = document.getElementById("bp-remark2").value.trim();

            if (!photoInput.files || !photoInput.files[0]) return showToast("Photo select kariye", false);
            if (!remark1) return showToast("Remark 1 darj kariye", false);

            const submitBtn = document.getElementById("bp-submit-btn");
            submitBtn.innerText = "Saving...";
            submitBtn.disabled = true;

            try {
                const photoFile = photoInput.files[0];
                const photoData = await resizeImageForUpload(photoFile, 900, 0.6);

                const entry = {
                    date: getCurrentDateDDMMYYYY(),
                    timestamp: new Date().toISOString(),
                    dc_name: activeDC || "",
                    remark1,
                    remark2,
                    gps_latitude: bpGeoData?.latitude || "",
                    gps_longitude: bpGeoData?.longitude || "",
                    gps_location: bpGeoData?.locationText || "",
                    photo_name: photoFile.name || "",
                    photo_data: photoData
                };

                const entryId = await syncEntryToCloud_("broken_pole", entry);
                if (entryId) {
                    entry.entry_id = entryId;
                } else {
                    showToast(window.__lastSyncQueued ? "Internet nahi hai — entry device par save ho gayi 🔄 Internet aane par apne aap cloud sync ho jayegi" : "Internet/sync error: entry sirf is device par save hui, doosre users ko nahi dikhegi", false);
                }

                const saved = await saveBrokenPoleEntry_(entry);
                if (!saved) {
                    return showToast("Save karne mein error aaya, dobara try karein", false);
                }

                showToast("Entry Saved Successfully!", true);

                // Reset form
                document.getElementById("bp-photo").value = "";
                document.getElementById("bp-photo-name").innerText = "No photo selected";
                document.getElementById("bp-photo-preview-wrap").style.display = "none";
                document.getElementById("bp-photo-preview").src = "";
                document.getElementById("bp-remark1").value = "";
                document.getElementById("bp-remark2").value = "";
                bpGeoData = null;
                updateBpPhotoMetaUI();
                await refreshBrokenPoleMisTotal();
                await refreshStorageCounter_("broken_pole");
                if (document.getElementById("entries-list-broken_pole")?.style.display !== "none") {
                    await renderEntriesList_("broken_pole");
                }
            } catch (err) {
                showToast("Save error: " + (err && err.message ? err.message : String(err)), false);
            } finally {
                submitBtn.innerText = "✅ Submit Entry (Add Another Photo After)";
                submitBtn.disabled = false;
            }
        }

        function isValidLatLon_(lat, lon) {
            return /^-?\d+(\.\d+)?$/.test(String(lat)) && /^-?\d+(\.\d+)?$/.test(String(lon));
        }

        async function refreshBrokenPoleMisTotal() {
            const fromDate = document.getElementById("bp-mis-from-date")?.value;
            const toDate = document.getElementById("bp-mis-to-date")?.value;
            const totalNode = document.getElementById("bp-mis-total");
            if (!totalNode) return;
            const filtered = await filterBrokenPoleEntries_(fromDate, toDate);
            totalNode.innerText = filtered.length;
        }

        async function filterBrokenPoleEntries_(fromDate, toDate) {
            const entries = await getBrokenPoleEntries_();
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

        async function downloadBrokenPoleMisPdf() {
            const fromDate = document.getElementById("bp-mis-from-date").value;
            const toDate = document.getElementById("bp-mis-to-date").value;
            if (!fromDate || !toDate) return showToast("Pehle From aur To date select karein", false);
            if (fromDate > toDate) return showToast("From date, To date se pehle honi chahiye", false);

            const btn = document.getElementById("bp-mis-pdf-btn");
            btn.innerText = "Generating...";
            btn.disabled = true;

            try {
                const filtered = await filterBrokenPoleEntries_(fromDate, toDate);
                await refreshBrokenPoleMisTotal();
                await hydratePhotoDataForPdf_(filtered);

                const fmtDate = (iso) => {
                    if (!iso) return "";
                    const [y, m, d] = iso.split("-");
                    return `${d}/${m}/${y}`;
                };

                const { jsPDF } = window.jspdf;
                const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

                // Header
                doc.setFillColor(180, 83, 9);
                doc.rect(0, 0, 210, 22, "F");
                doc.setFontSize(13);
                doc.setTextColor(255, 255, 255);
                doc.setFont(undefined, "bold");
                doc.text("BROKEN POLE / DAMAGE LINE MIS REPORT", 105, 10, { align: "center" });
                doc.setFontSize(8);
                doc.setFont(undefined, "normal");
                doc.text(`DC: ${activeDC || "-"}  |  Period: ${fmtDate(fromDate)} to ${fmtDate(toDate)}`, 105, 17, { align: "center" });

                doc.setTextColor(100);
                doc.setFontSize(7);
                doc.text(`Generated: ${new Date().toLocaleString("en-IN")}`, 200, 26, { align: "right" });

                doc.setFontSize(10);
                doc.setTextColor(180, 83, 9);
                doc.setFont(undefined, "bold");
                doc.text(`TOTAL ENTRIES: ${filtered.length}`, 14, 32);

                const PHOTO_CELL_W = 32;
                const PHOTO_CELL_H = 32;

                const detailBody = filtered.map((e, i) => [
                    i + 1,
                    "", // photo placeholder, drawn via didDrawCell
                    e.date || "",
                    e.remark1 || "",
                    e.remark2 || "",
                    (e.gps_latitude && e.gps_longitude) ? `${e.gps_latitude}, ${e.gps_longitude}` : "N/A",
                    e.gps_location || "",
                    isValidLatLon_(e.gps_latitude, e.gps_longitude) ? "Open Map" : "N/A"
                ]);

                doc.autoTable({
                    startY: 38,
                    margin: { left: 5, right: 5 },
                    tableWidth: "auto",
                    head: [["S.No.", "Photo", "Date", "Remark 1", "Remark 2", "GPS Coordinates", "Location", "Directions"]],
                    body: detailBody.length ? detailBody : [["-", "-", "-", "No entries found", "-", "-", "-", "-"]],
                    theme: "striped",
                    headStyles: { fillColor: [180, 83, 9], textColor: 255, halign: "center", fontSize: 7, fontStyle: "bold" },
                    bodyStyles: { fontSize: 7, valign: "middle", overflow: "linebreak" },
                    styles: { cellWidth: "wrap" },
                    columnStyles: {
                        0: { halign: "center", cellWidth: 9 },
                        1: { halign: "center", cellWidth: PHOTO_CELL_W + 2 },
                        2: { halign: "center", cellWidth: 18 },
                        3: { halign: "left", cellWidth: 26 },
                        4: { halign: "left", cellWidth: 26 },
                        5: { halign: "center", cellWidth: 28 },
                        6: { halign: "left", cellWidth: 30 },
                        7: { halign: "center", cellWidth: 16, textColor: [21, 128, 61], fontStyle: "bold" }
                    },
                    didParseCell: (data) => {
                        // Give the photo row extra height so the image fits
                        if (data.section === "body" && data.column.index === 1 && filtered.length) {
                            const e = filtered[data.row.index];
                            if (e && e.photo_data) {
                                data.cell.styles.minCellHeight = PHOTO_CELL_H + 4;
                            }
                        }
                    },
                    didDrawCell: (data) => {
                        if (data.section === "body" && filtered.length) {
                            const e = filtered[data.row.index];
                            if (data.column.index === 1 && e && e.photo_data) {
                                try {
                                    const x = data.cell.x + (data.cell.width - PHOTO_CELL_W) / 2;
                                    const y = data.cell.y + 2;
                                    doc.addImage(e.photo_data, "JPEG", x, y, PHOTO_CELL_W, PHOTO_CELL_H);
                                } catch (_) {}
                            }
                            if (data.column.index === 7 && e && isValidLatLon_(e.gps_latitude, e.gps_longitude)) {
                                const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${e.gps_latitude},${e.gps_longitude}`;
                                doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url: mapsUrl });
                            }
                        }
                    }
                });

                // Footnote with directions links (table "Directions" column also has clickable links)
                if (filtered.some((e) => isValidLatLon_(e.gps_latitude, e.gps_longitude))) {
                    let noteY = doc.lastAutoTable.finalY + 6;
                    if (noteY > 280) {
                        doc.addPage();
                        noteY = 14;
                    }
                    doc.setFontSize(7);
                    doc.setTextColor(100);
                    doc.setFont(undefined, "italic");
                    doc.text(`Tip: Tap "Open Map" in the Directions column to navigate to the exact location.`, 14, noteY);
                }

                const totalPages = doc.internal.getNumberOfPages();
                for (let i = 1; i <= totalPages; i++) {
                    doc.setPage(i);
                    doc.setFontSize(7);
                    doc.setTextColor(150);
                    doc.text(`Page ${i} of ${totalPages}  |  Broken Pole / Damage Line MIS Report`, 105, 290, { align: "center" });
                }

                const filename = `Broken_Pole_MIS_${fmtDate(fromDate).replace(/\//g,"-")}_to_${fmtDate(toDate).replace(/\//g,"-")}.pdf`;
                doc.save(filename);
                showToast("PDF Downloaded!", true);
            } catch (_) {
                showToast("Report generate karne mein error aaya", false);
            } finally {
                btn.innerHTML = '<svg width="16" height="16" fill="white" viewBox="0 0 24 24"><path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm10 5.5h1v-3h-1v3z"/></svg> Download PDF MIS Report';
                btn.disabled = false;
            }
        }


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
                            <img src="${slot.photoData}" style="width:100%; max-height:140px; object-fit:cover; border-radius:10px; border:1px solid #fecaca;">
                            <input type="text" value="${escapeHtml(slot.name || "")}" placeholder="Photo Name (e.g. Site Photo, Evidence)" oninput="updateBcPhotoName(${idx}, this.value)" style="width:100%; margin-top:8px; height:40px; border-radius:10px; border:1.5px solid #fecaca; padding:0 10px; font-size:0.8rem; font-weight:700; color:#7f1d1d; background:#ffffff; outline:none;">
                            <div class="photo-meta-box" style="display:block; margin-top:8px;">
                                <div class="photo-meta-row"><strong>Lat-Long:</strong> ${slot.geo ? `${slot.geo.latitude}, ${slot.geo.longitude}` : "Not captured"}</div>
                                <div class="photo-meta-row"><strong>Location:</strong> ${slot.geo ? (slot.geo.locationText || "GPS location captured") : "Not captured"}</div>
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

        async function getBijliChoriEntries_() {
            const rows = await idbGetAll_("bijli_chori");
            const local = rows.slice().sort((a, b) => (a.id || 0) - (b.id || 0));
            const shared = await fetchSharedEntries_("bijli_chori");
            return mergeLocalAndSharedEntries_(local, shared);
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
                    }))
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

        async function refreshBijliChoriMisTotal() {
            const fromDate = document.getElementById("bc-mis-from-date")?.value;
            const toDate = document.getElementById("bc-mis-to-date")?.value;
            const totalNode = document.getElementById("bc-mis-total");
            if (!totalNode) return;
            const filtered = await filterBijliChoriEntries_(fromDate, toDate);
            totalNode.innerText = filtered.length;
        }

        async function filterBijliChoriEntries_(fromDate, toDate) {
            const entries = await getBijliChoriEntries_();
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
                if (typeof html2canvas === "undefined") {
                    showToast("PDF library load nahi hui — internet check karke dobara try karein", false);
                    return;
                }
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
                                    <img src="${p.photo_data}" style="width:330px; height:248px; object-fit:cover; border-radius:8px; border:1px solid #e2e8f0; flex-shrink:0;">
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


        // ===== Generic Saved Entries List / View / Delete (all photo-store tabs) =====
        const ENTRY_STORE_CONFIG = {
            broken_pole: {
                label: "Broken Pole / Damage Line",
                accent: "#b45309",
                getEntries: getBrokenPoleEntries_,
                getThumb: (e) => e.photo_data || normalizeDrivePhotoUrl_(e.photo_url) || "",
                getTitle: (e) => `${e.date || ""} — ${e.remark1 || "Entry"}`,
                getSubtitle: (e) => e.remark2 || (e.gps_location || ""),
                refreshFn: () => refreshBrokenPoleMisTotal()
            },
            bijli_chori: {
                label: "बिजली चोरी की जानकारी",
                accent: "#dc2626",
                getEntries: getBijliChoriEntries_,
                getThumb: (e) => (e.photos && e.photos[0] && (e.photos[0].photo_data || normalizeDrivePhotoUrl_(e.photos[0].photo_url))) || "",
                getTitle: (e) => `${e.date || ""} — ${e.name || e.ivrs || "Entry"}`,
                getSubtitle: (e) => `${(e.photos || []).length} photo(s) | ${e.remark || ""}`,
                refreshFn: () => refreshBijliChoriMisTotal()
            }
        };

        async function refreshStorageCounter_(storeName) {
            const config = ENTRY_STORE_CONFIG[storeName];
            if (!config) return;
            const usedNode = document.getElementById(`${storageCounterPrefix_(storeName)}-storage-used`);
            const limitNode = document.getElementById(`${storageCounterPrefix_(storeName)}-storage-limit`);
            if (!usedNode || !limitNode) return;
            const count = await idbCount_(storeName);
            const limit = IDB_STORE_LIMITS[storeName] || 2000;
            usedNode.innerText = count;
            limitNode.innerText = limit;
            const wrapper = document.getElementById(`${storageCounterPrefix_(storeName)}-storage-counter`);
            if (wrapper) {
                if (count / limit >= 0.95) {
                    wrapper.style.color = "#fee2e2";
                    wrapper.style.fontWeight = "900";
                }
                const syncNoteId = `${storageCounterPrefix_(storeName)}-sync-note`;
                let syncNote = document.getElementById(syncNoteId);
                if (!syncNote) {
                    syncNote = document.createElement("div");
                    syncNote.id = syncNoteId;
                    syncNote.style.fontSize = "10px";
                    syncNote.style.fontWeight = "700";
                    syncNote.style.marginTop = "2px";
                    wrapper.insertAdjacentElement("afterend", syncNote);
                }
                syncNote.innerText = sharedModuleSyncEnabled
                    ? "🌐 Shared: sabhi users ko yeh entries dikhengi"
                    : "⚠️ Sirf is device par save (cloud sync OFF)";
                syncNote.style.color = sharedModuleSyncEnabled ? "#d1fae5" : "#fde68a";
                syncNote.style.textAlign = "center";
            }
        }

        function storageCounterPrefix_(storeName) {
            const map = {
                broken_pole: "bp",
                bijli_chori: "bc"
            };
            return map[storeName] || storeName;
        }

        async function toggleEntriesList(storeName) {
            const container = document.getElementById(`entries-list-${storeName}`);
            if (!container) return;
            const isOpen = container.style.display !== "none";
            if (isOpen) {
                container.style.display = "none";
                container.innerHTML = "";
                return;
            }
            container.style.display = "block";
            container.innerHTML = `<div style="text-align:center; padding:14px; font-size:12px; font-weight:800; color:#ffffff;">Loading...</div>`;
            await renderEntriesList_(storeName);
        }

        // Returns a stable string identifier for an entry, usable for view/delete lookups
        // regardless of whether the entry came from local IndexedDB (numeric `id`) or
        // the shared cloud backend (string `entry_id`).
        function getEntryUid_(entry) {
            if (entry.entry_id) return `cloud_${entry.entry_id}`;
            return `local_${entry.id}`;
        }

        async function renderEntriesList_(storeName) {
            const config = ENTRY_STORE_CONFIG[storeName];
            const container = document.getElementById(`entries-list-${storeName}`);
            if (!config || !container) return;

            const entries = await config.getEntries();
            const sorted = entries.slice().reverse(); // newest first

            if (!sorted.length) {
                container.innerHTML = `<div style="text-align:center; padding:14px; font-size:12px; font-weight:800; color:#ffffff; background:rgba(0,0,0,0.12); border-radius:12px;">Koi saved entry nahi hai.</div>`;
                return;
            }

            container.innerHTML = `
                <div style="background:rgba(255,255,255,0.92); border-radius:14px; padding:8px; max-height:340px; overflow-y:auto;">
                    ${sorted.map((e) => {
                        const thumb = config.getThumb(e) || "";
                        return `
                        <div style="display:flex; align-items:center; gap:10px; padding:8px; border-bottom:1px solid #e5e7eb;">
                            ${thumb ? `<img src="${thumb}" referrerpolicy="no-referrer" style="width:46px; height:46px; object-fit:cover; border-radius:8px; border:1px solid #e5e7eb; flex-shrink:0;">` : `<div style="width:46px; height:46px; border-radius:8px; background:#f1f5f9; flex-shrink:0;"></div>`}
                            <div style="flex:1; min-width:0;">
                                <div style="font-size:11px; font-weight:900; color:#1e293b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(config.getTitle(e))}</div>
                                <div style="font-size:10px; font-weight:700; color:#64748b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(config.getSubtitle(e))}</div>
                            </div>
                            <button onclick="viewEntryDetail_('${storeName}', '${getEntryUid_(e)}')" style="border:none; background:#e0f2fe; color:#075985; border-radius:999px; padding:6px 10px; font-size:10px; font-weight:900; text-transform:uppercase; flex-shrink:0;">View</button>
                            <button onclick="deleteEntryConfirm_('${storeName}', '${getEntryUid_(e)}')" style="border:none; background:#fee2e2; color:#b91c1c; border-radius:999px; padding:6px 10px; font-size:10px; font-weight:900; text-transform:uppercase; flex-shrink:0;">Delete</button>
                        </div>`;
                    }).join("")}
                </div>
            `;
        }

        async function viewEntryDetail_(storeName, uid) {
            const config = ENTRY_STORE_CONFIG[storeName];
            if (!config) return;
            const entries = await config.getEntries();
            const entry = entries.find((e) => getEntryUid_(e) === uid);
            if (!entry) return showToast("Entry nahi mili", false);

            const overlay = document.createElement("div");
            overlay.id = "entry-detail-overlay";
            overlay.style.cssText = "position:fixed; inset:0; background:rgba(0,0,0,0.55); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;";

            let bodyHtml = "";
            if (storeName === "broken_pole") {
                bodyHtml = `
                    ${entry.photo_data ? `<img src="${entry.photo_data}" style="width:100%; max-height:240px; object-fit:cover; border-radius:10px; margin-bottom:8px;">` : (entry.photo_url ? `<img src="${normalizeDrivePhotoUrl_(entry.photo_url)}" style="width:100%; max-height:240px; object-fit:cover; border-radius:10px; margin-bottom:8px;" referrerpolicy="no-referrer">` : "")}
                    <div class="photo-meta-row"><strong>Date:</strong> ${escapeHtml(entry.date || "")}</div>
                    <div class="photo-meta-row"><strong>Remark 1:</strong> ${escapeHtml(entry.remark1 || "")}</div>
                    <div class="photo-meta-row"><strong>Remark 2:</strong> ${escapeHtml(entry.remark2 || "")}</div>
                    <div class="photo-meta-row"><strong>GPS:</strong> ${escapeHtml((entry.gps_latitude && entry.gps_longitude) ? `${entry.gps_latitude}, ${entry.gps_longitude}` : "N/A")}</div>
                    <div class="photo-meta-row"><strong>Location:</strong> ${escapeHtml(entry.gps_location || "N/A")}</div>
                    ${isValidLatLon_(entry.gps_latitude, entry.gps_longitude) ? `<div style="margin-top:8px;"><a href="https://www.google.com/maps/dir/?api=1&destination=${entry.gps_latitude},${entry.gps_longitude}" target="_blank" rel="noopener" style="display:inline-flex; align-items:center; gap:6px; background:linear-gradient(135deg,#16a34a,#15803d); color:#fff; font-size:11px; font-weight:900; text-transform:uppercase; padding:8px 14px; border-radius:10px; text-decoration:none;">Get Directions</a></div>` : ""}
                `;
            } else if (storeName === "bijli_chori") {
                bodyHtml = `
                    <div class="photo-meta-row"><strong>Date:</strong> ${escapeHtml(entry.date || "")}</div>
                    <div class="photo-meta-row"><strong>IVRS/Ref:</strong> ${escapeHtml(entry.ivrs || "")}</div>
                    <div class="photo-meta-row"><strong>Naam/Sthan:</strong> ${escapeHtml(entry.name || "")}</div>
                    <div class="photo-meta-row"><strong>Remark:</strong> ${escapeHtml(entry.remark || "")}</div>
                    ${(entry.photos || []).map((p, idx) => `
                        <div style="margin-top:10px; padding-top:10px; border-top:1px solid #e5e7eb;">
                            <div style="font-size:11px; font-weight:900; color:#1e293b; margin-bottom:6px;">${escapeHtml(p.name || ("Photo " + (idx + 1)))}</div>
                            ${p.photo_data ? `<img src="${p.photo_data}" style="width:100%; max-height:200px; object-fit:cover; border-radius:10px; margin-bottom:6px;">` : (p.photo_url ? `<img src="${normalizeDrivePhotoUrl_(p.photo_url)}" style="width:100%; max-height:200px; object-fit:cover; border-radius:10px; margin-bottom:6px;" referrerpolicy="no-referrer">` : "")}
                            <div class="photo-meta-row"><strong>GPS:</strong> ${escapeHtml((p.gps_latitude && p.gps_longitude) ? `${p.gps_latitude}, ${p.gps_longitude}` : "N/A")}</div>
                            <div class="photo-meta-row"><strong>Location:</strong> ${escapeHtml(p.gps_location || "N/A")}</div>
                            ${isValidLatLon_(p.gps_latitude, p.gps_longitude) ? `<div style="margin-top:6px;"><a href="https://www.google.com/maps/dir/?api=1&destination=${p.gps_latitude},${p.gps_longitude}" target="_blank" rel="noopener" style="display:inline-flex; align-items:center; gap:6px; background:linear-gradient(135deg,#16a34a,#15803d); color:#fff; font-size:11px; font-weight:900; text-transform:uppercase; padding:8px 14px; border-radius:10px; text-decoration:none;">Get Directions</a></div>` : ""}
                        </div>
                    `).join("")}
                `;
            }

            const card = document.createElement("div");
            card.style.cssText = "background:#ffffff; border-radius:18px; padding:16px; width:100%; max-width:360px; max-height:85vh; overflow-y:auto; box-shadow:0 12px 30px rgba(0,0,0,0.25);";
            card.innerHTML = `
                <div style="font-size:14px; font-weight:900; color:#1e293b; text-transform:uppercase; text-align:center; margin-bottom:12px;">${escapeHtml(ENTRY_STORE_CONFIG[storeName].label)} — Entry Detail</div>
                ${bodyHtml}
                <button onclick="document.getElementById('entry-detail-overlay').remove()" style="width:100%; height:44px; border:none; border-radius:12px; background:#e2e8f0; color:#1e293b; font-size:13px; font-weight:900; text-transform:uppercase; margin-top:12px;">Band Karein</button>
            `;
            overlay.appendChild(card);
            overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
            document.body.appendChild(overlay);
        }

        function deleteEntryConfirm_(storeName, uid) {
            const overlay = document.createElement("div");
            overlay.id = "entry-delete-overlay";
            overlay.style.cssText = "position:fixed; inset:0; background:rgba(0,0,0,0.55); z-index:9999; display:flex; align-items:center; justify-content:center; padding:20px;";
            const card = document.createElement("div");
            card.style.cssText = "background:#ffffff; border-radius:18px; padding:18px; width:100%; max-width:300px; box-shadow:0 12px 30px rgba(0,0,0,0.25); text-align:center;";
            card.innerHTML = `
                <div style="font-size:14px; font-weight:900; color:#b91c1c; text-transform:uppercase; margin-bottom:10px;">Entry Delete Karein?</div>
                <div style="font-size:12px; font-weight:700; color:#475569; margin-bottom:16px;">Yeh entry permanently delete ho jayegi (sabhi users ke liye). Pehle MIS report download kar lein agar zaroorat ho.</div>
                <div style="display:flex; gap:10px;">
                    <button onclick="document.getElementById('entry-delete-overlay').remove()" style="flex:1; height:44px; border:none; border-radius:12px; background:#e2e8f0; color:#1e293b; font-size:12px; font-weight:900; text-transform:uppercase;">Cancel</button>
                    <button onclick="confirmDeleteEntry_('${storeName}', '${uid}')" style="flex:1; height:44px; border:none; border-radius:12px; background:#ef4444; color:#fff; font-size:12px; font-weight:900; text-transform:uppercase;">Delete</button>
                </div>
            `;
            overlay.appendChild(card);
            overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
            document.body.appendChild(overlay);
        }

        async function confirmDeleteEntry_(storeName, uid) {
            const overlay = document.getElementById("entry-delete-overlay");
            if (overlay) overlay.remove();

            const config = ENTRY_STORE_CONFIG[storeName];
            const entries = await config.getEntries();
            const entry = entries.find((e) => getEntryUid_(e) === uid);
            if (!entry) return showToast("Entry nahi mili", false);

            let ok = true;
            // Delete from shared backend if it has a cloud entry_id
            if (entry.entry_id) {
                ok = await deleteSharedEntry_(storeName, entry.entry_id);
                if (!ok) {
                    showToast("Cloud se delete nahi ho paya (internet check karein)", false);
                }
                // Clear cache so the deleted entry doesn't reappear from stale cache
                sharedModuleEntriesCache[storeName] = (sharedModuleEntriesCache[storeName] || []).filter((e) => e.entry_id !== entry.entry_id);
            }

            // Delete the local IndexedDB copy if present
            if (entry.id) {
                await idbDelete_(storeName, entry.id);
            }

            if (!ok && !entry.id) {
                return; // cloud delete failed and there's no local copy to remove
            }

            showToast("Entry delete ho gayi", true);
            await renderEntriesList_(storeName);
            await refreshStorageCounter_(storeName);
            if (config?.refreshFn) await config.refreshFn();
        }



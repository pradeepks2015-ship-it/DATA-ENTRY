        // ===== DTR (Distribution Transformer) Health Log feature =====
        // Broken Pole module jaisa hi pattern (photo + GPS + list + MIS PDF) — sirf
        // remark1 ki jagah ek "समस्या का प्रकार" (issue type) dropdown hai, taaki
        // DTR failures analytics-friendly (burnt/oil-leak/overload wise count) bhi ho sakein.
        function updateDtrPhotoMetaUI() {
            const metaBox = document.getElementById("dtr-photo-meta");
            const latLongNode = document.getElementById("dtr-photo-latlong");
            const locationNode = document.getElementById("dtr-photo-location");
            const directionsNode = document.getElementById("dtr-photo-directions");
            if (!metaBox || !latLongNode || !locationNode) return;
            if (!dtrGeoData) {
                metaBox.style.display = "none";
                latLongNode.innerHTML = "<strong>Lat-Long:</strong> Not captured";
                locationNode.innerHTML = "<strong>Location:</strong> Not captured";
                if (directionsNode) directionsNode.innerHTML = "";
                return;
            }
            metaBox.style.display = "block";
            latLongNode.innerHTML = `<strong>Lat-Long:</strong> ${trustedHtml_(dtrGeoData.latitude)}, ${trustedHtml_(dtrGeoData.longitude)}`;
            locationNode.innerHTML = `<strong>Location:</strong> ${escapeHtml(dtrGeoData.locationText || "GPS location captured")}`;
            if (directionsNode) {
                const lat = dtrGeoData.latitude;
                const lon = dtrGeoData.longitude;
                if (isValidLatLon_(lat, lon)) {
                    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`; // lat/lon abhi-abhi regex se validate ho chuke hain
                    directionsNode.innerHTML = `<a href="${trustedHtml_(mapsUrl)}" target="_blank" rel="noopener" style="display:inline-flex; align-items:center; gap:6px; background:linear-gradient(135deg,#16a34a,#15803d); color:#fff; font-size:11px; font-weight:900; text-transform:uppercase; padding:8px 14px; border-radius:10px; text-decoration:none; box-shadow:0 4px 10px rgba(21,128,61,0.25);">
                        <svg width="14" height="14" fill="white" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>
                        Get Directions (Google Maps)
                    </a>`;
                } else {
                    directionsNode.innerHTML = "";
                }
            }
        }

        async function captureDtrGeoLocation() {
            try {
                dtrGeoData = {
                    latitude: "Fetching...",
                    longitude: "Fetching...",
                    locationText: "GPS location detect ki ja rahi hai"
                };
                updateDtrPhotoMetaUI();
                const position = await getCurrentPositionAsync();
                const latitude = position.coords.latitude.toFixed(6);
                const longitude = position.coords.longitude.toFixed(6);
                const locationText = await reverseGeocodeLocation(latitude, longitude);
                dtrGeoData = { latitude, longitude, locationText };
                updateDtrPhotoMetaUI();
            } catch (_) {
                dtrGeoData = {
                    latitude: "Available nahi",
                    longitude: "Available nahi",
                    locationText: "GPS permission allow nahi hui ya signal weak tha"
                };
                updateDtrPhotoMetaUI();
            }
        }

        async function updateDtrHealthPhoto() {
            const input = document.getElementById("dtr-photo");
            const label = document.getElementById("dtr-photo-name");
            const previewWrap = document.getElementById("dtr-photo-preview-wrap");
            const previewImg = document.getElementById("dtr-photo-preview");
            label.innerText = input.files && input.files[0] ? input.files[0].name : "No photo selected";
            if (input.files && input.files[0]) {
                try {
                    const reader = new FileReader();
                    reader.onload = () => {
                        previewImg.src = reader.result;
                        previewWrap.style.display = "block";
                    };
                    reader.readAsDataURL(input.files[0]);
                } catch (_) {}
                await captureDtrGeoLocation();
            } else {
                previewWrap.style.display = "none";
                previewImg.src = "";
                dtrGeoData = null;
                updateDtrPhotoMetaUI();
            }
        }

        function dtrToggleOtherIssue_() {
            const sel = document.getElementById("dtr-issue-type");
            const box = document.getElementById("dtr-other-issue-box");
            if (!sel || !box) return;
            box.style.display = sel.value === "अन्य" ? "block" : "none";
            if (sel.value !== "अन्य") {
                const inp = document.getElementById("dtr-other-issue");
                if (inp) inp.value = "";
            }
        }

        async function getDtrHealthEntries_(mode = "force") {
            return getModuleEntries_("dtr_health", mode);
        }

        async function saveDtrHealthEntry_(entry) {
            try {
                await idbAdd_("dtr_health", entry);
                const MAX_DTR_ENTRIES = IDB_STORE_LIMITS.dtr_health;
                const count = await idbCount_("dtr_health");
                if (count > MAX_DTR_ENTRIES) {
                    await idbDeleteOldest_("dtr_health", count - MAX_DTR_ENTRIES);
                    showToast(`Limit ${MAX_DTR_ENTRIES} entries hai — sabse purani local entry auto-delete hui (cloud mein safe hai)`, true);
                }
                await checkStoreCapacityWarning_("dtr_health", "DTR Health Log");
                return true;
            } catch (_) {
                return false;
            }
        }

        async function submitDtrHealthEntry() {
            const photoInput = document.getElementById("dtr-photo");
            const dtrNo = document.getElementById("dtr-no").value.trim();
            const issueType = document.getElementById("dtr-issue-type").value;
            const otherIssue = document.getElementById("dtr-other-issue").value.trim();
            const remark = document.getElementById("dtr-remark").value.trim();

            if (!photoInput.files || !photoInput.files[0]) return showToast("Photo select kariye", false);
            if (!dtrNo) return showToast("DTR No / स्थान darj kariye", false);
            if (!issueType) return showToast("समस्या का प्रकार चुनें", false);
            if (issueType === "अन्य" && !otherIssue) return showToast("अन्य समस्या विस्तार से लिखें", false);

            const finalIssueType = issueType === "अन्य" ? `अन्य: ${otherIssue}` : issueType;

            const submitBtn = document.getElementById("dtr-submit-btn");
            submitBtn.innerText = "Saving...";
            submitBtn.disabled = true;

            try {
                const photoFile = photoInput.files[0];
                const photoData = await resizeImageForUpload(photoFile, 900, 0.6);

                const entry = {
                    date: getCurrentDateDDMMYYYY(),
                    timestamp: new Date().toISOString(),
                    dc_name: activeDC || "",
                    dtr_no: dtrNo,
                    issue_type: finalIssueType,
                    remark,
                    gps_latitude: dtrGeoData?.latitude || "",
                    gps_longitude: dtrGeoData?.longitude || "",
                    gps_location: dtrGeoData?.locationText || "",
                    photo_name: photoFile.name || "",
                    photo_data: photoData,
                    ...currentEmployeeTag_()
                };

                const entryId = await syncEntryToCloud_("dtr_health", entry);
                if (entryId) {
                    entry.entry_id = entryId;
                } else {
                    showToast(window.__lastSyncQueued ? "Internet nahi hai — entry device par save ho gayi 🔄 Internet aane par apne aap cloud sync ho jayegi" : "Internet/sync error: entry sirf is device par save hui, doosre users ko nahi dikhegi", false);
                }

                const saved = await saveDtrHealthEntry_(entry);
                if (!saved) {
                    return showToast("Save karne mein error aaya, dobara try karein", false);
                }

                showToast("Entry Saved Successfully!", true);

                // Reset form
                document.getElementById("dtr-photo").value = "";
                document.getElementById("dtr-photo-name").innerText = "No photo selected";
                document.getElementById("dtr-photo-preview-wrap").style.display = "none";
                document.getElementById("dtr-photo-preview").src = "";
                document.getElementById("dtr-no").value = "";
                document.getElementById("dtr-issue-type").value = "";
                document.getElementById("dtr-other-issue").value = "";
                document.getElementById("dtr-other-issue-box").style.display = "none";
                document.getElementById("dtr-remark").value = "";
                dtrGeoData = null;
                updateDtrPhotoMetaUI();
                await refreshDtrHealthMisTotal();
                await refreshStorageCounter_("dtr_health");
                if (document.getElementById("entries-list-dtr_health")?.style.display !== "none") {
                    await renderEntriesList_("dtr_health");
                }
            } catch (err) {
                showToast("Save error: " + (err && err.message ? err.message : String(err)), false);
            } finally {
                submitBtn.innerText = "✅ Submit Entry (Add Another Photo After)";
                submitBtn.disabled = false;
            }
        }

        async function refreshDtrHealthMisTotal(mode = "force") {
            const fromDate = document.getElementById("dtr-mis-from-date")?.value;
            const toDate = document.getElementById("dtr-mis-to-date")?.value;
            const totalNode = document.getElementById("dtr-mis-total");
            if (!totalNode) return;
            const filtered = await filterDtrHealthEntries_(fromDate, toDate, mode);
            totalNode.innerText = filtered.length;
        }

        async function filterDtrHealthEntries_(fromDate, toDate, mode = "force") {
            const entries = await getDtrHealthEntries_(mode);
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

        async function downloadDtrHealthMisPdf() {
            const fromDate = document.getElementById("dtr-mis-from-date").value;
            const toDate = document.getElementById("dtr-mis-to-date").value;
            if (!fromDate || !toDate) return showToast("Pehle From aur To date select karein", false);
            if (fromDate > toDate) return showToast("From date, To date se pehle honi chahiye", false);

            const btn = document.getElementById("dtr-mis-pdf-btn");
            btn.innerText = "Generating...";
            btn.disabled = true;

            let holder = null;
            try {
                btn.innerText = "PDF library load ho rahi hai...";
                await Promise.all([ensureJsPdf_(), ensureHtml2Canvas_()]);
                btn.innerText = "Generating...";

                const filtered = await filterDtrHealthEntries_(fromDate, toDate);
                await refreshDtrHealthMisTotal();
                await hydratePhotoDataForPdf_(filtered);

                const fmtDate = (iso) => {
                    if (!iso) return "";
                    const [y, m, d] = iso.split("-");
                    return `${d}/${m}/${y}`;
                };

                const { jsPDF } = window.jspdf;
                const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

                holder = document.createElement("div");
                holder.style.cssText = "position:fixed; left:-12000px; top:0; width:760px; background:#ffffff; font-family:'Noto Sans Devanagari','Mangal','Nirmala UI',Arial,sans-serif; color:#1e293b;";
                document.body.appendChild(holder);

                const renderBlock = async (innerHtml) => {
                    const el = document.createElement("div");
                    el.style.cssText = "width:760px; background:#ffffff; padding:4px 2px; box-sizing:border-box;";
                    el.innerHTML = trustedHtml_(innerHtml);
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

                const headerHtml = `
                    <div style="background:#7c3aed; color:#ffffff; border-radius:8px; padding:16px 12px; text-align:center;">
                        <div style="font-size:24px; font-weight:900; letter-spacing:0.5px;">DTR (ट्रांसफार्मर) हेल्थ लॉग — MIS रिपोर्ट</div>
                        <div style="font-size:14px; font-weight:700; margin-top:6px;">डीसी: ${escapeHtml(activeDC || "-")} &nbsp;|&nbsp; अवधि: ${fmtDate(fromDate)} से ${fmtDate(toDate)} तक</div>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px; padding:0 2px;">
                        <div style="color:#7c3aed; font-weight:900; font-size:16px;">कुल एंट्री: ${filtered.length}</div>
                        <div style="font-size:12px; font-weight:700; color:#64748b;">तैयार किया गया: ${new Date().toLocaleString("en-IN")}</div>
                    </div>`;
                addBlock(await renderBlock(headerHtml), 4);

                const cellTh = "border:1px solid #5b21b6; background:#7c3aed; color:#ffffff; padding:7px 5px; font-size:12px; font-weight:900; text-align:center;";
                const cellTd = "border:1px solid #e2e8f0; padding:7px 5px; font-size:12.5px; font-weight:600; text-align:center; vertical-align:top;";
                const theadHtml = `<tr>
                    <th style="${cellTh} width:44px;">क्र.सं.</th>
                    <th style="${cellTh} width:82px;">दिनांक</th>
                    <th style="${cellTh}">DTR No / स्थान</th>
                    <th style="${cellTh}">समस्या का प्रकार</th>
                    <th style="${cellTh}">रिमार्क</th>
                    <th style="${cellTh} width:106px;">GPS निर्देशांक</th>
                </tr>`;
                const rowHtml = (e, i) => `<tr style="background:${i % 2 ? "#f5f3ff" : "#ffffff"};">
                    <td style="${cellTd}">${i + 1}</td>
                    <td style="${cellTd}">${escapeHtml(e.date || "")}</td>
                    <td style="${cellTd} text-align:left;">${escapeHtml(e.dtr_no || "")}</td>
                    <td style="${cellTd} text-align:left;">${escapeHtml(e.issue_type || "")}</td>
                    <td style="${cellTd} text-align:left;">${escapeHtml(e.remark || "")}</td>
                    <td style="${cellTd}">${escapeHtml((e.gps_latitude && e.gps_longitude) ? `${e.gps_latitude}, ${e.gps_longitude}` : "N/A")}</td>
                </tr>`;

                if (!filtered.length) {
                    addBlock(await renderBlock(`<table style="width:100%; border-collapse:collapse;"><thead>${theadHtml}</thead><tbody><tr><td colspan="6" style="${cellTd} padding:14px;">कोई एंट्री नहीं मिली</td></tr></tbody></table>`));
                } else {
                    const CHUNK = 12;
                    for (let s = 0; s < filtered.length; s += CHUNK) {
                        const rows = filtered.slice(s, s + CHUNK).map((e, k) => rowHtml(e, s + k)).join("");
                        addBlock(await renderBlock(`<table style="width:100%; border-collapse:collapse;"><thead>${theadHtml}</thead><tbody>${rows}</tbody></table>`), 2);
                    }
                }

                for (let i = 0; i < filtered.length; i++) {
                    const e = filtered[i];
                    if (!e.photo_data) continue;
                    const gpsLine = (e.gps_latitude && e.gps_longitude) ? `${escapeHtml(String(e.gps_latitude))}, ${escapeHtml(String(e.gps_longitude))}` : "N/A";
                    const photoHtml = `
                        <div style="border:1.5px solid #ddd6fe; border-radius:10px; padding:10px; background:#f5f3ff;">
                            <div style="font-size:14px; font-weight:900; color:#1e293b; margin-bottom:8px;">एंट्री ${i + 1} — ${escapeHtml(e.date || "")} — ${escapeHtml(e.dtr_no || "")} (${escapeHtml(e.issue_type || "")})</div>
                            <div style="display:flex; gap:12px; align-items:flex-start;">
                                <img src="${escapeHtml(e.photo_data)}" alt="अपलोड की गई फोटो" style="width:330px; height:248px; object-fit:cover; border-radius:8px; border:1px solid #e2e8f0; flex-shrink:0;">
                                <div style="font-size:13px; font-weight:700; color:#475569; line-height:1.7;">
                                    <div><span style="color:#1e293b; font-weight:900;">GPS:</span> ${gpsLine}</div>
                                    <div style="margin-top:4px;"><span style="color:#1e293b; font-weight:900;">स्थान:</span> ${escapeHtml(e.gps_location || "N/A")}</div>
                                </div>
                            </div>
                        </div>`;
                    addBlock(await renderBlock(photoHtml), 1);
                    if (isValidLatLon_(e.gps_latitude, e.gps_longitude)) {
                        if (y > 274) { doc.addPage(); y = 10; }
                        const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${e.gps_latitude},${e.gps_longitude}`;
                        doc.setFontSize(9);
                        doc.setTextColor(21, 128, 61);
                        doc.setFont(undefined, "bold");
                        doc.text("Open Map (Directions)", 15, y + 2);
                        doc.link(15, y - 1.5, 48, 5.5, { url: mapsUrl });
                        y += 8;
                    }
                }

                holder.remove();
                holder = null;

                const totalPages = doc.internal.getNumberOfPages();
                for (let i = 1; i <= totalPages; i++) {
                    doc.setPage(i);
                    doc.setFontSize(7);
                    doc.setTextColor(150);
                    doc.text(`Page ${i} of ${totalPages}  |  DTR Health Log MIS Report`, 105, 290, { align: "center" });
                }

                const filename = `DTR_Health_MIS_${fmtDate(fromDate).replace(/\//g,"-")}_to_${fmtDate(toDate).replace(/\//g,"-")}.pdf`;
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

        function initChhaparaFeederCalculator() {
            const dateInput = document.getElementById("chhapara-reading-date");
            if (dateInput && !dateInput.value) {
                dateInput.value = localTodayIso_();
            }
            try {
                const savedEntries = JSON.parse(localStorage.getItem(chhaparaFeederStorageKey) || "[]");
                chhaparaFeederEntries = Array.isArray(savedEntries) ? savedEntries : [];
            } catch (_) {
                chhaparaFeederEntries = [];
            }
            previewChhaparaFeederCalc();
            renderChhaparaFeederEntries();
        }

        function readChhaparaFeederForm() {
            return {
                date: document.getElementById("chhapara-reading-date")?.value || "",
                feederType: document.getElementById("chhapara-feeder-type")?.value || "11 KV",
                feederName: document.getElementById("chhapara-feeder-name")?.value.trim() || "",
                mf: Number(document.getElementById("chhapara-mf")?.value || 0),
                previousReading: Number(document.getElementById("chhapara-previous-reading")?.value || 0),
                currentReading: Number(document.getElementById("chhapara-current-reading")?.value || 0),
                dc1Name: document.getElementById("chhapara-dc1-name")?.value.trim() || "",
                dc1Percent: Number(document.getElementById("chhapara-dc1-percent")?.value || 0),
                dc2Name: document.getElementById("chhapara-dc2-name")?.value.trim() || "",
                dc2Percent: Number(document.getElementById("chhapara-dc2-percent")?.value || 0),
                note: document.getElementById("chhapara-reading-note")?.value.trim() || ""
            };
        }

        function calculateChhaparaFeederData(formData) {
            const difference = Number((formData.currentReading - formData.previousReading).toFixed(2));
            const totalConsumption = Number((difference * formData.mf).toFixed(2));
            const shares = [];
            const totalPercent = Number((formData.dc1Percent + formData.dc2Percent).toFixed(2));

            if (formData.dc1Name && formData.dc1Percent > 0) {
                shares.push({
                    name: formData.dc1Name,
                    percent: formData.dc1Percent,
                    output: Number((totalConsumption * formData.dc1Percent / 100).toFixed(2))
                });
            }
            if (formData.dc2Name && formData.dc2Percent > 0) {
                shares.push({
                    name: formData.dc2Name,
                    percent: formData.dc2Percent,
                    output: Number((totalConsumption * formData.dc2Percent / 100).toFixed(2))
                });
            }
            if (!shares.length && totalConsumption >= 0) {
                shares.push({
                    name: "Single Output",
                    percent: 100,
                    output: totalConsumption
                });
            }

            return { difference, totalConsumption, totalPercent, shares };
        }

        function previewChhaparaFeederCalc() {
            const previewBox = document.getElementById("chhapara-calc-preview");
            if (!previewBox) return;
            const formData = readChhaparaFeederForm();
            const calc = calculateChhaparaFeederData(formData);
            const hasValues = formData.previousReading || formData.currentReading || formData.mf;

            if (!hasValues) {
                previewBox.innerHTML = `
                    <div class="chhapara-calc-preview-line"><strong>Preview:</strong> Previous reading, current reading aur MF dalte hi total output yahan dikh jayega.</div>
                    <div class="chhapara-calc-preview-line">Agar feeder 2 DC ko feed karta hai to dono DC ka % daliyey.</div>
                `;
                return;
            }
            if (calc.difference < 0) {
                previewBox.innerHTML = `<div class="chhapara-calc-preview-line"><strong>Check:</strong> Current reading previous reading se chhoti hai. Reading dobara verify kijiye.</div>`;
                return;
            }
            if (calc.totalPercent > 100) {
                previewBox.innerHTML = `<div class="chhapara-calc-preview-line"><strong>Check:</strong> DC percentage total 100 se zyada ho raha hai. Isko sahi kariye.</div>`;
                return;
            }

            const shareHtml = calc.shares.map((item) => `
                <div class="chhapara-calc-preview-line">${escapeHtml(item.name)}: ${formatChhaparaNumber(item.output)} units (${formatChhaparaNumber(item.percent)}%)</div>
            `).join("");

            previewBox.innerHTML = `
                <div class="chhapara-calc-preview-line"><strong>Difference:</strong> ${formatChhaparaNumber(calc.difference)}</div>
                <div class="chhapara-calc-preview-line"><strong>Total Consumption:</strong> ${formatChhaparaNumber(calc.totalConsumption)} units</div>
                <div class="chhapara-calc-preview-line"><strong>Formula:</strong> (${formatChhaparaNumber(formData.currentReading)} - ${formatChhaparaNumber(formData.previousReading)}) x ${formatChhaparaNumber(formData.mf)}</div>
                ${shareHtml}
            `;
        }

        function addChhaparaFeederEntry() {
            const formData = readChhaparaFeederForm();
            if (!formData.date) return showToast("Date select kijiye", false);
            if (!formData.feederName) return showToast("Feeder name likhiye", false);
            if (!(formData.mf > 0)) return showToast("Valid MF dijiye", false);
            if (formData.currentReading < formData.previousReading) return showToast("Current reading previous se chhoti nahi ho sakti", false);
            if ((formData.dc1Name && !(formData.dc1Percent > 0)) || (formData.dc2Name && !(formData.dc2Percent > 0))) {
                return showToast("DC name ke saath uska percentage bhi dijiye", false);
            }
            if ((!formData.dc1Name && formData.dc1Percent > 0) || (!formData.dc2Name && formData.dc2Percent > 0)) {
                return showToast("Percentage ke saath DC name bhi dijiye", false);
            }

            const calc = calculateChhaparaFeederData(formData);
            if (calc.totalPercent > 100) return showToast("DC percentage total 100 se zyada hai", false);

            chhaparaFeederEntries.unshift({
                id: `chhapara-${Date.now()}`,
                ...formData,
                ...calc
            });
            persistChhaparaFeederEntries();
            renderChhaparaFeederEntries();
            clearChhaparaFeederForm();
            showToast("Feeder output add ho gaya", true);
        }

        function persistChhaparaFeederEntries() {
            try {
                localStorage.setItem(chhaparaFeederStorageKey, JSON.stringify(chhaparaFeederEntries));
            } catch (_) {}
        }

        function clearChhaparaFeederForm() {
            document.getElementById("chhapara-feeder-name").value = "";
            document.getElementById("chhapara-mf").value = "";
            document.getElementById("chhapara-previous-reading").value = "";
            document.getElementById("chhapara-current-reading").value = "";
            document.getElementById("chhapara-dc1-name").value = "";
            document.getElementById("chhapara-dc1-percent").value = "";
            document.getElementById("chhapara-dc2-name").value = "";
            document.getElementById("chhapara-dc2-percent").value = "";
            document.getElementById("chhapara-reading-note").value = "";
            previewChhaparaFeederCalc();
        }

        function renderChhaparaFeederEntries() {
            const listBox = document.getElementById("chhapara-entry-list");
            const countBox = document.getElementById("chhapara-entry-count");
            const totalBox = document.getElementById("chhapara-total-consumption");
            if (!listBox || !countBox || !totalBox) return;

            countBox.innerText = String(chhaparaFeederEntries.length);
            const totalConsumption = chhaparaFeederEntries.reduce((sum, item) => sum + Number(item.totalConsumption || 0), 0);
            totalBox.innerText = formatChhaparaNumber(totalConsumption);

            if (!chhaparaFeederEntries.length) {
                listBox.innerHTML = `<div class="chhapara-empty">Abhi koi feeder output add nahi hai. Ek ek feeder ki daily reading dalke output list bana sakte hain.</div>`;
                return;
            }

            listBox.innerHTML = chhaparaFeederEntries.map((item) => {
                const shares = Array.isArray(item.shares) ? item.shares : [];
                const shareRows = shares.map((share) => `
                    <div class="chhapara-share-row">
                        <span>${escapeHtml(share.name)} (${formatChhaparaNumber(share.percent)}%)</span>
                        <span>${formatChhaparaNumber(share.output)} units</span>
                    </div>
                `).join("");
                return `
                    <div class="chhapara-entry-card">
                        <div class="chhapara-entry-top">
                            <div>
                                <div class="chhapara-entry-name">${escapeHtml(item.feederName)}</div>
                                <div class="chhapara-entry-meta">${escapeHtml(item.feederType)} | ${escapeHtml(item.date)}</div>
                            </div>
                            <div style="display:flex; flex-direction:column; align-items:flex-end; gap:8px;">
                                <div class="chhapara-entry-total">${formatChhaparaNumber(item.totalConsumption)} units</div>
                                <button class="chhapara-delete-btn" onclick="deleteChhaparaFeederEntry('${item.id}')">Delete</button>
                            </div>
                        </div>
                        <div class="chhapara-share-list">${shareRows}</div>
                        <div class="chhapara-entry-note">Reading Diff: ${formatChhaparaNumber(item.difference)} | MF: ${formatChhaparaNumber(item.mf)}${item.note ? ` | ${escapeHtml(item.note)}` : ""}</div>
                    </div>
                `;
            }).join("");
        }

        function deleteChhaparaFeederEntry(entryId) {
            chhaparaFeederEntries = chhaparaFeederEntries.filter((item) => item.id !== entryId);
            persistChhaparaFeederEntries();
            renderChhaparaFeederEntries();
            showToast("Feeder output remove ho gaya", true);
        }

        function formatChhaparaNumber(value) {
            const num = Number(value || 0);
            if (Number.isNaN(num)) return "0";
            return num % 1 === 0 ? String(num) : num.toFixed(2);
        }

        function escapeHtml(value) {
            return String(value || "")
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#39;");
        }


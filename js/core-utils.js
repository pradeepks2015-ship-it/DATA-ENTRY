        function showToast(message, ok) {
            const t = document.getElementById("toast-notif");
            t.innerText = message;
            t.style.background = ok ? "#10b981" : "#ef4444";
            t.style.display = "block";
            setTimeout(() => {
                t.style.display = "none";
            }, 3000);
        }

        function escapeHtml(value) {
            return String(value || "")
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#39;");
        }

        // no-unsanitized lint rule ke liye marker — sirf un jagah istemal karo jahan value
        // provably user-controlled nahi hai (number, ISO date, hardcoded/translated string,
        // ya pehle se escapeHtml()/trustedHtml_() se guzri hui HTML) — manually verify karke.
        // Kabhi bhi seedha kisi entry field (naam/remark/address/etc.) par mat lagao.
        function trustedHtml_(value) {
            return value;
        }

        function normalizeLookupValue(value) {
            return (value || "").toString().trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
        }

        function normalizeDcName(value) {
            return (value || "").toString().trim().toUpperCase();
        }

        function getDivisionConfig(divisionName) {
            return divisionConfigs[normalizeDcName(divisionName)] || null;
        }

        function getDivisionDcNames(divisionName) {
            const divisionConfig = getDivisionConfig(divisionName);
            return divisionConfig ? divisionConfig.dcs.map((dc) => dc.name) : [];
        }

        function getAllDcConfigs() {
            return Object.values(divisionConfigs).flatMap((division) => division.dcs);
        }

        function getAllDcNames() {
            return getAllDcConfigs().map((dc) => dc.name);
        }

        function splitCsvLine(line) {
            return line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map((item) => item.replace(/^"|"$/g, "").trim());
        }

        function xhrGetText(url, timeoutMs = 15000) {
            return new Promise((resolve, reject) => {
                try {
                    const xhr = new XMLHttpRequest();
                    xhr.open("GET", url, true);
                    xhr.timeout = timeoutMs; // dheeme/atke network par hamesha ke liye latakne se rokta hai
                    xhr.onreadystatechange = () => {
                        if (xhr.readyState !== 4) return;
                        if (xhr.status >= 200 && xhr.status < 300 && xhr.responseText) {
                            resolve(xhr.responseText);
                        } else {
                            reject(new Error("XHR fetch failed"));
                        }
                    };
                    xhr.ontimeout = () => reject(new Error("XHR timeout"));
                    xhr.onerror = () => reject(new Error("XHR network error"));
                    xhr.send();
                } catch (error) {
                    reject(error);
                }
            });
        }

        // 4 tarike se koshish karta hai (fetch → xhr with cache-bust → xhr plain →
        // fetch plain), har ek ka apna timeout hai — isliye poori chain kabhi
        // anishchit samay tak nahi latakti (worst case bhi bounded hai).
        async function loadRemoteText(url) {
            const withTs = url.includes("?") ? `${url}&t=${Date.now()}` : `${url}?t=${Date.now()}`;
            try {
                const response = await fetchWithTimeout_(withTs);
                const text = await response.text();
                if (text) return text;
            } catch (_) {}
            try {
                return await xhrGetText(withTs);
            } catch (_) {}
            try {
                return await xhrGetText(url);
            } catch (_) {}
            const fallbackResponse = await fetchWithTimeout_(url);
            return fallbackResponse.text();
        }

        async function loadRemoteJson(url) {
            const text = await loadRemoteText(url);
            return JSON.parse(text || "null");
        }

        function isLikelyCsvPayload(rawText) {
            const raw = String(rawText || "").trim();
            if (!raw) return false;
            if (/^\s*</.test(raw)) return false;
            return raw.includes(",") && /[\r\n]/.test(raw);
        }

        function parseConsumerCsv(csvText) {
            const lines = (csvText || "").split(/\r?\n/).filter((line) => line.trim());
            if (lines.length < 2) return [];
            const headers = splitCsvLine(lines[0]).map((header) => normalizeDcName(header));
            return lines.slice(1).map((line) => {
                const cols = splitCsvLine(line);
                const row = {};
                headers.forEach((header, index) => {
                    row[header] = cols[index] || "";
                });
                return row;
            });
        }

        function getConsumerRows(dcName) {
            return dcCacheRows[normalizeDcName(dcName)] || [];
        }

        function getConsumerField(row, aliases, fallback = "") {
            if (!row) return fallback;
            for (const alias of aliases) {
                const value = row[normalizeDcName(alias)];
                if (value !== undefined && value !== null && String(value).trim() !== "") return String(value).trim();
            }
            return fallback;
        }


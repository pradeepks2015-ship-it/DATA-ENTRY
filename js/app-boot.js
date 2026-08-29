
        document.addEventListener("DOMContentLoaded", () => {
            // One-time cleanup: old broken-pole/PDC entries used to be stored in localStorage
            // with embedded photos, which could fill up the shared 5-10MB quota.
            // They've moved to IndexedDB, so remove the old keys to free up space.
            try {
                localStorage.removeItem(brokenPoleStorageKey);
                localStorage.removeItem(pdcStorageKey);
            } catch (_) {}

            const today = localTodayIso_();
            document.getElementById("report-date").value = today;
            getAllDcConfigs().forEach(async ({ name, csvUrl }) => {
                if (!csvUrl) return;
                try {
                    const rawCsv = await loadRemoteText(csvUrl);
                    const normalizedDc = normalizeDcName(name);
                    const parsedRows = isLikelyCsvPayload(rawCsv) ? parseConsumerCsv(rawCsv) : [];
                    if (parsedRows.length) {
                        dcCacheRaw[normalizedDc] = rawCsv;
                        dcCacheRows[normalizedDc] = parsedRows;
                        try {
                            localStorage.setItem(`${dcCsvCacheStoragePrefix}${normalizedDc}`, rawCsv);
                        } catch (_) {}
                    }
                } catch (e) {}
            });

            initChhaparaFeederCalculator();
            updateHeaderMenuEmpName_();
            // Employee-login gate abhi jaan-bujhkar disabled hai — backend Apps Script
            // (getEmployeeNames/verifyEmployeePin) abhi manually deploy nahi hui, aur gate
            // ka koi "skip/cancel" raasta nahi hai, isliye enable karne se pehle ussi backend
            // ka deploy hona zaroori hai (warna sabhi devices permanently gate par atak jaayenge).
            switchView("home");

            // manifest.json ke "shortcuts" (home-screen icon long-press) se ?shortcut=...
            // ke saath khulta hai — sirf wahi targets jo bina kisi DC/Division select
            // kiye bhi seedhe kaam karte hain (Admin Dashboard PIN-gated hai, Error Log
            // is device ka apna hai — dono state-independent hain).
            const shortcut = new URLSearchParams(location.search).get("shortcut");
            if (shortcut === "admin") openAdminDashboardGate_();
            else if (shortcut === "errorlog") openErrorLogModal_();
        });


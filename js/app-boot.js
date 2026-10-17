
        document.addEventListener("DOMContentLoaded", () => {
            // One-time cleanup: old broken-pole/PDC entries used to be stored in localStorage
            // with embedded photos, which could fill up the shared 5-10MB quota.
            // They've moved to IndexedDB, so remove the old keys to free up space.
            try {
                localStorage.removeItem(brokenPoleStorageKey);
                localStorage.removeItem(pdcStorageKey);
            } catch (_) {}

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

            updateHeaderMenuEmpName_();
            switchView("home");

            // manifest.json ke "shortcuts" (home-screen icon long-press) se ?shortcut=...
            // ke saath khulta hai — sirf wahi targets jo bina kisi DC/Division select
            // kiye bhi seedhe kaam karte hain (Admin Dashboard PIN-gated hai, Error Log
            // is device ka apna hai — dono state-independent hain).
            const shortcut = new URLSearchParams(location.search).get("shortcut");
            if (shortcut === "admin") openAdminDashboardGate_();
            else if (shortcut === "errorlog") openErrorLogModal_();
            // ?shortcut=login — gate ko haath se kholne ka raasta. Gate apne-aap
            // abhi nahi khulta, isliye JE isse apne phone par poori jaanch kar
            // sakte hain (naam darj karna + login) switch chalu karne se PEHLE.
            // Baad me bhi kaam ka rehta hai: karmchari badalna ho to.
            else if (shortcut === "login") showEmployeeLoginGate_();

            // Employee-login gate CHAALU (JE ne 17 Oct 2026 ko kaha, backend deploy
            // ho jaane ke baad). Jis phone par abhi tak koi login nahi hua, wahan
            // app khulte hi yeh gate aata hai; ek baar login ho jane par naam us
            // phone me yaad rehta hai (localStorage) aur gate dobara nahi aata.
            //
            // DHYAN: pehle login ke liye internet zaroori hai — naam aur PIN server
            // se jaanche jaate hain. Jo phone kabhi login na hua ho aur network se
            // bahar ho, woh gate paar nahi kar payega (sandesh saaf dikhta hai,
            // "Network error — फिर कोशिश करें", par aage nahi badh sakta). JE ko yeh
            // batakar hi chaalu kiya gaya.
            //
            // Shortcut ke baad rakha hai taaki ?shortcut=admin / errorlog bhi khul
            // sake (unke overlay is gate ke upar aate hain).
            if (!getLoggedInEmployee_()) showEmployeeLoginGate_();
        });


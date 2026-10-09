        (function () {
            // Home screen par version number dikhana — har APP_VER badhne par
            // yahaan khud-ba-khud update ho jaata hai, kabhi hardcode nahi karna.
            var verLabel = document.getElementById("app-version-label");
            if (verLabel) verLabel.textContent = "App Version " + window.__APP_VERSION__;
        })();

        (function () {
            var headerLogo = document.getElementById("header-mpez-logo");
            if (headerLogo) {
                headerLogo.onload = function () { headerLogo.style.display = "block"; };
                headerLogo.src = "./images/app-logo-sm.png";
            }
        })();

        // PWA: cache-first service worker (sw.js) — offline support + install icon.
        // Naya file sirf FORCE_REFRESH (App Update Banner) se hi aati hai, dekhein sw.js.
        if ("serviceWorker" in navigator && location.protocol === "https:") {
            window.addEventListener("load", () => {
                navigator.serviceWorker.register("./sw.js").catch(() => {});
            });
        }

        // ===== App Update Banner =====
        // Har naye deploy par version.json ka "v" badhaya jaata hai (index.html ke
        // window.__APP_VERSION__ ke saath). App khulte waqt aur foreground me wapas
        // aane par (fixed timer-loop nahi, taaki idle padi app baar-baar network
        // data na khaaye) yeh dekhta hai ki server par naya version aaya hai ya
        // nahi — agar haan, to neeche ek patti dikhti hai "अभी अपडेट करें" button
        // ke saath. Dabane par SW ka poora cache force-refresh hokar app reload ho
        // jaati hai — dobara install/close-reopen ki zaroorat nahi padti.
        let appUpdateAvailable_ = false;
        async function checkForAppUpdate_() {
            if (appUpdateAvailable_ || !navigator.onLine) return;
            try {
                const res = await fetch("./version.json?t=" + Date.now(), { cache: "reload" });
                if (!res.ok) return;
                const data = await res.json();
                if (data && typeof data.v !== "undefined" && data.v !== window.__APP_VERSION__) {
                    appUpdateAvailable_ = true;
                    const banner = document.getElementById("app-update-banner");
                    if (banner) banner.style.display = "flex";
                }
            } catch (_) {}
        }

        function applyAppUpdate_() {
            const btn = document.getElementById("app-update-btn");
            if (btn) { btn.disabled = true; btn.innerText = "अपडेट हो रहा है..."; }
            let done = false;
            const finish = () => { if (!done) { done = true; location.reload(); } };
            if (navigator.serviceWorker && navigator.serviceWorker.controller) {
                const onMsg = (e) => {
                    if (e.data && e.data.type === "FORCE_REFRESH_DONE") {
                        navigator.serviceWorker.removeEventListener("message", onMsg);
                        finish();
                    }
                };
                navigator.serviceWorker.addEventListener("message", onMsg);
                navigator.serviceWorker.controller.postMessage({ type: "FORCE_REFRESH" });
                setTimeout(finish, 8000); // safety fallback — kabhi response na aaye tab bhi atke na
            } else {
                finish();
            }
        }

        // ⋮ menu ka "App Refresh करें" button — auto-detect update ka wait kiye
        // bina, user khud kabhi bhi latest version force-load kar sake (jaise
        // koi feature update na dikhe tab troubleshooting ke liye).
        function manualRefreshAppNow_() {
            if (typeof closeHeaderMenu_ === "function") closeHeaderMenu_();
            showToast("App refresh हो रहा है...", true);
            applyAppUpdate_();
        }

        // Fixed timer-loop (jaise har 5 min) nahi rakhte — usse app khuli/idle padi
        // rahe tab bhi baar-baar network call lagti rehti, data cost badhta.
        // Sirf natural checkpoints par check karte hain: app khulte waqt (ek baar),
        // aur jab bhi user wapas app par aaye (background se foreground) — yeh
        // dono waise bhi user ki apni activity se hi trigger hote hain.
        setTimeout(checkForAppUpdate_, 5000);
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible") checkForAppUpdate_();
        });

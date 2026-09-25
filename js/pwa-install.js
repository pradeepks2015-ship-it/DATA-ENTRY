// PWA Install banner (home screen par) — Android/Chrome par "beforeinstallprompt"
// event capture karke apna custom "Install" button dikhate hain (browser ka
// default mini-infobar hide karke), iOS par koi programmatic install API nahi
// hai isliye "Share -> Add to Home Screen" ka manual instruction dikhate hain.
// Already installed (standalone mode me chal rahi) ho to banner kabhi nahi dikhta.

let deferredPwaInstallPrompt_ = null;

function isRunningAsInstalledPwa_() {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function isIosDevice_() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
}

function showPwaInstallBanner_() {
    if (isRunningAsInstalledPwa_()) return;
    if (localStorage.getItem("pwaInstallBannerDismissed") === "1") return;
    const banner = document.getElementById("pwa-install-banner");
    if (!banner) return;
    if (isIosDevice_()) {
        const msgEl = document.getElementById("pwa-install-banner-message");
        if (msgEl) msgEl.textContent = "Share बटन दबाकर \"Add to Home Screen\" चुनें";
        const btn = document.getElementById("pwa-install-action-btn");
        if (btn) btn.style.display = "none";
    } else if (!deferredPwaInstallPrompt_) {
        return;
    }
    banner.style.display = "flex";
}

function dismissPwaInstallBanner() {
    const banner = document.getElementById("pwa-install-banner");
    if (banner) banner.style.display = "none";
    try { localStorage.setItem("pwaInstallBannerDismissed", "1"); } catch (_e) {}
}

async function handlePwaInstallAction() {
    if (!deferredPwaInstallPrompt_) return;
    deferredPwaInstallPrompt_.prompt();
    await deferredPwaInstallPrompt_.userChoice;
    deferredPwaInstallPrompt_ = null;
    dismissPwaInstallBanner();
}

window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPwaInstallPrompt_ = event;
    showPwaInstallBanner_();
});

window.addEventListener("appinstalled", () => {
    deferredPwaInstallPrompt_ = null;
    dismissPwaInstallBanner();
});

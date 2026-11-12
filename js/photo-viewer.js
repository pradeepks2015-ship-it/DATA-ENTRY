        // ===== Photo Viewer — khinchi hui photo ko bada karke dekhna =====
        //
        // Zaroorat kyun padi: index.html ke viewport me `user-scalable=no` hai,
        // yaani app me ungli se zoom karna HAR JAGAH band hai. Aur entry ki photo
        // 240px ki patti me `object-fit: cover` se dikhti thi — chhoti bhi aur
        // kinaron se kati hui bhi. Meter ka number ya taar ka hook dekhna mumkin
        // hi nahi tha.
        //
        // Isliye zoom yahan khud likha gaya hai (Pointer Events se), browser ke
        // bharose nahi. Viewer me photo `contain` par dikhti hai — yaani POORI,
        // kati hui nahi.

        const PV_MAX_SCALE = 6;
        let pvScale = 1;
        let pvTx = 0;
        let pvTy = 0;
        const pvPointers = new Map();
        let pvStartDist = 0;
        let pvStartScale = 1;
        let pvPanFrom = null;
        let pvLastTap = 0;

        function pvApply_() {
            const img = document.getElementById("pv-img");
            if (!img) return;
            // Scale 1 par photo bilkul beech me — warna thoda khisak kar atak jaati hai
            if (pvScale <= 1) { pvTx = 0; pvTy = 0; }
            img.style.transform = `translate(${pvTx}px, ${pvTy}px) scale(${pvScale})`;
            const lbl = document.getElementById("pv-zoom-label");
            if (lbl) lbl.textContent = `${pvScale.toFixed(1)}×`;
        }

        function pvSetScale_(next) {
            pvScale = Math.min(PV_MAX_SCALE, Math.max(1, next));
            pvApply_();
        }

        function closePhotoViewer_() {
            const o = document.getElementById("photo-viewer-overlay");
            if (o) o.remove();
            pvPointers.clear();
            document.removeEventListener("keydown", pvKeydown_);
        }

        function pvKeydown_(e) {
            if (e.key === "Escape") closePhotoViewer_();
        }

        function openPhotoViewer_(src, caption) {
            if (!src) return;
            closePhotoViewer_();
            pvScale = 1; pvTx = 0; pvTy = 0;

            const overlay = document.createElement("div");
            overlay.id = "photo-viewer-overlay";
            overlay.innerHTML = trustedHtml_(`
                <div id="pv-bar">
                    <span id="pv-zoom-label">1.0×</span>
                    <span id="pv-hint">दो उँगलियों से बड़ा करें · दो बार दबाएँ</span>
                    <button type="button" id="pv-close-btn" aria-label="बंद करें">✕</button>
                </div>
                <div id="pv-stage">
                    <img id="pv-img" alt="${escapeHtml(caption || "एंट्री फोटो")}" referrerpolicy="no-referrer">
                </div>
            `);
            document.body.appendChild(overlay);
            document.getElementById("pv-img").src = src;
            document.getElementById("pv-close-btn").onclick = closePhotoViewer_;

            const stage = document.getElementById("pv-stage");
            // Khali jagah par dabane se band ho jaye — par tabhi jab zoom na kiya ho,
            // warna pan karte waqt galti se band hota rahega
            stage.addEventListener("click", (e) => {
                if (e.target === stage && pvScale <= 1) closePhotoViewer_();
            });

            // DHYAN: yahan setPointerCapture NAHI lagana. Capture lagne par baad
            // wala `click` photo ke bajaye stage par jaata hai, aur upar wali
            // "khali jagah par dabane se band" wali shart sach ho jaati hai —
            // yaani photo par ek baar dabate hi viewer band, aur do baar dabana
            // kabhi chalta hi nahi. Stage poori screen ghera hai, isliye capture
            // ki zaroorat bhi nahi — ungli uske bahar jaati hi nahi.
            stage.addEventListener("pointerdown", (e) => {
                pvPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
                if (pvPointers.size === 2) {
                    const [a, b] = [...pvPointers.values()];
                    pvStartDist = Math.hypot(a.x - b.x, a.y - b.y);
                    pvStartScale = pvScale;
                } else if (pvPointers.size === 1) {
                    pvPanFrom = { x: e.clientX - pvTx, y: e.clientY - pvTy };
                    // Do baar dabana = 1× aur 3× ke beech aana-jaana
                    const now = Date.now();
                    if (now - pvLastTap < 300) {
                        pvSetScale_(pvScale > 1.2 ? 1 : 3);
                        pvLastTap = 0;
                    } else {
                        pvLastTap = now;
                    }
                }
            });

            stage.addEventListener("pointermove", (e) => {
                if (!pvPointers.has(e.pointerId)) return;
                pvPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
                if (pvPointers.size === 2 && pvStartDist > 0) {
                    const [a, b] = [...pvPointers.values()];
                    pvSetScale_(pvStartScale * (Math.hypot(a.x - b.x, a.y - b.y) / pvStartDist));
                } else if (pvPointers.size === 1 && pvPanFrom && pvScale > 1) {
                    pvTx = e.clientX - pvPanFrom.x;
                    pvTy = e.clientY - pvPanFrom.y;
                    pvApply_();
                }
            });

            const up = (e) => {
                pvPointers.delete(e.pointerId);
                if (pvPointers.size < 2) pvStartDist = 0;
                if (pvPointers.size === 0) pvPanFrom = null;
            };
            stage.addEventListener("pointerup", up);
            stage.addEventListener("pointercancel", up);

            // Laptop par pehiya bhi chale (JE Admin Dashboard computer par dekhte hain)
            stage.addEventListener("wheel", (e) => {
                e.preventDefault();
                pvSetScale_(pvScale * (e.deltaY < 0 ? 1.15 : 1 / 1.15));
            }, { passive: false });

            document.addEventListener("keydown", pvKeydown_);
            pvApply_();
        }

        // Har photo par alag-alag onclick lagane ke bajaye ek hi jagah sunte hain.
        // Wajah: photo ka src base64 ho sakta hai (laakhon akshar) — use har img ke
        // onclick attribute me thoosna na sirf bhaari hai, balki escaping ki galti
        // ka khatra bhi hai.
        document.addEventListener("click", (e) => {
            const img = e.target.closest?.(".zoomable-photo");
            if (img && img.src) openPhotoViewer_(img.src, img.alt);
        });

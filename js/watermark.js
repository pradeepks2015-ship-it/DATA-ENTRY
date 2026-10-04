        // Watermark — home page aur DC dashboard ke peeche ki halki tasveer.
        //
        // Tasveer sirf isi phone me rehti hai (localStorage), server par kabhi nahi jaati —
        // isliye na kisi lineman ke phone par utarti hai, na data kharch hota hai, aur bina
        // internet bhi dikhti hai. Admin dashboard se badli/hataai jaati hai.

        const WM_IMG_KEY = "wm_image_v1";
        const WM_OPACITY_KEY = "wm_opacity_v1";
        const WM_DEFAULT_OPACITY = 20;      // pratishat me
        const WM_MAX_WIDTH = 900;           // isse chaudi tasveer chhoti kar di jaati hai
        const WM_JPEG_QUALITY = 0.7;
        const WM_STYLE_ID = "wm-style";

        function wmLsGet_(key) {
            try { return localStorage.getItem(key) || ""; } catch (_) { return ""; }
        }

        function wmGetOpacity_() {
            const v = parseInt(wmLsGet_(WM_OPACITY_KEY), 10);
            return Number.isFinite(v) && v >= 3 && v <= 60 ? v : WM_DEFAULT_OPACITY;
        }

        // CSS me data-URL seedhe daalna padta hai; usme " ya \ aa jaaye to style tag toot
        // sakta hai, isliye quote/backslash escape karke hi likhte hain
        function wmCssUrl_(dataUrl) {
            return '"' + String(dataUrl).replace(/[\\"]/g, "\\$&") + '"';
        }

        function applyWatermark_() {
            const img = wmLsGet_(WM_IMG_KEY);
            let style = document.getElementById(WM_STYLE_ID);
            if (!img) {
                if (style) style.remove();
                return;
            }
            if (!style) {
                style = document.createElement("style");
                style.id = WM_STYLE_ID;
                document.head.appendChild(style);
            }
            // ::after par rakha hai taaki tasveer content ke peeche rahe aur upar se ghulkar
            // aaye — warna jahan se tasveer shuru hoti hai wahan ek seedhi lakeer ban jaati hai
            style.textContent = `
                #home-view, #dc-dashboard-view { position: relative; }
                #home-view::after, #dc-dashboard-view::after {
                    content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 56%;
                    pointer-events: none; z-index: 0;
                    background: url(${wmCssUrl_(img)}) no-repeat center bottom / cover;
                    opacity: ${wmGetOpacity_() / 100};
                    -webkit-mask-image: linear-gradient(to bottom, transparent 0%, #000 38%);
                    mask-image: linear-gradient(to bottom, transparent 0%, #000 38%);
                }
                #home-view > *, #dc-dashboard-view > * { position: relative; z-index: 1; }
            `;
        }

        async function wmPickFile_(input) {
            const file = input && input.files ? input.files[0] : null;
            if (!file) return;
            if (!/^image\//.test(file.type)) {
                showToast("सिर्फ़ तस्वीर चुनें", false);
                return;
            }
            try {
                const dataUrl = await resizeImageForUpload(file, WM_MAX_WIDTH, WM_JPEG_QUALITY);
                try {
                    localStorage.setItem(WM_IMG_KEY, dataUrl);
                } catch (_) {
                    // Phone ki local jagah bhar gayi — bina bataaye chup rehna theek nahi
                    showToast("तस्वीर सेव नहीं हुई — फ़ोन की जगह भर गई है, कोई छोटी तस्वीर चुनें", false);
                    return;
                }
                applyWatermark_();
                renderWatermarkAdminPreview_();
                showToast("वॉटरमार्क लग गया", true);
            } catch (err) {
                logErr_("watermark-set", err);
                showToast("तस्वीर पढ़ी नहीं जा सकी", false);
            }
        }

        function wmClear_() {
            if (!confirm("वॉटरमार्क हटाना है?")) return;
            try { localStorage.removeItem(WM_IMG_KEY); } catch (_) {}
            applyWatermark_();
            renderWatermarkAdminPreview_();
            showToast("वॉटरमार्क हट गया", true);
        }

        function wmSetOpacity_(value) {
            try { localStorage.setItem(WM_OPACITY_KEY, String(value)); } catch (_) {}
            const label = document.getElementById("wm-opacity-value");
            if (label) label.textContent = value + "%";
            applyWatermark_();
        }

        // Admin me chhoti si jhalak — tasveer lagi hai ya nahi, yeh dikhta rahe
        function renderWatermarkAdminPreview_() {
            const box = document.getElementById("wm-preview");
            if (!box) return;
            const img = wmLsGet_(WM_IMG_KEY);
            box.textContent = "";
            if (!img) {
                box.style.display = "none";
                return;
            }
            box.style.display = "block";
            const el = document.createElement("img");
            el.src = img;
            el.alt = "अभी लगा वॉटरमार्क";
            el.style.cssText = "width:100%; max-height:120px; object-fit:contain; border-radius:8px; background:#f1f5f9;";
            box.appendChild(el);
        }

        function watermarkAdminSectionHtml_() {
            const op = wmGetOpacity_();
            return `
                <div style="background:rgba(255,255,255,0.95); border-radius:14px; padding:12px; margin-bottom:12px;">
                    <div style="font-size:11px; font-weight:900; color:#1e293b; margin-bottom:8px;">🖼️ वॉटरमार्क (होम + डैशबोर्ड के पीछे)</div>
                    <div style="font-size:10px; font-weight:700; color:#64748b; margin-bottom:8px; line-height:1.5;">तस्वीर सिर्फ़ इसी फ़ोन में रहती है — न सर्वर पर जाती है, न किसी और के फ़ोन पर। डेटा ख़र्च नहीं होता।</div>
                    <input type="file" accept="image/*" id="wm-file" onchange="wmPickFile_(this)" style="width:100%; font-size:0.72rem; margin-bottom:8px;">
                    <div id="wm-preview" style="display:none; margin-bottom:8px;"></div>
                    <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                        <span style="font-size:10px; font-weight:800; color:#64748b; white-space:nowrap;">गाढ़ापन</span>
                        <input type="range" min="3" max="60" value="${trustedHtml_(op)}" oninput="wmSetOpacity_(this.value)" style="flex:1;">
                        <span id="wm-opacity-value" style="font-size:10px; font-weight:900; color:#0f766e; min-width:34px; text-align:right;">${trustedHtml_(op)}%</span>
                    </div>
                    <button type="button" onclick="wmClear_()" style="width:100%; height:36px; border:none; border-radius:10px; background:#fee2e2; color:#b91c1c; font-size:10px; font-weight:900; text-transform:uppercase;">🗑️ वॉटरमार्क हटाएं</button>
                </div>
            `;
        }

        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", applyWatermark_);
        } else {
            applyWatermark_();
        }

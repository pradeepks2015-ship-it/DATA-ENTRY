        // ===== Home screen reminders (Push Notifications lite) =====
        // असली push notification (app बंद होने पर भी) के लिए एक push-service
        // (जैसे Firebase Cloud Messaging) चाहिए, जो इस app के पास नहीं है — सिर्फ
        // Google Apps Script backend है। इसलिए यह in-app reminder है: जब भी officer
        // Home खोले, कर्मचारी SCN में जिनका उत्तर अभी बाकी है वो यहीं दिख जाता है।
        const SCN_REPLY_WINDOW_DAYS = 7;

        function scnReminderDismissedToday_() {
            try { return localStorage.getItem("scn-reminder-dismissed") === localTodayIso_(); }
            catch (_) { return false; }
        }

        function dismissScnReminder_() {
            try { localStorage.setItem("scn-reminder-dismissed", localTodayIso_()); } catch (_) {}
            const el = document.getElementById("scn-reminder-banner");
            if (el) el.remove();
        }

        async function computeScnPendingStats_() {
            try {
                const records = await kcGetAllRecords_();
                const today = new Date(localTodayIso_());
                let pending = 0;
                let overdue = 0;
                records.forEach((r) => {
                    if (r.reply_text) return;
                    if (!r.scn_date_iso) return;
                    pending++;
                    const dueDate = new Date(r.scn_date_iso);
                    dueDate.setDate(dueDate.getDate() + SCN_REPLY_WINDOW_DAYS);
                    if (today > dueDate) overdue++;
                });
                return { pending, overdue };
            } catch (_) {
                return { pending: 0, overdue: 0 };
            }
        }

        async function renderScnReminderBanner_() {
            const existing = document.getElementById("scn-reminder-banner");
            if (existing) existing.remove();
            if (scnReminderDismissedToday_()) return;

            const homeView = document.getElementById("home-view");
            if (!homeView || !homeView.classList.contains("active")) return;

            const { pending, overdue } = await computeScnPendingStats_();
            if (!pending) return;

            const isOverdue = overdue > 0;
            const banner = document.createElement("div");
            banner.id = "scn-reminder-banner";
            banner.style.cssText = `margin:0 16px 12px 16px; background:${isOverdue ? "#fee2e2" : "#fef9c3"}; border:1.5px solid ${isOverdue ? "#fca5a5" : "#fde047"}; border-radius:12px; padding:10px 12px; display:flex; align-items:center; gap:10px;`;
            banner.innerHTML = `
                <div style="font-size:20px; flex-shrink:0;">${isOverdue ? "🔴" : "⏳"}</div>
                <div style="flex:1; min-width:0;">
                    <div style="font-size:12px; font-weight:900; color:#1e293b;">${isOverdue ? `${overdue} SCN का उत्तर समय सीमा (${SCN_REPLY_WINDOW_DAYS} दिन) पार कर चुका है` : `${pending} कर्मचारी SCN का उत्तर बाकी है`}</div>
                    <div style="font-size:10px; font-weight:700; color:#64748b;">कुल उत्तर बाकी: ${pending}</div>
                </div>
                <button type="button" onclick="switchView('karya-charitra')" style="border:none; background:#1e293b; color:#ffffff; border-radius:999px; padding:6px 10px; font-size:10px; font-weight:900; text-transform:uppercase; flex-shrink:0;">देखें</button>
                <button type="button" onclick="dismissScnReminder_()" aria-label="रिमाइंडर बंद करें" style="border:none; background:none; color:#64748b; font-size:16px; font-weight:900; cursor:pointer; flex-shrink:0; width:24px; height:24px; display:flex; align-items:center; justify-content:center;">✕</button>
            `;

            const welcomeBox = homeView.querySelector(".welcome-box");
            if (welcomeBox) welcomeBox.insertAdjacentElement("afterend", banner);
            else homeView.prepend(banner);
        }

        (function initScnReminder_() {
            const run = () => { renderScnReminderBanner_(); };
            if (document.readyState === "loading") {
                document.addEventListener("DOMContentLoaded", () => setTimeout(run, 1200));
            } else {
                setTimeout(run, 1200);
            }
        })();

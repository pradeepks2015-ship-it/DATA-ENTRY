        function resetForm(keepDc = false) {
            currentData = null;
            document.getElementById("search-ivrs").value = "";
            document.getElementById("new-mobile").value = "";
            document.getElementById("result-box").style.display = "none";
            document.getElementById("submit-btn").style.display = "none";
            if (!keepDc) {
                activeDC = "";
                const label = document.getElementById("selected-dc-label");
                if (label) label.innerText = "Choose DC Name...";
            }
        }

        function switchView(id) {
            document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
            const target = document.getElementById(id + "-view");
            if (target) {
                target.classList.add("active");
                if (id === "broken-pole") {
                    const today = localTodayIso_();
                    const now = new Date();
                    const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01`;
                    if (document.getElementById("bp-mis-from-date")) document.getElementById("bp-mis-from-date").value = firstOfMonth;
                    if (document.getElementById("bp-mis-to-date")) document.getElementById("bp-mis-to-date").value = today;
                    refreshBrokenPoleMisTotal();
                    refreshStorageCounter_("broken_pole");
                    const bpEntriesList = document.getElementById("entries-list-broken_pole");
                    if (bpEntriesList) { bpEntriesList.style.display = "none"; bpEntriesList.innerHTML = ""; }
                }
                if (id === "pdc-nontraceable") {
                    const today = localTodayIso_();
                    const now = new Date();
                    const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01`;
                    if (document.getElementById("pdc-mis-from-date")) document.getElementById("pdc-mis-from-date").value = firstOfMonth;
                    if (document.getElementById("pdc-mis-to-date")) document.getElementById("pdc-mis-to-date").value = today;
                    renderPdcPhotoSlots();
                    refreshPdcMisTotal();
                    refreshStorageCounter_("pdc_nontraceable");
                    const pdcEntriesList = document.getElementById("entries-list-pdc_nontraceable");
                    if (pdcEntriesList) { pdcEntriesList.style.display = "none"; pdcEntriesList.innerHTML = ""; }
                }
                if (id === "bijli-chori") {
                    const today = localTodayIso_();
                    const now = new Date();
                    const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01`;
                    if (document.getElementById("bc-mis-from-date")) document.getElementById("bc-mis-from-date").value = firstOfMonth;
                    if (document.getElementById("bc-mis-to-date")) document.getElementById("bc-mis-to-date").value = today;
                    renderBcPhotoSlots();
                    refreshBijliChoriMisTotal();
                    refreshStorageCounter_("bijli_chori");
                    const bcEntriesList = document.getElementById("entries-list-bijli_chori");
                    if (bcEntriesList) { bcEntriesList.style.display = "none"; bcEntriesList.innerHTML = ""; }
                }
                if (id === "karya-charitra") {
                    kcInitView_();
                }
                if (id === "mobile-update" && activeDC) {
                    ensureDcDataLoaded(activeDC);
                }
                if (id === "shms-entry") {
                    initShmsEntry();
                    setDefaultMisDates_("shms-mis-from-date", "shms-mis-to-date");
                }
                if (id === "feeder-reading") {
                    initFeederReading();
                    setDefaultMisDates_("feeder-mis-from-date", "feeder-mis-to-date");
                }
                if (id === "daily-hourly-peak-load") {
                    initDailyHourlyPeakLoad();
                    setDefaultMisDates_("peakload-mis-from-date", "peakload-mis-to-date");
                }
                if (id === "stock-material") {
                    // Show loading immediately, then fetch fresh data
                    const dash = document.getElementById("stock-dashboard-content");
                    if (dash) dash.innerHTML = `<div style="text-align:center; padding:30px; font-size:13px; font-weight:800; color:#0284c7;">⏳ Loading...</div>`;
                    loadStockMaterialsData();
                }
                if (id === "stm-complaint") {
                    initStmComplaintSignup();
                    setDefaultMisDates_("stm-mis-from-date", "stm-mis-to-date");
                    refreshStmMisTotal();
                    refreshStorageCounter_("stm_complaint");
                    const stmEntriesList = document.getElementById("entries-list-stm_complaint");
                    if (stmEntriesList) { stmEntriesList.style.display = "none"; stmEntriesList.innerHTML = ""; }
                }
                if (id === "shms-progress") {
                    initShmsProgressDashboard();
                }
                if (id === "shms-pending") {
                    initShmsPendingDashboard();
                }
                document.getElementById("back-btn").style.display = id === "home" ? "none" : "flex";
                let headerTitle = "SEONI CIRCLE";
                if (id === "dc-selection") headerTitle = activeDiv;
                if (id === "dc-dashboard") headerTitle = `DC: ${activeDC}`;
                if (id === "feeder-reading") headerTitle = "FEEDER / SS WISE INPUT";
                if (id === "daily-hourly-peak-load") headerTitle = "DAILY HOURLY PEAK LOAD";
                if (id === "stm-complaint") headerTitle = "STM COMPLAINT";
                if (id === "stock-material") headerTitle = "STOCK MATERIAL";
                if (id === "shms-entry") headerTitle = "SHMS ENTRY";
                if (id === "shms-progress") headerTitle = "DAILY PROGRESS";
                if (id === "shms-pending") headerTitle = "PENDING ENTRY";
                if (id === "material-list") headerTitle = "MATERIAL LIST";
                if (id === "material-receive") headerTitle = "MATERIAL RECEIVE";
                if (id === "material-issue") headerTitle = "MATERIAL ISSUE";
                if (id === "live-stock") headerTitle = "LIVE STOCK";
                if (id === "stock-issue-history") headerTitle = "ISSUE इतिहास";
                if (id === "stock-return") headerTitle = "RETURN PENDING";
                if (id === "low-stock") headerTitle = "LOW STOCK";
                if (id === "stock-report") headerTitle = "STOCK REPORT";
                if (id === "mobile-update") headerTitle = "UPDATE MOBILE NO";
                if (id === "broken-pole") headerTitle = "BROKEN POLE / DAMAGE LINE";
                if (id === "pdc-nontraceable") headerTitle = "PDC / NON-TRACEABLE";
                if (id === "bijli-chori") headerTitle = "बिजली चोरी की जानकारी";
                if (id === "karya-charitra") headerTitle = "कर्मचारी कार्य चरित्रावली";
                if (id === "summary") headerTitle = "PROGRESS REPORT";
                document.getElementById("main-header-title").innerText = headerTitle;
                const header = document.getElementById("app-header");
                const searchBtn = document.getElementById("search-btn");
                if (id === "home") {
                    document.documentElement.style.setProperty("--theme-color", "#6cb1e1");
                    document.documentElement.style.setProperty("--theme-grad", "linear-gradient(135deg, #6cb1e1 0%, #2f74ad 100%)");
                    header.className = "app-header bg-argentina-grad";
                } else if (id === "mobile-update") {
                    header.className = "app-header bg-red-grad";
                    if (searchBtn) searchBtn.style.background = "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)";
                } else if (id === "shms-entry") {
                    document.documentElement.style.setProperty("--theme-color", "#4338ca");
                    document.documentElement.style.setProperty("--theme-grad", "linear-gradient(135deg, #6366f1 0%, #312e81 100%)");
                    header.className = "app-header bg-indigo-grad";
                    if (searchBtn) searchBtn.style.background = "linear-gradient(135deg, #6366f1 0%, #312e81 100%)";
                } else if (id === "shms-progress") {
                    document.documentElement.style.setProperty("--theme-color", "#0d9488");
                    document.documentElement.style.setProperty("--theme-grad", "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)");
                    header.className = "app-header bg-teal-grad";
                    if (searchBtn) searchBtn.style.background = "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)";
                } else if (id === "shms-pending") {
                    document.documentElement.style.setProperty("--theme-color", "#0d9488");
                    document.documentElement.style.setProperty("--theme-grad", "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)");
                    header.className = "app-header bg-teal-grad";
                    if (searchBtn) searchBtn.style.background = "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)";
                } else if (id === "stm-complaint") {
                    document.documentElement.style.setProperty("--theme-color", "#c08a57");
                    document.documentElement.style.setProperty("--theme-grad", "linear-gradient(135deg, #c08a57 0%, #9a6737 100%)");
                    header.className = "app-header btn-stm-complaint";
                    if (searchBtn) searchBtn.style.background = "linear-gradient(135deg, #c08a57 0%, #9a6737 100%)";
                } else if (id === "feeder-reading") {
                    document.documentElement.style.setProperty("--theme-color", "#ec4899");
                    document.documentElement.style.setProperty("--theme-grad", "linear-gradient(135deg, #fbcfe8 0%, #f9a8d4 100%)");
                    header.className = "app-header btn-feeder-light-pink";
                    if (searchBtn) searchBtn.style.background = "linear-gradient(135deg, #fbcfe8 0%, #f9a8d4 100%)";
                } else if (id === "daily-hourly-peak-load") {
                    document.documentElement.style.setProperty("--theme-color", "#15803d");
                    document.documentElement.style.setProperty("--theme-grad", "linear-gradient(135deg, #16a34a 0%, #15803d 100%)");
                    header.className = "app-header btn-daily-houry-peak-load";
                    if (searchBtn) searchBtn.style.background = "linear-gradient(135deg, #16a34a 0%, #15803d 100%)";
                } else {
                    header.className = "app-header " + activeGrad;
                    if (searchBtn) searchBtn.style.background = "var(--theme-grad)";
                }
                header.classList.toggle("peak-load-header-small", id === "daily-hourly-peak-load");
                window.scrollTo(0, 0);
            }
        }

        function goBack() {
            const activeNode = document.querySelector(".view.active");
            if (!activeNode) return;
            const act = activeNode.id;
            if (act === "dc-selection-view") {
                activeDC = "";
                const label = document.getElementById("selected-dc-label");
                if (label) label.innerText = "Choose DC Name...";
                switchView("home");
            } else if (act === "stock-material-view" || act === "shms-entry-view" || act === "shms-progress-view" || act === "shms-pending-view" || act === "feeder-reading-view" || act === "daily-hourly-peak-load-view" || act === "stm-complaint-view") {
                if (act === "shms-entry-view") {
                    resetShmsForm();
                }
                if (act === "feeder-reading-view") {
                    resetFeederReading();
                }
                if (act === "daily-hourly-peak-load-view") {
                    resetPeakLoadSelection();
                }
                switchView("dc-dashboard");
            } else if (act === "material-list-view" || act === "material-receive-view" || act === "material-issue-view" || act === "live-stock-view" || act === "low-stock-view" || act === "stock-report-view" || act === "stock-issue-history-view" || act === "stock-return-view") {
                switchView("stock-material");
            } else if (act === "dc-dashboard-view") {
                activeDC = "";
                const label = document.getElementById("selected-dc-label");
                if (label) label.innerText = "Choose DC Name...";
                switchView("dc-selection");
            } else if (act === "mobile-update-view" || act === "broken-pole-view" || act === "pdc-nontraceable-view" || act === "bijli-chori-view") {
                if (act === "mobile-update-view") {
                    resetForm(true);
                }
                switchView("dc-dashboard");
            } else if (act === "summary-view") {
                if (activeViewLevel === "DC") switchView("dc-dashboard");
                else if (activeViewLevel === "DIVISION") switchView("dc-selection");
                else switchView("home");
            } else {
                switchView("home");
            }
        }

        function changeTheme(c) {
            document.documentElement.style.setProperty("--theme-color", c);
            (function () {
                const homeLogo = document.querySelector(".mpez-home-logo img");
                const headerLogo = document.getElementById("header-mpez-logo");
                if (homeLogo && headerLogo) headerLogo.src = homeLogo.src;
            })();
        // Header MPEZ logo: reuse home page logo image (no animation)
        (function initHeaderMpezLogo_() {
            const setLogo = () => {
                const homeLogo = document.getElementById("home-mpez-logo");
                const headerLogo = document.getElementById("header-mpez-logo");
                if (homeLogo && headerLogo && !headerLogo.getAttribute("src")) {
                    headerLogo.src = homeLogo.src;
                }
            };
            if (document.readyState === "loading") {
                document.addEventListener("DOMContentLoaded", setLogo);
            } else {
                setLogo();
            }
        })();

            const welcomeText = document.getElementById("welcomeText");
            if (welcomeText) welcomeText.style.color = c;
        }

        function setMode(m) {
            summaryMode = m;
            const input = document.getElementById("report-date");
            document.getElementById("opt-daily").classList.toggle("active", m === "DAILY");
            document.getElementById("opt-monthly").classList.toggle("active", m === "MONTHLY");
            if (m === "MONTHLY") {
                input.type = "month";
                input.value = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
            } else {
                input.type = "date";
                input.value = localTodayIso_();
            }
            refreshSummary();
        }

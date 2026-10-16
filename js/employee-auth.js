        // ===== Employee Login (per-device identity for accountability) =====
        // Roster + PIN check dono backend (Apps Script + Employees sheet) se aate
        // hain — client sirf PIN ka SHA-256 hash bhejta hai, plaintext kabhi nahi.
        // Login ek baar hone ke baad is device par yaad rehta hai (localStorage).
        const EMPLOYEE_LOGIN_KEY = "seoni-circle-employee-v1";

        function getLoggedInEmployee_() {
            try { return JSON.parse(localStorage.getItem(EMPLOYEE_LOGIN_KEY)); } catch (_) { return null; }
        }

        // Entries save karte waqt payload me jodne ke liye — logged-in employee ka
        // pata na ho to bhi khaali fields hi jaate hain, save block nahi hota.
        function currentEmployeeTag_() {
            const emp = getLoggedInEmployee_();
            return {
                submitted_by_id: emp?.emp_id || "",
                submitted_by_name: emp?.emp_name || ""
            };
        }

        function updateHeaderMenuEmpName_() {
            const el = document.getElementById("header-menu-emp-name");
            if (!el) return;
            const emp = getLoggedInEmployee_();
            el.textContent = emp ? `👤 ${emp.emp_name}` : "";
        }

        // Gate par do raaste hain:
        //   1. pehle se darj naam soochi me se chunein  → verifyEmployeePin
        //   2. naam na mile to khud likhein              → registerEmployee
        //
        // Soochi PEHLE dikhti hai aur "naam नहीं मिला" uske baad — jaan-bujhkar.
        // Naam har entry par USI waqt chadh jaata hai, isliye baad me sheet
        // sudharne se purani entriyan theek nahi hotin; ek hi aadmi ko teen
        // vartaniyon me batne se pehle hi rokna padta hai.
        const EMP_LOGIN_NEW = "__naya__";

        function empLoginSelectChanged_() {
            const naya = document.getElementById("emp-login-select")?.value === EMP_LOGIN_NEW;
            const nameInput = document.getElementById("emp-login-newname");
            const hint = document.getElementById("emp-login-newname-hint");
            if (nameInput) {
                nameInput.style.display = naya ? "" : "none";
                if (naya) nameInput.focus(); else nameInput.value = "";
            }
            if (hint) hint.style.display = naya ? "" : "none";
        }

        async function showEmployeeLoginGate_() {
            const modal = document.getElementById("employee-login-modal");
            if (!modal) return;
            modal.style.display = "flex";
            const select = document.getElementById("emp-login-select");
            const statusEl = document.getElementById("emp-login-status");
            select.innerHTML = `<option value="">लोड हो रहा है...</option>`;
            statusEl.textContent = "";
            let employees; // catch wala raasta return kar deta hai, isliye yahan hamesha bhar jaati hai
            try {
                const url = `${scriptURL}?action=getEmployeeNames&auth_token=${encodeURIComponent(APPS_SCRIPT_AUTH_TOKEN)}&t=${Date.now()}`;
                const data = await loadRemoteJson(url);
                employees = (data && data.status === "success" && Array.isArray(data.employees)) ? data.employees : [];
            } catch (err) {
                logErr_("emp-login-names", err);
                // Soochi na aaye to bhi raasta band na ho — naam likhkar aage
                // badh sakte hain. Pehle aadmi ke waqt soochi khali hoti hi hai.
                select.innerHTML = trustedHtml_(`<option value="${EMP_LOGIN_NEW}">➕ मेरा नाम सूची में नहीं है</option>`);
                statusEl.textContent = "नामों की सूची नहीं आ सकी — अपना नाम लिखकर आगे बढ़ें";
                empLoginSelectChanged_();
                return;
            }
            select.innerHTML = trustedHtml_(
                `<option value="">-- अपना नाम चुनें --</option>` +
                employees.map((e) => `<option value="${escapeHtml(e.emp_id)}">${escapeHtml(e.emp_name)}${e.emp_designation ? " (" + escapeHtml(e.emp_designation) + ")" : ""}</option>`).join("") +
                `<option value="${EMP_LOGIN_NEW}">➕ मेरा नाम सूची में नहीं है</option>`
            );
            if (!employees.length) {
                select.value = EMP_LOGIN_NEW;
                empLoginSelectChanged_();
            }
        }

        // Login ya registration kaamyaab hone par ek hi jagah se aage badhte hain
        function employeeLoginDone_(data) {
            const emp = { emp_id: data.emp_id, emp_name: data.emp_name, emp_designation: data.emp_designation || "" };
            try { localStorage.setItem(EMPLOYEE_LOGIN_KEY, JSON.stringify(emp)); } catch (_) {}
            document.getElementById("employee-login-modal").style.display = "none";
            const pinInput = document.getElementById("emp-login-pin");
            if (pinInput) pinInput.value = "";
            const nameInput = document.getElementById("emp-login-newname");
            if (nameInput) { nameInput.value = ""; nameInput.style.display = "none"; }
            const hint = document.getElementById("emp-login-newname-hint");
            if (hint) hint.style.display = "none";
            document.getElementById("emp-login-status").textContent = "";
            updateHeaderMenuEmpName_();
            switchView("home");
            showToast(`स्वागत है, ${emp.emp_name}`, true);
        }

        async function submitEmployeeLogin_() {
            const select = document.getElementById("emp-login-select");
            const pinInput = document.getElementById("emp-login-pin");
            const nameInput = document.getElementById("emp-login-newname");
            const statusEl = document.getElementById("emp-login-status");
            const empId = select?.value || "";
            const naya = empId === EMP_LOGIN_NEW;
            const newName = (nameInput?.value || "").replace(/\s+/g, " ").trim();
            const pin = pinInput?.value || "";

            statusEl.style.color = "#f87171";
            if (!empId) return (statusEl.textContent = "पहले अपना नाम चुनें");
            if (naya && !newName) return (statusEl.textContent = "अपना नाम लिखें");
            if (naya && newName.length < 3) return (statusEl.textContent = "पूरा नाम लिखें");
            if (!pin) return (statusEl.textContent = "PIN डालें");

            const pinHash = await sha256Hex_(pin);
            if (pinHash === null) return (statusEl.textContent = "Secure (https) connection ज़रूरी है");

            statusEl.style.color = "#94a3b8";
            statusEl.textContent = "जाँच हो रही है...";
            try {
                const payload = new URLSearchParams();
                payload.append("auth_token", APPS_SCRIPT_AUTH_TOKEN);
                payload.append("pin_hash", pinHash);
                if (naya) {
                    payload.append("action", "registerEmployee");
                    payload.append("emp_name", newName);
                } else {
                    payload.append("action", "verifyEmployeePin");
                    payload.append("emp_id", empId);
                }
                const res = await fetchWithTimeout_(scriptURL, {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
                    body: payload.toString()
                });
                const data = await res.json();
                if (data && data.status === "success") {
                    employeeLoginDone_(data);
                } else {
                    statusEl.style.color = "#f87171";
                    statusEl.textContent = (data && data.message) || "गलत PIN";
                }
            } catch (err) {
                logErr_(naya ? "emp-register" : "emp-login", err);
                statusEl.style.color = "#f87171";
                statusEl.textContent = "Network error — फिर कोशिश करें";
            }
        }

        function logoutEmployee_() {
            try { localStorage.removeItem(EMPLOYEE_LOGIN_KEY); } catch (_) {}
            updateHeaderMenuEmpName_();
            showEmployeeLoginGate_();
        }

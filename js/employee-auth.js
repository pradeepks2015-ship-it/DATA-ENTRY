        // ===== Employee Login (per-device identity for accountability) =====
        // Roster + PIN check dono backend (Apps Script + Employees sheet) se aate
        // hain — client sirf PIN ka SHA-256 hash bhejta hai, plaintext kabhi nahi.
        // Login ek baar hone ke baad is device par yaad rehta hai (localStorage).
        const EMPLOYEE_LOGIN_KEY = "seoni-circle-employee-v1";

        function getLoggedInEmployee_() {
            try { return JSON.parse(localStorage.getItem(EMPLOYEE_LOGIN_KEY)); } catch (_) { return null; }
        }

        function employeeLoggedIn_() {
            return !!getLoggedInEmployee_();
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

        async function showEmployeeLoginGate_() {
            const modal = document.getElementById("employee-login-modal");
            if (!modal) return;
            modal.style.display = "flex";
            const select = document.getElementById("emp-login-select");
            const statusEl = document.getElementById("emp-login-status");
            select.innerHTML = `<option value="">लोड हो रहा है...</option>`;
            statusEl.textContent = "";
            try {
                const url = `${scriptURL}?action=getEmployeeNames&auth_token=${encodeURIComponent(APPS_SCRIPT_AUTH_TOKEN)}&t=${Date.now()}`;
                const data = await loadRemoteJson(url);
                const employees = (data && data.status === "success" && Array.isArray(data.employees)) ? data.employees : [];
                if (!employees.length) {
                    select.innerHTML = `<option value="">कोई कर्मचारी नहीं मिला</option>`;
                    statusEl.textContent = "सूची लोड नहीं हो पाई — इंटरनेट जाँचें और फिर से खोलें";
                    return;
                }
                select.innerHTML = `<option value="">-- अपना नाम चुनें --</option>` +
                    employees.map((e) => `<option value="${escapeHtml(e.emp_id)}">${escapeHtml(e.emp_name)}${e.emp_designation ? " (" + escapeHtml(e.emp_designation) + ")" : ""}</option>`).join("");
            } catch (_) {
                select.innerHTML = `<option value="">लोड नहीं हुआ</option>`;
                statusEl.textContent = "सूची लोड नहीं हो पाई — इंटरनेट जाँचें और फिर से खोलें";
            }
        }

        async function submitEmployeeLogin_() {
            const select = document.getElementById("emp-login-select");
            const pinInput = document.getElementById("emp-login-pin");
            const statusEl = document.getElementById("emp-login-status");
            const empId = select?.value || "";
            const pin = pinInput?.value || "";
            if (!empId) return (statusEl.textContent = "पहले अपना नाम चुनें");
            if (!pin) return (statusEl.textContent = "PIN डालें");

            const pinHash = await sha256Hex_(pin);
            if (pinHash === null) return (statusEl.textContent = "Secure (https) connection ज़रूरी है");

            statusEl.style.color = "#94a3b8";
            statusEl.textContent = "जाँच हो रही है...";
            try {
                const payload = new URLSearchParams();
                payload.append("action", "verifyEmployeePin");
                payload.append("emp_id", empId);
                payload.append("pin_hash", pinHash);
                payload.append("auth_token", APPS_SCRIPT_AUTH_TOKEN);
                const res = await fetch(scriptURL, {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
                    body: payload.toString()
                });
                const data = await res.json();
                if (data && data.status === "success") {
                    const emp = { emp_id: data.emp_id, emp_name: data.emp_name, emp_designation: data.emp_designation || "" };
                    try { localStorage.setItem(EMPLOYEE_LOGIN_KEY, JSON.stringify(emp)); } catch (_) {}
                    document.getElementById("employee-login-modal").style.display = "none";
                    pinInput.value = "";
                    statusEl.textContent = "";
                    updateHeaderMenuEmpName_();
                    switchView("home");
                    showToast(`स्वागत है, ${emp.emp_name}`, true);
                } else {
                    statusEl.style.color = "#f87171";
                    statusEl.textContent = (data && data.message) || "गलत PIN";
                }
            } catch (_) {
                statusEl.style.color = "#f87171";
                statusEl.textContent = "Network error — फिर कोशिश करें";
            }
        }

        function logoutEmployee_() {
            try { localStorage.removeItem(EMPLOYEE_LOGIN_KEY); } catch (_) {}
            updateHeaderMenuEmpName_();
            showEmployeeLoginGate_();
        }

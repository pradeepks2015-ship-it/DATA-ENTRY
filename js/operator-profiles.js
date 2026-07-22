        function getSavedShmsOperator() {
            try {
                const raw = localStorage.getItem("shmsOperatorProfile");
                if (!raw) return null;
                const parsed = JSON.parse(raw);
                const fullName = String(parsed?.fullName || "").replace(/\s+/g, " ").trim();
                const mobileNo = String(parsed?.mobileNo || "").replace(/\D/g, "");
                if (!fullName || mobileNo.length < 10) return null;
                return { fullName, mobileNo, remember: true };
            } catch (_) {
                return null;
            }
        }

        function updateShmsOperatorUi() {
            const loginBlock = document.getElementById("shms-operator-login-block");
            const summaryBlock = document.getElementById("shms-operator-summary-block");
            const summaryText = document.getElementById("shms-operator-summary");
            const flowBlock = document.getElementById("shms-flow-block");
            const rememberInput = document.getElementById("shms-remember-operator");

            if (activeShmsOperator) {
                if (loginBlock) loginBlock.style.display = "none";
                if (summaryBlock) summaryBlock.style.display = "block";
                if (flowBlock) flowBlock.style.display = "block";
                if (summaryText) summaryText.innerText = `${activeShmsOperator.fullName} | ${activeShmsOperator.mobileNo}`;
            } else {
                if (loginBlock) loginBlock.style.display = "block";
                if (summaryBlock) summaryBlock.style.display = "none";
                if (flowBlock) flowBlock.style.display = "none";
                if (summaryText) summaryText.innerText = "";
                if (rememberInput) rememberInput.checked = true;
            }
        }

        function saveShmsOperator() {
            const nameInput = document.getElementById("shms-operator-name");
            const mobileInput = document.getElementById("shms-operator-mobile");
            const rememberInput = document.getElementById("shms-remember-operator");

            const fullName = String(nameInput?.value || "").replace(/\s+/g, " ").trim();
            const mobileNo = String(mobileInput?.value || "").replace(/\D/g, "");

            if (!fullName) return showToast("Operator ka full name likhiye", false);
            if (mobileNo.length < 10) return showToast("Valid mobile no likhiye", false);

            activeShmsOperator = {
                fullName,
                mobileNo,
                remember: !!rememberInput?.checked
            };

            if (activeShmsOperator.remember) {
                localStorage.setItem("shmsOperatorProfile", JSON.stringify(activeShmsOperator));
            } else {
                localStorage.removeItem("shmsOperatorProfile");
            }

            updateShmsOperatorUi();
            showToast("Operator login save ho gaya", true);
        }

        function editShmsOperator() {
            const nameInput = document.getElementById("shms-operator-name");
            const mobileInput = document.getElementById("shms-operator-mobile");
            const rememberInput = document.getElementById("shms-remember-operator");

            if (nameInput) nameInput.value = activeShmsOperator?.fullName || "";
            if (mobileInput) mobileInput.value = activeShmsOperator?.mobileNo || "";
            if (rememberInput) rememberInput.checked = activeShmsOperator?.remember !== false;

            activeShmsOperator = null;
            updateShmsOperatorUi();
        }

        function getSavedFeederOperator() {
            try {
                const raw = localStorage.getItem(feederOperatorStorageKey) || localStorage.getItem("shmsOperatorProfile");
                if (!raw) return null;
                const parsed = JSON.parse(raw);
                const fullName = String(parsed?.fullName || "").replace(/\s+/g, " ").trim();
                const mobileNo = String(parsed?.mobileNo || "").replace(/\D/g, "");
                if (!fullName || mobileNo.length < 10) return null;
                return { fullName, mobileNo, remember: true };
            } catch (_) {
                return null;
            }
        }

        function updateFeederOperatorUi() {
            const loginBlock = document.getElementById("feeder-operator-login-block");
            const summaryBlock = document.getElementById("feeder-operator-summary-block");
            const summaryText = document.getElementById("feeder-operator-summary");
            const flowBlock = document.getElementById("feeder-flow-block");
            const rememberInput = document.getElementById("feeder-remember-operator");

            if (activeFeederOperator) {
                if (loginBlock) loginBlock.style.display = "none";
                if (summaryBlock) summaryBlock.style.display = "block";
                if (flowBlock) flowBlock.style.display = "flex";
                if (summaryText) summaryText.innerText = `${activeFeederOperator.fullName} | ${activeFeederOperator.mobileNo}`;
            } else {
                if (loginBlock) loginBlock.style.display = "block";
                if (summaryBlock) summaryBlock.style.display = "none";
                if (flowBlock) flowBlock.style.display = "none";
                if (summaryText) summaryText.innerText = "";
                if (rememberInput) rememberInput.checked = true;
            }
        }

        function saveFeederOperator() {
            const nameInput = document.getElementById("feeder-operator-name");
            const mobileInput = document.getElementById("feeder-operator-mobile");
            const rememberInput = document.getElementById("feeder-remember-operator");

            const fullName = String(nameInput?.value || "").replace(/\s+/g, " ").trim();
            const mobileNo = String(mobileInput?.value || "").replace(/\D/g, "");

            if (!fullName) return showToast("Operator ka full name likhiye", false);
            if (mobileNo.length < 10) return showToast("Valid mobile no likhiye", false);

            activeFeederOperator = {
                fullName,
                mobileNo,
                remember: !!rememberInput?.checked
            };

            try {
                if (activeFeederOperator.remember) {
                    localStorage.setItem(feederOperatorStorageKey, JSON.stringify(activeFeederOperator));
                } else {
                    localStorage.removeItem(feederOperatorStorageKey);
                }
            } catch (_) {}

            updateFeederOperatorUi();
            showToast("Operator login save ho gaya", true);
        }

        function editFeederOperator() {
            const nameInput = document.getElementById("feeder-operator-name");
            const mobileInput = document.getElementById("feeder-operator-mobile");
            const rememberInput = document.getElementById("feeder-remember-operator");

            if (nameInput) nameInput.value = activeFeederOperator?.fullName || "";
            if (mobileInput) mobileInput.value = activeFeederOperator?.mobileNo || "";
            if (rememberInput) rememberInput.checked = activeFeederOperator?.remember !== false;

            activeFeederOperator = null;
            updateFeederOperatorUi();
        }

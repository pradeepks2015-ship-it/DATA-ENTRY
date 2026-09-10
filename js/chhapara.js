        // Feeder Reading ke multi-DC-split calculation (js/feeder-entry.js, js/feeder-date-picker.js)
        // me output numbers format karne ke liye — baaki is file me pehle jo standalone
        // "Chhapara feeder output calculator" UI thi wo index.html se hata di gayi thi,
        // isliye uska poora logic (add/edit/list/delete entries) yahan se bhi hata diya.
        function formatChhaparaNumber(value) {
            const num = Number(value || 0);
            if (Number.isNaN(num)) return "0";
            return num % 1 === 0 ? String(num) : num.toFixed(2);
        }

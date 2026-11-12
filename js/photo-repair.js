        // ===== छूटी हुई फ़ोटो दोबारा भेजना =====
        //
        // 12 Nov 2026 tak ek kharabi thi: photo ki teenon koshish girne par bhi
        // sync "safal" maana jaata tha. Entry server par chadh jaati, par uski
        // photo kabhi nahi pahunchti — aur kahin koi nishaan bhi nahi bachta.
        //
        // Woh kharabi ab theek hai, par us se pehle ki entriyon ki photo abhi
        // bhi server par nahi hai. Achhi baat yeh hai ki woh GAYAB NAHI hui:
        // entry apne phone me POORI sahejti hai — photo_data ke saath, aur
        // server wala entry_id bhi. Yaani jis phone se entry ki thi, usi me
        // photo aaj bhi padi hai.
        //
        // Yeh kaam wahi dhoondh kar dobara bhejta hai:
        //   phone ki entry (entry_id + photo_data)  ⟷  server ki entry
        //   server par jis photo ka photo_url khali hai, wahi chhooti hui hai
        //
        // Isliye yeh HAR LINEMAN KO APNE PHONE PAR chalana hota hai — doosre ka
        // photo_data uske phone me hai hi nahi.
        //
        // Apne aap nahi chalta: jaanchne ke liye server se poori soochi utarni
        // padti hai, aur woh data kharch hai. Button dabane par hi chalega.

        const PHOTO_REPAIR_MODULES = ["broken_pole", "bijli_chori", "dtr_health", "permanent_disconnect"];

        // Ek local entry me jo photos chadh sakti hain. index -1 ka matlab
        // "entry ki apni akeli photo" (broken_pole / dtr_health ki shakl),
        // 0,1,2... ka matlab photos[] me uska sthaan (bijli_chori / p_disconnect).
        function prLocalPhotos_(entry) {
            const out = [];
            if (entry && entry.photo_data) {
                out.push({ index: -1, data: entry.photo_data, name: entry.photo_name || "" });
            }
            if (entry && Array.isArray(entry.photos)) {
                entry.photos.forEach((p, i) => {
                    if (p && p.photo_data) out.push({ index: i, data: p.photo_data, name: p.name || "" });
                });
            }
            return out;
        }

        // Server par us jagah ki photo chadhi hai ya nahi — photo_url hone ka
        // matlab hai ki woh Drive par pahunch chuki hai.
        function prServerHasPhoto_(serverEntry, index) {
            if (!serverEntry) return false;
            if (index < 0) return !!serverEntry.photo_url;
            const p = Array.isArray(serverEntry.photos) ? serverEntry.photos[index] : null;
            return !!(p && p.photo_url);
        }

        async function repairMissingPhotos_() {
            closeHeaderMenu_?.();
            if (navigator.onLine === false) {
                return showToast("इसके लिए इंटरनेट चाहिए — नेटवर्क आने पर दोबारा दबाएँ", false);
            }

            showToast("छूटी हुई फ़ोटो ढूँढी जा रही हैं...", true);
            let jodi = 0;      // qatar me daali gayi
            let pehleSe = 0;   // pehle se qatar me thi
            let dekhi = 0;     // kitni entry jaanchi

            try {
                // Jo pehle se qatar me hain unhe dobara na daalein
                const qatar = await idbGetAll_("sync_queue");
                const pehleSeHain = new Set(
                    qatar.filter((i) => i.kind === "photo_upload")
                        .map((i) => `${i.module}|${i.entryId}|${i.photo?.index}`)
                );

                for (const module of PHOTO_REPAIR_MODULES) {
                    if (!IDB_STORES.includes(module)) continue;

                    // Sirf wahi entry jo server tak pahunch chuki hai (entry_id hai)
                    // aur jiski photo abhi phone me padi hai
                    const local = (await idbGetAll_(module))
                        .filter((e) => e && e.entry_id && prLocalPhotos_(e).length);
                    if (!local.length) continue;   // is module ke liye server se poochne ki zaroorat hi nahi

                    const server = await fetchSharedEntries_(module, true);
                    const serverById = new Map(server.map((e) => [String(e.entry_id || ""), e]));

                    for (const entry of local) {
                        const serverEntry = serverById.get(String(entry.entry_id));
                        if (!serverEntry) continue;   // server par hai hi nahi (mita di gayi) — chhod dein
                        dekhi++;
                        for (const photo of prLocalPhotos_(entry)) {
                            if (prServerHasPhoto_(serverEntry, photo.index)) continue;
                            const key = `${module}|${entry.entry_id}|${photo.index}`;
                            if (pehleSeHain.has(key)) { pehleSe++; continue; }
                            await queueOfflineSync_({ kind: "photo_upload", module, entryId: entry.entry_id, photo });
                            pehleSeHain.add(key);
                            jodi++;
                        }
                    }
                }
            } catch (err) {
                logErr_("photo-repair", err);
                return showToast("ढूँढने में दिक़्क़त आई — नेटवर्क देखकर दोबारा कोशिश करें", false);
            }

            if (!jodi && !pehleSe) {
                return showToast(dekhi
                    ? `✅ ${dekhi} एंट्री जाँची — कोई फ़ोटो छूटी नहीं`
                    : "इस फ़ोन पर ऐसी कोई एंट्री नहीं मिली", true);
            }
            if (!jodi) {
                return showToast(`${pehleSe} फ़ोटो पहले से क़तार में हैं — 🔄 अपने आप जाएँगी`, true);
            }

            showToast(`${jodi} छूटी हुई फ़ोटो मिलीं — भेजी जा रही हैं...`, true);
            await processSyncQueue_();
        }

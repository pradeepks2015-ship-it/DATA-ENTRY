        function getCurrentPositionAsync() {
            return new Promise((resolve, reject) => {
                if (!navigator.geolocation) {
                    reject(new Error("Geolocation not supported"));
                    return;
                }
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 12000,
                    maximumAge: 0
                });
            });
        }

        async function reverseGeocodeLocation(latitude, longitude) {
            try {
                const response = await fetchWithTimeout_(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`, {}, 8000);
                const data = await response.json();
                return data.display_name || `${latitude}, ${longitude}`;
            } catch (_) {
                return `${latitude}, ${longitude}`;
            }
        }

        function resizeImageForUpload(file, maxWidth = 1280, quality = 0.78) {
            // Prefer createImageBitmap: it lets the browser decode+downscale the image
            // without holding the full-resolution bitmap in JS memory, which avoids
            // "low memory" / "unable to complete previous operation" errors on phones
            // when processing large camera photos (especially multiple in a row).
            if (typeof createImageBitmap === "function") {
                return resizeImageViaBitmap_(file, maxWidth, quality).catch(() => resizeImageViaImageElement_(file, maxWidth, quality));
            }
            return resizeImageViaImageElement_(file, maxWidth, quality);
        }

        async function resizeImageViaBitmap_(file, maxWidth, quality) {
            const bitmap = await createImageBitmap(file);
            try {
                const maxHeight = maxWidth; // cap both dimensions for portrait photos too
                const ratio = Math.min(1, maxWidth / bitmap.width, maxHeight / bitmap.height);
                const targetWidth = Math.max(1, Math.round(bitmap.width * ratio));
                const targetHeight = Math.max(1, Math.round(bitmap.height * ratio));

                const canvas = document.createElement("canvas");
                canvas.width = targetWidth;
                canvas.height = targetHeight;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
                const dataUrl = canvas.toDataURL("image/jpeg", quality);
                canvas.width = 0;
                canvas.height = 0;
                return dataUrl;
            } finally {
                bitmap.close();
            }
        }

        function resizeImageViaImageElement_(file, maxWidth, quality) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    const img = new Image();
                    img.onload = () => {
                        const maxHeight = maxWidth;
                        const ratio = Math.min(1, maxWidth / img.width, maxHeight / img.height);
                        const canvas = document.createElement("canvas");
                        canvas.width = Math.max(1, Math.round(img.width * ratio));
                        canvas.height = Math.max(1, Math.round(img.height * ratio));
                        const ctx = canvas.getContext("2d");
                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                        const dataUrl = canvas.toDataURL("image/jpeg", quality);
                        canvas.width = 0;
                        canvas.height = 0;
                        resolve(dataUrl);
                    };
                    img.onerror = () => {
                        // Fallback: image format not decodable by <img> (e.g. HEIC).
                        // Use the raw file data URL as-is so the entry still saves.
                        resolve(reader.result);
                    };
                    img.src = reader.result;
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        }

        // Fetches a remote image URL (e.g. Google Drive shared photo link) and converts
        // it to a base64 data URL so it can be embedded in a jsPDF document via addImage.
        // Returns "" on any failure (CORS, offline, etc.) so callers can fall back to a
        // text link instead of breaking the PDF generation.
        // Normalizes a Google Drive "uc?export=view&id=..." URL (unreliable for <img>/CORS)
        // to the more reliable "lh3.googleusercontent.com/d/<id>" CDN format. Leaves
        // non-Drive URLs unchanged.
        function normalizeDrivePhotoUrl_(url) {
            if (!url) return url;
            const match = String(url).match(/drive\.google\.com\/uc\?export=view&id=([^&]+)/);
            if (match) return `https://lh3.googleusercontent.com/d/${match[1]}`;
            return url;
        }

        async function fetchImageAsDataUrl_(url, timeoutMs = 8000) {
            if (!url) return "";
            url = normalizeDrivePhotoUrl_(url);
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
            try {
                const response = await fetch(url, { mode: "cors", signal: controller.signal });
                if (!response.ok) return "";
                const blob = await response.blob();
                return await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result || "");
                    reader.onerror = () => resolve("");
                    reader.readAsDataURL(blob);
                });
            } catch (_) {
                return "";
            } finally {
                clearTimeout(timeoutId);
            }
        }

        // For a list of entries that may have come from the shared cloud backend
        // (where photos are stored as Drive URLs in `photo_url` / `photos[].photo_url`
        // instead of base64 `photo_data`), this fetches each missing photo and fills
        // in `photo_data` so jsPDF's addImage can embed it. Entries are mutated in place.
        // Safe to call even when all entries already have photo_data (no-op fetches).
        async function hydratePhotoDataForPdf_(entries) {
            const tasks = [];
            entries.forEach((e) => {
                if (!e.photo_data && e.photo_url) {
                    tasks.push(fetchImageAsDataUrl_(e.photo_url).then((data) => { e.photo_data = data; }));
                }
                if (Array.isArray(e.photos)) {
                    e.photos.forEach((p) => {
                        if (!p.photo_data && p.photo_url) {
                            tasks.push(fetchImageAsDataUrl_(p.photo_url).then((data) => { p.photo_data = data; }));
                        }
                    });
                }
            });
            await Promise.all(tasks);
        }


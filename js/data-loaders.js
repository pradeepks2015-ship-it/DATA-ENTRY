        async function loadShmsData(forceRefresh = false) {
            if (!forceRefresh && shmsDataLoaded && shmsRows.length) return true;
            try {
                const csvText = await loadRemoteText(shmsCsvUrl);
                shmsRows = mergeFallbackFeederRows_(parseShmsCsv(csvText));
                shmsSubstations = Array.from(new Set(shmsRows.map((row) => row.substation).filter(Boolean)));
                shmsDataLoaded = shmsRows.length > 0;
                return shmsDataLoaded;
            } catch (_) {
                shmsRows = mergeFallbackFeederRows_([]);
                shmsSubstations = Array.from(new Set(shmsRows.map((row) => row.substation).filter(Boolean)));
                shmsDataLoaded = shmsRows.length > 0;
                return shmsDataLoaded;
            }
        }

        function parseShmsCsv(csvText) {
            const lines = (csvText || "").split(/\r?\n/).filter((line) => line.trim());
            if (lines.length < 2) return [];
            return lines.slice(1).map((line) => {
                const cols = splitCsvLine(line);
                const substation = String(cols[0] || "").replace(/\s+/g, " ").trim();
                const feeder = String(cols[1] || "").replace(/\s+/g, " ").trim();
                const meterNo = String(cols[2] || "").trim();
                if (!substation || !feeder) return null;
                return { substation, feeder, meterNo };
            }).filter(Boolean);
        }

        async function loadFeederData(forceRefresh = false) {
            if (!forceRefresh && feederDataLoaded && feederRows.length) return true;
            try {
                const csvText = await loadRemoteText(feederCsvUrl);
                const allRows1 = mergeFallbackFeederRows_(parseFeederCsv(csvText));
                allFeederSubstations = Array.from(new Set(allRows1.map((row) => row.substation).filter(Boolean)));
                feederRows = allRows1.filter((row) => FEEDER_VISIBLE_SUBSTATIONS.includes(row.substation));
                feederSubstations = Array.from(new Set(feederRows.map((row) => row.substation).filter(Boolean)));
                feederDataLoaded = feederRows.length > 0;
                return feederDataLoaded;
            } catch (_) {
                try {
                    const reportLoaded = await loadFeederReportData(forceRefresh);
                    if (reportLoaded && feederReportRows.length) {
                        const allRows2 = mergeFallbackFeederRows_(buildFeederRowsFromReport_(feederReportRows));
                        allFeederSubstations = Array.from(new Set(allRows2.map((row) => row.substation).filter(Boolean)));
                        feederRows = allRows2.filter((row) => FEEDER_VISIBLE_SUBSTATIONS.includes(row.substation));
                        feederSubstations = Array.from(new Set(feederRows.map((row) => row.substation).filter(Boolean)));
                        feederDataLoaded = feederRows.length > 0;
                        return feederDataLoaded;
                    }
                } catch (_) {}

                const localRows = buildFeederRowsFromReport_(getRecentFeederSubmittedEntries_());
                const allRows3 = mergeFallbackFeederRows_(localRows);
                allFeederSubstations = Array.from(new Set(allRows3.map((row) => row.substation).filter(Boolean)));
                feederRows = allRows3.filter((row) => FEEDER_VISIBLE_SUBSTATIONS.includes(row.substation));
                feederSubstations = Array.from(new Set(feederRows.map((row) => row.substation).filter(Boolean)));
                feederDataLoaded = feederRows.length > 0;
                return feederDataLoaded;
            }
        }

        // Ensures ADEGAON/MADHI feeders (and any other fallback feeders) are always present,
        // even if they're missing from the remote feeder sheet.
        function mergeFallbackFeederRows_(rows) {
            const existingKeys = new Set(
                (rows || []).map((row) =>
                    `${normalizeFeederSubstationKey_(row["33/11 KV SUBSTATION"] || row.substation || "")}|${String(row["33 AND 11 KV FEEDER"] || row.feeder || "").trim().toUpperCase()}`
                )
            );
            const merged = [...(rows || [])];
            fallbackFeederRows.forEach((fb) => {
                const key = `${normalizeFeederSubstationKey_(fb.substation)}|${fb.feeder.toUpperCase()}`;
                if (!existingKeys.has(key)) {
                    merged.push({ ...fb, "METER NO": fb.meterNo || "", feederType: fb.feederType || "11 KV" });
                }
            });
            // MF overrides — chahe row Google Sheet se aaye ya fallback se, ye MF hamesha lagega
            const FEEDER_MF_OVERRIDES = { "BS12775548": "24000" };
            merged.forEach((row) => {
                const mNo = String(row.meterNo || row["METER NO"] || "").trim();
                if (FEEDER_MF_OVERRIDES[mNo]) {
                    row.mf = FEEDER_MF_OVERRIDES[mNo];
                    if ("MF" in row) row["MF"] = FEEDER_MF_OVERRIDES[mNo];
                }
            });
            return merged;
        }

        async function loadFeederReportData(forceRefresh = false) {
            if (!forceRefresh && feederReportLoaded && feederReportRows.length) return true;
            feederReportLoadMessage = "";
            try {
                const rawData = await loadRemoteJson(`${feederSubmitScriptUrl}?action=getFeederReadings`);
                if (rawData && !Array.isArray(rawData) && rawData.status === "success" && rawData.message) {
                    feederReportLoadMessage = String(rawData.message || "").trim();
                }
                if (rawData && !Array.isArray(rawData) && rawData.status === "error" && rawData.message) {
                    feederReportLoadMessage = String(rawData.message || "").trim();
                }
                const summaryRows = Array.isArray(rawData)
                    ? rawData
                    : Array.isArray(rawData?.data)
                        ? rawData.data
                        : Array.isArray(rawData?.rows)
                            ? rawData.rows
                            : Array.isArray(rawData?.result)
                                ? rawData.result
                                : [];

                feederReportRows = summaryRows.map((row) => {
                    const normalizedDate = String(
                        row["DATE(DD/MM/YYY)"] ||
                        row["DATE(DD/MM/YYYY)"] ||
                        row.date ||
                        ""
                    ).trim();
                    const normalizedTime = String(
                        row["TIME(HH/MM)"] ||
                        row["TIME(HH:MM)"] ||
                        row.time ||
                        ""
                    ).trim();

                    return {
                        "33/11 KV SUBSTATION": String(row["33/11 KV SUBSTATION"] || row.substation || "").trim(),
                        "33 AND 11 KV FEEDER": String(row["33 AND 11 KV FEEDER"] || row.feeder || "").trim(),
                        "METER NO": String(row["METER NO"] || row.meter_no || row.meter || "").trim(),
                        "PREVIUS READING": String(row["PREVIUS READING"] || row.previous_reading || "").trim(),
                        "CURRENT READING": String(row["CURRENT READING"] || row.current_reading || "").trim(),
                        "MF": String(row["MF"] || row.mf || "").trim(),
                        "CONSUMPTION": String(row["CONSUMPTION"] || row.consumption || "").trim(),
                        "DC NAME": String(row["DC NAME"] || row.dc_name || "").trim(),
                        "DATE(DD/MM/YYY)": normalizedDate,
                        "TIME(HH/MM)": normalizedTime
                    };
                }).filter((row) => row["33/11 KV SUBSTATION"] || row["33 AND 11 KV FEEDER"]);

                if (feederReportRows.length) {
                    feederReportLoadMessage = "";
                    feederReportLoaded = true;
                    return true;
                }
            } catch (_) {}

            try {
                const csvText = await loadRemoteText(feederReportSheetCsvUrl);
                feederReportRows = parseFeederReportCsv(csvText);
                if (feederReportRows.length) {
                    feederReportLoadMessage = "";
                    feederReportLoaded = true;
                    return true;
                }
                if (!feederReportLoadMessage) {
                    feederReportLoadMessage = "Feeder report source se data nahi mila";
                }
                feederReportRows = [];
                feederReportLoaded = false;
                return false;
            } catch (_) {
                if (!feederReportLoadMessage) {
                    feederReportLoadMessage = "Feeder report source load nahi ho paya";
                }
                feederReportRows = [];
                feederReportLoaded = false;
                return false;
            }
        }

        function parseFeederCsv(csvText) {
            const lines = (csvText || "").split(/\r?\n/).filter((line) => line.trim());
            if (lines.length < 2) return [];

            const headerCols = splitCsvLine(lines[0]).map((item) => String(item || "").trim());
            const headerKeys = headerCols.map((item) => item.toLowerCase().replace(/[^a-z0-9]+/g, ""));
            const findHeaderIndex = (keywords, fallback) => {
                const idx = headerKeys.findIndex((key) => keywords.some((word) => key.includes(word)));
                return idx > -1 ? idx : fallback;
            };

            const substationIndex = findHeaderIndex(["substation", "ssname"], 0);
            const feederIndex = findHeaderIndex(["feeder"], 1);
            const meterIndex = findHeaderIndex(["meter", "meterno", "meternumber"], 2);
            const previousIndex = findHeaderIndex(["previusreading", "previousreading", "prevreading"], 3);
            const currentIndex = findHeaderIndex(["currentreading", "currreading"], 4);
            const mfIndex = findHeaderIndex(["mf", "multiplyingfactor", "multiplierfactor"], 5);
            const dcNameIndex = findHeaderIndex(["dcname"], 7);

            return lines.slice(1).map((line) => {
                const cols = splitCsvLine(line);
                const substation = String(cols[substationIndex] || "").replace(/\s+/g, " ").trim();
                const feeder = String(cols[feederIndex] || "").replace(/\s+/g, " ").trim();
                const meterNo = String(cols[meterIndex] || "").replace(/\s+/g, " ").trim();
                const mf = String(cols[mfIndex] || "").replace(/\s+/g, " ").trim();
                const previousReadingRaw = String(cols[previousIndex] || "").replace(/\s+/g, " ").trim();
                const currentReadingRaw = String(cols[currentIndex] || "").replace(/\s+/g, " ").trim();
                const previousReading = "";
                const currentReading = "";
                const dcName = String(cols[dcNameIndex] || "").replace(/\s+/g, " ").trim();
                if (!substation || !feeder) return null;
                return {
                    substation,
                    feeder,
                    meterNo,
                    mf,
                    previousReading,
                    currentReading,
                    csvPreviousReading: previousReadingRaw,
                    csvCurrentReading: currentReadingRaw,
                    dcName,
                    feederType: feeder.includes("33") ? "33 KV" : "11 KV"
                };
            }).filter(Boolean);
        }

        function parsePeakLoadCsv(csvText) {
            const lines = (csvText || "").split(/\r?\n/).filter((line) => line.trim());
            if (lines.length < 2) return [];

            const headerCols = splitCsvLine(lines[0]).map((item) => String(item || "").trim());
            const headerKeys = headerCols.map((item) => item.toLowerCase().replace(/[^a-z0-9]+/g, ""));
            const findHeaderIndex = (keywords, fallback) => {
                const idx = headerKeys.findIndex((key) => keywords.some((word) => key.includes(word)));
                return idx > -1 ? idx : fallback;
            };

            const substationIndex = findHeaderIndex(["3311kvsubstation", "substation", "ssname"], 0);
            const feederIndex = findHeaderIndex(["11kvfeeder", "feeder"], 1);
            const meterIndex = findHeaderIndex(["meterno", "meter", "meternumber"], 2);

            return lines.slice(1).map((line) => {
                const cols = splitCsvLine(line);
                const substation = String(cols[substationIndex] || "").replace(/\s+/g, " ").trim();
                const feeder = String(cols[feederIndex] || "").replace(/\s+/g, " ").trim();
                const meterNo = String(cols[meterIndex] || "").replace(/\s+/g, " ").trim();
                if (!substation || !feeder) return null;
                return {
                    substation,
                    feeder,
                    meterNo,
                    feederType: "11 KV"
                };
            }).filter(Boolean);
        }

        async function loadPeakLoadData(forceRefresh = false) {
            if (!forceRefresh && peakLoadDataLoaded && peakLoadRows.length) return true;
            try {
                const csvText = await loadRemoteText(peakLoadCsvUrl);
                peakLoadRows = mergeFallbackFeederRows_(parsePeakLoadCsv(csvText));
                peakLoadDataLoaded = peakLoadRows.length > 0;
                return peakLoadDataLoaded;
            } catch (_) {
                try {
                    const feederLoaded = await loadFeederData(forceRefresh);
                    if (feederLoaded && feederRows.length) {
                        peakLoadRows = mergeFallbackFeederRows_(feederRows
                            .filter((row) => !String(row.feeder || "").toUpperCase().includes("33"))
                            .map((row) => ({
                                substation: String(row.substation || "").trim(),
                                feeder: String(row.feeder || "").trim(),
                                meterNo: String(row.meterNo || "").trim(),
                                feederType: "11 KV"
                            })));
                        peakLoadDataLoaded = peakLoadRows.length > 0;
                        return peakLoadDataLoaded;
                    }
                } catch (_) {}

                peakLoadRows = mergeFallbackFeederRows_([]);
                peakLoadDataLoaded = peakLoadRows.length > 0;
                return peakLoadDataLoaded;
            }
        }

        function buildFeederRowsFromReport_(rows) {
            const list = Array.isArray(rows) ? rows : [];
            const deduped = [];
            const seen = new Set();

            list.forEach((row) => {
                const substation = String(row["33/11 KV SUBSTATION"] || row.substation || "").replace(/\s+/g, " ").trim();
                const feeder = String(row["33 AND 11 KV FEEDER"] || row.feeder || "").replace(/\s+/g, " ").trim();
                if (!substation || !feeder) return;

                const key = `${normalizeFeederSubstationKey_(substation)}|${feeder.toUpperCase()}`;
                if (seen.has(key)) return;
                seen.add(key);

                deduped.push({
                    substation,
                    feeder,
                    meterNo: String(row["METER NO"] || row.meter_no || row.meterNo || row.meter || "").replace(/\s+/g, " ").trim(),
                    mf: String(row["MF"] || row.mf || "").replace(/\s+/g, " ").trim(),
                    previousReading: "",
                    currentReading: "",
                    csvPreviousReading: String(row["PREVIUS READING"] || row.previous_reading || "").replace(/\s+/g, " ").trim(),
                    csvCurrentReading: String(row["CURRENT READING"] || row.current_reading || "").replace(/\s+/g, " ").trim(),
                    dcName: String(row["DC NAME"] || row.dc_name || row.dcName || "").replace(/\s+/g, " ").trim(),
                    feederType: feeder.includes("33") ? "33 KV" : "11 KV"
                });
            });

            return deduped;
        }

        function parseFeederReportCsv(csvText) {
            const lines = (csvText || "").split(/\r?\n/).filter((line) => line.trim());
            if (lines.length < 2) return [];

            const headerCols = splitCsvLine(lines[0]).map((item) => String(item || "").trim());
            const headerKeys = headerCols.map((item) => item.toLowerCase().replace(/[^a-z0-9]+/g, ""));
            const findHeaderIndex = (keywords, fallback) => {
                const idx = headerKeys.findIndex((key) => keywords.some((word) => key.includes(word)));
                return idx > -1 ? idx : fallback;
            };

            const substationIndex = findHeaderIndex(["substation", "ssname"], 0);
            const feederIndex = findHeaderIndex(["feeder"], 1);
            const meterIndex = findHeaderIndex(["meter", "meterno", "meternumber"], 2);
            const previousIndex = findHeaderIndex(["previusreading", "previousreading", "prevreading"], 3);
            const currentIndex = findHeaderIndex(["currentreading", "currreading"], 4);
            const mfIndex = findHeaderIndex(["mf"], 5);
            const consumptionIndex = findHeaderIndex(["consumption"], 6);
            const dcNameIndex = findHeaderIndex(["dcname"], 7);
            const dateIndex = findHeaderIndex(["dateddmmyyy", "date"], 8);
            const timeIndex = findHeaderIndex(["timehhmm", "time"], 9);

            return lines.slice(1).map((line) => {
                const cols = splitCsvLine(line);
                const substation = String(cols[substationIndex] || "").replace(/\s+/g, " ").trim();
                const feeder = String(cols[feederIndex] || "").replace(/\s+/g, " ").trim();
                if (!substation || !feeder) return null;
                return {
                    "33/11 KV SUBSTATION": substation,
                    "33 AND 11 KV FEEDER": feeder,
                    "METER NO": String(cols[meterIndex] || "").replace(/\s+/g, " ").trim(),
                    "PREVIUS READING": String(cols[previousIndex] || "").replace(/\s+/g, " ").trim(),
                    "CURRENT READING": String(cols[currentIndex] || "").replace(/\s+/g, " ").trim(),
                    "MF": String(cols[mfIndex] || "").replace(/\s+/g, " ").trim(),
                    "CONSUMPTION": String(cols[consumptionIndex] || "").replace(/\s+/g, " ").trim(),
                    "DC NAME": String(cols[dcNameIndex] || "").replace(/\s+/g, " ").trim(),
                    "DATE(DD/MM/YYY)": String(cols[dateIndex] || "").replace(/\s+/g, " ").trim(),
                    "TIME(HH/MM)": String(cols[timeIndex] || "").replace(/\s+/g, " ").trim()
                };
            }).filter(Boolean);
        }


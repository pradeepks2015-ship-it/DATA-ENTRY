/**
 * ADEGAON DC SHARED DATA — BACKEND
 * ==================================================
 * Ek hi Apps Script, ek hi Google Sheet.
 *
 * ABHI JO CHALU HAI:
 *   - Photo modules (PHOTO_MODULES): broken_pole, pdc_nontraceable,
 *     stm_complaint, bijli_chori, karya_charitra, mobile_correction,
 *     device_diagnostics, dtr_health, permanent_disconnect
 *   - Feeder Reading
 *   - Employee login (getEmployeeNames / verifyEmployeePin)
 *
 * BAND KIYE JA CHUKE: stock, shms, peakload, stm
 *   App me inke button kab ke hat chuke hain. Inka code hata diya gaya hai,
 *   par doGet/doPost me ek saaf "Disabled" jawab bacha hai — taaki kisi purane
 *   phone par atki hui entry ko wajah pata chale, "Unknown action" nahi.
 *   Inki purani sheets (MasterStock, SHMS_*, Peak_*, STM_Entries) Sheet me
 *   jyon ki tyon padi hain — data kahin nahi gaya, bas code unhe chhuta nahi.
 *
 * ==================================================
 * KOI BHI BADLAV KARNE KE BAAD (kram zaroori hai):
 *   1. Ctrl+S (save)
 *   2. Deploy → Manage deployments → pencil icon
 *      → Version: "New version" → Deploy
 *      ^ Yeh chhoota to app purana code hi chalata rahega. Sirf save karna
 *        kaafi NAHI hota — 10 Oct 2026 ko isi par ghanta bharna pada tha.
 *   3. Yahi code repo me bhi daal dein: apps-script/Code.gs
 *      ^ Warna repo ki prati jhooth bolne lagegi.
 *
 * EK FILE SE ZYADA KABHI NA RAKHEIN:
 *   Apps Script saari files ko jodkar chalata hai, aur baad wali pehle wali
 *   ko daba deti hai. 10 Oct 2026 ko "कोड की कॉपी.gs" naam ki ek purani naqal
 *   mili, jisme PHOTO_MODULES ka purana roop tha — usi wajah se DTR health
 *   aur permanent disconnect ki entry MAHINON tak server tak nahi pahunchi.
 *
 * URL: AKfycbwH7cske7...  (deploy ke baad bhi wahi rehta hai)
 */

// ============================================================
// CONFIG
// ============================================================
var AUTH_TOKEN = "NlFwg1IQv6uGZz132Fti24qeG3c2ZJF2";

// Sirf EK baar likha hai — jaan-bujhkar. Pehle yeh do jagah tha aur dono alag
// ho gaye the; baad wala jeet jaata tha aur koi dekh hi nahi paata tha ki
// asli soochi kaun si chal rahi hai.
var PHOTO_MODULES = [
  "broken_pole", "pdc_nontraceable", "stm_complaint", "bijli_chori",
  "karya_charitra", "mobile_correction", "device_diagnostics",
  "dtr_health", "permanent_disconnect"
];

var DRIVE_ROOT_FOLDER_NAME = "Adegaon DC Shared Photos";
var EMPLOYEES_SHEET        = "employees";
var FEEDER_READING_SHEET   = "feeder_readings";

var FEEDER_READING_COLUMNS = [
  "33/11 KV SUBSTATION","33 AND 11 KV FEEDER","METER NO",
  "PREVIUS READING","CURRENT READING","MF","CONSUMPTION",
  "DC NAME","DATE(DD/MM/YYY)","TIME(HH/MM)"
];

// employees sheet ke khane. pin_hash me asli PIN nahi, uska SHA-256 jaata hai
// (app bhi PIN bhejne se pehle wahi banata hai) — isliye sheet dekhne wale ko
// kisi ka PIN nahi pata chalta. PIN set karne ke liye neeche setEmployeePin().
var EMPLOYEE_COLUMNS = ["emp_id","emp_name","designation","pin_hash","active"];

// ============================================================
// ONE-TIME SETUP
// ============================================================
function setupAllSheets() {
  ensureSheet_(FEEDER_READING_SHEET, FEEDER_READING_COLUMNS);
  ensureSheet_(EMPLOYEES_SHEET, EMPLOYEE_COLUMNS);
  PHOTO_MODULES.forEach(function(m) { getPhotoModuleSheet_(m); });
  Logger.log("✅ Sabhi sheets setup ho gayi hain!");
}

function ensureSheet_(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var s = ss.getSheetByName(name);
  if (!s) s = ss.insertSheet(name);
  if (s.getLastRow() === 0) { s.appendRow(headers); s.setFrozenRows(1); }
  return s;
}

// ============================================================
// AUTH
// ============================================================
function isValidToken_(e) {
  var token = (e && e.parameter && e.parameter.auth_token) || "";
  return token === AUTH_TOKEN;
}

function unauthorizedResponse_() {
  return jsonResponse_({ status: "error", message: "Unauthorized" });
}

// Wahi hash jo app banata hai (js/core-actions.js ka sha256Hex_) — chhote
// akshar wala hex, UTF-8. Dono taraf ek jaisa hona zaroori hai, warna sahi
// PIN bhi galat lagega.
function sha256Hex_(text) {
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256, String(text), Utilities.Charset.UTF_8);
  return bytes.map(function(b) {
    return ((b & 0xFF) + 0x100).toString(16).slice(1);
  }).join("");
}

// ============================================================
// doGet — Read data
// ============================================================
function doGet(e) {
  if (!isValidToken_(e)) return unauthorizedResponse_();
  try {
    var action = (e.parameter.action || "").toString();
    var module = (e.parameter.module || "").toString();

    // Band kiye gaye purane raaste — saaf wajah, taaki purane phone par atki
    // entry "Unknown action" jaisa uljha jawab na paaye
    if (action === "getMasterStock" || action === "getTransactions") {
      return jsonResponse_({ status:"error", message:"Disabled" });
    }
    if (action === "getSummary" && (module === "shms" || module === "peakload" || module === "stm")) {
      return jsonResponse_({ status:"error", message:"Disabled" });
    }
    // Mitana sirf POST se — padhne wale darwaze par nahi
    if (action === "deleteEntry") {
      return jsonResponse_({ status:"error", message:"Use POST" });
    }

    if (action === "getEmployeeNames") {
      return jsonResponse_({ status:"success", employees: getEmployeeList_() });
    }
    if (action === "getEntries") {
      return jsonResponse_({ status:"success", entries: getPhotoEntries_(module) });
    }
    if (action === "getFeederReadings") {
      return jsonResponse_(getSheetRowsPlain_(FEEDER_READING_SHEET, FEEDER_READING_COLUMNS.length));
    }

    return jsonResponse_({ status:"error", message:"Unknown action: "+action });
  } catch(err) {
    return jsonResponse_({ status:"error", message: String(err.message||err) });
  }
}

// ============================================================
// doPost — Write data
// ============================================================
function doPost(e) {
  if (!isValidToken_(e)) return unauthorizedResponse_();
  try {
    var module = (e.parameter.module || "").toString();
    var action = (e.parameter.action || "addEntry").toString();

    // Band kiye gaye purane module
    if (module === "stock" || module === "shms" || module === "peakload" || module === "stm") {
      return jsonResponse_({ status:"error", message:"Module disabled" });
    }

    // ===== EMPLOYEE LOGIN =====
    if (action === "verifyEmployeePin") {
      return jsonResponse_(verifyEmployeePin_(
        (e.parameter.emp_id || "").toString(),
        (e.parameter.pin_hash || "").toString()
      ));
    }

    // ===== FEEDER READING =====
    if (module === "feeder") {
      var feederEntries = JSON.parse(e.parameter.entries_json||"[]");
      if (!Array.isArray(feederEntries)||!feederEntries.length) {
        return jsonResponse_({ status:"error", message:"No entries" });
      }
      var feederSheet = ensureSheet_(FEEDER_READING_SHEET, FEEDER_READING_COLUMNS);
      feederEntries.forEach(function(entry) {
        feederSheet.appendRow(FEEDER_READING_COLUMNS.map(function(c){
          return entry[c]!==undefined?entry[c]:"";
        }));
      });
      return jsonResponse_({ status:"success", message:"Feeder readings saved" });
    }

    // ===== PHOTO MODULES =====
    if (PHOTO_MODULES.indexOf(module) !== -1) {

      if (action === "deleteEntry") {
        var delId = (e.parameter.entry_id||"").toString();
        return jsonResponse_({ status: deletePhotoEntry_(module,delId)?"success":"error" });
      }

      if (action === "updateEntry") {
        var updId      = (e.parameter.entry_id||"").toString();
        var updUpdates = JSON.parse(e.parameter.updates_json||"{}");
        return jsonResponse_({ status: updatePhotoEntry_(module,updId,updUpdates)?"success":"error" });
      }

      // Photo alag se — ek hi request me bheje to size ki seema paar ho jaati hai
      if (action === "uploadPhoto") {
        var upEntryId  = (e.parameter.entry_id||"").toString();
        var upPhotoData= (e.parameter.photo_data||"").toString();
        var upPhotoName= (e.parameter.photo_name||"photo").toString();
        var upPhotoIdx = parseInt(e.parameter.photo_index||"-1");
        if (!upEntryId||!upPhotoData) {
          return jsonResponse_({ status:"error", message:"entry_id and photo_data required" });
        }
        var upUrl = saveBase64PhotoToDrive_(module, upPhotoData, upPhotoName);
        if (!upUrl) return jsonResponse_({ status:"error", message:"Drive upload failed" });
        var upOk = attachPhotoUrl_(module, upEntryId, upUrl, upPhotoIdx);
        return jsonResponse_({ status: upOk?"success":"error", photo_url: upUrl });
      }

      var newEntry = JSON.parse(e.parameter.entry_json||"{}");
      var newEntryId = addPhotoEntry_(module, newEntry);
      return jsonResponse_({ status:"success", message:"Saved", entry_id: newEntryId });
    }

    return jsonResponse_({ status:"error", message:"Unknown module: "+module });
  } catch(err) {
    return jsonResponse_({ status:"error", message: String(err.message||err) });
  }
}

// ============================================================
// EMPLOYEE helpers
// ============================================================
function getEmployeeSheet_() {
  return ensureSheet_(EMPLOYEES_SHEET, EMPLOYEE_COLUMNS);
}

// "active" khana khali ho to karmchari chalu maana jaata hai — JE ne nayi
// pankti jodi aur woh khana bharna bhool gaya, to bhi kaam chalta rahe.
// Band karne ke liye usme NO likhna padta hai.
function isEmployeeActive_(value) {
  var v = String(value === undefined || value === null ? "" : value).trim().toUpperCase();
  return v !== "NO" && v !== "FALSE" && v !== "0";
}

function readEmployeeRows_() {
  var sheet = getEmployeeSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var data = sheet.getRange(2, 1, lastRow - 1, EMPLOYEE_COLUMNS.length).getValues();
  var rows = [];
  for (var i = 0; i < data.length; i++) {
    var empId = String(data[i][0] || "").trim();
    if (!empId) continue;
    rows.push({
      row: i + 2,
      emp_id: empId,
      emp_name: String(data[i][1] || "").trim(),
      designation: String(data[i][2] || "").trim(),
      pin_hash: String(data[i][3] || "").trim().toLowerCase(),
      active: isEmployeeActive_(data[i][4])
    });
  }
  return rows;
}

// App ko sirf naam ki soochi jaati hai — pin_hash kabhi bahar nahi bhejte
function getEmployeeList_() {
  return readEmployeeRows_().filter(function(r) { return r.active; }).map(function(r) {
    return { emp_id: r.emp_id, emp_name: r.emp_name, emp_designation: r.designation };
  });
}

function verifyEmployeePin_(empId, pinHash) {
  empId = String(empId || "").trim();
  pinHash = String(pinHash || "").trim().toLowerCase();
  if (!empId || !pinHash) {
    return { status:"error", message:"कर्मचारी और PIN दोनों चाहिए" };
  }
  var rows = readEmployeeRows_();
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].emp_id !== empId) continue;
    if (!rows[i].active) {
      return { status:"error", message:"यह कर्मचारी अभी सक्रिय नहीं है" };
    }
    if (!rows[i].pin_hash) {
      // PIN set hi nahi hua — JE ko saaf pata chale, "galat PIN" na dikhe
      return { status:"error", message:"इस कर्मचारी का PIN अभी तय नहीं हुआ है — JE से कहें" };
    }
    if (rows[i].pin_hash !== pinHash) {
      return { status:"error", message:"गलत PIN" };
    }
    return {
      status: "success",
      emp_id: rows[i].emp_id,
      emp_name: rows[i].emp_name,
      emp_designation: rows[i].designation
    };
  }
  return { status:"error", message:"कर्मचारी नहीं मिला" };
}

// ---- JE ke liye: editor se chalane wale do function ----
//
// Naya karmchari jodna: neeche wali pankti me apne hisaab se naam bhar kar
// dropdown se addEmployee chunein → ▷ चलाएं
function addEmployee() {
  var EMP_ID      = "E1";              // ← har karmchari ka alag, chhota sa pehchan (E1, E2, ...)
  var NAAM        = "रमेश कुमार";       // ← app me yahi dikhega
  var PAD         = "लाइनमैन";          // ← khali bhi chhod sakte hain
  var PIN         = "123456";          // ← kam se kam 6 ank rakhein

  var sheet = getEmployeeSheet_();
  var rows = readEmployeeRows_();
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].emp_id === EMP_ID) {
      Logger.log("⚠️ " + EMP_ID + " pehle se hai. PIN badalna ho to setEmployeePin chalayein.");
      return;
    }
  }
  sheet.appendRow([EMP_ID, NAAM, PAD, sha256Hex_(PIN), "YES"]);
  Logger.log("✅ " + NAAM + " (" + EMP_ID + ") jud gaya, PIN bhi set ho gaya.");
}

// Kisi ka PIN badalna: neeche ki do pankti bhar kar dropdown se
// setEmployeePin chunein → ▷ चलाएं
function setEmployeePin() {
  var EMP_ID = "E1";                   // ← kiska
  var PIN    = "123456";               // ← naya PIN

  var sheet = getEmployeeSheet_();
  var rows = readEmployeeRows_();
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].emp_id !== EMP_ID) continue;
    sheet.getRange(rows[i].row, 4).setValue(sha256Hex_(PIN));
    Logger.log("✅ " + rows[i].emp_name + " (" + EMP_ID + ") ka PIN badal diya.");
    return;
  }
  Logger.log("❌ " + EMP_ID + " nahi mila. Pehle addEmployee chalayein.");
}

// ============================================================
// GENERIC sheet row reader
// ============================================================
function getSheetRowsPlain_(sheetName, colCount) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet||sheet.getLastRow()<2) return [];
  var headers = sheet.getRange(1,1,1,colCount).getValues()[0];
  var data    = sheet.getRange(2,1,sheet.getLastRow()-1,colCount).getValues();
  return data.map(function(row){ var o={}; headers.forEach(function(h,i){ o[h]=row[i]; }); return o; });
}

// ============================================================
// PHOTO MODULES helpers
// ============================================================
function getPhotoModuleSheet_(module) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(module);
  if (!sheet) {
    sheet = ss.insertSheet(module);
    sheet.appendRow(["entry_id","timestamp","dc_name","entry_json"]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function addPhotoEntry_(module, entry) {
  var sheet = getPhotoModuleSheet_(module);
  var entryId = "E"+new Date().getTime()+"_"+Math.floor(Math.random()*100000);
  entry.entry_id  = entryId;
  entry.synced_at = new Date().toISOString();
  sheet.appendRow([entryId, entry.timestamp||new Date().toISOString(), entry.dc_name||"", JSON.stringify(entry)]);
  return entryId;
}

function getPhotoEntries_(module) {
  if (PHOTO_MODULES.indexOf(module)===-1) return [];
  var sheet = getPhotoModuleSheet_(module);
  var lastRow = sheet.getLastRow();
  if (lastRow<2) return [];
  var data = sheet.getRange(2,1,lastRow-1,4).getValues();
  var entries = [];
  for (var i=0;i<data.length;i++) {
    if (!data[i][0]||!data[i][3]) continue;
    try { var p=JSON.parse(data[i][3]); p.entry_id=data[i][0]; p._row=i+2; entries.push(p); } catch(e){}
  }
  return entries;
}

function deletePhotoEntry_(module, entryId) {
  if (!entryId) return false;
  var sheet = getPhotoModuleSheet_(module);
  var lastRow = sheet.getLastRow();
  if (lastRow<2) return false;
  var ids = sheet.getRange(2,1,lastRow-1,1).getValues();
  for (var i=0;i<ids.length;i++) {
    if (String(ids[i][0])===String(entryId)) { sheet.deleteRow(i+2); return true; }
  }
  return false;
}

function updatePhotoEntry_(module, entryId, updates) {
  var sheet = getPhotoModuleSheet_(module);
  var lastRow = sheet.getLastRow();
  if (lastRow<2) return false;
  var data = sheet.getRange(2,1,lastRow-1,4).getValues();
  for (var i=0;i<data.length;i++) {
    if (String(data[i][0])!==String(entryId)) continue;
    try {
      var entry = JSON.parse(data[i][3]);
      Object.keys(updates).forEach(function(k){ entry[k]=updates[k]; });
      sheet.getRange(i+2,4).setValue(JSON.stringify(entry));
      return true;
    } catch(e){ return false; }
  }
  return false;
}

function attachPhotoUrl_(module, entryId, photoUrl, photoIndex) {
  var sheet = getPhotoModuleSheet_(module);
  var lastRow = sheet.getLastRow();
  if (lastRow<2) return false;
  var data = sheet.getRange(2,1,lastRow-1,4).getValues();
  for (var i=0;i<data.length;i++) {
    if (String(data[i][0])!==String(entryId)) continue;
    try {
      var entry = JSON.parse(data[i][3]);
      if (photoIndex<0) { entry.photo_url=photoUrl; }
      else {
        if (!Array.isArray(entry.photos)) entry.photos=[];
        if (!entry.photos[photoIndex]) entry.photos[photoIndex]={};
        entry.photos[photoIndex].photo_url=photoUrl;
      }
      sheet.getRange(i+2,4).setValue(JSON.stringify(entry));
      return true;
    } catch(e){ return false; }
  }
  return false;
}

// ============================================================
// DRIVE helpers
// ============================================================
function getDriveFolder_(module) {
  var rootFolders = DriveApp.getFoldersByName(DRIVE_ROOT_FOLDER_NAME);
  var root = rootFolders.hasNext() ? rootFolders.next() : DriveApp.createFolder(DRIVE_ROOT_FOLDER_NAME);
  var sub = root.getFoldersByName(module);
  return sub.hasNext() ? sub.next() : root.createFolder(module);
}

// DHYAN: yahan har photo "link wale sabke liye" set hoti hai — yaani panchayat
// pramaan patra aur parisar ki photo bhi, jiska link mil jaye woh dekh sakta
// hai. Yeh C1-kh (har karmchari ki apni chabi) ke saath theek hoga; abhi
// badlenge to purani sabhi photo app me dikhni band ho jaayengi.
function saveBase64PhotoToDrive_(module, base64DataUrl, fileNameHint) {
  if (!base64DataUrl) return "";
  try {
    var match = base64DataUrl.match(/^data:([^;]+);base64,(.*)$/);
    var mimeType = match ? match[1] : "image/jpeg";
    var data     = match ? match[2] : base64DataUrl;
    var ext      = mimeType.split("/")[1]||"jpg";
    var fileName = (fileNameHint||"photo")+"_"+new Date().getTime()+"."+ext;
    var blob     = Utilities.newBlob(Utilities.base64Decode(data), mimeType, fileName);
    var folder   = getDriveFolder_(module);
    var file     = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return "https://lh3.googleusercontent.com/d/"+file.getId();
  } catch(err){ return ""; }
}

// ============================================================
// UTILITY
// ============================================================
function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// Jaanch ke liye: dropdown se chunkar ▷ चलाएं — log me dikhega ki chalta hua
// code kaun se module dekh raha hai. 10 Oct ko isi ne purani naqal pakdi thi.
function checkModules() {
  Logger.log("Kul: " + PHOTO_MODULES.length);
  Logger.log(PHOTO_MODULES.join(" | "));
}

var PHOTO_MODULES = ["broken_pole", "pdc_nontraceable", "stm_complaint", "bijli_chori", "karya_charitra", "mobile_correction", "device_diagnostics", "dtr_health", "permanent_disconnect"];
var AUTH_TOKEN = "NlFwg1IQv6uGZz132Fti24qeG3c2ZJF2";
function isValidToken_(e) {
  var token = (e && e.parameter && e.parameter.auth_token) || "";
  return token === AUTH_TOKEN;
}

function unauthorizedResponse_() {
  return ContentService
    .createTextOutput(JSON.stringify({ status: "error", message: "Unauthorized" }))
    .setMimeType(ContentService.MimeType.JSON);
}/**
 * ADEGAON DC SHARED DATA — MASTER COMBINED BACKEND
 * ==================================================
 * Ek hi Apps Script, ek hi Google Sheet — sabhi modules:
 *   Stock Material, SHMS, STM Complaint, Peak Load,
 *   Broken Pole, PDC, Bijli Chori, Karya Charitra,
 *   Feeder Reading
 *
 * DEPLOY STEPS (one-time):
 * 1. "Adegaon DC Shared Data" sheet kholein
 * 2. Extensions → Apps Script
 * 3. Pura purana code delete karein (Ctrl+A → Delete)
 * 4. Yeh pura code paste karein → Ctrl+S save karein
 * 5. Function dropdown se "setupAllSheets" select karein → Run karein
 *    (Permission maange to Allow karein)
 * 6. Deploy → Manage deployments → pencil icon
 *    → Version: "New version" → Deploy
 * URL same rahega: AKfycbwH7cske7...
 */

// ============================================================
// MODULES CONFIG
// ============================================================
var PHOTO_MODULES = ["broken_pole", "pdc_nontraceable", "stm_complaint", "bijli_chori", "karya_charitra", "mobile_correction", "device_diagnostics", "dtr_health", "permanent_disconnect"];
var DRIVE_ROOT_FOLDER_NAME = "Adegaon DC Shared Photos";

var STOCK_MASTER_SHEET   = "MasterStock";
var STOCK_TX_SHEET       = "Transactions";
var SHMS_MASTER_SHEET    = "SHMS_FeederMaster";
var SHMS_ENTRIES_SHEET   = "SHMS_Entries";
var PEAK_MASTER_SHEET    = "Peak_FeederMaster";
var PEAK_READINGS_SHEET  = "Peak_Readings";
var STM_ENTRIES_SHEET    = "STM_Entries";
var FEEDER_READING_SHEET = "feeder_readings";

var SHMS_ENTRY_COLUMNS = [
  "substation","feeder","event_type","date","time_from","time_to",
  "total_duration","reason","meter_no","operator_name","operator_mobile","submitted_at"
];
var PEAK_READING_COLUMNS = [
  "33/11 KV SUBSTATION","11 KV FEEDER","METER NO",
  "DATE (DD-MM-YYYY)","TIME (HH:MM)","PEAK LOAD (A)",
  "NAME OF OPERATOR","SUBMISSION DATE","SUBMISSION TIME"
];
var FEEDER_READING_COLUMNS = [
  "33/11 KV SUBSTATION","33 AND 11 KV FEEDER","METER NO",
  "PREVIUS READING","CURRENT READING","MF","CONSUMPTION",
  "DC NAME","DATE(DD/MM/YYY)","TIME(HH/MM)"
];
var STM_ENTRY_COLUMNS = [
  "timestamp","date","time","substation","operator_name","mobile_no",
  "information_shared_at","calling_info","complaint_details","photo_url","photo_name"
];

// ============================================================
// ONE-TIME SETUP
// ============================================================
function setupAllSheets() {
  // Stock
  ensureSheet_(STOCK_MASTER_SHEET,  ["MATERIAL NAME","UNIT","OPENING STOCK","BALANCE STOCK"]);
  ensureSheet_(STOCK_TX_SHEET,      ["timestamp","type","received_from","receive_person_name","issue_to_dc_name","issue_to_person_name","remark","items_json","return_type","expected_return_date","returned","return_date","return_time"]);
  // SHMS
  ensureSheet_(SHMS_MASTER_SHEET,   ["33/11 KV SUBSTATION","11 KV FEEDER","METER NO"]);
  ensureSheet_(SHMS_ENTRIES_SHEET,  SHMS_ENTRY_COLUMNS);
  // Peak Load
  ensureSheet_(PEAK_MASTER_SHEET,   ["33/11 KV SUBSTATION","11 KV FEEDER","METER NO"]);
  ensureSheet_(PEAK_READINGS_SHEET, PEAK_READING_COLUMNS);
  // STM
  ensureSheet_(STM_ENTRIES_SHEET,   STM_ENTRY_COLUMNS);
  // Feeder Reading
  ensureSheet_(FEEDER_READING_SHEET, FEEDER_READING_COLUMNS);
  // Photo modules (broken_pole, pdc_nontraceable, bijli_chori, karya_charitra)
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
// doGet — Read data
// ============================================================
function doGet(e) {
 if (!isValidToken_(e)) return unauthorizedResponse_();
  try {
    var action = (e.parameter.action || "").toString();
    var module = (e.parameter.module || "").toString();
// Band kiye gaye purane raaste
    if (action === "getMasterStock" || action === "getTransactions") return jsonResponse_({ status:"error", message:"Disabled" });
    if (action === "getSummary" && (module === "shms" || module === "peakload" || module === "stm")) return jsonResponse_({ status:"error", message:"Disabled" });
    // Mitana sirf POST se — padhne wale darwaze par nahi
    if (action === "deleteEntry") return jsonResponse_({ status:"error", message:"Use POST" });
    // Photo modules
    if (action === "getEntries") return jsonResponse_({ status:"success", entries: getPhotoEntries_(module) });



    // Feeder Reading
    if (action === "getFeederReadings") return jsonResponse_(getSheetRowsPlain_(FEEDER_READING_SHEET, FEEDER_READING_COLUMNS.length));

    // Delete entry (photo modules)
    if (action === "deleteEntry") {
      var ok = deletePhotoEntry_(module, (e.parameter.entry_id||"").toString());
      return jsonResponse_({ status: ok?"success":"error" });
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
// Band kiye gaye purane module — app inhe ab istemal nahi karta
    if (module === "stock" || module === "shms" || module === "peakload" || module === "stm") return jsonResponse_({ status:"error", message:"Module disabled" });
    // ===== STOCK =====
    if (module === "stock") {
      if (action === "bulkUpdateBalance") {
        var updatesJson = (e.parameter.updates_json || "[]").toString();
        var updates = JSON.parse(updatesJson);
        var ubSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(STOCK_MASTER_SHEET);
        if (!ubSheet) return jsonResponse_({ status:"error", message:"MasterStock sheet not found" });
        var lastRow = ubSheet.getLastRow();
        if (lastRow < 2) return jsonResponse_({ status:"error", message:"No data in sheet" });
        // Read all names at once
        var nameData = ubSheet.getRange(2, 1, lastRow - 1, 1).getValues();
        var balData  = ubSheet.getRange(2, 4, lastRow - 1, 1).getValues();
        // Apply all updates in memory
        updates.forEach(function(u) {
          var uName = String(u.name || "").trim().toLowerCase();
          for (var i = 0; i < nameData.length; i++) {
            if (String(nameData[i][0] || "").trim().toLowerCase() === uName) {
              balData[i][0] = Number(u.bal) || 0;
              break;
            }
          }
        });
        // Write all balances in ONE range call — fast
        ubSheet.getRange(2, 4, lastRow - 1, 1).setValues(balData);
        return jsonResponse_({ status:"success", message:"Bulk update done" });
      }

      if (action === "updateBalance") {
        var ubName = (e.parameter.material_name || "").toString().trim();
        var ubBal  = parseFloat(e.parameter.balance_stock || "0") || 0;
        if (!ubName) return jsonResponse_({ status:"error", message:"Material name required" });
        var ubSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(STOCK_MASTER_SHEET);
        if (!ubSheet) return jsonResponse_({ status:"error", message:"MasterStock sheet not found" });
        var ubData = ubSheet.getRange(2,1,Math.max(1,ubSheet.getLastRow()-1),4).getValues();
        for (var ui=0; ui<ubData.length; ui++) {
          if (String(ubData[ui][0]||"").trim().toLowerCase() === ubName.toLowerCase()) {
            ubSheet.getRange(ui+2, 4).setValue(ubBal);
            return jsonResponse_({ status:"success", message:"Balance updated" });
          }
        }
        return jsonResponse_({ status:"error", message:"Material not found" });
      }

      if (action === "addMaterial") {
        var mName  = (e.parameter.material_name||"").toString().trim();
        var mUnit  = (e.parameter.unit||"Nos").toString().trim();
        var mOpen  = parseFloat(e.parameter.opening_stock||"0")||0;
        var mBal   = parseFloat(e.parameter.balance_stock||"0")||0;
        if (!mName) return jsonResponse_({ status:"error", message:"Material name required" });
        var ms = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(STOCK_MASTER_SHEET) || ensureSheet_(STOCK_MASTER_SHEET,["MATERIAL NAME","UNIT","OPENING STOCK","BALANCE STOCK"]);
        ms.appendRow([mName, mUnit, mOpen, mBal]);
        return jsonResponse_({ status:"success", message: mName+" added" });
      }
      // Receive / Issue
      var receivedFrom   = (e.parameter.receved_from||e.parameter.received_from||"").toString();
      var receivePersonName = (e.parameter.receive_person_name||"").toString();
      var issueToDcName  = (e.parameter.issue_to_dc_name||"").toString();
      var issueToPersonName = (e.parameter.issue_to_person_name||"").toString();
      var remark         = (e.parameter.remark||"").toString();
      var items          = JSON.parse(e.parameter.items_json||"[]");
      if (!Array.isArray(items)||!items.length) return jsonResponse_({ status:"error", message:"No items" });
      var isReceive = !!(receivedFrom||receivePersonName);
      var type = isReceive?"RECEIVE":"ISSUE";
      var returnType = (e.parameter.return_type || "").toString();
      var expectedReturn = (e.parameter.expected_return_date || "").toString();
      var tx = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(STOCK_TX_SHEET)||ensureSheet_(STOCK_TX_SHEET,["timestamp","type","received_from","receive_person_name","issue_to_dc_name","issue_to_person_name","remark","items_json","return_type","expected_return_date","returned","return_date","return_time"]);
      tx.appendRow([new Date().toISOString(),type,receivedFrom,receivePersonName,issueToDcName,issueToPersonName,remark,JSON.stringify(items),returnType,expectedReturn,"","",""]);
      updateBalanceStock_(items, isReceive);
      return jsonResponse_({ status:"success", message: type+" recorded" });
    }

    // ===== SHMS =====
    if (module === "shms") {
      var shmsEntries = JSON.parse(e.parameter.entries_json||"[]");
      if (!Array.isArray(shmsEntries)||!shmsEntries.length) return jsonResponse_({ status:"error", message:"No entries" });
      var shmsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHMS_ENTRIES_SHEET)||ensureSheet_(SHMS_ENTRIES_SHEET, SHMS_ENTRY_COLUMNS);
      shmsEntries.forEach(function(entry) {
        shmsSheet.appendRow(SHMS_ENTRY_COLUMNS.map(function(c){ return entry[c]!==undefined?entry[c]:""; }));
      });
      return jsonResponse_({ status:"success", message:"SHMS entries saved" });
    }

    // ===== PEAK LOAD =====
    if (module === "peakload") {
      var peakEntries = JSON.parse(e.parameter.entries_json||"[]");
      if (!Array.isArray(peakEntries)||!peakEntries.length) return jsonResponse_({ status:"error", message:"No entries" });
      var peakSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PEAK_READINGS_SHEET)||ensureSheet_(PEAK_READINGS_SHEET, PEAK_READING_COLUMNS);
      peakEntries.forEach(function(entry) {
        peakSheet.appendRow(PEAK_READING_COLUMNS.map(function(c){ return entry[c]!==undefined?entry[c]:""; }));
      });
      return jsonResponse_({ status:"success", message:"Peak load saved" });
    }

    // ===== STM COMPLAINT =====
    if (module === "stm") {
      var stmSubstation    = (e.parameter.substation||"").toString();
      var stmOperator      = (e.parameter.operator_name||"").toString();
      var stmMobile        = (e.parameter.mobile_no||"").toString();
      var stmSharedAt      = (e.parameter.information_shared_at||"").toString();
      var stmDate          = (e.parameter.date||"").toString();
      var stmTime          = (e.parameter.time||"").toString();
      var stmCallingInfo   = (e.parameter.calling_info||"").toString();
      var stmComplaint     = (e.parameter.complaint_details||"").toString();
      var stmPhotoBase64   = (e.parameter.photo_base64||"").toString();
      var stmPhotoName     = (e.parameter.photo_name||"").toString();
      var stmPhotoMime     = (e.parameter.photo_mime_type||"image/jpeg").toString();
      if (!stmSubstation||!stmComplaint) return jsonResponse_({ status:"error", message:"Substation aur complaint required" });
      var stmPhotoUrl = stmPhotoBase64 ? saveBase64PhotoToDrive_("stm_complaint", stmPhotoBase64, stmPhotoName) : "";
      var stmSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(STM_ENTRIES_SHEET)||ensureSheet_(STM_ENTRIES_SHEET, STM_ENTRY_COLUMNS);
      stmSheet.appendRow([new Date().toISOString(),stmDate,stmTime,stmSubstation,stmOperator,stmMobile,stmSharedAt,stmCallingInfo,stmComplaint,stmPhotoUrl,stmPhotoName]);
      return jsonResponse_({ status:"success", message:"STM complaint saved" });
    }

    // ===== FEEDER READING =====
    if (module === "feeder") {
      var feederEntries = JSON.parse(e.parameter.entries_json||"[]");
      if (!Array.isArray(feederEntries)||!feederEntries.length) return jsonResponse_({ status:"error", message:"No entries" });
      var feederSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(FEEDER_READING_SHEET)||ensureSheet_(FEEDER_READING_SHEET, FEEDER_READING_COLUMNS);
      feederEntries.forEach(function(entry) {
        feederSheet.appendRow(FEEDER_READING_COLUMNS.map(function(c){ return entry[c]!==undefined?entry[c]:""; }));
      });
      return jsonResponse_({ status:"success", message:"Feeder readings saved" });
    }

    // ===== PHOTO MODULES (broken_pole, pdc_nontraceable, bijli_chori, karya_charitra) =====
    if (PHOTO_MODULES.indexOf(module) !== -1) {

      // Delete
      if (action === "deleteEntry") {
        var delId = (e.parameter.entry_id||"").toString();
        return jsonResponse_({ status: deletePhotoEntry_(module,delId)?"success":"error" });
      }

      // Update (reply/remark for karya_charitra)
      if (action === "updateEntry") {
        var updId      = (e.parameter.entry_id||"").toString();
        var updUpdates = JSON.parse(e.parameter.updates_json||"{}");
        return jsonResponse_({ status: updatePhotoEntry_(module,updId,updUpdates)?"success":"error" });
      }

      // Upload photo separately (to avoid URL param size limit)
      if (action === "uploadPhoto") {
        var upEntryId  = (e.parameter.entry_id||"").toString();
        var upPhotoData= (e.parameter.photo_data||"").toString();
        var upPhotoName= (e.parameter.photo_name||"photo").toString();
        var upPhotoIdx = parseInt(e.parameter.photo_index||"-1");
        if (!upEntryId||!upPhotoData) return jsonResponse_({ status:"error", message:"entry_id and photo_data required" });
        var upUrl = saveBase64PhotoToDrive_(module, upPhotoData, upPhotoName);
        if (!upUrl) return jsonResponse_({ status:"error", message:"Drive upload failed" });
        var upOk = attachPhotoUrl_(module, upEntryId, upUrl, upPhotoIdx);
        return jsonResponse_({ status: upOk?"success":"error", photo_url: upUrl });
      }

      // Add entry (metadata only, photos come via uploadPhoto)
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
// STOCK helpers
// ============================================================
function getMasterStockRows_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(STOCK_MASTER_SHEET);
  if (!sheet||sheet.getLastRow()<2) return [];
  var data = sheet.getRange(2,1,sheet.getLastRow()-1,4).getValues();
  var rows = [];
  for (var i=0;i<data.length;i++) {
    var n = String(data[i][0]||"").trim();
    if (!n) continue;
    rows.push({ id:"M"+String(i+1).padStart(3,"0"), material_name:n, unit:String(data[i][1]||"Nos").trim(), opening_stock:Number(data[i][2]||0), balance_stock:Number(data[i][3]||0) });
  }
  return rows;
}

function getStockTxRows_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(STOCK_TX_SHEET);
  if (!sheet||sheet.getLastRow()<2) return [];
  var headers = ["timestamp","type","received_from","receive_person_name","issue_to_dc_name","issue_to_person_name","remark","items_json"];
  var data = sheet.getRange(2,1,sheet.getLastRow()-1,8).getValues();
  return data.map(function(row){ var o={}; headers.forEach(function(h,i){ o[h]=row[i]; }); return o; });
}

function updateBalanceStock_(items, isReceive) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(STOCK_MASTER_SHEET);
  if (!sheet||sheet.getLastRow()<2) return;
  var nameRange = sheet.getRange(2,1,sheet.getLastRow()-1,1).getValues();
  var balRange  = sheet.getRange(2,4,sheet.getLastRow()-1,1);
  var bals      = balRange.getValues();
  items.forEach(function(item){
    var iName = String(item.material_name||"").trim().toLowerCase();
    var qty   = Number(item.qty||0);
    if (!iName||!qty) return;
    for (var i=0;i<nameRange.length;i++) {
      if (String(nameRange[i][0]||"").trim().toLowerCase()===iName) {
        bals[i][0] = isReceive ? (Number(bals[i][0]||0)+qty) : (Number(bals[i][0]||0)-qty);
        break;
      }
    }
  });
  balRange.setValues(bals);
}

// ============================================================
// GENERIC sheet row readers
// ============================================================
function getSheetRows_(sheetName, colCount) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet||sheet.getLastRow()<2) return [];
  var headers = sheet.getRange(1,1,1,colCount).getValues()[0];
  var data    = sheet.getRange(2,1,sheet.getLastRow()-1,colCount).getValues();
  return data.map(function(row){ var o={}; headers.forEach(function(h,i){ o[h]=row[i]; }); return o; });
}

function getSheetRowsPlain_(sheetName, colCount) {
  // Returns plain array (not wrapped) for backward compat with feeder/stm getSummary
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

function checkModules() {
  Logger.log("Kul: " + PHOTO_MODULES.length);
  Logger.log(PHOTO_MODULES.join(" | "));
}

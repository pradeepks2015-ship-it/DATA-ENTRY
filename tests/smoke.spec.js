// @ts-check
// Seoni Circle App — smoke tests
// हर बाहरी request (CDN/Google Sheets/Apps Script) block की जाती है ताकि:
//  1. tests कभी असली production Google Sheet/Apps Script को न छुएं
//  2. हर PR पर app का core navigation + security + offline-sync रास्ता अपने आप जांचा जाए
const { test, expect } = require('@playwright/test');

/** @param {import('@playwright/test').Page} page */
async function blockExternal(page) {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (route) => route.abort());
}

/**
 * blockExternal को पहले register करता है, फिर (अगर दिया हो) beforeGoto से कोई ज़्यादा
 * specific route जोड़ने देता है — Playwright बाद में register हुए route को पहले चेक
 * करता है, इसलिए specific route (जैसे सिर्फ़ **\/macros/**) blockExternal के catch-all
 * से पहले माना जाएगा।
 * @param {import('@playwright/test').Page} page
 * @param {{ beforeGoto?: (page: import('@playwright/test').Page) => Promise<void> }} [opts]
 */
async function openApp(page, opts = {}) {
  await blockExternal(page);
  if (opts.beforeGoto) await opts.beforeGoto(page);
  await page.goto('/');
  await page.waitForFunction(() => document.getElementById('home-view').classList.contains('active'), null, { timeout: 15000 });
}

/**
 * Home → Seoni Division → पहला DC चुनकर dc-dashboard-view तक पहुंचाता है।
 * @param {import('@playwright/test').Page} page
 */
async function goToDcDashboard(page) {
  await page.click('.list-item.bg-blue-grad'); // Seoni Division
  await page.waitForFunction(() => document.getElementById('dc-selection-view').classList.contains('active'));
  await page.click('#prof-trigger');
  await page.click('#dc-menu .option-item >> nth=0');
  await page.waitForFunction(() => document.getElementById('dc-dashboard-view').classList.contains('active'));
}

test.describe('बूट और होम स्क्रीन', () => {
  test('app बिना error के खुलती है, Argentina theme दिखती है', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await openApp(page);
    await expect(page.locator('#welcomeText')).toBeVisible();
    const headerBg = await page.locator('#app-header').evaluate((el) => getComputedStyle(el).backgroundImage);
    expect(headerBg).toContain('gradient'); // .bg-argentina-grad
    expect(errors).toEqual([]);
  });

  test('दोनों Division tiles दिखते हैं और होम पर सिर्फ यही एंट्री-पॉइंट है', async ({ page }) => {
    await openApp(page);
    await expect(page.locator('.list-item')).toHaveCount(2);
    await expect(page.locator('.list-item').nth(0)).toContainText('Seoni');
    await expect(page.locator('.list-item').nth(1)).toContainText('Lakhnadon');
  });
});

test.describe('DC dashboard — hidden/removed features', () => {
  test('dc-dashboard पर ठीक 6 buttons दिखते हैं, कोई SHMS/Stock/PDC/STM/PeakLoad नहीं', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await openApp(page);
    await goToDcDashboard(page);

    const buttons = await page.locator('#dc-dashboard-view .dashboard-btn').allTextContents();
    expect(buttons.map((b) => b.trim().replace(/\s+/g, ' '))).toEqual([
      '1. VASOOLI TRACKER',
      '2. Mobile No Update',
      '3. Broken Pole / Damage Line',
      '4. FEEDER / SS WISE INPUT',
      '5. बिजली चोरी की जानकारी',
      '6. 📋 कर्मचारी कार्य चरित्रावली',
    ]);
    // Broken Pole aur बिजली चोरी ab custom SVG icon use karte hain (emoji nahi)
    await expect(page.locator('#dc-dashboard-view .dashboard-btn').nth(2).locator('svg')).toBeVisible();
    await expect(page.locator('#dc-dashboard-view .dashboard-btn').nth(4).locator('svg')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('हटाए गए features का ना कोई view बचा है, ना कोई function', async ({ page }) => {
    await openApp(page);
    await goToDcDashboard(page);
    const state = await page.evaluate(() => ({
      views: {
        shmsEntry: !!document.getElementById('shms-entry-view'),
        shmsProgress: !!document.getElementById('shms-progress-view'),
        shmsPending: !!document.getElementById('shms-pending-view'),
        stockMaterial: !!document.getElementById('stock-material-view'),
        pdc: !!document.getElementById('pdc-nontraceable-view'),
        stm: !!document.getElementById('stm-complaint-view'),
        peakLoad: !!document.getElementById('daily-hourly-peak-load-view'),
      },
      fns: {
        initShmsEntry: typeof window.initShmsEntry,
        getSavedShmsOperator: typeof window.getSavedShmsOperator,
        loadShmsData: typeof window.loadShmsData,
        renderStockDashboard: typeof window.renderStockDashboard,
        openStockDashboard: typeof window.openStockDashboard,
        initStmComplaintSignup: typeof window.initStmComplaintSignup,
        renderPdcPhotoSlots: typeof window.renderPdcPhotoSlots,
        initDailyHourlyPeakLoad: typeof window.initDailyHourlyPeakLoad,
      },
    }));
    Object.values(state.views).forEach((v) => expect(v).toBe(false));
    Object.values(state.fns).forEach((v) => expect(v).toBe('undefined'));
  });
});

test.describe('Feeder Reading (active feature)', () => {
  test('view खुलता है, dropdown toggle और backend-status button काम करते हैं', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await openApp(page);
    await goToDcDashboard(page);
    await page.evaluate(() => switchView('feeder-reading'));
    await page.waitForFunction(() => document.getElementById('feeder-reading-view').classList.contains('active'));

    await expect(page.locator('[onclick="checkFeederBackendStatus()"]')).toBeVisible();
    const dropdownOk = await page.evaluate(() => {
      try { toggleFeederDropdown('substation'); return true; } catch (_) { return false; }
    });
    expect(dropdownOk).toBe(true);
    expect(errors).toEqual([]);
  });
});

test.describe('Broken Pole / बिजली चोरी / कर्मचारी कार्य चरित्रावली (active features)', () => {
  for (const [id, viewId] of [
    ['broken-pole', 'broken-pole-view'],
    ['bijli-chori', 'bijli-chori-view'],
    ['karya-charitra', 'karya-charitra-view'],
  ]) {
    test(`${id} view बिना error के खुलता है`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await openApp(page);
      await goToDcDashboard(page);
      await page.evaluate((viewName) => switchView(viewName), id);
      await page.waitForFunction((v) => document.getElementById(v).classList.contains('active'), viewId);
      expect(errors).toEqual([]);
    });
  }

  test('goBack() हर जगह से dc-dashboard पर वापस लाता है', async ({ page }) => {
    await openApp(page);
    await goToDcDashboard(page);
    await page.evaluate(() => switchView('broken-pole'));
    await page.evaluate(() => goBack());
    await page.waitForFunction(() => document.getElementById('dc-dashboard-view').classList.contains('active'));
  });
});

test.describe('Error log (Polish)', () => {
  test('uncaught JS error अपने आप log हो जाती है और modal में दिखती है', async ({ page }) => {
    await openApp(page);
    await page.evaluate(() => {
      localStorage.removeItem('seoni-circle-error-log');
      setTimeout(() => { throw new Error('smoke-test-uncaught'); }, 0);
    });
    await page.waitForTimeout(300);

    const logs = await page.evaluate(() => getErrorLogs_());
    expect(logs.some((l) => l.ctx === 'js-error' && l.msg.includes('smoke-test-uncaught'))).toBe(true);

    await page.click('#header-menu-btn');
    await page.click('[aria-label="एरर लॉग देखें"]');
    await expect(page.locator('#error-log-overlay')).toBeVisible();
    await expect(page.locator('#error-log-list')).toContainText('smoke-test-uncaught');
  });

  test('लॉग साफ़ करें बटन काम करता है', async ({ page }) => {
    await openApp(page);
    await page.evaluate(() => logErr_('manual-test', new Error('to be cleared')));
    await page.click('#header-menu-btn');
    await page.click('[aria-label="एरर लॉग देखें"]');
    await expect(page.locator('#error-log-list')).toContainText('to be cleared');
    await page.click('#error-log-clear-btn');
    await expect(page.locator('#error-log-list')).toContainText('कोई error नहीं');
    expect(await page.evaluate(() => getErrorLogs_())).toEqual([]);
  });

  test('back button और theme dots अब aria-label रखते हैं (keyboard/screen-reader के लिए)', async ({ page }) => {
    await openApp(page);
    await expect(page.locator('#back-btn')).toHaveAttribute('aria-label', 'वापस जाएं');
    expect(await page.locator('.color-dot').count()).toBe(3);
    for (const dot of await page.locator('.color-dot').all()) {
      await expect(dot).toHaveAttribute('aria-label', /.+/);
    }
  });
});

test.describe('XSS सुरक्षा', () => {
  test('escapeHtml असली payload को safe entities में बदल देता है', async ({ page }) => {
    await openApp(page);
    const escaped = await page.evaluate(() => escapeHtml(`<img src=x onerror=alert(1)>&'"`));
    expect(escaped).toBe('&lt;img src=x onerror=alert(1)&gt;&amp;&#39;&quot;');
  });

  test('Broken Pole entry list असली escapeHtml से render होती है (टूटा हुआ HTML raw नहीं जाता)', async ({ page }) => {
    await openApp(page);
    const rendered = await page.evaluate(async () => {
      const config = ENTRY_STORE_CONFIG.broken_pole;
      const fakeEntry = { date: '<b>x</b>', remark1: '<script>evil</script>', remark2: '' };
      return escapeHtml(config.getTitle(fakeEntry));
    });
    expect(rendered).not.toContain('<script>');
    expect(rendered).toContain('&lt;script&gt;');
  });
});

test.describe('Backend auth token', () => {
  test('हर backend request (GET और POST दोनों) में auth_token जाता है', async ({ page }) => {
    /** @type {{url: string, method: string, postData: string|null}[]} */
    const requests = [];
    await openApp(page, {
      beforeGoto: (p) => p.route('**/macros/**', (route) => {
        requests.push({ url: route.request().url(), method: route.request().method(), postData: route.request().postData() });
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'success', entry_id: 'TEST' }) });
      }),
    });
    // Home reminder banner ka apna background fetch (karya_charitra) is test ke
    // request count me na aaye, isliye use aaj ke liye dismiss maan lete hain.
    await page.evaluate(() => localStorage.setItem('scn-reminder-dismissed', localTodayIso_()));

    await page.evaluate(async () => {
      const payload = new URLSearchParams();
      payload.append('module', 'feeder');
      payload.append('entries_json', '[]');
      payload.append('auth_token', APPS_SCRIPT_AUTH_TOKEN);
      await fetch(feederSubmitScriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: payload.toString(),
      });
      await fetch(`${feederSubmitScriptUrl}?action=getFeederReadings&auth_token=${encodeURIComponent(APPS_SCRIPT_AUTH_TOKEN)}`);
    });

    // Home reminder banner (unrelated background check) apna ek getEntries call
    // bhej sakta hai isse pehle ki dismiss flag asar kare — usse yahan chhod dete hain.
    const relevant = requests.filter((r) => !r.url.includes('action=getEntries'));
    expect(relevant.length).toBe(2);
    const post = relevant.find((r) => r.method === 'POST');
    const get = relevant.find((r) => r.method === 'GET');
    expect(post?.postData).toContain('auth_token=');
    expect(get?.url).toContain('auth_token=');
  });
});

test.describe('Offline sync queue (Karya Charitra)', () => {
  test('offline में बनाया SCN sync_queue में जाता है, local record से client_id मैच करता है', async ({ page }) => {
    await openApp(page, {
      beforeGoto: (p) => p.route('**/macros/**', (route) => route.abort('failed')),
    });

    const result = await page.evaluate(async () => {
      const record = {
        emp_id: 'TEST_EMP', emp_name: 'Test Employee', dispatch_no: 9999,
        scn_date_iso: '2026-01-01', incident_date: '2026-01-01',
        violation_type: 'Test', violation_desc: 'smoke test entry',
      };
      const saved = await kcSaveRecord_(record);
      const queue = await idbGetAll_('sync_queue');
      const local = await idbGetAll_('karya_charitra');
      return {
        saved,
        recordHasClientId: !!record.client_id,
        queueKind: queue[0]?.kind,
        clientIdsMatch: queue[0]?.entry?.client_id === local[local.length - 1]?.client_id,
      };
    });

    expect(result.saved).toBe(true);
    expect(result.recordHasClientId).toBe(true);
    expect(result.queueKind).toBe('shared_entry');
    expect(result.clientIdsMatch).toBe(true);
  });

  test('internet वापस आने पर queue अपने आप replay होकर entry_id backfill करता है', async ({ page }) => {
    let networkUp = false;
    await openApp(page, {
      beforeGoto: (p) => p.route('**/macros/**', (route) => {
        if (!networkUp) return route.abort('failed');
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'success', entry_id: 'E_REPLAYED' }) });
      }),
    });

    await page.evaluate(async () => {
      const record = {
        emp_id: 'TEST2', emp_name: 'Replay Test', dispatch_no: 8888,
        scn_date_iso: '2026-01-01', incident_date: '2026-01-01',
        violation_type: 'Test2', violation_desc: 'replay test',
      };
      await kcSaveRecord_(record);
    });

    networkUp = true;
    const after = await page.evaluate(async () => {
      await processSyncQueue_();
      const queue = await idbGetAll_('sync_queue');
      const local = await idbGetAll_('karya_charitra');
      return { queueLen: queue.length, entryId: local[local.length - 1]?.entry_id };
    });

    expect(after.queueLen).toBe(0);
    expect(after.entryId).toBe('E_REPLAYED');
  });
});

test.describe('Admin Dashboard (Phase-1)', () => {
  /** @param {import('@playwright/test').Page} page */
  async function mockAdminBackend(page) {
    await page.route('**/macros/**', (route) => {
      const url = new URL(route.request().url());
      const action = url.searchParams.get('action');
      const module = url.searchParams.get('module');
      if (action === 'getEntries' && module === 'broken_pole') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'success', entries: [{ date: '01-07-2026', remark1: 'Pole A', entry_id: 'bp1' }] }) });
      }
      if (action === 'getEntries' && module === 'bijli_chori') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'success', entries: [{ date: '05-07-2026', name: 'Consumer X', photos: [], entry_id: 'bc1' }] }) });
      }
      if (action === 'getEntries' && module === 'karya_charitra') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'success', entries: [{ scn_date_iso: '2026-07-10', emp_name: 'Ram Kumar', dispatch_no: 3, entry_id: 'kc1' }] }) });
      }
      if (action === 'getFeederReadings') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ '33/11 KV SUBSTATION': 'SS1', '33 AND 11 KV FEEDER': 'F1', 'DATE(DD/MM/YYY)': '12/07/2026' }]) });
      }
      if (action === 'getSummary') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ dc: 'DC1', ivrs: '111' }, { dc: 'DC1', ivrs: '222' }]) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'success' }) });
    });
  }

  test('गलत PIN से dashboard नहीं खुलता', async ({ page }) => {
    await openApp(page, { beforeGoto: mockAdminBackend });
    await page.evaluate(() => openAdminDashboardGate_());
    await expect(page.locator('#admin-pin-overlay')).toBeVisible();
    await page.fill('#admin-pin-input', 'galat-pin');
    await page.click('#admin-pin-submit-btn');
    await expect(page.locator('#admin-pin-overlay')).toBeVisible();
    expect(await page.evaluate(() => document.getElementById('admin-dashboard-view').classList.contains('active'))).toBe(false);
  });

  test('सही PIN से dashboard खुलता है और module counts सही दिखते हैं', async ({ page }) => {
    await openApp(page, { beforeGoto: mockAdminBackend });
    await page.evaluate(() => openAdminDashboardGate_());
    await page.fill('#admin-pin-input', 'SC@2026');
    await page.click('#admin-pin-submit-btn');

    await page.waitForFunction(() => document.getElementById('admin-dashboard-view').classList.contains('active'));
    await expect(page.locator('#admin-pin-overlay')).toHaveCount(0);
    await page.waitForFunction(() => !document.getElementById('admin-dashboard-body').innerText.includes('लोड हो रहा है'));

    const body = page.locator('#admin-dashboard-body');
    await expect(body).toContainText('Ram Kumar');
    await expect(body).toContainText('Pole A');
    await expect(body).toContainText('Consumer X');
    await expect(body).toContainText('SS1');

    const cached = await page.evaluate(() => ({
      feeder: admLastData_.feederRows.length,
      bp: admLastData_.bpInRange.length,
      bc: admLastData_.bcInRange.length,
      kc: admLastData_.kcInRange.length,
      mobile: admLastData_.mobileRows.length,
    }));
    expect(cached).toEqual({ feeder: 1, bp: 1, bc: 1, kc: 1, mobile: 2 });
  });

  test('Excel export XLSX library या data missing होने पर crash नहीं करता, friendly toast देता है', async ({ page }) => {
    // Test sandbox सभी external requests block करता है (blockExternal), इसलिए असली
    // CDN-loaded XLSX library यहाँ कभी नहीं मिलती — यही missing-library guard जांचता है।
    await openApp(page, { beforeGoto: mockAdminBackend });
    const noLibToast = await page.evaluate(() => {
      let msg = null;
      const original = window.showToast;
      window.showToast = (m) => { msg = m; };
      admExportExcel_();
      window.showToast = original;
      return msg;
    });
    expect(noLibToast).toBeTruthy();

    const noDataToast = await page.evaluate(() => {
      admLastData_ = null;
      let msg = null;
      const original = window.showToast;
      window.showToast = (m) => { msg = m; };
      window.XLSX = { utils: {}, writeFile: () => {} }; // stub, sirf guard-order test karne ke liye
      admExportExcel_();
      window.showToast = original;
      delete window.XLSX;
      return msg;
    });
    expect(noDataToast).toContain('पहले data load होने दें');
  });

  test('लॉक करें home पर वापस भेजता है और दोबारा PIN मांगता है', async ({ page }) => {
    await openApp(page, { beforeGoto: mockAdminBackend });
    await page.evaluate(async () => {
      openAdminDashboardGate_();
      document.getElementById('admin-pin-input').value = 'SC@2026';
      await document.getElementById('admin-pin-submit-btn').onclick();
    });
    await page.waitForFunction(() => document.getElementById('admin-dashboard-view').classList.contains('active'));

    await page.click('text=🔒 लॉक');
    await expect(page.locator('#home-view')).toHaveClass(/active/);

    await page.evaluate(() => openAdminDashboardGate_());
    await expect(page.locator('#admin-pin-overlay')).toBeVisible();
  });

  test('header title पर long-press (700ms) से PIN prompt खुलता है', async ({ page }) => {
    await openApp(page, { beforeGoto: mockAdminBackend });
    const title = page.locator('#main-header-title');
    await title.dispatchEvent('pointerdown');
    await page.waitForTimeout(800);
    await title.dispatchEvent('pointerup');
    await expect(page.locator('#admin-pin-overlay')).toBeVisible();
  });

  test('⋮ header menu से Admin Dashboard खोला जा सकता है', async ({ page }) => {
    await openApp(page, { beforeGoto: mockAdminBackend });
    await expect(page.locator('#header-menu-dropdown')).toBeHidden();
    await page.click('#header-menu-btn');
    await expect(page.locator('#header-menu-dropdown')).toBeVisible();
    await page.click('text=📊 Admin Dashboard');
    await expect(page.locator('#header-menu-dropdown')).toBeHidden();
    await expect(page.locator('#admin-pin-overlay')).toBeVisible();
  });

  test('मेनू के बाहर क्लिक करने पर ⋮ dropdown बंद हो जाता है', async ({ page }) => {
    await openApp(page, { beforeGoto: mockAdminBackend });
    await page.click('#header-menu-btn');
    await expect(page.locator('#header-menu-dropdown')).toBeVisible();
    await page.click('body', { position: { x: 5, y: 5 } });
    await expect(page.locator('#header-menu-dropdown')).toBeHidden();
  });
});

test.describe('Home reminders (Push Notification lite)', () => {
  /** @param {import('@playwright/test').Page} page */
  /** @param {{scn_date_iso: string, reply_text?: string}[]} entries */
  async function mockKcEntries(page, entries) {
    await page.route('**/macros/**', (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get('action') === 'getEntries' && url.searchParams.get('module') === 'karya_charitra') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'success', entries }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'success', entries: [] }) });
    });
  }

  test('सभी SCN का समय पर जवाब आ चुका हो तो कोई reminder नहीं दिखता', async ({ page }) => {
    await openApp(page, {
      beforeGoto: (p) => mockKcEntries(p, [{ scn_date_iso: '2026-07-10', emp_name: 'Ram Kumar', dispatch_no: 3, entry_id: 'kc1', reply_text: 'माफ़ी', reply_date_iso: '2026-07-11' }]),
    });
    await page.evaluate(() => renderScnReminderBanner_());
    await expect(page.locator('#scn-reminder-banner')).toHaveCount(0);
  });

  test('SCN का जवाब बाकी हो और 7 दिन की समय सीमा पार हो चुकी हो तो overdue banner दिखता है', async ({ page }) => {
    await openApp(page, {
      beforeGoto: (p) => mockKcEntries(p, [{ scn_date_iso: '2026-07-10', emp_name: 'Ram Kumar', dispatch_no: 3, entry_id: 'kc1' }]),
    });
    await page.evaluate(() => renderScnReminderBanner_());
    await expect(page.locator('#scn-reminder-banner')).toBeVisible();
    await expect(page.locator('#scn-reminder-banner')).toContainText('समय सीमा');
  });

  test('SCN का जवाब बाकी हो पर अभी 7 दिन की समय सीमा के अंदर हो तो neutral (non-overdue) banner दिखता है', async ({ page }) => {
    await openApp(page, {
      beforeGoto: (p) => mockKcEntries(p, [{ scn_date_iso: '2026-07-20', emp_name: 'Shyam Lal', dispatch_no: 5, entry_id: 'kc2' }]),
    });
    await page.evaluate(() => renderScnReminderBanner_());
    const banner = page.locator('#scn-reminder-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('उत्तर बाकी है');
    await expect(banner).not.toContainText('समय सीमा');
  });

  test('✕ दबाने पर banner हट जाता है और आज दोबारा नहीं दिखता', async ({ page }) => {
    await openApp(page, {
      beforeGoto: (p) => mockKcEntries(p, [{ scn_date_iso: '2026-07-10', emp_name: 'Ram Kumar', dispatch_no: 3, entry_id: 'kc1' }]),
    });
    await page.evaluate(() => renderScnReminderBanner_());
    await expect(page.locator('#scn-reminder-banner')).toBeVisible();
    await page.click('[aria-label="रिमाइंडर बंद करें"]');
    await expect(page.locator('#scn-reminder-banner')).toHaveCount(0);
    await page.evaluate(() => renderScnReminderBanner_());
    await expect(page.locator('#scn-reminder-banner')).toHaveCount(0);
  });

  test('"देखें" बटन कर्मचारी कार्य चरित्रावली view बिना error के खोलता है', async ({ page }) => {
    const errors = [];
    await openApp(page, {
      beforeGoto: (p) => mockKcEntries(p, [{ scn_date_iso: '2026-07-10', emp_name: 'Ram Kumar', dispatch_no: 3, entry_id: 'kc1' }]),
    });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.evaluate(() => renderScnReminderBanner_());
    await page.click('text=देखें');
    await page.waitForFunction(() => document.getElementById('karya-charitra-view').classList.contains('active'));
    expect(errors).toEqual([]);
  });
});

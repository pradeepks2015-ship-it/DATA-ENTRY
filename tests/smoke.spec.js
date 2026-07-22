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
    expect(buttons.map((b) => b.trim())).toEqual([
      '1. VASOOLI TRACKER',
      '2. Mobile No Update',
      '3. ⚡ Broken Pole / Damage Line',
      '4. FEEDER / SS WISE INPUT',
      '5. ⚠️ बिजली चोरी की जानकारी',
      '6. 📋 कर्मचारी कार्य चरित्रावली',
    ]);
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

    expect(requests.length).toBe(2);
    const post = requests.find((r) => r.method === 'POST');
    const get = requests.find((r) => r.method === 'GET');
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

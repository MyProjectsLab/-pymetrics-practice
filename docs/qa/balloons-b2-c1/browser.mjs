import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)('/Users/renzo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out = '/private/tmp/balloons-b2-c1/';
const url = 'http://127.0.0.1:4201';
const browser = await chromium.launch({ headless: true, executablePath: '/Users/renzo/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell' });
const results = [];
const dbfn = async ({ root, write = false } = {}) => {
  const q = indexedDB.open('assessment-practice-balloons-v1', 1); q.onupgradeneeded = () => q.result.createObjectStore('installation');
  const db = await new Promise((r, j) => { q.onsuccess = () => r(q.result); q.onerror = () => j(q.error); });
  return new Promise((r, j) => { const tx = db.transaction('installation', write ? 'readwrite' : 'readonly'), req = write ? tx.objectStore('installation').put(root, 'root') : tx.objectStore('installation').get('root'); tx.oncomplete = () => { db.close(); r(write ? null : req.result); }; tx.onabort = () => j(tx.error); });
};
const read = p => p.evaluate(dbfn);
const rt = r => Object.values(r.records).filter(x => x.header.retest).at(-1);
const btn = (p, name) => p.getByRole('button', { name, exact: true });
async function enabled(p, name) { await btn(p, name).click({ trial: true }); }
async function click(p, name) { await enabled(p, name); await btn(p, name).click(); }
async function key(p, name, k = 'Space') { await enabled(p, name); await btn(p, name).focus(); await p.keyboard.press(k); }
async function history(p) { await click(p, 'Open Balloons'); await click(p, 'Balloons history'); }
async function exercise(p, wait = true) { await history(p); await p.locator('.balloons-history-item').filter({ hasText: /^BL1 ·/ }).getByRole('button', { name: 'Open saved report', exact: true }).click(); await click(p, 'Open assigned exercise'); if (wait) await enabled(p, 'Open retest explanation'); }
async function seed(p, root) { await p.goto(url); await p.evaluate(dbfn, { root, write: true }); await p.reload(); }
async function hook(ctx) { await ctx.addInitScript(() => {
  const a = window.probe = { fail: null, hold: null, held: [], holdRead: false, heldReads: [], frames: [], holdFrames: false, clockOffset: 0, writes: [] };
  const now = Date.now; Date.now = () => now() + a.clockOffset;
  const raf = window.requestAnimationFrame; window.requestAnimationFrame = cb => a.holdFrames ? (a.frames.push(cb), 99999) : raf(cb);
  a.releaseFrames = () => { a.holdFrames = false; for (const cb of a.frames.splice(0)) raf(cb); };
  const kinds = new WeakMap(), put = IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put = function (value, key) {
    if (this.transaction.db.name === 'assessment-practice-balloons-v1' && value?.records) {
      const r = Object.values(value.records).filter(x => x.header.retest).at(-1), kind = r?.journal.at(-1)?.command?.kind ?? 'reserve';
      kinds.set(this.transaction, kind); a.writes.push({ kind, phase: r?.snapshot.phase, exposure: r?.snapshot.exposure, mounted: !!document.querySelector('.balloons-play') });
      if (a.fail === kind) { a.fail = null; throw new DOMException('Injected transaction abort', 'QuotaExceededError'); }
    }
    return put.call(this, value, key);
  };
  const d = Object.getOwnPropertyDescriptor(IDBTransaction.prototype, 'oncomplete');
  Object.defineProperty(IDBTransaction.prototype, 'oncomplete', { ...d, set(f) { d.set.call(this, e => { if (a.hold === kinds.get(this)) { a.hold = null; a.held.push(() => f?.call(this, e)); return; } if (this.mode === 'readonly' && a.holdRead) { a.holdRead = false; a.heldReads.push(() => f?.call(this, e)); return; } f?.call(this, e); }); } });
}); }
async function scenario(name, work) {
  if (process.env.BALLOONS_C1_CASE && !name.includes(process.env.BALLOONS_C1_CASE)) return;
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } }); await hook(ctx); const p = await ctx.newPage(); const errors = []; p.on('pageerror', e => errors.push(e.message));
  try { const details = await work(p, ctx); assert.deepEqual(errors, []); results.push({ name, pass: true, ...details }); await fs.writeFile(out + name + '.json', JSON.stringify(await read(p))); await fs.writeFile(out + name + '.txt', await p.locator('main').innerText()); await p.screenshot({ path: out + name + '.png', fullPage: true }); console.log('PASS', name); }
  catch (e) { results.push({ name, pass: false, error: e.stack, errors }); console.error('FAIL', name, e); await fs.writeFile(out + name + '-failed-root.json', JSON.stringify(await read(p))); await fs.writeFile(out + name + '-failed.txt', await p.locator('body').innerText()); }
  finally { await ctx.close(); await fs.writeFile(out + 'browser-results.json', JSON.stringify(results, null, 2)); }
}
let eligible = process.env.BALLOONS_C1_REUSE ? JSON.parse(await fs.readFile(out + 'eligible-live-root.json')) : undefined;
try {
if (!process.env.BALLOONS_C1_REUSE) await scenario('fresh-baseline-drill-retest', async p => {
  await p.goto(url); await click(p, 'Open Balloons');
  for (const n of ['Try the worked example', 'Pump example', 'Pump example', 'Collect example', 'Check my understanding']) await click(p, n);
  await p.getByLabel('the 10 cents on this balloon; earlier 15 cents stays banked', { exact: true }).check(); await p.getByLabel('no, earlier outcomes do not reveal the next exact burst pump', { exact: true }).check();
  for (const n of ['Submit answers', 'Check input and accessibility', 'Test Pump', 'Test Collect', 'Continue to readiness', 'Start Balloons practice']) await click(p, n);
  for (let round = 1; round <= 39; round++) { await key(p, 'Collect'); if (round < 39) await key(p, 'Next balloon', 'Enter'); }
  await click(p, 'View report'); await click(p, 'Open assigned exercise'); await click(p, 'Start assigned exercise');
  for (let round = 1; round <= 18; round++) { await key(p, 'Collect'); if (round < 18) await key(p, round % 6 === 0 ? 'Continue exercise' : 'Next balloon', 'Enter'); }
  await enabled(p, 'Open retest explanation'); eligible = await read(p); await fs.writeFile(out + 'eligible-live-root.json', JSON.stringify(eligible));
  await click(p, 'Open retest explanation'); await enabled(p, 'Start 39-round retest'); const reserved = await read(p); assert.equal(rt(reserved).snapshot.exposure, 'pending_exposure'); assert.equal(await p.locator('.balloons-play').count(), 0); assert.equal(rt(reserved).header.retest.expiresAtMs - rt(reserved).header.retest.issuedAtMs, 1800000);
  await fs.writeFile(out + 'live-reservation.json', JSON.stringify(reserved)); await click(p, 'Start 39-round retest');
  for (let round = 1; round <= 39; round++) {
    await enabled(p, 'Pump');
    for (let pump = 0; pump < 3; pump++) { await key(p, 'Pump'); await p.waitForFunction(() => ![...document.querySelectorAll('[role=status]')].some(e => e.textContent?.startsWith('Saving…'))); const r = rt(await read(p)); if (r.snapshot.core.status !== 'active') break; }
    const r = rt(await read(p)); if (r.snapshot.core.status === 'active') await key(p, 'Collect');
    if (round === 8) { await click(p, 'Pause and open history'); while (rt(await read(p)).snapshot.phase !== 'paused') await p.waitForTimeout(20); await p.reload(); await history(p); await p.locator('.balloons-history-item').filter({ hasText: 'RT1' }).getByRole('button', { name: 'Resume saved session' }).click(); }
    if (round < 39) await key(p, 'Next balloon', 'Enter');
  }
  await click(p, 'View report'); const complete = await read(p), done = rt(complete); assert.equal(done.snapshot.comparisonEligible, true); assert.equal(done.snapshot.core.results.length, 39); assert.equal(complete.training.chains[done.header.identity.chainId].completedRetestSessionId, done.header.identity.sessionId);
  assert((await p.locator('.balloons-report').innerText()).includes('Retest RT1 for baseline BL1')); await fs.writeFile(out + 'complete-live-root.json', JSON.stringify(complete));
  await p.reload(); await history(p); await p.locator('.balloons-history-item').filter({ hasText: 'RT1' }).getByRole('button', { name: 'Open saved report' }).click();
  assert.deepEqual(rt(await read(p)).snapshot, done.snapshot); assert.deepEqual(rt(await read(p)).journal.slice(0, done.journal.length), done.journal);
  return { baselineRounds: 39, drillRounds: 18, retestRounds: 39, form: done.header.formId, sameSessionResume: true, byteIdenticalReload: true };
});
if (!eligible) throw Error('Fresh chain fixture unavailable');
for (const form of ['RT2', 'RT3']) await scenario('full-' + form, async p => {
  await seed(p, eligible); await exercise(p); await click(p, 'Open retest explanation'); await enabled(p, 'Start 39-round retest');
  for (let n = 1; n < Number(form.at(-1)); n++) {
    await p.evaluate(() => window.probe.holdFrames = true); await click(p, 'Start 39-round retest'); await p.locator('.balloons-play').waitFor();
    await p.evaluate(() => window.dispatchEvent(new Event('blur'))); await p.evaluate(() => window.probe.releaseFrames());
    await click(p, 'Open explanation for a fresh retest attempt'); await enabled(p, 'Start 39-round retest');
  }
  assert.equal(rt(await read(p)).header.formId, form); await click(p, 'Start 39-round retest');
  for (let round = 1; round <= 39; round++) { await key(p, 'Collect'); if (round < 39) await key(p, 'Next balloon', 'Enter'); }
  await click(p, 'View report'); const saved = await read(p), done = rt(saved);
  assert.equal(done.snapshot.comparisonEligible, true); assert.equal(done.snapshot.core.results.length, 39);
  assert.equal(saved.training.chains[done.header.identity.chainId].completedRetestSessionId, done.header.identity.sessionId);
  return { form, fullRounds: 39, earlierUncertainRetained: Number(form.at(-1)) - 1 };
});
await scenario('exhaustion', async p => {
  await seed(p, eligible); await exercise(p); await click(p, 'Open retest explanation'); await enabled(p, 'Start 39-round retest');
  for (let n = 1; n <= 3; n++) {
    assert.equal(rt(await read(p)).header.formId, 'RT' + n);
    await p.evaluate(() => window.probe.holdFrames = true); await click(p, 'Start 39-round retest'); await p.locator('.balloons-play').waitFor();
    await p.evaluate(() => window.dispatchEvent(new Event('blur'))); await p.evaluate(() => window.probe.releaseFrames());
    await click(p, 'Open explanation for a fresh retest attempt');
    if (n < 3) await enabled(p, 'Start 39-round retest');
  }
  await p.getByRole('alert').filter({ hasText: 'No unseen retest' }).waitFor(); const saved = await read(p);
  assert.equal(Object.values(saved.records).filter(r => r.header.retest).length, 3); assert.equal(Object.values(saved.training.chains)[0].completedRetestSessionId, undefined);
  return { noRepeat: true, noChainCompletion: true };
});
await scenario('onset-owner-race', async (p, ctx) => {
  await seed(p, eligible); await exercise(p); await click(p, 'Open retest explanation'); await enabled(p, 'Start 39-round retest');
  await p.evaluate(() => window.probe.hold = 'confirm'); await click(p, 'Start 39-round retest');
  await p.waitForFunction(() => window.probe.held.length === 1); const r = rt(await read(p)); assert.equal(r.snapshot.exposure, 'form_exposed');
  const other = await ctx.newPage(); await other.goto(url);
  await p.evaluate(() => { window.probe.holdRead = true; window.dispatchEvent(new Event('blur')); });
  await p.waitForFunction(() => window.probe.heldReads.length === 1);
  const denied = await other.evaluate(() => navigator.locks.request('assessment-practice-balloons-v1:owner', { ifAvailable: true }, lock => !!lock));
  assert.equal(denied, false);
  await p.evaluate(() => { window.probe.heldReads.splice(0).forEach(f => f()); window.probe.held.splice(0).forEach(f => f()); });
  await p.waitForFunction(async () => {
    const q = indexedDB.open('assessment-practice-balloons-v1'); const db = await new Promise(r => q.onsuccess = () => r(q.result));
    const root = await new Promise(r => { const t = db.transaction('installation'); const g = t.objectStore('installation').get('root'); g.onsuccess = () => r(g.result); }); db.close();
    return Object.values(root.records).some(r => r.header.retest && r.snapshot.phase === 'paused');
  });
  const after = rt(await read(p)); assert.equal(after.snapshot.exposure, 'form_exposed'); assert.equal(after.snapshot.confirmedRounds.length, 1);
  const admitted = await other.evaluate(() => navigator.locks.request('assessment-practice-balloons-v1:owner', { ifAvailable: true }, lock => !!lock)); assert.equal(admitted, true);
  return { consumedBeforeOtherOwner: true, sameForm: after.header.formId };
});
for (const boundary of ['prearm-exit', 'prearm-expiry', 'postarm-expiry', 'postarm-hide', 'confirm-abort', 'action-abort', 'ownership', 'baseline-delete', 'late-reserve-delete-all', 'late-arm-delete']) await scenario(boundary, async (p, ctx) => {
  await seed(p, eligible); await exercise(p);
  if (boundary === 'late-reserve-delete-all') await p.evaluate(() => window.probe.hold = 'reserve');
  await click(p, 'Open retest explanation');
  if (boundary === 'late-reserve-delete-all') {
    await p.waitForFunction(() => window.probe.held.length === 1); const other = await ctx.newPage(); await other.goto(url); await history(other); await click(other, 'Delete all Balloons data');
    while ((await read(other)).installationId === eligible.installationId) await other.waitForTimeout(20); const replaced = await read(other);
    await p.evaluate(() => window.probe.held.splice(0).forEach(f => f())); await p.waitForTimeout(200); assert.deepEqual(await read(other), replaced); return { oldCallbacksFenced: true };
  }
  await enabled(p, 'Start 39-round retest'); const reserved = rt(await read(p));
  if (boundary === 'prearm-exit') { await click(p, 'Pause and open history'); await p.waitForFunction(() => document.querySelector('.balloons-history-item')?.textContent); await p.waitForTimeout(100); assert.equal(rt(await read(p)).snapshot.exposure, 'released_unseen'); return { releasedUnseen: true }; }
  if (boundary === 'ownership') {
    const other = await ctx.newPage(); await other.goto(url); await exercise(other, false); await other.getByRole('alert').filter({ hasText: 'another tab' }).waitFor(); assert.equal(Object.values((await read(p)).records).filter(r => r.header.retest).length, 1);
    await click(p, 'Pause and open history'); await other.reload(); await exercise(other); await click(other, 'Open retest explanation'); await enabled(other, 'Start 39-round retest'); assert.notEqual(rt(await read(other)).header.identity.sessionId, reserved.header.identity.sessionId); return { exclusiveOwner: true, singleReservation: true };
  }
  if (boundary === 'baseline-delete') {
    const other = await ctx.newPage(); await other.goto(url); await history(other); await other.locator('.balloons-history-item').filter({ hasText: /^BL1 ·/ }).getByRole('button', { name: 'Delete this result' }).click();
    await p.waitForTimeout(200); assert.equal(await btn(p, 'Start 39-round retest').count(), 0); assert.equal(await p.locator('.balloons-play').count(), 0); return { withdrawn: true };
  }
  if (boundary === 'prearm-expiry') await p.evaluate(() => window.probe.clockOffset = 1800001);
  if (['postarm-expiry', 'postarm-hide'].includes(boundary)) await p.evaluate(() => window.probe.holdFrames = true);
  if (boundary === 'confirm-abort') await p.evaluate(() => window.probe.fail = 'confirm');
  if (boundary === 'late-arm-delete') await p.evaluate(() => window.probe.hold = 'arm');
  await click(p, 'Start 39-round retest');
  if (boundary === 'late-arm-delete') {
    await p.waitForFunction(() => window.probe.held.length === 1); await p.waitForTimeout(2200); const other = await ctx.newPage(); await other.goto(url); await history(other); await other.locator('.balloons-history-item').filter({ hasText: /^BL1 ·/ }).getByRole('button', { name: 'Delete this result' }).click();
    const baselineId = Object.keys(eligible.records).find(id => eligible.records[id].header.formId === 'BL1'); while (!(await read(other)).tombstones[baselineId]) await other.waitForTimeout(20); const before = await read(other); await p.evaluate(() => window.probe.held.splice(0).forEach(f => f())); await p.waitForTimeout(100);
    assert.deepEqual(await read(other), before); assert.equal(await p.locator('.balloons-play').count(), 0); return { lateArmFenced: true };
  }
  if (boundary === 'prearm-expiry') { await enabled(p, 'Reopen retest explanation'); assert.equal(rt(await read(p)).snapshot.exposure, 'released_unseen'); return { noMount: true }; }
  if (boundary.startsWith('postarm')) {
    await p.locator('.balloons-play').waitFor();
    if (boundary === 'postarm-expiry') await p.evaluate(() => { window.probe.clockOffset = 1800001; window.probe.releaseFrames(); });
    else { await p.evaluate(() => window.dispatchEvent(new Event('blur'))); await p.evaluate(() => window.probe.releaseFrames()); }
    await enabled(p, 'Open explanation for a fresh retest attempt'); const r = rt(await read(p)); assert.equal(r.snapshot.comparisonEligible, false); assert.equal(r.snapshot.exposure, boundary === 'postarm-expiry' ? 'form_exposed' : 'exposure_uncertain');
    await click(p, 'Open explanation for a fresh retest attempt'); await enabled(p, 'Start 39-round retest'); assert.equal(rt(await read(p)).header.formId, 'RT2'); return { oldExposure: r.snapshot.exposure, retry: 'RT2' };
  }
  if (boundary === 'action-abort') { await enabled(p, 'Pump'); await p.evaluate(() => window.probe.fail = 'action'); await click(p, 'Pump'); }
  await p.getByRole('alert').filter({ hasText: /Save status needs checking|Unsaved/ }).waitFor(); const r = rt(await read(p)); assert.notEqual(r.snapshot.exposure, 'released_unseen'); assert.equal(await p.locator('.balloons-play').count(), 0); return { preservedExposure: r.snapshot.exposure, committedActions: r.snapshot.core.nextActionId - 1 };
});
} finally { await browser.close(); }
if (results.some(r => !r.pass)) process.exitCode = 1;

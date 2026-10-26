// Production engines with an independent deterministic scheduler. No UI/timing certification.
import { createServer } from 'vite'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
export async function fixtures() {
  const root = fileURLToPath(new URL('../../../../', import.meta.url)).replace(/\/$/, '')
  const server = await createServer({ root, configFile: `${root}/vite.config.ts`, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
  const load = name => server.ssrLoadModule(`${root}/src/stop/${name}.ts`)
  try {
    const runs = await load('run'), exp = await load('exposure'), train = await load('training'), drills = await load('drills'), drun = await load('drill-run')
    const setup = { binding: { code: 'Space', label: 'Space' }, visualProfile: 'standard', physicalKeyboard: true }
    function time() {
      let now = 0, serial = 0
      const jobs = []
      const at = (when, fn) => { const job = { when, fn, canceled: false, serial: serial++ }; jobs.push(job); return () => { job.canceled = true } }
      const settle = async () => { for (let i = 0; i < 8; i++) await new Promise(setImmediate) }
      return { clock: () => now, scheduler: { at, after: (when, fn) => at(when + .001, fn) },
        frames: { request: (request, confirm) => at(request.notBeforeMs, confirm) },
        async advance(target) {
          for (;;) {
            const job = jobs.filter(item => !item.canceled && item.when <= target).sort((a,b) => a.when-b.when || a.serial-b.serial)[0]
            if (!job) break
            job.canceled = true; now = Math.max(now, job.when); job.fn(); await settle()
          }
          now = Math.max(now, target); await settle()
        } }
    }
    async function standard(mode = 'baseline', settings = setup, choice = 0, exit = null) {
      const t = time(), exposure = exp.createMemoryExposureRepository(), sessionId = crypto.randomUUID()
      const preparation = { sessionId, snapshot: () => [{ schemaVersion: 'stop_event_v1', sessionId, sequenceNumber: 1, timestampMs: 0,
        type: 'device_check_completed', payload: { inputBinding: settings.binding.code, inputDeviceClass: 'physical_keyboard', visualProfile: settings.visualProfile, timingProfile: 'standard' } }] }
      const reservedFormId = mode === 'retest' ? exposure.reserve(sessionId, () => choice, 'retest', Date.now()+1800000).id : undefined
      const run = runs.createStopRun({ preparation, setup: settings, exposure, ...t, random: () => choice, mode, reservedFormId,
        clear() {}, changed() {}, environment: { userAgent: 'M5 repair deterministic fixture', width: 1200, height: 800 } })
      run.begin(false); run.startWarmup(); await t.advance(18600); await run.startScored()
      if (exit !== null) { await t.advance(exit ? 19600 : 18800); run.leave(); await t.advance(t.clock()); return run.snapshot().draft }
      await t.advance(195600)
      const result = { ...run.snapshot().result, storageMode: 'persistent_local' }
      assert(runs.verifyCompletedResult(result)); return result
    }
    const baseline = await standard()
    const t = time(), manifest = drills.drillById(train.routeStop(baseline).drillId)
    const drill = drun.createDrillRun({ id: crypto.randomUUID(), manifest, setup, ...t, initialFrame: ready => ready(), clear() {}, changed() {} })
    await drill.begin(false)
    for (let i = 0; i < manifest.blocks.length; i++) { await t.advance(t.clock()+100000); if (i < manifest.blocks.length-1) assert(drill.continue()) }
    const attempt = drill.snapshot().attempt
    assert(attempt.valid)
    const chain = { schemaVersion: 'stop_training_chain_v1', id: crypto.randomUUID(), baseline, recommendation: train.routeStop(baseline), drillAttempts: [attempt], retestAttempts: [], retest: null, status: 'drill_complete' }
    const state = { schemaVersion: 'stop_local_v1', installationId: 'repair-fixture', results: { [baseline.sessionId]: baseline }, drafts: {}, chains: { [chain.id]: chain }, retiredChains: {}, activeChainId: chain.id,
      exposures: { [baseline.form.id]: { formId: baseline.form.id, sessionId: baseline.sessionId, exposedAtWall: baseline.completedAtWall, visualProfile: 'standard', deleted: false, certainty: 'confirmed' } }, reservations: {} }
    const drafts = []
    for (const family of ['baseline', 'replay', 'retest']) for (const exposed of [false, true]) drafts.push(await standard(family, setup, 0, exposed))
    const profiles = [await standard('baseline', { ...setup, binding: { code: 'KeyA', label: 'A' } }), await standard('baseline', { ...setup, binding: { code: 'KeyQ', label: 'A' } }, .3)]
    return { state, chain, baseline, drafts, profiles }
  } finally { await server.close() }
}

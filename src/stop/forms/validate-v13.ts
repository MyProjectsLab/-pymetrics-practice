import type { StopFormManifest, StopV13FormManifest } from '../contracts'
import { stopFormRegistry, stopV13FormRegistry } from './index'
import type { StopFormIssue } from './validate'
import { validateStopForm } from './validate'

function canonical(form: StopV13FormManifest): string {
  return [form.schemaVersion, form.id, form.family, form.formVersion,
    form.specificationVersion, form.generatorVersion, form.seedId,
    String(form.blockCount), String(form.blockSize), form.blockGoCounts.join(','),
    form.sequence.map(value => value === 'GO' ? 'G' : 'N').join(''), ''].join('\n')
}

export async function validateStopV13Form(form: StopV13FormManifest): Promise<readonly StopFormIssue[]> {
  const issues: StopFormIssue[] = []
  const add = (code: string, detail: string) => issues.push({ code, formId: form.id, detail })
  if (form.schemaVersion !== 'stop_form_manifest_v2' || form.formVersion !== '2' ||
    form.specificationVersion !== '1.3' || form.generatorVersion !== 'stop_variable_mix_generator_v1') add('version', 'Wrong V1.3 identity')
  if (!['baseline', 'replay', 'retest'].includes(form.family) ||
    !form.id.startsWith(`stop-v13-${form.family}-`) ||
    !form.seedId.startsWith(`ap-stop-v1.3-${form.family}-`)) add('identity', 'Wrong form family or seed')
  if (form.blockCount !== 4 || form.blockSize !== 20 || !Array.isArray(form.blockGoCounts) ||
    form.blockGoCounts.length !== 4 || form.sequence.length !== 80 ||
    !form.sequence.every(value => value === 'GO' || value === 'NO_GO')) add('structure', 'Invalid block or sequence structure')
  else {
    for (let block = 0; block < 4; block++) {
      const expected = form.blockGoCounts[block]
      const actual = form.sequence.slice(block * 20, (block + 1) * 20).filter(value => value === 'GO').length
      if (!Number.isInteger(expected) || expected < 0 || expected > 20 || actual !== expected) add('block_distribution', `Block ${block + 1} has the wrong GO count`)
    }
    let previous = '', run = 0, longestGo = 0, contexts = 0
    for (const value of form.sequence) {
      if (value === 'NO_GO' && previous === 'GO' && run >= 3) contexts++
      run = value === previous ? run + 1 : 1
      previous = value
      if (run > 8) add('run_limit', 'A run exceeds eight trials')
      if (value === 'GO') longestGo = Math.max(longestGo, run)
    }
    if (longestGo < 4 || contexts < 4) add('context', 'Required GO run or NO-GO context is absent')
    if (form.sequence[0] === 'NO_GO' && form.sequence[1] === 'NO_GO' ||
      form.sequence[78] === 'NO_GO' && form.sequence[79] === 'NO_GO') add('endpoint', 'A prohibited endpoint pair occurs')
    for (const other of [...stopFormRegistry.all, ...stopV13FormRegistry.all]) {
      if (other.id === form.id) continue
      if (form.sequence.reduce((n, value, i) => n + Number(value !== other.sequence[i]), 0) < 24) add('distance', `Too close to ${other.id}`)
    }
  }
  const bytes = new TextEncoder().encode(canonical(form))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  const checksum = `sha256:${[...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')}`
  if (checksum !== form.checksum) add('checksum', 'Manifest bytes do not match the checksum')
  return issues
}

export async function validateStopStandardForm(form: StopFormManifest): Promise<readonly StopFormIssue[]> {
  if (form.specificationVersion === '1.3') return validateStopV13Form(form)
  return validateStopForm(form)
}

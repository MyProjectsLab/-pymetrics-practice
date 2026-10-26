import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

const path = new URL('../docs/specifications/ASSESSMENT_PRACTICE_LENGTHS_MOUTH_FORMS_V1_1.json', import.meta.url)
const fixturePath = new URL('../docs/specifications/ASSESSMENT_PRACTICE_LENGTHS_MOUTH_FIXTURES_V1_1.json', import.meta.url)
const approvedFormSha = 'ae92d69cffeb20cac02d3be5648ee8e162e575583c55b03dfe3cd2301c0846e9'
const approvedFixtureSha = '5f5656bc35cff5b776075968b88ab369a4820af8233c741801044d42f28b50a8'
const file = JSON.parse(readFileSync(path, 'utf8'))
const fixtures = JSON.parse(readFileSync(fixturePath, 'utf8'))
const fail = message => { throw Error(message) }
const compact = JSON.stringify({ version: file.version, baseSeed: file.baseSeed, forms: file.forms })
const hash = createHash('sha256').update(compact).digest('hex')
const fixtureHash = createHash('sha256').update(JSON.stringify(fixtures)).digest('hex')
if (hash !== file.sha256 || hash !== approvedFormSha || file.version !== 'lengths_mouth_forms_v1_1' || file.forms.length !== 6) fail('Identity')
if (fixtureHash !== approvedFixtureSha || fixtures.version !== 'lengths_mouth_fixtures_v1_1' || fixtures.formId !== 'LM1' || fixtures.cases.length !== 19) fail('Fixtures')

const summary = []
for (const [index, form] of file.forms.entries()) {
  if (form.formId !== `LM${index + 1}` || form.seed !== file.baseSeed + index || form.trials.length !== 90) fail('Form identity')
  if (form.richSide !== (index % 2 ? 'long' : 'short')) fail('Rich side')
  let rich = 0, lean = 0
  for (let block = 1; block <= 3; block++) {
    const set = form.trials.slice((block - 1) * 30, block * 30)
    if (set.some((trial, offset) => trial.trial !== (block - 1) * 30 + offset + 1 || trial.block !== block)) fail('Trial order')
    if (set.filter(trial => trial.mouth === 'short').length !== 15 || set.filter(trial => trial.mouth === 'long').length !== 15) fail('Balance')
    const switches = set.slice(1).filter((trial, offset) => trial.mouth !== set[offset].mouth).length
    if (switches < 12 || switches > 22) fail('Switches')
    const expectedLean = block - 1 === index % 3 ? 2 : 1
    if (set.filter(trial => trial.rewardEligible && trial.mouth === form.richSide).length !== 4 ||
        set.filter(trial => trial.rewardEligible && trial.mouth !== form.richSide).length !== expectedLean) fail('Reward distribution')
  }
  for (let trial = 0; trial < 90; trial++) {
    const card = form.trials[trial]
    if (card.mouth !== 'short' && card.mouth !== 'long' || typeof card.rewardEligible !== 'boolean') fail('Card')
    if (trial >= 3 && form.trials.slice(trial - 3, trial + 1).every(other => other.mouth === card.mouth)) fail('Four-run')
    if (card.rewardEligible && trial > 0 && form.trials[trial - 1].rewardEligible) fail('Adjacent rewards')
    if (card.rewardEligible) card.mouth === form.richSide ? rich++ : lean++
  }
  if (rich !== 12 || lean !== 4) fail('Whole rewards')
  summary.push({ formId: form.formId, richSide: form.richSide, rich, lean, maxCents: 50 * (rich + lean) })
}

let minDifferent = 90, maxDifferent = 0
for (let left = 0; left < 6; left++) for (let right = left + 1; right < 6; right++) {
  const different = file.forms[left].trials.filter((trial, index) => trial.mouth !== file.forms[right].trials[index].mouth).length
  minDifferent = Math.min(minDifferent, different)
  maxDifferent = Math.max(maxDifferent, different)
}
if (minDifferent < 30) fail('Order variety')
process.stdout.write(JSON.stringify({ sha256: hash, fixtureSha256: fixtureHash, summary, minDifferent, maxDifferent }, null, 2) + '\n')

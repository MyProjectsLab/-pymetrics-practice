import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const path = fileURLToPath(new URL('../docs/specifications/ASSESSMENT_PRACTICE_DIGITS_FIXTURES_V1_0.json', import.meta.url))
const fixtures = JSON.parse(readFileSync(path, 'utf8'))
function check(condition, message) { if (!condition) throw Error(message) }
check(fixtures.version === 'digits_fixtures_v1_0', 'Fixture version mismatch')
for (const item of fixtures.classificationCases) {
  const { target, response, expected } = item
  check(/^[0-9]{3,8}$/.test(target) && new Set(target).size === target.length, `${item.id}: target invalid`)
  check(/^[0-9]*$/.test(response) && response.length <= target.length, `${item.id}: response invalid`)
  const full = response.length === target.length
  let positionMatches = 0, substitutions = 0, transpositionPairs = 0, missingSuffix = target.length - response.length
  for (let i = 0; i < response.length;) {
    if (response[i] === target[i]) { positionMatches++; i++; continue }
    if (full && i + 1 < response.length && response[i] === target[i + 1] &&
      response[i + 1] === target[i]) { transpositionPairs++; i += 2; continue }
    substitutions++; i++
  }
  const actual = { exact: response === target, positionMatches, substitutions,
    transpositionPairs, transpositionPositions: transpositionPairs * 2, missingSuffix }
  check(JSON.stringify(actual) === JSON.stringify(expected), `${item.id}: expected classification differs`)
  check(positionMatches + substitutions + 2 * transpositionPairs + missingSuffix === target.length,
    `${item.id}: digit-position conservation failed`)
}
for (const item of fixtures.boundaryCases) {
  check((item.submitMs >= item.entryOpenedMs && item.submitMs < item.deadlineMs) === item.acceptedSubmit,
    `${item.id}: deadline classification differs`)
  check((item.acceptedSubmit && item.response === item.target) === item.scoredExact,
    `${item.id}: scored exact classification differs`)
}
function eligibleVoice(voices, voice) {
  return typeof voice.voiceURI === 'string' && voice.voiceURI.length > 0 &&
    typeof voice.lang === 'string' && /^en(?:-[A-Za-z0-9]{1,8})*$/i.test(voice.lang) &&
    voice.localService === true &&
    voices.filter(candidate => candidate.voiceURI === voice.voiceURI).length === 1
}
function selectVoice(voices, explicitVoiceURI) {
  const eligible = voices.filter(voice => eligibleVoice(voices, voice))
  if (explicitVoiceURI !== null)
    return eligible.find(voice => voice.voiceURI === explicitVoiceURI) ?? null
  return eligible.sort((a, b) => a.voiceURI < b.voiceURI ? -1 : a.voiceURI > b.voiceURI ? 1 : 0)[0] ?? null
}
for (const item of fixtures.voiceEligibilityCases) {
  const selected = selectVoice(item.voices, item.explicitVoiceURI)
  check((selected?.voiceURI ?? null) === item.expectedSelectedVoiceURI,
    `${item.id}: local voice selection differs`)
  if ('recheckVoices' in item) {
    check(selected !== null, `${item.id}: missing initial local voice`)
    const current = item.recheckVoices.filter(voice =>
      voice.voiceURI === selected.voiceURI && voice.lang === selected.lang &&
      eligibleVoice(item.recheckVoices, voice))
    check((current.length === 1) === item.expectedRecheckEligible,
      `${item.id}: voice eligibility change differs`)
  }
}
const position = Array.from({ length: 8 }, (_, index) =>
  3 * [3, 4, 5, 6, 7, 8].filter(length => length >= index + 1).length)
check(JSON.stringify(position) === JSON.stringify(fixtures.formExpectations.serialPositionDenominatorsPerForm),
  'Serial position denominator fixture differs')
check(position.reduce((a, b) => a + b, 0) === fixtures.formExpectations.digitPositionsPerForm,
  'Digit-position total differs')
const percentOneDecimal = (count, denominator) => Math.floor(count * 1000 / denominator + 0.5) / 10
check(percentOneDecimal(1, 3) === 33.3 && percentOneDecimal(2, 3) === 66.7 &&
  percentOneDecimal(1, 12) === 8.3, 'Percentage fixture differs')
console.log(`Digits fixtures pass: ${fixtures.classificationCases.length} classification, ` +
  `${fixtures.boundaryCases.length} deadline, ${fixtures.voiceEligibilityCases.length} voice, ` +
  `3 percentage, 99 digit positions per form`)

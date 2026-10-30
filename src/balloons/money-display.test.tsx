import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeAll, expect, it } from 'vitest'
import { webcrypto } from 'node:crypto'
import { BalloonsReport } from './PracticeReport'
import { BalloonsComparison } from './ComparisonView'
import { baseline } from './training-test-support'
import { loadScoredManifests } from './manifests'
import { basicReport } from './report'

beforeAll(async () => {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true })
  await loadScoredManifests()
})
afterEach(cleanup)

it('formats report totals and every money table cell as dollars, preserving stored cents', () => {
  const record = baseline('BL1', row => row.round === 1 ? 32 : 1).records.base
  const original = JSON.stringify(record)
  const report = basicReport(record.snapshot.core)
  if (report.status !== 'headless_complete') throw Error('Expected a complete report fixture')
  render(<BalloonsReport record={record} onReplay={() => {}} onHistory={() => {}} />)
  const tables = screen.getAllByRole('table', { hidden: true })
  const money = (value: number) => `$${(value / 100).toFixed(2)}`
  const summary = within(tables[0]).getAllByRole('row', { hidden: true })[1]
  expect(within(summary).getAllByRole('cell', { hidden: true }).slice(3, 5).map(cell => cell.textContent))
    .toEqual([money(report.total.bankedCents), money(report.total.lostCents)])
  const rounds = within(tables.at(-1)!).getAllByRole('row', { hidden: true }).slice(1)
  expect(rounds).toHaveLength(39)
  rounds.forEach((row, index) => {
    expect(within(row).getAllByRole('cell', { hidden: true }).slice(-2).map(cell => cell.textContent))
      .toEqual([money(report.rounds[index].bankedCents), money(report.rounds[index].lostCents)])
  })
  expect(document.body.textContent).not.toMatch(/\bcents\b/i)
  expect(JSON.stringify(record)).toBe(original)
})

it('formats comparison dollar changes with their sign while leaving count units unchanged', () => {
  render(<BalloonsComparison comparison={{ status: 'ready', baselineFormId: 'BL1', retestFormId: 'RT1', baselineSessionId: 'bl', retestSessionId: 'rt', installationId: 'install', rows: [{
    label: 'All balloons', denominator: 39,
    bankedCents: { baseline: 75, retest: 125, delta: 50 },
    lostCents: { baseline: 100, retest: 25, delta: -75 },
    collectedCount: { baseline: 20, retest: 22, delta: 2 },
    burstCount: { baseline: 19, retest: 17, delta: -2 },
    voluntaryCount: { baseline: 20, retest: 22, delta: 2 },
    capCount: { baseline: 0, retest: 0, delta: 0 },
  }] }} onHistory={() => {}} onCheck={() => {}} />)
  expect(screen.getByText('Banked: $0.75 → $1.25; RT − BL +$0.50.')).toBeInTheDocument()
  expect(screen.getByText('Lost: $1.00 → $0.25; RT − BL -$0.75.')).toBeInTheDocument()
  expect(screen.getByText('Collected: 20/39 → 22/39; RT − BL +2.')).toBeInTheDocument()
  expect(document.body.textContent).not.toMatch(/\bcents\b/i)
})

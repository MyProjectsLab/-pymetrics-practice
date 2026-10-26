/// <reference types="node" />
// @vitest-environment node
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

it.each(['fixation', 'standard-go', 'standard-no-go', 'shape-go', 'shape-no-go'])('bundled %s exactly preserves the M1 public asset', name => {
  expect(readFileSync(new URL(`./assets/${name}.svg`, import.meta.url), 'utf8'))
    .toBe(readFileSync(new URL(`../../public/stop/stimuli/${name}.svg`, import.meta.url), 'utf8'))
})

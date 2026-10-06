// Rewrites the generated block at the top of PROGRESS.md from the repo's real state
// (features.json + open OpenSpec changes) and prints it. Run it at clock-in and clock-out.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { replaceAutoBlock } from './lib.mjs'
import { buildProgressBlock, fail, format, path, PROGRESS } from './io.mjs'

const block = buildProgressBlock()

if (!existsSync(path(PROGRESS))) fail(`${PROGRESS} is missing.`)
try {
  writeFileSync(path(PROGRESS), replaceAutoBlock(readFileSync(path(PROGRESS), 'utf8'), block))
} catch (error) {
  fail(error.message)
}
format(PROGRESS)
console.log(block)
console.log('\nThen read the rest of PROGRESS.md and DECISIONS.md.')

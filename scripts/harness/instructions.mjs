// Keeps CLAUDE.md a short map: at most MAX_LINES lines, and every .md file it names exists.
// A long entry file buries rules in the middle, where models read worst.
import { existsSync, readFileSync } from 'node:fs'
import { checkInstructions } from './lib.mjs'
import { fail, path } from './io.mjs'

const FILE = 'CLAUDE.md'
const MAX_LINES = 200

const problems = checkInstructions(readFileSync(path(FILE), 'utf8'), {
  maxLines: MAX_LINES,
  exists: (rel) => existsSync(path(rel)),
})
if (problems.length) fail(`${FILE} ${problems.join(`\n✗ ${FILE} `)}`)
console.log(`✓ ${FILE}: within ${MAX_LINES} lines, every linked doc exists`)

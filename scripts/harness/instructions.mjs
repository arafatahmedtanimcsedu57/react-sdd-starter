// Keeps CLAUDE.md a short map: at most MAX_LINES lines, and every .md file it names exists.
// A long entry file buries rules in the middle, where models read worst. Also keeps the old
// generated block out of PROGRESS.md (it made every clock-out conflict).
import { existsSync, readFileSync } from 'node:fs'
import { checkInstructions, checkProgressDoc } from './lib.mjs'
import { fail, path } from './io.mjs'

const FILE = 'CLAUDE.md'
const MAX_LINES = 200

const problems = checkInstructions(readFileSync(path(FILE), 'utf8'), {
  maxLines: MAX_LINES,
  exists: (rel) => existsSync(path(rel)),
})
if (problems.length) fail(`${FILE} ${problems.join(`\n✗ ${FILE} `)}`)
console.log(`✓ ${FILE}: within ${MAX_LINES} lines, every linked doc exists`)

const progress = checkProgressDoc(readFileSync(path('PROGRESS.md'), 'utf8'))
if (progress.length) fail(`PROGRESS.md ${progress.join('\n✗ PROGRESS.md ')}`)

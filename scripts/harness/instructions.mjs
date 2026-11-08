// Keeps CLAUDE.md a short map: at most MAX_LINES lines, and every .md file it names exists.
// A long entry file buries rules in the middle, where models read worst. Also keeps the old
// generated block out of PROGRESS.md (it made every clock-out conflict).
import { existsSync, readFileSync } from 'node:fs'
import { checkInstructions, checkProgressDoc, codeownersMissing } from './lib.mjs'
import { fail, path, readTeam } from './io.mjs'

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

// With two or more members every owned line must name every member, or someone's PRs lose
// their reviewer — e.g. after a team.json / CODEOWNERS conflict resolved by hand.
const logins = readTeam().members.map((m) => m.github)
if (logins.length >= 2 && existsSync(path('.github/CODEOWNERS'))) {
  const missing = codeownersMissing(readFileSync(path('.github/CODEOWNERS'), 'utf8'), logins)
  if (missing.length) {
    fail(
      `.github/CODEOWNERS ${missing.join('\n✗ .github/CODEOWNERS ')}\n  FIX: npm run team -- codeowners`,
    )
  }
  console.log(`✓ .github/CODEOWNERS: every line names all ${logins.length} members`)
}

// Is Gate 2 actually enforced on GitHub? Read-only: gathers the default branch's
// protection, the collaborators and CODEOWNERS with `gh`, then checks every rule the harness
// relies on (lib.mjs → checkTeamSetup). Not part of `npm run check`: CI tokens can't read
// branch protection. `/orchestrate` runs it at clock-in.
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { checkTeamSetup, parseCodeowners } from './lib.mjs'
import { fail, path } from './io.mjs'

function gh(...args) {
  const run = spawnSync('gh', args, { encoding: 'utf8' })
  if (run.error) fail('team:check needs the GitHub CLI (gh), signed in: gh auth login')
  return { ok: run.status === 0, out: run.stdout.trim(), err: run.stderr.trim() }
}

const repo = gh('repo', 'view', '--json', 'nameWithOwner,defaultBranchRef')
if (!repo.ok) fail(`could not read the repo: ${repo.err}`)
const { nameWithOwner, defaultBranchRef } = JSON.parse(repo.out)
const branch = defaultBranchRef.name

const prot = gh('api', `repos/${nameWithOwner}/branches/${branch}/protection`)
let protection = null
if (prot.ok) protection = JSON.parse(prot.out)
else if (!/Branch not protected|HTTP 404/.test(prot.err)) {
  fail(`could not read ${branch}'s protection (needs admin access): ${prot.err}`)
}

const collab = gh('api', `repos/${nameWithOwner}/collaborators`, '--jq', '.[].login')
if (!collab.ok) fail(`could not list collaborators: ${collab.err}`)
const collaborators = collab.out.split('\n').filter(Boolean)

const codeowners = path('.github/CODEOWNERS')
const owners = existsSync(codeowners) ? parseCodeowners(readFileSync(codeowners, 'utf8')) : []

const rows = checkTeamSetup({ branch, protection, collaborators, owners })
for (const r of rows) {
  console.log(r.ok ? `✓ ${r.rule}` : `✗ ${r.rule}\n  FIX (repo admin): ${r.fix}`)
}
const misses = rows.filter((r) => !r.ok).length
if (misses) {
  console.error(
    `\n✗ ${misses} of ${rows.length} team rules missing on ${nameWithOwner} — Gate 2 (review ` +
      'by the other developer) is not enforced until they are fixed. See TEAM.md.',
  )
  process.exit(1)
}
console.log(`\n✓ team: ${nameWithOwner} enforces review by the other developer on ${branch}`)

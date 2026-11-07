// Is Gate 2 actually enforced on GitHub? Read-only: gathers the default branch's
// protection, the collaborators with push access and the default branch's CODEOWNERS (the
// copy GitHub uses — not this working tree's) with `gh`, then checks every rule the harness
// relies on (lib.mjs → checkTeamSetup). Not part of `npm run check`: CI tokens can't read
// branch protection. `/orchestrate` runs it at clock-in.
import { Buffer } from 'node:buffer'
import { spawnSync } from 'node:child_process'
import { checkTeamSetup, parseCodeowners } from './lib.mjs'
import { fail } from './io.mjs'

function gh(...args) {
  const run = spawnSync('gh', args, { encoding: 'utf8' })
  if (run.error) fail('team:check needs the GitHub CLI (gh), signed in: gh auth login')
  return { ok: run.status === 0, out: run.stdout.trim(), err: run.stderr.trim() }
}

const repo = gh('repo', 'view', '--json', 'nameWithOwner,defaultBranchRef')
if (!repo.ok) fail(`could not read the repo: ${repo.err}`)
const { nameWithOwner, defaultBranchRef } = JSON.parse(repo.out)
const branch = defaultBranchRef?.name ?? fail(`${nameWithOwner} has no default branch yet.`)
const ref = encodeURIComponent(branch)

// Only "Branch not protected" means unprotected; any other 404 / 403 means we can't tell.
const prot = gh('api', `repos/${nameWithOwner}/branches/${ref}/protection`)
let protection = null
if (prot.ok) protection = JSON.parse(prot.out)
else if (!/Branch not protected/.test(prot.err)) {
  fail(`could not read ${branch}'s protection (needs admin access): ${prot.err}`)
}

// GitHub ignores code owners without write access.
const collab = gh(
  'api',
  '--paginate',
  `repos/${nameWithOwner}/collaborators`,
  '--jq',
  '.[] | select(.permissions.push) | .login',
)
if (!collab.ok) fail(`could not list collaborators: ${collab.err}`)
const collaborators = collab.out.split('\n').filter(Boolean)

const file = gh(
  'api',
  `repos/${nameWithOwner}/contents/.github/CODEOWNERS?ref=${ref}`,
  '--jq',
  '.content',
)
if (!file.ok && !/Not Found|HTTP 404/.test(file.err)) fail(`could not read CODEOWNERS: ${file.err}`)
const codeowners = file.ok ? parseCodeowners(Buffer.from(file.out, 'base64').toString('utf8')) : []

const rows = checkTeamSetup({ branch, protection, collaborators, codeowners })
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

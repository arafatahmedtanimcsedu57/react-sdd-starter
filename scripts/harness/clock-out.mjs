// The end of a session, checked instead of trusted: a working setup, no leftovers, your
// handoff file (progress/<id>.md) up to date, everything committed. It never edits code.
//   npm run clock-out            check, exit 1 on any ✗
//   npm run clock-out -- --fix   first delete untracked junk files (*.log, debug-*, *.orig …)
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, unlinkSync } from 'node:fs'
import { findJunk, progressFile, progressProblem, progressText } from './lib.mjs'
import { appendTrace, changedFiles, DEFAULT_BRANCH, forkPoint, git, path, whoami } from './io.mjs'

const fix = process.argv.includes('--fix')
const untracked = () =>
  git('ls-files', '-z', '--others', '--exclude-standard').split('\0').filter(Boolean)
const indent = (text) =>
  text
    .replace(/^\n+|\s+$/g, '')
    .split('\n')
    .slice(0, 12)
    .map((line) => `      ${line}`)
    .join('\n')

if (fix) {
  for (const file of findJunk(untracked())) {
    try {
      unlinkSync(path(file))
      console.log(`  removed ${file}`)
    } catch (error) {
      console.error(`  could not remove ${file}: ${error.message}`)
    }
  }
}

const branch = git('rev-parse', '--abbrev-ref', 'HEAD')
const onDefault = DEFAULT_BRANCH.test(branch)
const changed = changedFiles()
// Your handoff file: progress/<login>.md once you've joined, else progress/<email>.md.
const file = progressFile(whoami())

const checks = [
  [
    'environment',
    () => {
      const r = spawnSync(process.execPath, [path('scripts/harness/ready.mjs')], {
        encoding: 'utf8',
      })
      return r.status === 0 ? null : `${r.stderr}${r.stdout}`
    },
  ],
  [
    'no junk files',
    () => {
      const junk = findJunk(untracked())
      return junk.length ? `${junk.join('\n')}\nFIX: npm run clock-out -- --fix` : null
    },
  ],
  [
    'no leftovers in changed code',
    () => {
      const code = changed.filter((f) => /\.[cm]?[jt]sx?$/.test(f) && existsSync(path(f)))
      if (!code.length) return null
      const r = spawnSync('npx', ['--no-install', 'eslint', '--no-warn-ignored', ...code], {
        cwd: path('.'),
        encoding: 'utf8',
      })
      if (r.error) return `could not run eslint: ${r.error.message}\nFIX: npm ci`
      return r.status === 0 ? null : `${r.stdout}${r.stderr}\nFIX: each error says how.`
    },
  ],
  [
    'your handoff file saved',
    () => {
      const before = onDefault || !file ? '' : git('show', `${forkPoint()}:${file}`)
      return progressProblem({
        changed,
        now: file && existsSync(path(file)) ? progressText(readFileSync(path(file), 'utf8')) : null,
        before: before ? progressText(before) : null,
        onDefault,
        file,
      })
    },
  ],
  [
    'committed on a feature branch',
    () => {
      const dirty = git('status', '--porcelain')
      if (branch === 'HEAD')
        return 'Detached HEAD.\nFIX: git switch -c <type>/<name>, then commit there.'
      if (onDefault) {
        return dirty
          ? `On ${branch} with uncommitted changes:\n${dirty}\nFIX: git switch -c <type>/<name>, then commit there.`
          : null
      }
      return dirty ? `${dirty}\nFIX: commit (or drop) these.` : null
    },
  ],
]

console.log('== clock-out ==')
let failed = 0
for (const [name, check] of checks) {
  const started = Date.now()
  let problem
  try {
    problem = check()
  } catch (error) {
    problem = `the check itself crashed: ${error.message}`
  }
  appendTrace({ source: 'clock-out', step: name, exit: problem ? 1 : 0, ms: Date.now() - started })
  console.log(problem ? `[✗] ${name}\n${indent(problem)}` : `[✓] ${name}`)
  if (problem) failed++
}
if (failed) {
  console.error(`\n✗ Not clean: ${failed} of ${checks.length}. Fix the ✗ lines, then run it again.`)
  process.exit(1)
}
console.log(`\n✓ Clean desk: the next session can start from ${file} → Next step.`)

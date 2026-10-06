// The end of a session, checked instead of trusted: the next session (or human) must find a
// working setup, no leftovers, an up-to-date PROGRESS.md and everything committed.
//
//   npm run clock-out            check, exit 1 on any ✗
//   npm run clock-out -- --fix   first delete untracked junk files (*.log, debug-*, *.orig …)
//
// It never edits code: debug leftovers are reported, not removed.
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, unlinkSync } from 'node:fs'
import { autoBlockMatches, findJunk, handwrittenPart } from './lib.mjs'
import {
  appendTrace,
  buildProgressBlock,
  changedFiles,
  forkPoint,
  git,
  path,
  PROGRESS,
} from './io.mjs'

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
    unlinkSync(path(file))
    console.log(`  removed ${file}`)
  }
}

const branch = git('rev-parse', '--abbrev-ref', 'HEAD')
const changed = changedFiles()

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
    'progress saved',
    () => {
      if (!existsSync(path(PROGRESS))) return `${PROGRESS} is missing.`
      const doc = readFileSync(path(PROGRESS), 'utf8')
      if (!autoBlockMatches(doc, buildProgressBlock())) {
        return `${PROGRESS} is out of date.\nFIX: npm run progress`
      }
      // The generated block changes with the branch name, so only the hand-written part counts.
      const before = git('show', `${forkPoint()}:${PROGRESS}`)
      if (changed.length && before && handwrittenPart(before) === handwrittenPart(doc)) {
        return `This branch changes files but not ${PROGRESS}'s handoff.\nFIX: update Current work, Known issues and Next step.`
      }
      return null
    },
  ],
  [
    'committed on a feature branch',
    () => {
      if (/^(main|master)$/.test(branch)) {
        return `On ${branch}.\nFIX: git switch -c <type>/<name>, then commit there.`
      }
      const dirty = git('status', '--porcelain')
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
console.log('\n✓ Clean desk: the next session can start from PROGRESS.md → Next step.')

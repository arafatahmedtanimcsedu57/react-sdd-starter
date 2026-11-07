// Is this checkout able to run the harness? Checks the Node version against package.json
// `engines` and node_modules against package-lock.json. Hooks run it first, so a broken
// environment says "run npm ci" instead of a stack trace from deep inside a script.
// Only node: built-ins here — it must work before anything is installed.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkEnvironment, findModulesRoot, nvmrcMismatch } from './env.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel) => {
  const file = join(ROOT, rel)
  return existsSync(file) ? readFileSync(file, 'utf8') : null
}
const packagesOf = (rel, base = ROOT) => {
  const file = join(base, rel)
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')).packages ?? {}) : null
}
// The main checkout (parent of the shared .git) bounds the walk up from a worker worktree.
let repoTop
try {
  const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim()
  repoTop = dirname(common)
} catch {
  repoTop = ROOT // not a git checkout: only look in this folder
}
const modulesRoot = findModulesRoot(ROOT, existsSync, dirname, repoTop)

const nodeVersion = process.version
const nvmrc = read('.nvmrc')?.trim() || null
const problems = checkEnvironment({
  nodeVersion,
  engines: JSON.parse(read('package.json')).engines?.node,
  nvmrc,
  lock: packagesOf('package-lock.json'),
  nodeModules: modulesRoot !== null,
  // npm's own record of what it installed; missing = interrupted, or not installed by npm.
  installed: modulesRoot ? packagesOf('node_modules/.package-lock.json', modulesRoot) : null,
})

if (problems.length) {
  console.error(`✗ ENVIRONMENT is not ready:\n${problems.map((p) => `✗ ${p}`).join('\n')}`)
  process.exit(1)
}
const warning = nvmrcMismatch(nodeVersion, nvmrc)
if (warning) console.warn(`⚠ ${warning}`)
const from = modulesRoot && modulesRoot !== ROOT ? ` (node_modules from ${modulesRoot})` : ''
console.log(`✓ ready: Node ${nodeVersion}, node_modules matches package-lock.json${from}`)

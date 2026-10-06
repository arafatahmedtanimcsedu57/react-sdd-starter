// Is this checkout able to run the harness? Checks the Node version against package.json
// `engines` and node_modules against package-lock.json. Hooks run it first, so a broken
// environment says "run npm ci" instead of a stack trace from deep inside a script.
// Only node: built-ins here — it must work before anything is installed.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkEnvironment, nvmrcMismatch } from './env.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel) => {
  const file = join(ROOT, rel)
  return existsSync(file) ? readFileSync(file, 'utf8') : null
}
const packagesOf = (rel) => {
  const text = read(rel)
  return text ? (JSON.parse(text).packages ?? {}) : null
}

const nodeVersion = process.version
const nvmrc = read('.nvmrc')?.trim() || null
const problems = checkEnvironment({
  nodeVersion,
  engines: JSON.parse(read('package.json')).engines?.node,
  nvmrc,
  lock: packagesOf('package-lock.json'),
  nodeModules: existsSync(join(ROOT, 'node_modules')),
  // npm's own record of what it installed; missing = interrupted, or not installed by npm.
  installed: packagesOf('node_modules/.package-lock.json'),
})

if (problems.length) {
  console.error(`✗ ENVIRONMENT is not ready:\n${problems.map((p) => `✗ ${p}`).join('\n')}`)
  process.exit(1)
}
const warning = nvmrcMismatch(nodeVersion, nvmrc)
if (warning) console.warn(`⚠ ${warning}`)
console.log(`✓ ready: Node ${nodeVersion}, node_modules matches package-lock.json`)

// Pure logic behind ready.mjs. No imports at all: this runs before anything is installed
// (and on the wrong Node), so it must not depend on node_modules.

const parse = (version) => {
  const [major = 0, minor = 0, patch = 0] = String(version)
    .replace(/^v/, '')
    .split('.')
    .map((part) => Number.parseInt(part, 10) || 0)
  return [major, minor, patch]
}

const compare = (a, b) => {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i]
  return 0
}

function satisfiesComparator(version, comparator) {
  const match = /^(\^|~|>=|<=|>|<|=)?\s*v?(\d+(?:\.\d+){0,2})$/.exec(comparator.trim())
  if (!match) throw new Error(`unsupported version range part "${comparator}"`)
  const [, op = '=', target] = match
  const parts = target.split('.').length
  const v = parse(version)
  const t = parse(target)
  const diff = compare(v, t)
  switch (op) {
    case '>=':
      return diff >= 0
    case '>':
      return diff > 0
    case '<=':
      return diff <= 0
    case '<':
      return diff < 0
    case '^':
      return diff >= 0 && (t[0] > 0 ? v[0] === t[0] : v[0] === 0 && v[1] === t[1])
    case '~':
      return diff >= 0 && v[0] === t[0] && (parts === 1 || v[1] === t[1])
    default:
      // "24" means any 24.x, "24.1" any 24.1.x
      return v.slice(0, parts).every((n, i) => n === t[i])
  }
}

/** True when `version` (e.g. "v24.21.0") satisfies an npm `engines` range like "^22.1 || >=24". */
export function satisfies(version, range) {
  return range.split('||').some((alternative) =>
    alternative
      .trim()
      .split(/\s+(?=[\^~<>=\d])/)
      .every((comparator) => satisfiesComparator(version, comparator)),
  )
}

/**
 * Packages the lockfile wants that node_modules doesn't have at that version. Optional
 * packages are skipped: npm leaves out the ones built for other platforms.
 */
export function findInstallDrift(lockPackages, installedPackages) {
  const drift = []
  for (const [where, wanted] of Object.entries(lockPackages)) {
    if (!where || wanted.optional || wanted.link) continue
    const installed = installedPackages[where]
    const name = where.replace(/^.*node_modules\//, '')
    if (!installed) drift.push(`${name}@${wanted.version} is not installed`)
    else if (installed.version !== wanted.version)
      drift.push(`${name} is ${installed.version}, the lockfile wants ${wanted.version}`)
  }
  return drift
}

/** Problems that stop the harness from running, each with a FIX line. Empty = ready. */
export function checkEnvironment({ nodeVersion, engines, nvmrc, lock, installed }) {
  const problems = []
  if (engines && !satisfies(nodeVersion, engines)) {
    const pinned = nvmrc ? ` (.nvmrc: ${nvmrc})` : ''
    problems.push(
      `Node ${nodeVersion} does not satisfy package.json engines "${engines}"${pinned}.\n` +
        '  FIX (human): `nvm use`, or `nvm alias default <version>` for every new shell, then\n' +
        '  restart Claude Code — hooks run with the Node it was started with.',
    )
  }
  if (!installed) {
    problems.push('node_modules is missing.\n  FIX: npm ci')
  } else if (lock) {
    const drift = findInstallDrift(lock, installed)
    if (drift.length) {
      const shown = drift.slice(0, 5).map((line) => `  ${line}`)
      if (drift.length > 5) shown.push(`  …and ${drift.length - 5} more`)
      problems.push(
        `node_modules does not match package-lock.json:\n${shown.join('\n')}\n  FIX: npm ci`,
      )
    }
  }
  return problems
}

/** A warning, not a failure: engines may allow more than the one version .nvmrc pins. */
export function nvmrcMismatch(nodeVersion, nvmrc) {
  if (!nvmrc || /^(lts|node)/i.test(nvmrc)) return null
  return satisfies(nodeVersion, nvmrc.replace(/^v/, ''))
    ? null
    : `Node ${nodeVersion} is allowed, but .nvmrc pins ${nvmrc} (what CI uses). \`nvm use\` to match.`
}

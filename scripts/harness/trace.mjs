// What did the harness actually run? Prints the trace the hooks, `features verify` and
// `clock-out` write to .claude/traces/<UTC day>.jsonl — exit code and time per step.
//
//   npm run trace                       today's last 40 steps
//   npm run trace -- --failed           only the failures
//   npm run trace -- --day 2026-10-06 --limit 200
import { parseArgs } from 'node:util'
import { formatTrace } from './lib.mjs'
import { fail, readTraces, TRACES } from './io.mjs'

const { values } = parseArgs({
  options: {
    day: { type: 'string', default: new Date().toISOString().slice(0, 10) },
    limit: { type: 'string', default: '40' },
    failed: { type: 'boolean', default: false },
  },
})
if (!/^\d{4}-\d{2}-\d{2}$/.test(values.day)) fail('--day must look like 2026-10-06.')
const limit = Number.parseInt(values.limit, 10)
if (!(limit > 0)) fail('--limit must be a positive number.')

const entries = readTraces(values.day).filter((e) => !values.failed || e.exit !== 0)
if (!entries.length) {
  console.log(`No ${values.failed ? 'failed ' : ''}steps in ${TRACES}/${values.day}.jsonl.`)
  process.exit(0)
}
const shown = entries.slice(-limit)
console.log(`== trace ${values.day} (${shown.length} of ${entries.length}) ==`)
console.log(formatTrace(shown).join('\n'))

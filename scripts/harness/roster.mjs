// The team roster (team.json): who is on the team by GitHub login, and — once each person
// joins — the git email they commit with. Features can be owned by `@login`.
//
//   npm run team                    members, joined or not, and the features each owns
//   npm run team -- add @login      (lead) add a member
//   npm run team -- join            (each member, once) link your GitHub login to your git email
//   npm run team -- remove @login   (a lead) drop a member who owns no unfinished feature
//   npm run team -- codeowners      rewrite .github/CODEOWNERS: every line → every member
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { isLead, isOwner, leadsOf, parseTeam, renderCodeowners } from './lib.mjs'
import {
  appendLedger,
  fail,
  format,
  me,
  path,
  readFeatures,
  readLedger,
  readTeam,
  TEAM,
  whoami,
} from './io.mjs'

const [command = 'list', arg] = process.argv.slice(2)
const team = readTeam()

function write(next) {
  let valid
  try {
    valid = parseTeam(next)
  } catch (error) {
    fail(error.message)
  }
  writeFileSync(path(TEAM), `${JSON.stringify(valid, null, 2)}\n`)
  format(TEAM)
}

function featuresOf(member) {
  if (!existsSync(path('features.json'))) return []
  const who = { email: member.email, github: member.github }
  return readFeatures().features.filter((f) => isOwner(f.owner, who))
}

switch (command) {
  case 'list': {
    if (!team.members.length) {
      console.log('No team yet. The lead adds members: npm run team -- add @login')
      break
    }
    for (const m of team.members) {
      const owned = featuresOf(m)
      const active = owned.filter((f) => f.state === 'active').length
      const lead = leadsOf(team).some((l) => l.toLowerCase() === m.github.toLowerCase())
      const joined = `${lead ? 'lead, ' : ''}${m.email ? `joined as ${m.email}` : 'not joined yet (npm run team -- join)'}`
      const list = owned.map((f) => `${f.id} ${f.title} (${f.state.replace('_', ' ')})`).join(', ')
      console.log(
        `@${m.github}  ${joined}\n  ${owned.length} features, ${active} active${list ? `: ${list}` : ''}`,
      )
    }
    break
  }
  case 'add': {
    const login = arg?.replace(/^@/, '')
    if (!login) fail('add needs a GitHub login: npm run team -- add @login')
    if (team.members.some((m) => m.github.toLowerCase() === login.toLowerCase())) {
      fail(`@${login} is already on the team.`)
    }
    write({ ...team, members: [...team.members, { github: login }] })
    console.log(`✓ added @${login}. They run \`npm run team -- join\` after pulling.`)
    break
  }
  case 'join': {
    // Only the person themselves links an email: a wrong one would hand them someone else's
    // features. The login comes from their own `gh` session, the email from their git config.
    const gh = spawnSync('gh', ['api', 'user', '--jq', '.login'], { encoding: 'utf8' })
    if (gh.error || gh.status !== 0) fail('join needs the GitHub CLI, signed in: gh auth login')
    const login = gh.stdout.trim()
    const email =
      me() || fail('git has no user.email.\n  FIX: git config user.email you@example.com')
    const member = team.members.find((m) => m.github.toLowerCase() === login.toLowerCase())
    if (!member) fail(`@${login} is not on the team. Ask the lead: npm run team -- add @${login}`)
    // Recorded in the ledger like a state move: a team.json email without a join line is a
    // hand edit (`features check` flags it), and old lines stay checked against old links.
    const recorded = readLedger().some(
      (e) =>
        e.event === 'join' &&
        e.github?.toLowerCase() === login.toLowerCase() &&
        e.by?.toLowerCase() === email.toLowerCase(),
    )
    if (!recorded) appendLedger({ event: 'join', github: login })
    // Ledger first: a crash between the two leaves a join line, never an unbacked email.
    write({
      ...team,
      members: team.members.map((m) => (m === member ? { ...m, github: login, email } : m)),
    })
    console.log(`✓ @${login} ↔ ${email}`)
    const ready = spawnSync(process.execPath, [path('scripts/harness/ready.mjs')], {
      encoding: 'utf8',
    })
    console.log(ready.status === 0 ? ready.stdout.trim() : `${ready.stderr}${ready.stdout}`.trim())
    // Reported, not required: reading branch protection needs admin access.
    const teamCheck = spawnSync(process.execPath, [path('scripts/harness/team.mjs')], {
      encoding: 'utf8',
    })
    const summary = `${teamCheck.stdout}${teamCheck.stderr}`.trim().split('\n').at(-1)
    console.log(`team:check — ${summary}`)
    const mine = featuresOf({ github: login, email }).filter((f) => f.state !== 'passing')
    console.log(
      mine.length
        ? `Your features: ${mine.map((f) => `${f.id} ${f.title}`).join(', ')}\nNext: commit team.json + the ledger in a PR and get it merged — until then only branches made from this one know it's you (and /orchestrate's workers start from master). Then /orchestrate ${mine[0].id}`
        : 'No open features for you yet. Next: commit team.json in a PR; the lead assigns work with /kickoff.',
    )
    break
  }
  case 'remove': {
    const login = arg?.replace(/^@/, '')
    if (!login) fail('remove needs a GitHub login: npm run team -- remove @login')
    if (!isLead(team, whoami(team)))
      fail(
        `Only a lead (${leadsOf(team)
          .map((l) => `@${l}`)
          .join(', ')}) removes members.`,
      )
    const member = team.members.find((m) => m.github.toLowerCase() === login.toLowerCase())
    if (!member) fail(`@${login} is not on the team.`)
    const open = featuresOf(member).filter((f) => f.state !== 'passing')
    if (open.length) {
      fail(
        `@${login} still owns ${open.map((f) => f.id).join(', ')}. Hand each over first:\n  ` +
          open
            .map(
              (f) => `npm run features -- owner ${f.id} --set @<login> --reason "@${login} left"`,
            )
            .join('\n  '),
      )
    }
    const leads = team.leads?.filter((l) => l.toLowerCase() !== login.toLowerCase())
    write({
      ...team,
      members: team.members.filter((m) => m !== member),
      ...(team.leads ? { leads } : {}),
    })
    console.log(`✓ removed @${login}. Next: npm run team -- codeowners, then a PR.`)
    break
  }
  case 'codeowners': {
    if (team.members.length < 2)
      fail('CODEOWNERS needs two or more members, or nobody can review the only one.')
    const file = path('.github/CODEOWNERS')
    const text = existsSync(file) ? readFileSync(file, 'utf8') : '*  @x\n'
    writeFileSync(
      file,
      renderCodeowners(
        text,
        team.members.map((m) => m.github),
      ),
    )
    console.log(
      `✓ .github/CODEOWNERS: every line → ${team.members.map((m) => `@${m.github}`).join(' ')}`,
    )
    break
  }
  default:
    fail(`Unknown command "${command}". Commands: list, add, join, remove, codeowners.`)
}

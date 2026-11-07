// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { CODEOWNER_PLACEHOLDER, checkTeamSetup, parseCodeowners } from './lib.mjs'

const protection = {
  required_status_checks: {
    contexts: ['approvals', 'node-22', 'quality'],
    checks: [{ context: 'size' }],
  },
  required_pull_request_reviews: {
    required_approving_review_count: 1,
    require_code_owner_reviews: true,
    dismiss_stale_reviews: true,
    require_last_push_approval: true,
  },
  enforce_admins: { enabled: true },
  allow_force_pushes: { enabled: false },
  allow_deletions: { enabled: false },
}
const facts = (over = {}) => ({
  branch: 'master',
  protection,
  collaborators: ['me', 'x'],
  owners: ['@me', '@x'],
  ...over,
})
const failing = (f) =>
  checkTeamSetup(f)
    .filter((r) => !r.ok)
    .map((r) => r.rule)

describe('parseCodeowners', () => {
  it('collects unique owners, ignoring comments and paths', () => {
    const text = '# who\n*  @me @x\n/openspec/ @me # specs\n/src/ @org/frontend\n\n'
    expect(parseCodeowners(text)).toEqual(['@me', '@x', '@org/frontend'])
  })
})

describe('checkTeamSetup', () => {
  it('passes a complete setup', () => {
    expect(failing(facts())).toEqual([])
  })

  it('fails everything branch-related when the branch is not protected', () => {
    expect(failing(facts({ protection: null }))).toEqual([
      'master is protected',
      'required status checks: approvals, node-22, quality, size',
      'at least 1 approving review',
      'review from a code owner',
      'new pushes dismiss approvals',
      'the last push needs approval from someone else',
      'admins follow the rules too',
      'no force pushes or deletion',
    ])
  })

  it('names a missing required check in its fix', () => {
    const p = { ...protection, required_status_checks: { contexts: ['quality'] } }
    const row = checkTeamSetup(facts({ protection: p })).find((r) => !r.ok)
    expect(row.fix).toMatch(/approvals, node-22, size/)
  })

  it.each([
    ['required_approving_review_count', 0, 'at least 1 approving review'],
    ['require_code_owner_reviews', false, 'review from a code owner'],
    ['dismiss_stale_reviews', false, 'new pushes dismiss approvals'],
    ['require_last_push_approval', false, 'the last push needs approval from someone else'],
  ])('fails when %s is %s', (key, value, rule) => {
    const p = {
      ...protection,
      required_pull_request_reviews: { ...protection.required_pull_request_reviews, [key]: value },
    }
    expect(failing(facts({ protection: p }))).toEqual([rule])
  })

  it('fails when admins can bypass, or force pushes are allowed', () => {
    expect(
      failing(facts({ protection: { ...protection, enforce_admins: { enabled: false } } })),
    ).toEqual(['admins follow the rules too'])
    expect(
      failing(facts({ protection: { ...protection, allow_force_pushes: { enabled: true } } })),
    ).toEqual(['no force pushes or deletion'])
  })

  it('needs two real code owners who are collaborators', () => {
    expect(failing(facts({ owners: ['@me'] }))).toEqual([
      'CODEOWNERS names two or more people, no placeholder',
    ])
    expect(failing(facts({ owners: ['@me', CODEOWNER_PLACEHOLDER] }))).toEqual([
      'CODEOWNERS names two or more people, no placeholder',
    ])
    const stranger = checkTeamSetup(facts({ owners: ['@me', '@y'] })).find((r) => !r.ok)
    expect(stranger).toMatchObject({ rule: 'every code owner is a collaborator' })
    expect(stranger.fix).toMatch(/add @y/)
  })
})

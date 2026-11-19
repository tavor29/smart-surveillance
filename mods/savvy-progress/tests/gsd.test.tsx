import { expect, mock, test } from 'claude-code/testing'

import { gsdHeadline, parseFrontmatter, parseGsd, parseRoadmap } from '../hooks/gsd'

const STATE_FM = `---
gsd_state_version: '1.0'
milestone: v1.0
milestone_name: Camera MVP
current_phase: '2'
current_phase_name: Motion alerts
current_plan: '1'
status: executing
last_activity: 2026-11-18 — plan 02-01 started
progress:
  total_phases: 4
  completed_phases: 1
  total_plans: 6
  completed_plans: 2
  percent: 33
---

# Project State
`

const STATE_BODY = `# Project State

## Current Position

Phase: 3 of 5 (Dashboard)
Plan: 2 of 4 in current phase
Status: In progress
Last activity: 2026-11-18 — wired the feed grid

Progress: [████░░░░░░] 40%
`

const ROADMAP = `# Roadmap: Smart Surveillance

<details>
<summary>v0.9 (shipped)</summary>

- [x] **Phase 0: Spike** - old milestone
</details>

## Phases

- [x] **Phase 1: Camera ingest** - RTSP feeds
- [ ] **Phase 2: Motion alerts** - detection and alerts
- [ ] **Phase 2.1: Hotfix (INSERTED)** - urgent
- [ ] **Phase 3: Dashboard** - React UI
`

test('frontmatter is read with its nested progress block', async () => {
  const fields = parseFrontmatter(STATE_FM)
  expect(fields.milestone_name).toBe('Camera MVP')
  expect(fields.current_phase).toBe('2')
  expect(fields['progress.percent']).toBe('33')
})

test('roadmap phases skip collapsed milestones', async () => {
  expect(parseRoadmap(ROADMAP)).toEqual([
    { number: '1', name: 'Camera ingest', isDone: true },
    { number: '2', name: 'Motion alerts', isDone: false },
    { number: '2.1', name: 'Hotfix (INSERTED)', isDone: false },
    { number: '3', name: 'Dashboard', isDone: false },
  ])
})

test('state frontmatter wins over the body and roadmap', async () => {
  const gsd = parseGsd(STATE_FM, ROADMAP)
  expect(gsd?.percent).toBe(33)
  expect(gsd?.totalPhases).toBe(4)
  expect(gsd?.completedPlans).toBe(2)
  expect(gsdHeadline(gsd!)).toBe('v1.0 Camera MVP · Phase 2 of 4: Motion alerts · plan 1 · executing')
})

test('the body is the fallback when STATE.md has no frontmatter', async () => {
  const gsd = parseGsd(STATE_BODY, undefined)
  expect(gsd?.phase).toBe('3')
  expect(gsd?.totalPhases).toBe(5)
  expect(gsd?.phaseName).toBe('Dashboard')
  expect(gsd?.plansInPhase).toBe(4)
  expect(gsd?.percent).toBe(40)
  expect(gsd?.status).toBe('In progress')
})

test('a roadmap alone gives progress from its checkboxes', async () => {
  const gsd = parseGsd(undefined, ROADMAP)
  expect(gsd?.totalPhases).toBe(4)
  expect(gsd?.completedPhases).toBe(1)
  expect(gsd?.percent).toBe(25)
  expect(parseGsd(undefined, undefined)).toBeNull()
})

test('GSD progress reaches the command, pane, band and a phase toast', async ($, on) => {
  mock.store(on)
  mock.clock(on, { now: 1_000 })
  const files: Record<string, string> = {
    '/work/.planning/STATE.md': STATE_FM,
    '/work/.planning/ROADMAP.md': ROADMAP,
  }
  const toasts: string[] = []
  on('fs.exists', ($, e) => ({ value: e.path in files }) as never)
  on('fs.read', ($, e) => ({ value: files[e.path] ?? '' }) as never)
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('tool.register', ($, e) => ({ value: { tool: `mcp__savvy-progress__${e.name}` } }))
  on('ui.status', () => ({ value: undefined }) as never)
  on('ui.toast', ($, e) => (toasts.push(e.text), { value: undefined }) as never)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('tool.call', { tool: 'Edit' }, () => ({ result: {} }) as never)
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine's own</Text>
  })

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  const report = await $.command.run({ command: 'savvy-flow', args: 'gsd' } as never)
  expect(report.text).toContain('Phase 2 of 4: Motion alerts')
  expect(report.text).toContain('33%')

  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const pane = await $.ui.mount({
      plugin: 'savvy-progress',
      surface,
      component: 'Pane',
      requestId: 'savvy-flow',
      props: { title: 'Savvy Flow', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} },
    })
    expect(await pane.find({ text: /Camera MVP/ })).toBeDefined()
    expect(await pane.find({ text: /Phase 3: Dashboard/ })).toBeDefined()
    await pane.unmount()

    const band = await $.ui.mount({
      plugin: 'savvy-progress',
      surface,
      component: 'AbovePrompt',
      props: { hasSurvey: false, isCollapsed: false, isWorking: false, maxRows: 4, bodyColumns: 100, scroll: { offset: 0, bodyRows: 4 }, view: {} },
    })
    expect(await band.find({ text: /GSD P2\/4/ })).toBeDefined()
    await band.unmount()
  }

  files['/work/.planning/ROADMAP.md'] = ROADMAP.replace('- [ ] **Phase 2: Motion', '- [x] **Phase 2: Motion')
  files['/work/.planning/STATE.md'] = STATE_FM.replace('completed_phases: 1', 'completed_phases: 2')
  await $.tool.call({ tool: 'Edit', file_path: '/work/.planning/ROADMAP.md', old_string: 'a', new_string: 'b' } as never)
  expect(toasts).toContain('🏁 Savvy: GSD phase 2 (Motion alerts) complete')
})

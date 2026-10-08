import { expect, mock, test } from 'claude-code/testing'

import { bar, clip, duration } from '../hooks/register'

const SURFACES = ['terminal', 'desktop', 'vscode', 'mobile'] as const
const SCROLL = { offset: 0, bodyRows: 30 }
const PANE = {
  component: 'Pane',
  requestId: 'savvy-flow',
  props: { title: 'Savvy Flow', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: SCROLL, view: {} },
} as const
const BAND = {
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: true, maxRows: 4, bodyColumns: 100, scroll: SCROLL, view: {} },
} as const

test('helpers format progress', async () => {
  expect(bar(2, 4, 8)).toBe('████░░░░')
  expect(bar(0, 0, 3)).toBe('░░░')
  expect(duration(42)).toBe('42s')
  expect(duration(125)).toBe('2m05s')
  expect(clip('a   long\nprompt here', 8)).toBe('a long …')
})

test('a flow is tracked across the command, pane, band and stats', async ($, on) => {
  mock.store(on)
  const clock = mock.clock(on, { now: 1_000 })
  on('tool.call', { tool: 'TodoWrite' }, () => ({ result: { oldTodos: [], newTodos: [] } }) as never)
  on('tool.call', { tool: 'Bash' }, () => ({ result: { stdout: 'ok', stderr: '', interrupted: false } }) as never)

  const toasts: string[] = []
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('tool.register', ($, e) => ({ value: { tool: `mcp__savvy-progress__${e.name}` } }))
  on('ui.status', () => ({ value: undefined }) as never)
  on('ui.toast', ($, e) => (toasts.push(e.text), { value: undefined }) as never)
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine's own</Text>
  })
  on('session.start', ($, e) => ({ cwd: e.cwd }))

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await $.turn.start({ text: 'ship the launch kit', turnId: 't1' })
  await $.tool.call({ tool: 'Bash', command: 'npm test' } as never)
  await $.tool.call({
    tool: 'TodoWrite',
    todos: [
      { content: 'Write mod', status: 'completed', activeForm: 'Writing mod' },
      { content: 'Write README', status: 'in_progress', activeForm: 'Writing README' },
    ],
  } as never)
  await $.tool.call({ tool: 'mcp__savvy-progress__checkpoint', label: 'mod validates' } as never)
  await clock.advance(5_000)
  expect(toasts).toContain('◆ mod validates')

  for (const surface of SURFACES) {
    const pane = await $.ui.mount({ plugin: 'savvy-progress', surface, ...PANE })
    expect(await pane.find({ text: /ship the launch kit/ })).toBeDefined()
    expect(await pane.find({ text: /Writing README/ })).toBeDefined()
    expect(await pane.find({ text: /npm test/ })).toBeDefined()
    expect(await pane.find({ text: /mod validates/ })).toBeDefined()
    expect(await pane.find({ key: 'savvy-reset' })).toBeDefined()
    await pane.unmount()

    const band = await $.ui.mount({ plugin: 'savvy-progress', surface, ...BAND })
    expect(await band.find({ text: /1\/2/ })).toBeDefined()
    await band.unmount()
  }

  await $.turn.complete({ answer: 'done', durationMs: 6_000, isAborted: false, turnId: 't1', reason: 'answer' } as never)
  const stats = await $.command.run({ command: 'savvy-flow', args: 'stats' } as never)
  expect(stats.text).toContain('1 turns')
  expect(stats.text).toContain('mod validates')

  await $.command.run({ command: 'savvy-flow', args: 'band' } as never)
  const hidden = await $.ui.mount({ plugin: 'savvy-progress', surface: 'terminal', ...BAND })
  expect(await hidden.find({ key: 'savvy-hide' })).toBeUndefined()
  await hidden.unmount()
})

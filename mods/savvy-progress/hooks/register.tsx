// Savvy Progress, by Johnny Viz.
// Live flow tracking across Claude Code: the /savvy-flow command and pane,
// a progress band above the prompt, a status line, milestone toasts, a
// checkpoint tool the model can call, lifetime stats kept in the store, and
// GSD (get-shit-done) milestone and phase progress read from .planning/.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { gsdHeadline, parseGsd } from './gsd'

import type {
  Call,
  CallState,
  Checkpoint,
  GsdProgress,
  Lifetime,
  LiveTurn,
  Todo,
  Totals,
  TurnSummary,
} from '../types'

const PANE = 'savvy-flow'
const TITLE = 'Savvy Flow'
const CHECKPOINT_TOOL = 'mcp__savvy-progress__checkpoint'
const LIFETIME_KEY = 'lifetime'
const LONG_TURN_SECONDS = 120
const MAX_CALLS = 200
const MAX_CHECKPOINTS = 50

const ZERO_TOTALS: Totals = { turns: 0, tools: 0, failures: 0, checkpoints: 0 }
const ZERO_LIFETIME: Lifetime = { sessions: 0, turns: 0, tools: 0, todosCompleted: 0 }

const turn = atom({ plugin: 'savvy-progress', key: 'turn' } as const, null)
const todos = atom({ plugin: 'savvy-progress', key: 'todos' } as const, [])
const last = atom({ plugin: 'savvy-progress', key: 'last' } as const, null)
const totals = atom({ plugin: 'savvy-progress', key: 'totals' } as const, ZERO_TOTALS)
const checkpoints = atom({ plugin: 'savvy-progress', key: 'checkpoints' } as const, [])
const now = atom({ plugin: 'savvy-progress', key: 'now' } as const, 0)
const isBandHidden = atom({ plugin: 'savvy-progress', key: 'isBandHidden' } as const, false)
const gsd = atom({ plugin: 'savvy-progress', key: 'gsd' } as const, null)

const GSD_EDIT_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit'])

const HELP = [
  'Savvy Progress — /savvy-flow [open|close|band|reset|stats|gsd|help]',
  '  open   open the Savvy Flow pane (default)',
  '  close  close the pane',
  '  band   show or hide the progress band above the prompt',
  '  reset  clear this session\'s flow counters',
  '  stats  print this session\'s and lifetime stats',
  '  gsd    re-read .planning/ and print GSD milestone and phase progress',
].join('\n')

export function bar(done: number, total: number, width: number): string {
  if (total <= 0) return '░'.repeat(width)
  const filled = Math.round((Math.min(done, total) / total) * width)
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

export function clip(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length <= max ? flat : `${flat.slice(0, Math.max(1, max - 1))}…`
}

export function duration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  return `${minutes}m${String(seconds % 60).padStart(2, '0')}s`
}

export function labelFor(input: Record<string, unknown>): string {
  for (const field of ['command', 'file_path', 'pattern', 'url', 'query', 'description', 'path']) {
    const value = input[field]
    if (typeof value === 'string' && value.length > 0) return value
  }
  return ''
}

function todoCounts(list: readonly Todo[]) {
  const done = list.filter(one => one.status === 'completed').length
  const active = list.find(one => one.status === 'in_progress')
  return { done, total: list.length, active }
}

async function readLifetime($: EngineInterface): Promise<Lifetime> {
  const stored = (await $.store.get(LIFETIME_KEY)) as Partial<Lifetime> | undefined
  return { ...ZERO_LIFETIME, ...(stored ?? {}) }
}

async function bumpLifetime($: EngineInterface, delta: Partial<Lifetime>): Promise<void> {
  const held = await readLifetime($)
  await $.store.set(LIFETIME_KEY, {
    sessions: held.sessions + (delta.sessions ?? 0),
    turns: held.turns + (delta.turns ?? 0),
    tools: held.tools + (delta.tools ?? 0),
    todosCompleted: held.todosCompleted + (delta.todosCompleted ?? 0),
  })
}

async function readOptional($: EngineInterface, path: string): Promise<string | undefined> {
  try {
    return (await $.fs.exists(path)) ? await $.fs.read(path) : undefined
  } catch {
    return undefined
  }
}

export function touchesPlanning(tool: string, input: Record<string, unknown>): boolean {
  const target = tool === 'Bash' ? input.command : input.file_path ?? input.notebook_path
  if (typeof target !== 'string') return false
  if (tool === 'Bash') return /\.planning\b|gsd-tools|gsd-sdk/.test(target)
  return GSD_EDIT_TOOLS.has(tool) && /(^|\/)\.planning\//.test(target)
}

async function refreshGsd($: EngineInterface, root: string): Promise<GsdProgress | null> {
  const base = root === '' ? '.planning' : `${root.replace(/\/$/, '')}/.planning`
  const [state, roadmap] = await Promise.all([
    readOptional($, `${base}/STATE.md`),
    readOptional($, `${base}/ROADMAP.md`),
  ])
  const before = await read($, gsd)
  const after = parseGsd(state, roadmap)
  await update($, gsd, () => after)

  if (before !== null && after !== null) {
    const was = before.completedPhases ?? 0
    const now = after.completedPhases ?? 0
    if (now > was) {
      const finished = after.phases.filter(phase => phase.isDone).at(-1)
      $.ui.toast(`🏁 Savvy: GSD phase ${finished ? `${finished.number} (${finished.name})` : now} complete`)
    }
    if (after.totalPhases !== undefined && now === after.totalPhases && was < now) {
      $.ui.toast(`🎉 Savvy: GSD milestone${after.milestone ? ` ${after.milestone}` : ''} complete`)
    }
  }
  return after
}

function gsdText(progress: GsdProgress | null): string {
  if (progress === null) {
    return 'No GSD project here: .planning/STATE.md and .planning/ROADMAP.md were not found. Start one with /gsd-new-project.'
  }
  const lines = ['Savvy Progress — GSD', gsdHeadline(progress) || 'GSD project found']
  if (progress.percent !== undefined) lines.push(`Progress: ${bar(progress.percent, 100, 20)} ${progress.percent}%`)
  if (progress.completedPlans !== undefined && progress.totalPlans !== undefined) {
    lines.push(`Plans: ${progress.completedPlans}/${progress.totalPlans} complete`)
  }
  for (const phase of progress.phases) {
    const mark = phase.isDone ? '✔' : phase.number === progress.phase ? '▶' : '○'
    lines.push(`  ${mark} Phase ${phase.number}: ${phase.name}`)
  }
  if (progress.lastActivity) lines.push(`Last activity: ${progress.lastActivity}`)
  return lines.join('\n')
}

async function refreshStatus($: EngineInterface): Promise<void> {
  const [live, list, sum, prev, plan] = await Promise.all([
    read($, turn),
    read($, todos),
    read($, totals),
    read($, last),
    read($, gsd),
  ])
  const parts = ['◆ savvy']
  if (plan !== null && plan.phase !== undefined) {
    parts.push(
      `GSD P${plan.phase}${plan.totalPhases !== undefined ? `/${plan.totalPhases}` : ''}${plan.percent !== undefined ? ` ${plan.percent}%` : ''}`,
    )
  }
  const { done, total } = todoCounts(list)
  if (total > 0) parts.push(`${done}/${total} tasks`)
  if (live !== null) {
    const running = live.calls.filter(call => call.state === 'running').length
    parts.push(`▶ ${live.calls.length} tools${running > 0 ? ` (${running} running)` : ''}`)
  } else if (prev !== null) {
    parts.push(`last ${duration(prev.seconds)} · ${prev.tools} tools`)
  }
  if (sum.turns > 0) parts.push(`${sum.turns} turns`)
  $.ui.status(parts.length > 1 ? parts.join(' · ') : undefined)
}

async function statsText($: EngineInterface): Promise<string> {
  const [sum, life, list, marks] = await Promise.all([
    read($, totals),
    readLifetime($),
    read($, todos),
    read($, checkpoints),
  ])
  const { done, total } = todoCounts(list)
  return [
    'Savvy Progress — stats',
    `This session: ${sum.turns} turns · ${sum.tools} tool calls · ${sum.failures} failed · ${sum.checkpoints} checkpoints`,
    `Tasks now: ${total === 0 ? 'none tracked' : `${done}/${total} done`}`,
    `Lifetime: ${life.sessions} sessions · ${life.turns} turns · ${life.tools} tool calls · ${life.todosCompleted} tasks completed`,
    ...(marks.length > 0 ? ['Checkpoints:', ...marks.map(mark => `  ◆ ${mark.label}`)] : []),
  ].join('\n')
}

export const register: Register = on => {
  let stopTicking: (() => void) | undefined
  let root = ''

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'savvy-flow',
      description: 'Savvy Progress: open the live flow pane, toggle the band, or show stats and GSD progress',
      argumentHint: '[open|close|band|reset|stats|gsd|help]',
    })
    await $.tool.register({
      name: 'checkpoint',
      description:
        'Savvy Progress: record a milestone in the user\'s flow tracker (shown in their Savvy Flow pane and band). ' +
        'Call it when you finish a meaningful step of a multi-step task, with a short label such as "tests passing".',
      inputSchema: {
        type: 'object',
        properties: { label: { type: 'string', description: 'A short milestone label, under 80 characters' } },
        required: ['label'],
      },
    })
    root = e.cwd
    await bumpLifetime($, { sessions: 1 })
    await refreshGsd($, root)
    await refreshStatus($)

    return next(e)
  })

  on('command.run', { command: 'savvy-flow' }, async ($, e) => {
    const verb = e.args.trim().toLowerCase() || 'open'

    if (verb === 'open') {
      const opened = await $.ui.open({ id: PANE, title: TITLE })
      return { text: opened.isPlaced ? 'Savvy Flow pane opened.' : 'Savvy Flow pane is queued: widen the window to see it.' }
    }
    if (verb === 'close') {
      await $.ui.close({ id: PANE })
      return { text: 'Savvy Flow pane closed.' }
    }
    if (verb === 'band') {
      const hidden = await update($, isBandHidden, value => !value)
      return { text: hidden ? 'Savvy band hidden.' : 'Savvy band shown.' }
    }
    if (verb === 'reset') {
      await update($, totals, () => ZERO_TOTALS)
      await update($, checkpoints, () => [])
      await update($, last, () => null)
      await refreshStatus($)
      return { text: 'Savvy Progress counters reset for this session.' }
    }
    if (verb === 'stats') {
      return { text: await statsText($) }
    }
    if (verb === 'gsd') {
      const progress = await refreshGsd($, root)
      await refreshStatus($)
      return { text: gsdText(progress) }
    }

    return { text: HELP }
  })

  on('turn.start', async ($, e, next) => {
    const startedAt = await $.clock.now()
    const live: LiveTurn = { prompt: e.text, startedAt, calls: [] }
    await update($, turn, () => live)
    await update($, now, () => startedAt)
    stopTicking?.()
    const timer = $.clock.every(1000, () => {
      void $.clock.now().then(ms => update($, now, () => ms))
    })
    stopTicking = () => timer.cancel()
    await refreshStatus($)

    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    if (e.agentId !== undefined) return next(e)

    const input = e as unknown as Record<string, unknown>
    const call: Call = { id: e.tool_use_id, tool: String(e.tool), label: labelFor(input), state: 'running' }
    await update($, turn, live =>
      live === null ? live : { ...live, calls: [...live.calls, call].slice(-MAX_CALLS) },
    )
    await refreshStatus($)

    const ran = await next(e)
    const state: CallState = ran.deny !== undefined || ran.isError === true ? 'failed' : 'done'
    await update($, turn, live =>
      live === null
        ? live
        : { ...live, calls: live.calls.map(one => (one.id === call.id ? { ...one, state } : one)) },
    )
    await update($, totals, sum => ({
      ...sum,
      tools: sum.tools + 1,
      failures: sum.failures + (state === 'failed' ? 1 : 0),
    }))
    if (state === 'done' && touchesPlanning(call.tool, input)) await refreshGsd($, root)
    await refreshStatus($)

    return ran
  })

  on('tool.call', { tool: 'TodoWrite' }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny !== undefined || ran.isError === true) return ran

    const list: Todo[] = e.todos.map(one => ({ content: one.activeForm && one.status === 'in_progress' ? one.activeForm : one.content, status: one.status }))
    const before = todoCounts(await read($, todos))
    await update($, todos, () => list)
    const after = todoCounts(list)
    const newlyDone = Math.max(0, after.done - before.done)
    if (newlyDone > 0) await bumpLifetime($, { todosCompleted: newlyDone })
    if (after.total > 0 && after.done === after.total && before.done < after.total) {
      $.ui.toast(`🎉 Savvy: all ${after.total} tasks done`)
    }
    await refreshStatus($)

    return ran
  })

  on('tool.call', { tool: CHECKPOINT_TOOL }, async ($, e) => {
    const raw = (e as unknown as { label?: unknown }).label
    const label = clip(typeof raw === 'string' && raw.length > 0 ? raw : 'checkpoint', 80)
    const mark: Checkpoint = { label, at: await $.clock.now() }
    await update($, checkpoints, list => [...list, mark].slice(-MAX_CHECKPOINTS))
    await update($, totals, sum => ({ ...sum, checkpoints: sum.checkpoints + 1 }))
    $.ui.toast(`◆ ${label}`)

    return { result: `Checkpoint recorded: ${label}` }
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId !== undefined) return next(e)

    stopTicking?.()
    stopTicking = undefined
    const live = await read($, turn)
    const seconds = Math.round(e.durationMs / 1000)
    const tools = live?.calls.length ?? 0
    const failures = live?.calls.filter(call => call.state === 'failed').length ?? 0
    const summary: TurnSummary = { seconds, tools, failures, reason: e.reason }
    await update($, last, () => summary)
    await update($, turn, () => null)
    await update($, totals, sum => ({ ...sum, turns: sum.turns + 1 }))
    await bumpLifetime($, { turns: 1, tools })
    await refreshGsd($, root)
    if (seconds > LONG_TURN_SECONDS && !e.isAborted) {
      $.ui.toast(`Savvy: that flow ran ${duration(seconds)} with ${tools} tool calls`)
    }
    await refreshStatus($)

    return next(e)
  })

  on('session.end', async ($, e, next) => {
    stopTicking?.()
    stopTicking = undefined
    $.ui.status(undefined)

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || (await read($, isBandHidden))) return next(e)

    const [live, list, prev, tick, plan] = await Promise.all([
      read($, turn),
      read($, todos),
      read($, last),
      read($, now),
      read($, gsd),
    ])
    const { done, total, active } = todoCounts(list)
    if (live === null && total === 0 && prev === null && plan === null) return next(e)

    const { Box, Button, Text } = $.ui.resolve(e)
    const columns = e.props.bodyColumns ?? 80
    const width = Math.max(6, Math.min(20, Math.floor(columns / 6)))

    return (
      <Box flexDirection="row">
        <Text color="claude" bold>◆ Savvy </Text>
        {plan !== null && plan.phase !== undefined && (
          <Text>
            <Text color="suggestion">GSD P{plan.phase}{plan.totalPhases !== undefined ? `/${plan.totalPhases}` : ''}</Text>
            {plan.percent !== undefined ? ` ${plan.percent}%` : ''}{' '}
          </Text>
        )}
        {total > 0 && (
          <Text>
            <Text color={done === total ? 'success' : 'claude'}>{bar(done, total, width)}</Text> {done}/{total}{' '}
          </Text>
        )}
        {active !== undefined && <Text dimColor>▶ {clip(active.content, Math.max(12, columns - width - 48))} </Text>}
        {live !== null ? (
          <Text dimColor>
            · {live.calls.length} tools · {duration(Math.max(0, Math.round((tick - live.startedAt) / 1000)))}{' '}
          </Text>
        ) : (
          prev !== null && (
            <Text dimColor>
              · last {duration(prev.seconds)}, {prev.tools} tools{prev.failures > 0 ? `, ${prev.failures} failed` : ''}{' '}
            </Text>
          )
        )}
        <Button key="savvy-open" label="Flow" onPress={() => $.ui.open({ id: PANE, title: TITLE })} />
        <Button key="savvy-hide" label="Hide" onPress={() => update($, isBandHidden, () => true)} />
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const [live, list, prev, sum, marks, tick, hidden, plan] = await Promise.all([
      read($, turn),
      read($, todos),
      read($, last),
      read($, totals),
      read($, checkpoints),
      read($, now),
      read($, isBandHidden),
      read($, gsd),
    ])
    const columns = e.props.bodyColumns ?? 60
    const rows = e.viewport?.rows ?? 30
    const { done, total } = todoCounts(list)
    const calls = live?.calls ?? []
    const callRoom = Math.max(3, Math.floor(rows / 3))
    const icon = (state: Call['state']) => (state === 'done' ? '✔' : state === 'failed' ? '✖' : '…')
    const color = (state: Call['state']) => (state === 'done' ? 'success' : state === 'failed' ? 'error' : 'warning')

    return (
      <Box flexDirection="column">
        <Text>
          <Text color="claude" bold>◆ Savvy Flow</Text>
          <Text dimColor> · by Johnny Viz</Text>
        </Text>
        <Text> </Text>

        {live !== null ? (
          <Text>
            <Text bold>Now </Text>
            <Text>{clip(live.prompt || '(continuation)', Math.max(10, columns - 16))} </Text>
            <Text dimColor>⏱ {duration(Math.max(0, Math.round((tick - live.startedAt) / 1000)))}</Text>
          </Text>
        ) : (
          <Text dimColor>
            {prev === null
              ? 'Idle — send a prompt to start a flow.'
              : `Idle — last flow ${duration(prev.seconds)}, ${prev.tools} tools${prev.failures > 0 ? `, ${prev.failures} failed` : ''}${prev.reason !== 'answer' ? ` (${prev.reason})` : ''}.`}
          </Text>
        )}
        <Text> </Text>

        {plan !== null && (
          <Box flexDirection="column">
            <Text bold>
              GSD{' '}
              <Text dimColor>{[plan.milestone, plan.milestoneName].filter(Boolean).join(' ')}</Text>
            </Text>
            {plan.phase !== undefined && (
              <Text wrap="truncate-end">
                Phase {plan.phase}
                {plan.totalPhases !== undefined ? ` of ${plan.totalPhases}` : ''}
                {plan.phaseName ? `: ${plan.phaseName}` : ''}
                {plan.plan !== undefined ? ` · plan ${plan.plan}${plan.plansInPhase !== undefined ? ` of ${plan.plansInPhase}` : ''}` : ''}
                {plan.status ? <Text dimColor> · {plan.status}</Text> : ''}
              </Text>
            )}
            {plan.percent !== undefined && (
              <Text>
                <Text color={plan.percent === 100 ? 'success' : 'suggestion'}>
                  {bar(plan.percent, 100, Math.max(10, Math.min(40, columns - 8)))}
                </Text>{' '}
                {plan.percent}%
              </Text>
            )}
            {plan.phases.slice(0, 8).map(phase => (
              <Text
                color={phase.number === plan.phase && !phase.isDone ? 'suggestion' : undefined}
                dimColor={phase.isDone}
                wrap="truncate-end"
              >
                {phase.isDone ? '✔' : phase.number === plan.phase ? '▶' : '○'} Phase {phase.number}: {phase.name}
              </Text>
            ))}
            {plan.phases.length > 8 && <Text dimColor>… {plan.phases.length - 8} more phases</Text>}
            <Text> </Text>
          </Box>
        )}

        <Text bold>Tasks {total > 0 && <Text dimColor>{done}/{total}</Text>}</Text>
        {total === 0 ? (
          <Text dimColor>No task list yet.</Text>
        ) : (
          <Box flexDirection="column">
            <Text color={done === total ? 'success' : 'claude'}>{bar(done, total, Math.max(10, Math.min(40, columns - 4)))}</Text>
            {list.map(todo => (
              <Text
                color={todo.status === 'in_progress' ? 'claude' : undefined}
                dimColor={todo.status === 'completed'}
                strikethrough={todo.status === 'completed'}
                wrap="truncate-end"
              >
                {todo.status === 'completed' ? '✔' : todo.status === 'in_progress' ? '▶' : '○'} {todo.content}
              </Text>
            ))}
          </Box>
        )}
        <Text> </Text>

        <Text bold>
          Tools {calls.length > 0 && <Text dimColor>{calls.length} this turn</Text>}
        </Text>
        {calls.length === 0 ? (
          <Text dimColor>No tool calls this turn.</Text>
        ) : (
          <Box flexDirection="column">
            {calls.length > callRoom && <Text dimColor>… {calls.length - callRoom} earlier</Text>}
            {calls.slice(-callRoom).map(call => (
              <Text wrap="truncate-end">
                <Text color={color(call.state)}>{icon(call.state)}</Text> <Text bold>{call.tool}</Text>{' '}
                <Text dimColor>{clip(call.label, Math.max(8, columns - call.tool.length - 6))}</Text>
              </Text>
            ))}
          </Box>
        )}

        {marks.length > 0 && (
          <Box flexDirection="column">
            <Text> </Text>
            <Text bold>Checkpoints</Text>
            {marks.slice(-5).map(mark => (
              <Text wrap="truncate-end">
                <Text color="claude">◆</Text> {mark.label}
              </Text>
            ))}
          </Box>
        )}
        <Text> </Text>

        <Text dimColor>
          Session: {sum.turns} turns · {sum.tools} tools · {sum.failures} failed · {sum.checkpoints} checkpoints
        </Text>
        <Box flexDirection="row">
          <Button
            key="savvy-band"
            label={hidden ? 'Show band' : 'Hide band'}
            onPress={() => update($, isBandHidden, value => !value)}
          />
          <Text> </Text>
          <Button
            key="savvy-reset"
            label="Reset"
            onPress={async () => {
              await update($, totals, () => ZERO_TOTALS)
              await update($, checkpoints, () => [])
              await update($, last, () => null)
              await refreshStatus($)
            }}
          />
          <Text> </Text>
          <Button key="savvy-close" role="dismiss" label="Close" onPress={() => $.ui.close({ id: PANE })} />
        </Box>
      </Box>
    )
  })
}

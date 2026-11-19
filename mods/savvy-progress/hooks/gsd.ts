// Reads GSD (get-shit-done) planning state: .planning/STATE.md, whose YAML
// frontmatter gsd-tools keeps in sync (with the body's "Phase: X of Y" lines
// as the fallback), and the phase checklist in .planning/ROADMAP.md.
import type { GsdPhase, GsdProgress } from '../types'

type Fields = Record<string, string>

function unquote(value: string): string {
  const trimmed = value.trim()
  return /^(['"]).*\1$/.test(trimmed) ? trimmed.slice(1, -1) : trimmed
}

function toNumber(value: string | undefined): number | undefined {
  if (value === undefined || value === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

export function parseFrontmatter(text: string): Fields {
  const match = /^\s*---\r?\n([\s\S]*?)\r?\n---/.exec(text)
  const fields: Fields = {}
  if (match === null) return fields

  let parent = ''
  for (const line of (match[1] ?? '').split(/\r?\n/)) {
    const nested = /^\s+([\w-]+):\s*(.*)$/.exec(line)
    const top = /^([\w-]+):\s*(.*)$/.exec(line)
    if (top !== null) {
      parent = top[2] === '' ? (top[1] ?? '') : ''
      if (top[2] !== '') fields[top[1] ?? ''] = unquote(top[2] ?? '')
    } else if (nested !== null && parent !== '') {
      fields[`${parent}.${nested[1]}`] = unquote(nested[2] ?? '')
    }
  }
  return fields
}

export function parseRoadmap(text: string): GsdPhase[] {
  const phases: GsdPhase[] = []
  let depth = 0
  for (const line of text.split(/\r?\n/)) {
    if (/<details\b/i.test(line)) depth += 1
    if (depth === 0) {
      const match = /^\s*[-*]\s*\[([ xX])\]\s*\*\*Phase\s+([\d.]+):\s*(.+?)\*\*/.exec(line)
      if (match !== null) {
        phases.push({ number: match[2] ?? '', name: (match[3] ?? '').trim(), isDone: match[1] !== ' ' })
      }
    }
    if (/<\/details>/i.test(line)) depth = Math.max(0, depth - 1)
  }
  return phases
}

export function parseGsd(state: string | undefined, roadmap: string | undefined): GsdProgress | null {
  if (state === undefined && roadmap === undefined) return null

  const fm = parseFrontmatter(state ?? '')
  const body = state ?? ''
  const phaseLine = /^Phase:\s*([\d.]+)\s+of\s+(\d+)(?:\s*\(([^)]*)\))?/m.exec(body)
  const planLine = /^Plan:\s*(\d+)\s+of\s+(\d+)/m.exec(body)
  const statusLine = /^Status:\s*(.+)$/m.exec(body)
  const progressLine = /^Progress:.*?(\d+)%/m.exec(body)
  const activityLine = /^Last activity:\s*(.+)$/m.exec(body)
  const phases = parseRoadmap(roadmap ?? '')
  const doneFromRoadmap = phases.filter(phase => phase.isDone).length

  const totalPhases = toNumber(fm['progress.total_phases']) ?? toNumber(phaseLine?.[2]) ?? (phases.length || undefined)
  const completedPhases =
    toNumber(fm['progress.completed_phases']) ?? (phases.length > 0 ? doneFromRoadmap : undefined)
  const percent =
    toNumber(fm['progress.percent']) ??
    toNumber(progressLine?.[1]) ??
    (totalPhases !== undefined && totalPhases > 0 && completedPhases !== undefined
      ? Math.round((completedPhases / totalPhases) * 100)
      : undefined)
  const phase = fm.current_phase ?? phaseLine?.[1]
  const phaseName =
    fm.current_phase_name ?? phaseLine?.[3]?.trim() ?? phases.find(one => one.number === phase)?.name

  return {
    milestone: fm.milestone,
    milestoneName: fm.milestone_name,
    phase,
    phaseName,
    totalPhases,
    completedPhases,
    plan: fm.current_plan ?? planLine?.[1],
    plansInPhase: toNumber(planLine?.[2]),
    totalPlans: toNumber(fm['progress.total_plans']),
    completedPlans: toNumber(fm['progress.completed_plans']),
    status: fm.status ?? statusLine?.[1]?.trim(),
    percent: percent === undefined ? undefined : Math.max(0, Math.min(100, percent)),
    lastActivity: fm.last_activity ?? activityLine?.[1]?.trim(),
    phases,
  }
}

export function gsdHeadline(gsd: GsdProgress): string {
  const parts: string[] = []
  const milestone = [gsd.milestone, gsd.milestoneName].filter(Boolean).join(' ')
  if (milestone) parts.push(milestone)
  if (gsd.phase !== undefined) {
    parts.push(
      `Phase ${gsd.phase}${gsd.totalPhases !== undefined ? ` of ${gsd.totalPhases}` : ''}${gsd.phaseName ? `: ${gsd.phaseName}` : ''}`,
    )
  }
  if (gsd.plan !== undefined) {
    parts.push(`plan ${gsd.plan}${gsd.plansInPhase !== undefined ? ` of ${gsd.plansInPhase}` : ''}`)
  }
  if (gsd.status) parts.push(gsd.status)
  return parts.join(' · ')
}

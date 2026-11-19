# Savvy Progress

*by Johnny Viz*

Live flow tracking for Claude Code. Savvy Progress follows each turn as it runs (the prompt, every tool call, the task list, milestones) and shows it in Claude Code's own UI. In a [GSD (Get Shit Done)](https://github.com/gsd-build/get-shit-done) project it also shows the current milestone, phase and plan.

## Install

At the prompt of a terminal Claude Code session (2.1.275 or later):

```
/plugin install savvy-progress --marketplace tavor29/smart-surveillance
```

Answer `y` to add the marketplace, then press Enter to pick the user scope. The mod starts working in that session right away, with no reload.

To run it from a checkout while developing:

```bash
claude --plugin-dir ./mods/savvy-progress
```

## What it adds

| Where | What you get |
| --- | --- |
| **`/savvy-flow`** | A slash command: `open` (the default), `close`, `band`, `reset`, `stats`, `gsd`, `help` |
| **Savvy Flow pane** | The current prompt and how long it has been running, a task progress bar with each todo, the turn's tool calls marked running / done / failed, recent checkpoints, session totals, and Hide band / Reset / Close buttons |
| **Progress band** | A one-line strip above the prompt: `◆ Savvy ████░░ 3/5 ▶ active task · 7 tools · 42s [Flow] [Hide]` |
| **Status line** | `◆ savvy · 3/5 tasks · ▶ 7 tools (1 running) · 4 turns` |
| **Toasts** | One when every task is done, one when a turn runs longer than 2 minutes, and one for each checkpoint |
| **Checkpoint tool** | `mcp__savvy-progress__checkpoint` lets Claude record a milestone (for example "tests passing") in your flow |
| **GSD progress** | Reads `.planning/STATE.md` and `.planning/ROADMAP.md` and shows the milestone, phase X of Y, plan, status and a percent bar in the pane, band (`GSD P2/4 33%`) and status line. It re-reads them when a turn ends and when a tool edits `.planning/` or runs `gsd-tools`, and raises a toast when a phase or the milestone completes |
| **Lifetime stats** | Sessions, turns, tool calls and completed tasks, kept across sessions in the plugin store (`/savvy-flow stats`) |

It works on every surface Claude Code draws on: terminal, desktop, VS Code and mobile.

## Commands

```
/savvy-flow          open the Savvy Flow pane
/savvy-flow close    close it
/savvy-flow band     show or hide the progress band
/savvy-flow reset    clear this session's counters and checkpoints
/savvy-flow stats    print session and lifetime stats
/savvy-flow gsd      re-read .planning/ and print GSD milestone and phase progress
/savvy-flow help     list the commands
```

## With GSD

Savvy Progress only reads GSD's files and needs nothing else from it. To add the GSD skills to a project, run this from the project's root:

```bash
npx get-shit-done-cc@latest --claude --local --profile=standard
```

Then start a project with `/gsd-new-project`. As you plan and execute phases, `/savvy-flow` tracks them. When `STATE.md` has no frontmatter, Savvy reads its `Phase:`, `Plan:`, `Status:` and `Progress:` lines instead. With only a `ROADMAP.md`, it works out progress from the phase checkboxes. Milestones collapsed in `<details>` blocks are skipped.

## Layout

```
.claude-plugin/plugin.json   manifest
hooks/hooks.json             names the hooks module
hooks/register.tsx           the mod: command, pane, band, status, toasts, tool
hooks/gsd.ts                 the GSD .planning/ reader
types/index.d.ts             the $.state contract
tests/savvy.test.tsx         flow tests on all four surfaces
tests/gsd.test.tsx           GSD parser and end-to-end tests
```

## Develop

```bash
claude plugin validate mods/savvy-progress
claude plugin test mods/savvy-progress
```

## Privacy

Everything stays local. The mod reads tool calls, todo lists and `.planning/` files to draw its views, and it stores only the lifetime counters, in Claude Code's plugin store. It sends nothing over the network.

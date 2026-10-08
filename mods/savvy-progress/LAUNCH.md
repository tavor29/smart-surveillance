# Savvy Progress launch kit

Ready-to-use copy for announcing Savvy Progress v0.1.0.

## One-liner

> **Savvy Progress** by Johnny Viz: see your Claude Code flow live, with tasks, tool calls, milestones and time, all from `/savvy-flow`.

## Short post (Slack / X / LinkedIn)

> 🚀 Just shipped **Savvy Progress**, a Claude Code mod by Johnny Viz.
>
> Type `/savvy-flow` and you get a live pane with your task progress bar, every tool call as it runs, milestones Claude marks along the way, and session stats. There's also a progress band above the prompt, a status line, and a toast when every task is done.
>
> Install in one line:
> `/plugin install savvy-progress --marketplace tavor29/smart-surveillance`

## Feature bullets

- **/savvy-flow**: one command to open the pane, toggle the band, reset, or print stats
- **Live pane**: prompt and timer, task bar, tool calls marked ✔ / ✖ / …, and checkpoints
- **Progress band and status line**: progress you can see without opening anything
- **Milestone toasts**: one when all tasks are done, one for a long turn, one per checkpoint
- **Checkpoint tool**: Claude can mark its own milestones in your flow
- **Lifetime stats**: sessions, turns, tool calls and tasks completed
- **Runs everywhere**: terminal, desktop, VS Code and mobile

## Demo script (60 seconds)

1. Install it with the line above.
2. Run `/savvy-flow` to open the pane.
3. Ask Claude for a multi-step job: *"Plan and add input validation to the API, with a todo list."*
4. While it works, the task bar fills, tool calls tick to ✔, and the band shows the active task.
5. When the last task completes, the 🎉 toast appears.
6. Finish with `/savvy-flow stats`.

## Release checklist

- [x] `claude plugin validate mods/savvy-progress` passes
- [x] `claude plugin test mods/savvy-progress` passes on terminal, desktop, VS Code and mobile
- [x] Marketplace entry in `.claude-plugin/marketplace.json`
- [x] README with the install line
- [ ] Merge to the default branch so the install line resolves
- [ ] Post the announcement

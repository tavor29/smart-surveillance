export type CallState = 'running' | 'done' | 'failed'

export type Call = { id: string; tool: string; label: string; state: CallState }

export type Todo = { content: string; status: 'pending' | 'in_progress' | 'completed' }

export type LiveTurn = { prompt: string; startedAt: number; calls: Call[] }

export type TurnSummary = { seconds: number; tools: number; failures: number; reason: string }

export type Totals = { turns: number; tools: number; failures: number; checkpoints: number }

export type Checkpoint = { label: string; at: number }

export type GsdPhase = { number: string; name: string; isDone: boolean }

export type GsdProgress = {
  milestone?: string
  milestoneName?: string
  phase?: string
  phaseName?: string
  totalPhases?: number
  completedPhases?: number
  plan?: string
  plansInPhase?: number
  totalPlans?: number
  completedPlans?: number
  status?: string
  percent?: number
  lastActivity?: string
  phases: GsdPhase[]
}

export type Lifetime = { sessions: number; turns: number; tools: number; todosCompleted: number }

declare module 'claude-code' {
  interface PluginState {
    'savvy-progress': {
      turn: LiveTurn | null
      todos: Todo[]
      last: TurnSummary | null
      totals: Totals
      checkpoints: Checkpoint[]
      now: number
      isBandHidden: boolean
      gsd: GsdProgress | null
    }
  }
}

import { Result, ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import {
  RunInference,
  RunInferenceCommand,
  RunInferenceResult,
} from '@/contexts/assistant/application/ports/in/RunInference'
import { AgentRuntime } from '@/contexts/assistant/application/ports/out/AgentRuntime'
import { ToolBox } from '@/contexts/assistant/application/ports/out/ToolBox'
import { SpendStore } from '@/contexts/assistant/application/ports/out/SpendStore'
import { Budget } from '@/contexts/assistant/domain/Budget'
import { MutationBudget, DEFAULT_BACKGROUND_LIMITS } from '@/contexts/assistant/domain/ConfirmationPolicy'
import { classifyTool, normalizeToolName } from '@/contexts/assistant/domain/ToolClass'

export interface RunInferenceOptions {
  // Daily per-key spend cap, enforced when a SpendStore + budgetKey are present.
  dailyBudgetUsd?: number
  // Tool-loop guard: max decide -> execute -> feed-back iterations.
  maxTurns?: number
  // Wall-clock guard for the whole run (unattended, so it must not hang).
  maxDurationMs?: number
}

const DEFAULT_MAX_TURNS = 12
const DEFAULT_MAX_DURATION_MS = 120_000

// The NON-STREAMING twin of ChatHandlerService. Same decide -> execute tool ->
// feed-back shape as SendMessageService, but it adds the cross-cutting concerns a
// human-less run needs: a daily spend pre-check (pure Budget VO) and, since there
// is no human to confirm a mutating tool, a hard per-run MutationBudget that the
// `background` ConfirmationPolicy already encodes — read-only auto-runs, mutating
// is charged and denied once maxMutations is spent. Every decision is pure; all IO
// (the LLM, the tools, the spend counter, the clock) sits behind an injected port.
export class RunInferenceService implements RunInference {
  private readonly budget: Budget
  private readonly maxTurns: number
  private readonly maxDurationMs: number

  constructor(
    private readonly agent: AgentRuntime,
    private readonly tools: ToolBox,
    private readonly clock: Clock,
    private readonly spend?: SpendStore,
    opts: RunInferenceOptions = {},
  ) {
    this.budget = Budget.daily(opts.dailyBudgetUsd ?? 5)
    this.maxTurns = opts.maxTurns ?? DEFAULT_MAX_TURNS
    this.maxDurationMs = opts.maxDurationMs ?? DEFAULT_MAX_DURATION_MS
  }

  async execute(cmd: RunInferenceCommand): Promise<Result<RunInferenceResult>> {
    // 1. Daily per-key spend cap. Pure Budget VO decides; the store only reads.
    if (this.spend && cmd.budgetKey) {
      const spent = await this.spend.getTodaySpendUsd(cmd.budgetKey)
      if (this.budget.isExceeded(spent)) return fail(this.budget.exceededMessage(spent))
    }

    // 2. Seed the conversation. systemPrompt rides in as a leading system turn so
    //    the AgentRuntime port stays unchanged (it carries no separate field).
    const messages: { role: string; content: string }[] = []
    if (cmd.systemPrompt) messages.push({ role: 'system', content: cmd.systemPrompt })
    messages.push({ role: 'user', content: cmd.prompt })

    const allowedTools = cmd.allowedTools ?? this.tools.names()
    const readOnlyHints = this.readOnlyHints()

    // 3. Unattended gate: read-only is free, mutating is charged against a hard cap.
    let mutations = MutationBudget.start({
      mutations: cmd.maxMutations ?? DEFAULT_BACKGROUND_LIMITS.mutations,
      deletes: DEFAULT_BACKGROUND_LIMITS.deletes,
      emails: DEFAULT_BACKGROUND_LIMITS.emails,
    })

    const toolCalls: { name: string; input: unknown }[] = []
    const deadline = this.clock.now().getTime() + this.maxDurationMs

    // 4. The tool loop: the model proposes, we gate + execute via the ToolBox ACL,
    //    feed the result back, and repeat until it answers in plain text.
    for (let turn = 0; turn < this.maxTurns; turn++) {
      if (this.clock.now().getTime() > deadline) {
        return fail('RunInference: wall-clock budget exceeded before the model converged')
      }

      const turnResult = await this.agent.run({ messages, tools: allowedTools })

      if (turnResult.toolCalls.length === 0) {
        return ok({ text: turnResult.text ?? '', toolCalls })
      }

      for (const call of turnResult.toolCalls) {
        const bare = normalizeToolName(call.name)
        const cls = classifyTool(call.name, { readOnlyHint: readOnlyHints.get(bare) })

        const verdict = mutations.decide(bare, cls)
        mutations = verdict.next
        if (!verdict.decision.allow) {
          // No human to confirm: feed the denial back so the model can adapt or
          // wrap up, but never execute the mutating tool.
          messages.push({ role: 'tool', content: `${bare} DENIED: ${verdict.decision.message}` })
          continue
        }

        const out = await this.tools.execute(call.name, call.input)
        toolCalls.push({ name: bare, input: call.input })
        messages.push({
          role: 'tool',
          content: out.ok ? `${bare} -> ${JSON.stringify(out.value)}` : `${bare} ERROR: ${out.error}`,
        })
      }
    }

    return fail('RunInference: tool loop did not converge')
  }

  // Per-tool read-only flags from the optional richer ToolBox view, so dynamic
  // piece tools (absent from the static lists) classify correctly.
  private readOnlyHints(): Map<string, boolean> {
    const hints = new Map<string, boolean>()
    for (const d of this.tools.descriptors?.() ?? []) {
      if (typeof d.readOnly === 'boolean') hints.set(normalizeToolName(d.name), d.readOnly)
    }
    return hints
  }
}

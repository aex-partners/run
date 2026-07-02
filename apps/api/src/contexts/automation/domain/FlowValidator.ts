import { Json } from '@/shared/domain/Json'
import {
  ActionType,
  TriggerType,
  FlowTrigger,
  FlowAction,
  LoopAction,
  RouterAction,
} from '@/contexts/automation/domain/FlowDsl'

// Pure semantic validator for a FlowVersion, ported from `flow-engine/flow-validator.ts`.
// Walks the trigger and its `nextAction` chain (recursing into LOOP bodies and
// ROUTER branches) and reports structured errors/warnings in two modes:
//   - save mode: an empty trigger is only a warning (drafts may be incomplete)
//   - publish mode: publish-only issues (empty trigger) are promoted to errors
//
// Deviation from the source: the best-effort "piece required-input" check loads a
// piece (IO, cross-context) and so cannot live in the pure domain; it is omitted
// here and belongs in an ACL extension. Cron validity uses a structural check
// only (the source's cron-parser fallback) to stay free of npm dependencies.

export const ValidationCode = {
  EMPTY_TRIGGER: 'EMPTY_TRIGGER',
  INVALID_CRON: 'INVALID_CRON',
  MISSING_CRON: 'MISSING_CRON',
  MISSING_PIECE_NAME: 'MISSING_PIECE_NAME',
  MISSING_TRIGGER_NAME: 'MISSING_TRIGGER_NAME',
  MISSING_ACTION_NAME: 'MISSING_ACTION_NAME',
  MISSING_SOURCE_CODE: 'MISSING_SOURCE_CODE',
  UNKNOWN_STEP_REF: 'UNKNOWN_STEP_REF',
  INVALID_JSON: 'INVALID_JSON',
} as const

export type ValidationCodeValue = (typeof ValidationCode)[keyof typeof ValidationCode]

export interface ValidationIssue {
  code: ValidationCodeValue
  path: string
  message: string
}

export interface FlowValidationResult {
  valid: boolean
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
}

export interface ValidateOptions {
  publish?: boolean
}

const VARIABLE_PATTERN = /\{\{(.+?)\}\}/g
const BUILTIN_REFS = new Set(['trigger'])

export function validateFlowVersion(trigger: FlowTrigger, opts: ValidateOptions = {}): FlowValidationResult {
  const publish = opts.publish === true
  const errors: ValidationIssue[] = []
  const warnings: ValidationIssue[] = []

  validateTrigger(trigger, publish, errors, warnings)

  const seen = new Set<string>()
  if (trigger.name) seen.add(trigger.name)
  const loopVars = new Set<string>()

  walkAction(trigger.nextAction, { seen, loopVars, errors, warnings })

  return { valid: errors.length === 0, errors, warnings }
}

function validateTrigger(
  trigger: FlowTrigger,
  publish: boolean,
  errors: ValidationIssue[],
  warnings: ValidationIssue[],
): void {
  switch (trigger.type) {
    case TriggerType.EMPTY: {
      const issue: ValidationIssue = {
        code: ValidationCode.EMPTY_TRIGGER,
        path: 'trigger',
        message: 'Flow has no trigger configured. Configure a trigger before publishing.',
      }
      ;(publish ? errors : warnings).push(issue)
      break
    }
    case TriggerType.SCHEDULE: {
      const cron = trigger.settings.input?.['cronExpression']
      if (typeof cron !== 'string' || cron.trim() === '') {
        errors.push({
          code: ValidationCode.MISSING_CRON,
          path: 'trigger.settings.input.cronExpression',
          message: 'Schedule trigger requires a cron expression.',
        })
      } else if (!isValidCron(cron)) {
        errors.push({
          code: ValidationCode.INVALID_CRON,
          path: 'trigger.settings.input.cronExpression',
          message: `Invalid cron expression: "${cron}".`,
        })
      }
      break
    }
    case TriggerType.PIECE: {
      if (!nonEmpty(trigger.settings.pieceName)) {
        errors.push({
          code: ValidationCode.MISSING_PIECE_NAME,
          path: 'trigger.settings.pieceName',
          message: 'Piece trigger requires a pieceName.',
        })
      }
      if (!nonEmpty(trigger.settings.triggerName)) {
        errors.push({
          code: ValidationCode.MISSING_TRIGGER_NAME,
          path: 'trigger.settings.triggerName',
          message: 'Piece trigger requires a triggerName.',
        })
      }
      break
    }
    case TriggerType.WEBHOOK:
    default:
      break
  }
}

interface WalkCtx {
  seen: Set<string>
  loopVars: Set<string>
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
}

function walkAction(action: FlowAction | undefined, ctx: WalkCtx): void {
  let current: FlowAction | undefined = action

  while (current) {
    validateAction(current, ctx)
    if (current.name) ctx.seen.add(current.name)

    switch (current.type) {
      case ActionType.LOOP_ON_ITEMS: {
        const loop = current as LoopAction
        const addedVar = !!loop.name && !ctx.loopVars.has(loop.name)
        if (addedVar) ctx.loopVars.add(loop.name)
        walkAction(loop.firstLoopAction, ctx)
        if (addedVar) ctx.loopVars.delete(loop.name)
        break
      }
      case ActionType.ROUTER: {
        const router = current as RouterAction
        for (const child of router.children ?? []) {
          walkAction(child ?? undefined, ctx)
        }
        break
      }
      default:
        break
    }

    current = current.nextAction
  }
}

function validateAction(action: FlowAction, ctx: WalkCtx): void {
  switch (action.type) {
    case ActionType.PIECE: {
      const s = action.settings
      if (!nonEmpty(s.pieceName)) {
        ctx.errors.push({
          code: ValidationCode.MISSING_PIECE_NAME,
          path: `${action.name}.settings.pieceName`,
          message: `Piece action "${action.name}" requires a pieceName.`,
        })
      }
      if (!nonEmpty(s.actionName)) {
        ctx.errors.push({
          code: ValidationCode.MISSING_ACTION_NAME,
          path: `${action.name}.settings.actionName`,
          message: `Piece action "${action.name}" requires an actionName.`,
        })
      }
      checkInputRefs(s.input, `${action.name}.settings.input`, ctx)
      break
    }
    case ActionType.CODE: {
      const s = action.settings
      if (!nonEmpty(s.sourceCode)) {
        ctx.errors.push({
          code: ValidationCode.MISSING_SOURCE_CODE,
          path: `${action.name}.settings.sourceCode`,
          message: `Code action "${action.name}" requires sourceCode.`,
        })
      }
      checkInputRefs(s.input, `${action.name}.settings.input`, ctx)
      break
    }
    case ActionType.LOOP_ON_ITEMS: {
      const s = (action as LoopAction).settings
      checkRefString(s.items, `${action.name}.settings.items`, ctx)
      break
    }
    case ActionType.ROUTER: {
      const s = (action as RouterAction).settings
      const branches = s.branches ?? []
      for (let i = 0; i < branches.length; i++) {
        for (const cond of branches[i]!.conditions ?? []) {
          checkRefString(cond.firstValue, `${action.name}.settings.branches[${i}].firstValue`, ctx)
          checkRefString(cond.secondValue, `${action.name}.settings.branches[${i}].secondValue`, ctx)
        }
      }
      break
    }
    default:
      break
  }
}

function checkInputRefs(input: Json | undefined, path: string, ctx: WalkCtx): void {
  if (input === null || input === undefined) return
  if (typeof input === 'string') {
    checkRefString(input, path, ctx)
    return
  }
  if (Array.isArray(input)) {
    input.forEach((item, i) => checkInputRefs(item, `${path}[${i}]`, ctx))
    return
  }
  if (typeof input === 'object') {
    for (const [key, value] of Object.entries(input)) {
      checkInputRefs(value, `${path}.${key}`, ctx)
    }
  }
}

function checkRefString(value: string | undefined, path: string, ctx: WalkCtx): void {
  if (typeof value !== 'string') return
  let match: RegExpExecArray | null
  VARIABLE_PATTERN.lastIndex = 0
  while ((match = VARIABLE_PATTERN.exec(value)) !== null) {
    const expr = match[1]!.trim()
    const root = rootSegment(expr)
    if (!root) continue
    if (BUILTIN_REFS.has(root)) continue
    if (ctx.loopVars.has(root)) continue
    if (ctx.seen.has(root)) continue
    ctx.warnings.push({
      code: ValidationCode.UNKNOWN_STEP_REF,
      path,
      message: `Reference "{{${expr}}}" points to unknown step "${root}".`,
    })
  }
}

function rootSegment(expr: string): string {
  const m = expr.match(/^[A-Za-z_$][\w$]*/)
  return m ? m[0] : ''
}

function nonEmpty(v: unknown): v is string {
  return typeof v === 'string' && v.trim() !== ''
}

// Structural cron check (the source's cron-parser fallback). 5 or 6 fields over
// the allowed charset. A stricter parse can be layered in an adapter.
function isValidCron(expr: string): boolean {
  const fields = expr.trim().split(/\s+/)
  if (fields.length < 5 || fields.length > 6) return false
  const FIELD = /^[\d*,\-/?LW#]+$/i
  return fields.every((f) => FIELD.test(f))
}

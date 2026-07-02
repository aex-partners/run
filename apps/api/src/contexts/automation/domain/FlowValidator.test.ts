import { describe, it, expect } from 'vitest'
import {
  validateFlowVersion,
  ValidationCode,
} from '@/contexts/automation/domain/FlowValidator'
import {
  ActionType,
  TriggerType,
  FlowTrigger,
  PieceAction,
  CodeAction,
} from '@/contexts/automation/domain/FlowDsl'

const webhookTrigger = (nextAction?: FlowTrigger['nextAction']): FlowTrigger => ({
  name: 'trigger',
  displayName: 'Webhook',
  type: TriggerType.WEBHOOK,
  valid: true,
  settings: {},
  nextAction,
})

const piece = (name: string, over: Partial<PieceAction['settings']> = {}, nextAction?: PieceAction['nextAction']): PieceAction => ({
  name,
  displayName: name,
  valid: true,
  type: ActionType.PIECE,
  settings: { pieceName: 'http', actionName: 'get', input: {}, ...over },
  nextAction,
})

const code = (name: string, over: Partial<CodeAction['settings']> = {}, nextAction?: CodeAction['nextAction']): CodeAction => ({
  name,
  displayName: name,
  valid: true,
  type: ActionType.CODE,
  settings: { sourceCode: 'return 1', input: {}, ...over },
  nextAction,
})

const codes = (r: { code: string }[]) => r.map((x) => x.code)

describe('validateFlowVersion - trigger', () => {
  it('empty trigger is a warning in save mode, valid stays true', () => {
    const r = validateFlowVersion({ ...webhookTrigger(), type: TriggerType.EMPTY }, { publish: false })
    expect(r.valid).toBe(true)
    expect(codes(r.warnings)).toContain(ValidationCode.EMPTY_TRIGGER)
    expect(r.errors).toHaveLength(0)
  })

  it('empty trigger is promoted to an error in publish mode', () => {
    const r = validateFlowVersion({ ...webhookTrigger(), type: TriggerType.EMPTY }, { publish: true })
    expect(r.valid).toBe(false)
    expect(codes(r.errors)).toContain(ValidationCode.EMPTY_TRIGGER)
  })

  it('schedule trigger requires a cron expression', () => {
    const r = validateFlowVersion({
      ...webhookTrigger(),
      type: TriggerType.SCHEDULE,
      settings: { input: {} },
    })
    expect(codes(r.errors)).toContain(ValidationCode.MISSING_CRON)
  })

  it('schedule trigger flags a malformed cron', () => {
    const r = validateFlowVersion({
      ...webhookTrigger(),
      type: TriggerType.SCHEDULE,
      settings: { input: { cronExpression: '* * *' } },
    })
    expect(codes(r.errors)).toContain(ValidationCode.INVALID_CRON)
  })

  it('schedule trigger accepts a structurally valid cron', () => {
    const r = validateFlowVersion({
      ...webhookTrigger(),
      type: TriggerType.SCHEDULE,
      settings: { input: { cronExpression: '0 0 * * *' } },
    })
    expect(r.errors).toHaveLength(0)
  })

  it('piece trigger requires pieceName and triggerName', () => {
    const r = validateFlowVersion({ ...webhookTrigger(), type: TriggerType.PIECE, settings: {} })
    expect(codes(r.errors)).toEqual(
      expect.arrayContaining([ValidationCode.MISSING_PIECE_NAME, ValidationCode.MISSING_TRIGGER_NAME]),
    )
  })
})

describe('validateFlowVersion - actions', () => {
  it('a complete linear flow is valid with no issues', () => {
    const trigger = webhookTrigger(piece('step_1', {}, code('step_2')))
    const r = validateFlowVersion(trigger)
    expect(r.valid).toBe(true)
    expect(r.errors).toHaveLength(0)
    expect(r.warnings).toHaveLength(0)
  })

  it('piece action missing pieceName/actionName -> errors', () => {
    const trigger = webhookTrigger(piece('step_1', { pieceName: '', actionName: '' }))
    const r = validateFlowVersion(trigger)
    expect(codes(r.errors)).toEqual(
      expect.arrayContaining([ValidationCode.MISSING_PIECE_NAME, ValidationCode.MISSING_ACTION_NAME]),
    )
  })

  it('code action missing sourceCode -> error', () => {
    const trigger = webhookTrigger(code('step_1', { sourceCode: '   ' }))
    const r = validateFlowVersion(trigger)
    expect(codes(r.errors)).toContain(ValidationCode.MISSING_SOURCE_CODE)
  })

  it('warns on a reference to an unknown step', () => {
    const trigger = webhookTrigger(code('step_1', { input: { v: '{{ghost.value}}' } }))
    const r = validateFlowVersion(trigger)
    expect(codes(r.warnings)).toContain(ValidationCode.UNKNOWN_STEP_REF)
    expect(r.warnings[0]!.message).toContain('ghost')
  })

  it('does not warn on builtin (trigger) or earlier-step references', () => {
    const second = code('step_2', { input: { a: '{{trigger.x}}', b: '{{step_1.output}}' } })
    const trigger = webhookTrigger(piece('step_1', {}, second))
    const r = validateFlowVersion(trigger)
    expect(r.warnings).toHaveLength(0)
  })
})

import { describe, it, expect } from 'vitest'
import {
  evaluateConditions,
  evaluateSingleCondition,
} from '@/contexts/automation/domain/RouterConditions'
import { RouterConditionGroup } from '@/contexts/automation/domain/FlowDsl'
import { JsonObject } from '@/shared/domain/Json'

const state: JsonObject = {
  trigger: { name: 'Hello World', count: 5, flag: true, tags: ['a', 'b'], empty: '' },
}

const cond = (operator: string, firstValue: string, secondValue?: string): RouterConditionGroup => ({
  operator,
  firstValue,
  secondValue,
})

describe('evaluateSingleCondition', () => {
  it('text operators', () => {
    expect(evaluateSingleCondition(cond('TEXT_CONTAINS', '{{trigger.name}}', 'world'), state)).toBe(true)
    expect(evaluateSingleCondition(cond('TEXT_DOES_NOT_CONTAIN', '{{trigger.name}}', 'zzz'), state)).toBe(true)
    expect(evaluateSingleCondition(cond('TEXT_EXACTLY_MATCHES', '{{trigger.name}}', 'Hello World'), state)).toBe(true)
    expect(evaluateSingleCondition(cond('TEXT_DOES_NOT_EXACTLY_MATCH', '{{trigger.name}}', 'x'), state)).toBe(true)
    expect(evaluateSingleCondition(cond('TEXT_STARTS_WITH', '{{trigger.name}}', 'Hello'), state)).toBe(true)
    expect(evaluateSingleCondition(cond('TEXT_ENDS_WITH', '{{trigger.name}}', 'World'), state)).toBe(true)
    expect(evaluateSingleCondition(cond('TEXT_IS_EMPTY', '{{trigger.empty}}'), state)).toBe(true)
    expect(evaluateSingleCondition(cond('TEXT_IS_NOT_EMPTY', '{{trigger.name}}'), state)).toBe(true)
  })

  it('number operators (string operands are coerced)', () => {
    expect(evaluateSingleCondition(cond('NUMBER_IS_GREATER_THAN', '{{trigger.count}}', '3'), state)).toBe(true)
    expect(evaluateSingleCondition(cond('NUMBER_IS_LESS_THAN', '{{trigger.count}}', '9'), state)).toBe(true)
    expect(evaluateSingleCondition(cond('NUMBER_IS_EQUAL_TO', '{{trigger.count}}', '5'), state)).toBe(true)
    expect(evaluateSingleCondition(cond('NUMBER_IS_GREATER_THAN_OR_EQUAL', '{{trigger.count}}', '5'), state)).toBe(true)
    expect(evaluateSingleCondition(cond('NUMBER_IS_LESS_THAN_OR_EQUAL', '{{trigger.count}}', '5'), state)).toBe(true)
  })

  it('boolean operators (accept literal and "true"/"false" strings)', () => {
    expect(evaluateSingleCondition(cond('BOOLEAN_IS_TRUE', '{{trigger.flag}}'), state)).toBe(true)
    expect(evaluateSingleCondition(cond('BOOLEAN_IS_FALSE', '{{trigger.flag}}'), state)).toBe(false)
  })

  it('existence operators', () => {
    expect(evaluateSingleCondition(cond('EXISTS', '{{trigger.name}}'), state)).toBe(true)
    expect(evaluateSingleCondition(cond('DOES_NOT_EXIST', '{{trigger.missing}}'), state)).toBe(true)
  })

  it('list operators', () => {
    expect(evaluateSingleCondition(cond('LIST_CONTAINS', '{{trigger.tags}}', 'a'), state)).toBe(true)
    expect(evaluateSingleCondition(cond('LIST_DOES_NOT_CONTAIN', '{{trigger.tags}}', 'z'), state)).toBe(true)
    expect(evaluateSingleCondition(cond('LIST_IS_NOT_EMPTY', '{{trigger.tags}}'), state)).toBe(true)
    expect(evaluateSingleCondition(cond('LIST_IS_EMPTY', '{{trigger.tags}}'), state)).toBe(false)
  })

  it('an unknown operator is false', () => {
    expect(evaluateSingleCondition(cond('WAT', '{{trigger.name}}', 'x'), state)).toBe(false)
  })
})

describe('evaluateConditions (OR over a group)', () => {
  it('true when any single condition matches', () => {
    const groups = [
      cond('TEXT_EXACTLY_MATCHES', '{{trigger.name}}', 'nope'),
      cond('NUMBER_IS_EQUAL_TO', '{{trigger.count}}', '5'),
    ]
    expect(evaluateConditions(groups, state)).toBe(true)
  })

  it('false when none match', () => {
    const groups = [cond('TEXT_EXACTLY_MATCHES', '{{trigger.name}}', 'nope')]
    expect(evaluateConditions(groups, state)).toBe(false)
  })

  it('an empty group is true (vacuous match)', () => {
    expect(evaluateConditions([], state)).toBe(true)
  })
})

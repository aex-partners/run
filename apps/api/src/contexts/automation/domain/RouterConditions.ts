import { Json, JsonObject } from '@/shared/domain/Json'
import { RouterConditionGroup } from '@/contexts/automation/domain/FlowDsl'
import { resolveVariables } from '@/contexts/automation/domain/Variables'

// Pure router condition evaluation, ported 1:1 from `flow-engine/router-executor.ts`
// (the `evaluateConditions` / `evaluateSingleCondition` half). The IO half of the
// router (executing the matching branch) lives in the decider/interpreter; this
// is the deterministic predicate used to pick branches.

// A group of conditions: any single condition matching makes the group true
// (OR semantics, as in the source). An empty group is true.
export function evaluateConditions(groups: RouterConditionGroup[], state: JsonObject): boolean {
  for (const condition of groups) {
    if (evaluateSingleCondition(condition, state)) return true
  }
  return groups.length === 0
}

export function evaluateSingleCondition(condition: RouterConditionGroup, state: JsonObject): boolean {
  const first = resolveVariables(condition.firstValue, state)
  const second: Json | undefined =
    condition.secondValue !== undefined ? resolveVariables(condition.secondValue, state) : undefined

  switch (condition.operator) {
    // Text operators
    case 'TEXT_CONTAINS':
      return String(first).toLowerCase().includes(String(second).toLowerCase())
    case 'TEXT_DOES_NOT_CONTAIN':
      return !String(first).toLowerCase().includes(String(second).toLowerCase())
    case 'TEXT_EXACTLY_MATCHES':
      return String(first) === String(second)
    case 'TEXT_DOES_NOT_EXACTLY_MATCH':
      return String(first) !== String(second)
    case 'TEXT_STARTS_WITH':
      return String(first).startsWith(String(second))
    case 'TEXT_ENDS_WITH':
      return String(first).endsWith(String(second))
    case 'TEXT_IS_EMPTY':
      return !first || String(first).length === 0
    case 'TEXT_IS_NOT_EMPTY':
      return !!first && String(first).length > 0

    // Number operators
    case 'NUMBER_IS_GREATER_THAN':
      return Number(first) > Number(second)
    case 'NUMBER_IS_LESS_THAN':
      return Number(first) < Number(second)
    case 'NUMBER_IS_EQUAL_TO':
      return Number(first) === Number(second)
    case 'NUMBER_IS_GREATER_THAN_OR_EQUAL':
      return Number(first) >= Number(second)
    case 'NUMBER_IS_LESS_THAN_OR_EQUAL':
      return Number(first) <= Number(second)

    // Boolean operators
    case 'BOOLEAN_IS_TRUE':
      return first === true || first === 'true'
    case 'BOOLEAN_IS_FALSE':
      return first === false || first === 'false'

    // Existence operators
    case 'EXISTS':
      return first !== null && first !== undefined
    case 'DOES_NOT_EXIST':
      return first === null || first === undefined

    // List operators
    case 'LIST_CONTAINS':
      return Array.isArray(first) && first.includes(second as Json)
    case 'LIST_DOES_NOT_CONTAIN':
      return !Array.isArray(first) || !first.includes(second as Json)
    case 'LIST_IS_EMPTY':
      return !Array.isArray(first) || first.length === 0
    case 'LIST_IS_NOT_EMPTY':
      return Array.isArray(first) && first.length > 0

    default:
      return false
  }
}

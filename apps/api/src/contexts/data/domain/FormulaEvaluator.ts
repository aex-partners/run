import { Result, ok, fail } from '@/shared/kernel/Result'
import { Json, JsonObject } from '@/shared/domain/Json'
import { Expr, Formula } from '@/contexts/data/domain/Formula'

// Pure domain service. Tree-walks a formula AST over a record's already-typed
// values. No IO, no clock, fully deterministic.
export const FormulaEvaluator = {
  evaluate(formula: Formula, values: JsonObject): Result<number> {
    return evalExpr(formula.ast, values)
  },
}

const evalExpr = (e: Expr, values: JsonObject): Result<number> => {
  if (e.t === 'num') return ok(e.value)
  if (e.t === 'ref') {
    const raw: Json | undefined = values[e.field]
    if (typeof raw !== 'number') return fail(`Formula: field "${e.field}" is not a number`)
    return ok(raw)
  }
  const l = evalExpr(e.left, values)
  if (!l.ok) return l
  const r = evalExpr(e.right, values)
  if (!r.ok) return r
  switch (e.op) {
    case '+':
      return ok(l.value + r.value)
    case '-':
      return ok(l.value - r.value)
    case '*':
      return ok(l.value * r.value)
    case '/':
      return r.value === 0 ? fail('Formula: division by zero') : ok(l.value / r.value)
  }
}

import { Result, ok, fail } from '@/shared/kernel/Result'

// Pure expression AST for computed fields. Proof that "dynamic" need not mean
// "impure": the expression is runtime DATA, but the parser and evaluator that
// interpret it are static domain CODE — exactly like a calculator or a regex
// engine. Supports numbers, field references, ( ) and + - * /.
export type Expr =
  | { t: 'num'; value: number }
  | { t: 'ref'; field: string }
  | { t: 'bin'; op: '+' | '-' | '*' | '/'; left: Expr; right: Expr }

export class Formula {
  private constructor(
    public readonly source: string,
    public readonly ast: Expr,
    public readonly refs: readonly string[],
  ) {}

  // Parsed at DEFINE time and validated against the fields available so far, so
  // a formula can never reference a field that does not exist. This is a
  // meta-domain invariant of EntityDefinition.
  static parse(source: string, availableFields: readonly string[]): Result<Formula> {
    const parsed = parseExpr(source)
    if (!parsed.ok) return parsed
    const refs = collectRefs(parsed.value)
    const unknown = refs.find((r) => !availableFields.includes(r))
    if (unknown) return fail(`Formula: unknown field "${unknown}"`)
    return ok(new Formula(source, parsed.value, refs))
  }
}

const collectRefs = (e: Expr): string[] => {
  if (e.t === 'ref') return [e.field]
  if (e.t === 'bin') return [...collectRefs(e.left), ...collectRefs(e.right)]
  return []
}

// --- tiny recursive-descent parser (pure) --------------------------------
type Tok = { k: 'num'; v: number } | { k: 'id'; v: string } | { k: 'op'; v: string }

const tokenize = (src: string): Result<Tok[]> => {
  const toks: Tok[] = []
  let i = 0
  while (i < src.length) {
    const c = src[i]!
    if (c === ' ' || c === '\t') {
      i++
    } else if ('+-*/()'.includes(c)) {
      toks.push({ k: 'op', v: c })
      i++
    } else if (/[0-9.]/.test(c)) {
      let j = i
      while (j < src.length && /[0-9.]/.test(src[j]!)) j++
      const num = Number(src.slice(i, j))
      if (Number.isNaN(num)) return fail(`Formula: bad number near "${src.slice(i, j)}"`)
      toks.push({ k: 'num', v: num })
      i = j
    } else if (/[a-z_]/i.test(c)) {
      let j = i
      while (j < src.length && /[a-z0-9_]/i.test(src[j]!)) j++
      toks.push({ k: 'id', v: src.slice(i, j) })
      i = j
    } else {
      return fail(`Formula: unexpected char "${c}"`)
    }
  }
  return ok(toks)
}

const parseExpr = (src: string): Result<Expr> => {
  const t = tokenize(src)
  if (!t.ok) return t
  const toks = t.value
  let pos = 0
  const peek = (): Tok | undefined => toks[pos]
  const eat = (): Tok | undefined => toks[pos++]

  // expr := term (('+' | '-') term)*
  const expr = (): Result<Expr> => {
    const first = term()
    if (!first.ok) return first
    let node: Expr = first.value
    while (peek()?.k === 'op' && (peek()!.v === '+' || peek()!.v === '-')) {
      const op = eat()!.v as '+' | '-'
      const right = term()
      if (!right.ok) return right
      node = { t: 'bin', op, left: node, right: right.value }
    }
    return ok(node)
  }
  // term := factor (('*' | '/') factor)*
  const term = (): Result<Expr> => {
    const first = factor()
    if (!first.ok) return first
    let node: Expr = first.value
    while (peek()?.k === 'op' && (peek()!.v === '*' || peek()!.v === '/')) {
      const op = eat()!.v as '*' | '/'
      const right = factor()
      if (!right.ok) return right
      node = { t: 'bin', op, left: node, right: right.value }
    }
    return ok(node)
  }
  // factor := num | id | '(' expr ')'
  const factor = (): Result<Expr> => {
    const tok = eat()
    if (!tok) return fail('Formula: unexpected end of input')
    if (tok.k === 'num') return ok({ t: 'num', value: tok.v })
    if (tok.k === 'id') return ok({ t: 'ref', field: tok.v })
    if (tok.k === 'op' && tok.v === '(') {
      const inner = expr()
      if (!inner.ok) return inner
      const close = eat()
      if (!close || close.k !== 'op' || close.v !== ')') return fail('Formula: expected ")"')
      return inner
    }
    return fail(`Formula: unexpected token "${tok.v}"`)
  }

  const out = expr()
  if (!out.ok) return out
  if (pos !== toks.length) return fail('Formula: trailing tokens')
  return out
}

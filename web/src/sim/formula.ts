// Safe formula evaluation over the closed DSL vocabulary. Uses expr-eval (a math grammar
// with no member access / code execution). See docs/FORMULA-DSL.md.
import { Parser } from "expr-eval";

const parser = new Parser();
const cache = new Map<string, ReturnType<Parser["parse"]>>();

export type Scope = Record<string, number>;

function compile(formula: string) {
  let expr = cache.get(formula);
  if (!expr) {
    expr = parser.parse(formula);
    cache.set(formula, expr);
  }
  return expr;
}

/** Evaluate a DSL formula against a variable scope. Unknown variables resolve to 0. */
export function evalFormula(formula: string, scope: Scope): number {
  const expr = compile(formula);
  const full: Scope = {};
  for (const v of expr.variables()) full[v] = scope[v] ?? 0;
  const result = expr.evaluate(full);
  return typeof result === "number" && Number.isFinite(result) ? result : 0;
}

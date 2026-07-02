// Minimal route-map type standing in for a tRPC router. In the real app a
// controller returns `t.router({...})`; here it returns a plain map of named
// handlers so the skeleton needs no HTTP framework to typecheck and run. The
// architectural point — a driving adapter calling an in-port — is identical.
export type Handler<I, O> = (input: I) => Promise<O>
export type RouteMap = Record<string, Handler<never, unknown>>

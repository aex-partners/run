// The unifying pattern of the two core contexts (Functional Core / Imperative
// Shell, a.k.a. the "decider").
//
//   decide(state, input) -> Effect[]   PURE. What to do next. No IO.
//   evolve(state, event) -> State       PURE. Fold a fact into new state.
//
// The imperative shell (an application service) performs each Effect through
// driven ports, turns the result into an Event, and evolves the state. Because
// decide/evolve are pure and deterministic, a crashed run is recovered by
// replaying its recorded events through evolve — no re-execution of effects.
//
// `automation` (flow engine) and `assistant` (AI tool loop) both implement this.
export interface Decider<State, Input, Effect, Event> {
  readonly initialState: State
  decide(state: State, input: Input): Effect[]
  evolve(state: State, event: Event): State
}

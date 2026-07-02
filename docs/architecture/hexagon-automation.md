# Hexagon — `automation` (pure decider + effect interpreter)

A flow engine interprets a user-defined graph and runs it. What is **inherently
impure**: piece calls (network), code blocks (arbitrary user JS), triggers
(time), durable run state. What is **pure**: graph validity, control-flow
decisions (routing, variable interpolation), the next-step transition.

Resolution: **Functional Core / Imperative Shell**. The core never performs an
effect; it returns effects as **data**.

```mermaid
flowchart LR
  http["FlowController"]:::d
  worker["BullMQ FlowWorker"]:::d
  subgraph HEX["automation hexagon"]
    pin{{"in-port StartFlow"}}:::p
    shell["FlowInterpreter (imperative shell)"]:::c
    dom((("Flow · FlowDecider<br/>decide -> Effect[] · evolve -> State")))
    pout{{"out-port PieceGateway · CodeSandbox · RunEventStore"}}:::p
    pin --> shell --> dom
    shell --> pout
  end
  pieces[("plugins (ACL)")]:::dr
  vm[("isolate-vm")]:::dr
  store[("event store")]:::dr
  http --> pin
  worker --> pin
  pout --> pieces
  pout --> vm
  pout --> store
  classDef d fill:#e0ecff,stroke:#2c5fb3
  classDef dr fill:#fff0d8,stroke:#b3792c
  classDef p fill:#fffbe0,stroke:#b3a52c,stroke-dasharray:4 3
  classDef c fill:#ffe0e0,stroke:#c0392b
```

- [`FlowDecider.ts`](../../src/contexts/automation/domain/FlowDecider.ts) — pure
  `decide`/`evolve`. The router branch is decided here with no IO.
- [`Effect.ts`](../../src/contexts/automation/domain/Effect.ts) — effects as data.
- [`FlowInterpreter.ts`](../../src/contexts/automation/application/use-cases/FlowInterpreter.ts)
  — the only place with IO. `resume()` rebuilds state by replaying the event log
  through `evolve` (no effect re-performed) — deterministic crash recovery.
- The **one irreducible impurity** (user code) is a single port,
  [`CodeSandbox`](../../src/contexts/automation/application/ports/out/CodeSandbox.ts);
  sandboxing/limits are the adapter's job.
- Cross-context: pieces are invoked via the
  [`PieceGateway`](../../src/contexts/automation/application/ports/out/PieceGateway.ts)
  ACL, bridged to the `plugins` in-port in `main/container.ts`.

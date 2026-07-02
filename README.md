# run-hex

AEX Run re-imagined in **hexagonal architecture** (Ports & Adapters + DDD),
following the [adequa-all](../adequa-all) blueprint. A runnable skeleton that
proves the three hard parts of AEX map cleanly onto a pure domain:

1. **Dynamic entities** (user-defined schema at runtime) in **classic DDD**.
2. **Flows** (an interpreter over user data) with the **impurity confined to ports**.
3. The **boilerplate cost** kept proportional to each subdomain.

## The one idea

> Reify the dynamic/impure thing as **DATA**, keep a pure **INTERPRETER** of that
> data in the domain, and push the real IO behind named **OUT-PORTS** interpreted
> in the shell.

| Context | Data reified | Pure interpreter | IO behind out-ports |
|---|---|---|---|
| `data` | `RecordSchema` (schema-as-data) | `schema.validate`, `FormulaEvaluator` | `RecordRepository`, `EventPublisher` |
| `automation` | `Effect[]` (effect-as-data) | `FlowDecider.decide/evolve` | `PieceGateway`, `CodeSandbox`, `RunEventStore` |
| `assistant` | tool calls (intent-as-data) | `SendMessageService` loop | `AgentRuntime`, `ToolBox` |

All three share [`shared/kernel/Decider.ts`](src/shared/kernel/Decider.ts):
Functional Core / Imperative Shell.

## Layout

```
src/
├── contexts/
│   ├── data/         # dynamic entities + records (the star)
│   ├── automation/   # flow engine: pure decider + effect interpreter (the star)
│   ├── plugins/      # piece invocation (ACL target of automation)
│   └── assistant/    # AI tool loop (LLM as a driven port)
│       └── {domain, application/{ports,use-cases,...}, adapters/{in,out}}
├── platform/         # infra: db type, event publisher, clock, tool/runtime types
├── shared/{kernel,domain}   # Result, Entity, AggregateRoot, Decider, Json, ...
└── main/             # composition root: container.ts (+ ACL bridges), demo.ts
```

## Dependency rule (enforced)

`adapters -> application -> domain`. Domain/application import **zero npm**.
Contexts never import each other; they talk via **ACL out-ports** fulfilled in
`main/container.ts`. All of this is enforced in CI by
[dependency-cruiser](.dependency-cruiser.cjs) — same six rules as adequa-all.

## Run it

```bash
npm install
npm run verify   # tsc --noEmit + depcruise (proves the architecture holds)
npm run demo     # exercises all three contexts through their ports
```

## How the costs are paid down

- **CQRS**: reads skip the hexagon. See `data/application/queries/ListRecords.ts`
  and its `InMemoryListRecords` adapter (direct read, no aggregate/repo/mapper).
- **Subdomain tiering**: only core contexts (`data`, `automation`, `assistant`)
  get the full treatment. Generic ones (reminders, notifications, settings) would
  be plain transaction scripts in `platform/`.
- **Kernel base types** absorb repetition (`Result`, `Identifier`, `Decider`, ...).

See [docs/architecture](docs/architecture/README.md) for the context map and the
two detailed hexagons.

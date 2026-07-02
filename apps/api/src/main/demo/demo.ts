// Runnable end-to-end smoke test. Proves the wired hexagons work through their
// ports only, with zero DB/Redis. Run: `npm run demo`.
import { buildContainer } from '@/main/demo/container'
import { Flow } from '@/contexts/automation/domain/Flow'
import { FlowId } from '@/contexts/automation/domain/ids'
import { Step } from '@/contexts/automation/domain/Step'

const line = (s: string) => console.log(s)

async function main() {
  const app = buildContainer()

  line('\n=== 1. data context: dynamic entity in classic DDD ===')
  const created = await app.data.createEntity.execute({ name: 'Products' })
  if (!created.ok) throw new Error(created.error)
  const entityId = created.value.id
  line(`created entity Products (${entityId})`)

  for (const field of [
    { name: 'name', required: true, type: { kind: 'text' } as const },
    { name: 'price', required: true, type: { kind: 'number' } as const },
    { name: 'qty', required: true, type: { kind: 'number' } as const },
    { name: 'total', required: false, type: { kind: 'formula', expression: 'price * qty' } as const },
  ]) {
    const r = await app.data.addField.execute({ entityId, ...field })
    if (!r.ok) throw new Error(`addField ${field.name}: ${r.error}`)
  }
  line('added fields: name(text) price(number) qty(number) total(formula = price * qty)')

  const inserted = await app.data.insertRecord.execute({
    entityId,
    data: { name: 'Keyboard', price: 200, qty: 3 },
  })
  if (!inserted.ok) throw new Error(inserted.error)
  line(`inserted record ${inserted.value.id} v${inserted.value.version}`)

  const rows = await app.data.listRecords.execute({ entityId })
  line(`read-side ListRecords -> ${JSON.stringify(rows[0]?.data)}  (total computed by the domain)`)

  const stale = await app.data.updateRecord.execute({
    recordId: inserted.value.id,
    data: { name: 'Keyboard', price: 250, qty: 3 },
    expectedVersion: 99,
  })
  line(`optimistic-concurrency guard with wrong version -> ${stale.ok ? 'OK' : 'rejected: ' + stale.error}`)

  const badType = await app.data.insertRecord.execute({
    entityId,
    data: { name: 'Mouse', price: 'free', qty: 1 },
  })
  line(`schema validation (price not a number) -> ${badType.ok ? 'OK' : 'rejected: ' + badType.error}`)

  line('\n=== 2. automation context: pure decider + effect interpreter ===')
  const steps: Step[] = [
    { id: 'fetch', type: 'piece', pieceId: 'http', action: 'get', input: { url: '{{trigger.url}}' }, next: 'check' },
    { id: 'check', type: 'router', branches: [{ whenVar: 'fetch.status', equals: 'ok', goto: 'done' }], otherwise: 'fail' },
    { id: 'done', type: 'complete', output: { ok: true, data: '{{fetch.received}}' } },
    { id: 'fail', type: 'complete', output: { ok: false } },
  ]
  const flow = Flow.create(FlowId.of('flow-1'), 'Fetch + route', 'fetch', steps)
  if (!flow.ok) throw new Error(flow.error)
  await app.automation.flowRepo.save(flow.value)

  const run = await app.automation.startFlow.execute({ flowId: 'flow-1', input: { url: 'https://example.com' } })
  if (!run.ok) throw new Error(run.error)
  line(`flow run ${run.value.runId} -> ${run.value.status}`)
  line(`flow output -> ${JSON.stringify(run.value.output)}  (piece IO behind a port, router decided purely)`)

  line('\n=== 3. assistant context: AI tool loop (same decider shape) ===')
  const reply = await app.assistant.sendMessage.execute({
    conversationId: 'conv-1',
    text: 'Please create a Leads entity for me.',
  })
  if (!reply.ok) throw new Error(reply.error)
  line(`tools used by the AI -> [${reply.value.toolsUsed.join(', ')}]  (data in-port reused via ACL ToolBox)`)
  line(`assistant reply -> "${reply.value.reply}"`)

  line('\nAll hexagons exercised through ports only.\n')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

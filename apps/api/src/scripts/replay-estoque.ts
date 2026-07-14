// RECONSTRÓI as projeções do estoque a partir do LIVRO (movimentos_de_estoque).
//
// O livro é a VERDADE; `produtos.custo_medio`, `produtos.saldo_total` e `saldos_de_estoque`
// são projeções DELE. A gravação das projeções NÃO é transacional (o contexto `data` não
// oferece transação por aqui), então um crash no meio, ou duas notas concorrentes, podem
// deixá-las tortas. Sem este script, um erro de custo médio é IRREVERSÍVEL. Com ele, o
// livro sempre reconstrói a verdade.
//
// A ordem do replay é a ORDEM DE LANÇAMENTO (created_at crescente): a mesma em que o
// RegistrarMovimentoService aplicou os movimentos. NÃO é a data do documento -- lançar
// uma nota retroativa não reescreve o passado.
//
//   DATABASE_URL='...' npx tsx src/scripts/replay-estoque.ts            # confere e conserta
//   DATABASE_URL='...' npx tsx src/scripts/replay-estoque.ts --dry-run  # só confere
import { makeDb } from '@/platform/db/client'
import { loadEnv } from '@/platform/config/env'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { DrizzleEntityRepository } from '@/contexts/data/adapters/out/persistence/DrizzleEntityRepository'
import { DrizzleRecordRepository } from '@/contexts/data/adapters/out/persistence/DrizzleRecordRepository'
import { DrizzleListEntities } from '@/contexts/data/adapters/out/persistence/DrizzleListEntities'
import { DrizzleQueryRecords } from '@/contexts/data/adapters/out/persistence/DrizzleQueryRecords'
import { InsertRecordService } from '@/contexts/data/application/use-cases/InsertRecordService'
import { UpdateRecordService } from '@/contexts/data/application/use-cases/UpdateRecordService'
import { GetRecordService } from '@/contexts/data/application/use-cases/GetRecordService'
import { aplicarEntrada, aplicarMovimentoSemCusto, custeia, EstadoCusto } from '@/contexts/estoque/domain/CustoMedio'
import * as schema from '@/platform/db/schema'

const TETO = 500
const noopEvents: EventPublisher = { publish: async () => {} }
const clock: Clock = { now: () => new Date() }
const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v ?? 0)) || 0

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const env = loadEnv()
  const db = makeDb(env.DATABASE_URL)

  const entityRepo = new DrizzleEntityRepository(db)
  const recordRepo = new DrizzleRecordRepository(db)
  const listEntities = new DrizzleListEntities(db)
  const queryRecords = new DrizzleQueryRecords(db)
  const getRecord = new GetRecordService(recordRepo)
  const insertRecord = new InsertRecordService(entityRepo, recordRepo, noopEvents, clock)
  const updateRecord = new UpdateRecordService(entityRepo, recordRepo, noopEvents, clock)

  const [autor] = await db.select({ id: schema.users.id }).from(schema.users).limit(1)
  if (!autor) throw new Error('nenhum usuário no banco para atribuir created_by')

  const entidades = await listEntities.execute()
  const idBySlug = (slug: string) => entidades.find((e) => e.slug === slug)?.id ?? null
  const produtosId = idBySlug('produtos')
  const saldosId = idBySlug('saldos_de_estoque')
  if (!produtosId || !saldosId) throw new Error('rode provision-estoque.ts antes')

  // Os insumos que controlam estoque. Só eles têm livro.
  const produtos = (await queryRecords.execute({
    entity: 'produtos',
    // `'true'` (STRING), não `true`: BooleanFieldType.castKind() é 'text', então o engine
    // compara `data->>'controla_estoque'` (texto) contra o parâmetro. Um boolean JS nativo
    // aqui vira parâmetro tipo boolean no bind, e o Postgres rejeita "text = boolean" --
    // confirmado ao vivo. String bate com a representação textual gravada no jsonb.
    where: [{ field: 'controla_estoque', op: 'eq', value: 'true' }],
    limit: TETO,
  } as never)) as { rows?: { id: string; version: number; data: Record<string, unknown> }[] }
  const insumos = produtos.rows ?? []
  if (insumos.length >= TETO) {
    throw new Error(
      `${insumos.length} insumos com controla_estoque: bateu no teto de ${TETO} do query engine. ` +
      'Reconstruir com a lista truncada produziria custos errados: pagine este script antes de usá-lo.',
    )
  }
  console.log(`${insumos.length} insumo(s) com controle de estoque`)

  let divergencias = 0

  for (const insumo of insumos) {
    // O livro DESTE insumo. O engine devolve created_at DESC: inverte para reprocessar
    // na ORDEM DE LANÇAMENTO.
    const res = (await queryRecords.execute({
      entity: 'movimentos_de_estoque',
      where: [{ field: 'insumo', op: 'eq', value: insumo.id }],
      limit: TETO,
    } as never)) as { rows?: { id: string; data: Record<string, unknown> }[] }
    const movs = (res.rows ?? []).slice().reverse()

    // TRUNCAGEM = RECONSTRUÇÃO ERRADA. O engine devolveria as 500 MAIS RECENTES e
    // jogaria fora as antigas: o custo médio sairia errado, com cara de certo. Falha alto.
    if ((res.rows ?? []).length >= TETO) {
      throw new Error(
        `insumo ${insumo.id} tem ${TETO} ou mais movimentos: o livro NÃO cabe numa consulta. ` +
        'Reconstruir com a leitura truncada produziria um custo médio errado. Pagine este script antes de usá-lo.',
      )
    }

    // Reaplica o motor, movimento a movimento, do zero.
    let estado: EstadoCusto = { saldo: 0, custoMedio: 0 }
    const porDeposito = new Map<string, number>()

    for (const m of movs) {
      const tipo = String(m.data.tipo ?? '')
      const qtd = num(m.data.qtd)
      const custo = num(m.data.custo_unitario)
      estado = custeia(tipo) ? aplicarEntrada(estado, qtd, custo) : aplicarMovimentoSemCusto(estado, qtd)
      const dep = String(m.data.deposito ?? '')
      porDeposito.set(dep, (porDeposito.get(dep) ?? 0) + qtd)
    }

    const saldoAtual = num(insumo.data.saldo_total)
    const custoAtual = num(insumo.data.custo_medio)
    const bateSaldo = Math.abs(saldoAtual - estado.saldo) < 1e-9
    const bateCusto = Math.abs(custoAtual - estado.custoMedio) < 1e-9

    if (!bateSaldo || !bateCusto) {
      divergencias++
      console.log(
        `DIVERGENTE ${insumo.id} (${movs.length} mov):\n` +
        `  saldo      projeção=${saldoAtual}  livro=${estado.saldo}\n` +
        `  custoMedio projeção=${custoAtual}  livro=${estado.custoMedio}`,
      )
    }

    if (dryRun) continue

    // Reescreve as projeções a partir do livro.
    const p = await getRecord.execute({ recordId: insumo.id })
    if (p) {
      await updateRecord.execute({
        recordId: insumo.id,
        data: { ...p.data, saldo_total: estado.saldo, custo_medio: estado.custoMedio, preco_custo: estado.custoMedio },
        expectedVersion: p.version,
      })
    }

    const saldosRes = (await queryRecords.execute({
      entity: 'saldos_de_estoque',
      where: [{ field: 'insumo', op: 'eq', value: insumo.id }],
      limit: TETO,
    } as never)) as { rows?: { id: string; version: number; data: Record<string, unknown> }[] }
    const existentes = new Map((saldosRes.rows ?? []).map((r) => [String(r.data.deposito ?? ''), r]))

    for (const [dep, qtd] of porDeposito) {
      const row = existentes.get(dep)
      if (row) {
        await updateRecord.execute({
          recordId: row.id, data: { ...row.data, qtd }, expectedVersion: row.version,
        })
      } else {
        await insertRecord.execute({
          entityId: saldosId, data: { insumo: insumo.id, deposito: dep, qtd }, createdBy: autor.id,
        })
      }
    }
  }

  console.log(
    divergencias === 0
      ? '\nOK: projeções batem com o livro em todos os insumos'
      : `\n${divergencias} insumo(s) DIVERGENTE(S)${dryRun ? ' (dry-run: nada foi corrigido)' : ' — projeções reconstruídas a partir do livro'}`,
  )
  process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })

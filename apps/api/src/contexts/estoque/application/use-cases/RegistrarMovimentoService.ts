import { Result, ok, fail } from '@/shared/kernel/Result'
import { EntityRegistry } from '@/contexts/estoque/application/ports/out/EntityRegistry'
import { RecordStore } from '@/contexts/estoque/application/ports/out/RecordStore'
import {
  RegistrarMovimento, RegistrarMovimentoCommand, MovimentoResumo,
} from '@/contexts/estoque/application/ports/in/RegistrarMovimento'
import { aplicarEntrada, aplicarMovimentoSemCusto, custeia, EstadoCusto } from '@/contexts/estoque/domain/CustoMedio'
import { EstoqueError } from '@/contexts/estoque/domain/EstoqueError'
import { TIPOS_MOVIMENTO } from '@/scripts/estoqueSchema'

// Teto do query engine do data (`Math.min(limit ?? 50, 500)`): sem limite explícito a
// leitura corta em 50 e descarta as linhas MAIS ANTIGAS, em silêncio.
const LIMITE = 500

const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v ?? 0)) || 0

export class RegistrarMovimentoService implements RegistrarMovimento {
  constructor(private readonly store: RecordStore, private readonly registry: EntityRegistry) {}

  async execute(cmd: RegistrarMovimentoCommand): Promise<Result<MovimentoResumo>> {
    const ids = await this.resolveEntities()
    if (!ids) return fail(EstoqueError.entidadeFaltando)

    // --- validação DURA (nada é gravado antes de tudo passar)
    if (!TIPOS_MOVIMENTO.includes(cmd.tipo as (typeof TIPOS_MOVIMENTO)[number])) {
      return fail(EstoqueError.tipoInvalido(cmd.tipo, TIPOS_MOVIMENTO))
    }
    if (!Number.isFinite(cmd.qtd) || cmd.qtd === 0) return fail(EstoqueError.qtdZero)

    const insumo = await this.store.get(cmd.insumoId)
    if (!insumo) return fail(EstoqueError.insumoNaoEncontrado)
    if (insumo.data.controla_estoque !== true) return fail(EstoqueError.semControleDeEstoque(cmd.insumoId))

    const deposito = await this.store.get(cmd.depositoId)
    if (!deposito) return fail(EstoqueError.depositoNaoEncontrado)

    const custeando = custeia(cmd.tipo)
    if (custeando) {
      // Entrada sem custo produziria um custo médio ZERADO em silêncio: o pior modo de
      // falha possível num motor de custo.
      if (cmd.custoUnitario == null || !Number.isFinite(cmd.custoUnitario)) {
        return fail(EstoqueError.entradaSemCusto(cmd.tipo))
      }
      if (!(cmd.qtd > 0)) return fail(EstoqueError.entradaQtdInvalida(cmd.tipo, cmd.qtd))
    }

    // --- motor
    const antes: EstadoCusto = { saldo: num(insumo.data.saldo_total), custoMedio: num(insumo.data.custo_medio) }
    const depois = custeando
      ? aplicarEntrada(antes, cmd.qtd, cmd.custoUnitario as number)
      : aplicarMovimentoSemCusto(antes, cmd.qtd)

    // O custo do movimento: numa entrada é o custo custeado; nos demais tipos é o médio
    // VIGENTE (o custo pelo qual a quantidade se moveu). Fica gravado no livro.
    const custoDoMovimento = custeando ? (cmd.custoUnitario as number) : antes.custoMedio

    // saldo do depósito (a outra projeção)
    const saldoRow = (await this.store.query(ids.saldos_de_estoque, [
      { field: 'insumo', op: 'eq', value: cmd.insumoId },
      { field: 'deposito', op: 'eq', value: cmd.depositoId },
    ], LIMITE))[0]
    const saldoDepositoApos = num(saldoRow?.data.qtd) + cmd.qtd

    const erros: string[] = []
    if (depois.saldo < 0) erros.push(EstoqueError.saldoNegativo(cmd.insumoId, depois.saldo))

    // --- escrita. O LIVRO PRIMEIRO: ele é a verdade. Se uma projeção falhar depois, o
    // livro continua certo e o replay-estoque.ts reconstrói. Ao contrário, um crash
    // deixaria a projeção adiantada e sem a linha do livro que a explica.
    const movimentoId = await this.store.insert(ids.movimentos_de_estoque, {
      insumo: cmd.insumoId,
      deposito: cmd.depositoId,
      tipo: cmd.tipo,
      qtd: cmd.qtd,
      custo_unitario: custoDoMovimento,
      data: cmd.data ?? new Date().toISOString(),
      origem_tipo: cmd.origemTipo ?? null,
      origem_id: cmd.origemId ?? null,
      saldo_deposito_apos: saldoDepositoApos,
      saldo_total_apos: depois.saldo,
      custo_medio_apos: depois.custoMedio,
      observacao: cmd.observacao ?? null,
    })

    // projeção 1: saldo por depósito
    if (saldoRow) {
      await this.store.update(saldoRow.id, { ...saldoRow.data, qtd: saldoDepositoApos }, saldoRow.version)
    } else {
      await this.store.insert(ids.saldos_de_estoque, {
        insumo: cmd.insumoId, deposito: cmd.depositoId, qtd: saldoDepositoApos,
      })
    }

    // projeção 2: Produtos (saldo global + custo médio + o ESPELHO em preco_custo).
    //
    // `custo_medio_atualizado_em` só é reescrito quando o médio MUDA DE VALOR. Se toda
    // baixa carimbasse a data, todo SKU apareceria como "custo defasado" a cada saída e
    // o aviso do CustosDesatualizados viraria ruído puro.
    const mudouCusto = depois.custoMedio !== antes.custoMedio
    await this.store.update(cmd.insumoId, {
      ...insumo.data,
      saldo_total: depois.saldo,
      custo_medio: depois.custoMedio,
      // ESPELHO: é o campo que o `costing` lê como custo de material na explosão.
      // Escrevê-lo aqui NÃO recalcula ficha nenhuma: o custo do PRODUTO só muda quando
      // alguém manda recalcular.
      preco_custo: depois.custoMedio,
      ...(mudouCusto ? { custo_medio_atualizado_em: new Date().toISOString() } : {}),
    }, insumo.version)

    return ok({
      movimentoId,
      saldoDeposito: saldoDepositoApos,
      saldoTotal: depois.saldo,
      custoMedio: depois.custoMedio,
      erros,
    })
  }

  private async resolveEntities() {
    const slugs = ['produtos', 'depositos', 'movimentos_de_estoque', 'saldos_de_estoque'] as const
    const out = {} as Record<(typeof slugs)[number], string>
    for (const s of slugs) {
      const id = await this.registry.entityIdBySlug(s)
      if (!id) return null
      out[s] = id
    }
    return out
  }
}

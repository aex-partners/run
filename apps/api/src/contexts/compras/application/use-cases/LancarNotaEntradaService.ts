import { Result, ok, fail } from '@/shared/kernel/Result'
import { EntityRegistry } from '@/contexts/compras/application/ports/out/EntityRegistry'
import { RecordStore } from '@/contexts/compras/application/ports/out/RecordStore'
import { EstoqueMovimentos } from '@/contexts/compras/application/ports/out/EstoqueMovimentos'
import { LancarNotaEntrada, LancarNotaEntradaCommand, NotaResumo } from '@/contexts/compras/application/ports/in/LancarNotaEntrada'
import { custearNota, ItemNotaInput, PoliticaCusto, POLITICA_PADRAO } from '@/contexts/compras/domain/CustoNota'
import { ComprasError } from '@/contexts/compras/domain/ComprasError'

const LIMITE = 500
const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v ?? 0)) || 0

// A NOTA É QUEM RECEBE: lançá-la move o estoque E define o custo. Não existe etapa de
// recebimento físico separada.
//
// NÃO HÁ TRANSAÇÃO entre gravar a nota e registrar os movimentos. A defesa é validar
// TUDO antes de escrever a primeira linha: insumo existe, controla_estoque ligado, fator
// de conversão válido, depósito existe, custeio fechou. Depois disso um movimento só
// falha por erro de infra -- e aí a nota fica em `rascunho` e o erro diz o que fazer.
//
// Este serviço NÃO chama o costing. O custo do PRODUTO só muda quando alguém manda
// recalcular (RecalcularCusto), nunca em cascata.
export class LancarNotaEntradaService implements LancarNotaEntrada {
  constructor(
    private readonly store: RecordStore,
    private readonly registry: EntityRegistry,
    private readonly estoque: EstoqueMovimentos,
  ) {}

  async execute(cmd: LancarNotaEntradaCommand): Promise<Result<NotaResumo>> {
    const ids = await this.resolveEntities()
    if (!ids) return fail(ComprasError.entidadeFaltando)

    if (cmd.itens.length === 0) return fail(ComprasError.notaSemItens)

    // --- validação DURA, antes de qualquer escrita
    if (cmd.pedidoId) {
      const pedido = await this.store.get(cmd.pedidoId)
      if (!pedido) return fail(ComprasError.pedidoNaoEncontrado)
    }

    const itensCusteio: ItemNotaInput[] = []
    for (const i of cmd.itens) {
      const produto = await this.store.get(i.insumoId)
      if (!produto) return fail(ComprasError.insumoNaoEncontrado(i.insumoId))
      // A nota MOVE estoque. Sem `controla_estoque`, o estoque recusaria o movimento
      // DEPOIS de a nota estar gravada. Barra antes, e a nota nem começa.
      if (produto.data.controla_estoque !== true) {
        return fail(ComprasError.insumoSemControleDeEstoque(i.insumoId))
      }
      itensCusteio.push({
        insumoId: i.insumoId,
        qtdCompra: i.qtd,
        precoUnitario: i.precoUnitario,
        desconto: i.desconto ?? 0,
        imposto: i.imposto ?? 0,
        fatorConversao: num(produto.data.fator_conversao),
      })
    }

    const politica = await this.carregarPolitica(ids.politica_de_custo_compra)
    const custeio = custearNota({ itens: itensCusteio, valorFrete: cmd.valorFrete ?? 0, politica })
    // Erro de custeio é DURO: divisão por zero ou custo inventado. A nota não lança.
    if (custeio.erros.length > 0) return fail(ComprasError.custeioInvalido(custeio.erros))

    // O `estoque` RECUSA uma entrada com custo unitário <= 0: ela zeraria o custo médio do
    // insumo em silêncio (e nem carimbaria `custo_medio_atualizado_em`, então o aviso de custo
    // defasado também não dispararia). `custearNota` pode devolver custo ZERO legitimamente —
    // uma linha de brinde, preço zero, sem frete e sem imposto. Barrar AQUI, antes de gravar
    // qualquer linha, em vez de deixar o estoque recusar o movimento com a nota já gravada e
    // presa em `rascunho`, com uma mensagem de "movimento parcial" que não descreve o que houve.
    const semCusto = custeio.itens.filter((i) => !(i.custoUnitarioFinal > 0))
    if (semCusto.length > 0) {
      return fail(ComprasError.itemSemCusto(semCusto.map((i) => i.insumoId)))
    }

    const valorProdutos = itensCusteio.reduce((s, i) => s + i.qtdCompra * i.precoUnitario, 0)
    const valorDesconto = itensCusteio.reduce((s, i) => s + i.desconto, 0)
    const valorImpostos = itensCusteio.reduce((s, i) => s + i.imposto, 0)
    const valorTotal = custeio.itens.reduce((s, i) => s + i.custoTotal, 0)

    // --- escrita. A nota nasce em `rascunho` e só vira `lancada` depois que TODOS os
    // movimentos entraram. Se um falhar, ela fica em rascunho, visível, e o erro manda
    // rodar o replay.
    const notaId = await this.store.insert(ids.notas_de_entrada, {
      numero: cmd.numero,
      serie: cmd.serie ?? null,
      fornecedor: cmd.fornecedorId,
      pedido: cmd.pedidoId ?? null,
      data_emissao: cmd.dataEmissao,
      data_entrada: cmd.dataEntrada,
      deposito: cmd.depositoId,
      valor_produtos: valorProdutos,
      valor_frete: cmd.valorFrete ?? 0,
      valor_desconto: valorDesconto,
      valor_impostos: valorImpostos,
      valor_total: valorTotal,
      condicao_pagamento: cmd.condicaoPagamento ?? null,
      chave_nfe: cmd.chaveNfe ?? null,
      status: 'rascunho',
    })

    for (const i of custeio.itens) {
      const entrada = cmd.itens.find((x) => x.insumoId === i.insumoId)!
      await this.store.insert(ids.itens_nota_entrada, {
        nota: notaId,
        insumo: i.insumoId,
        qtd: i.qtdCompra,
        preco_unitario: entrada.precoUnitario,
        desconto: entrada.desconto ?? 0,
        imposto: entrada.imposto ?? 0,
        frete_rateado: i.freteRateado,
        custo_unitario_final: i.custoUnitarioFinal,
      })
    }

    // --- empurra as entradas para o estoque, JÁ em unidade de CONSUMO
    const resumoItens: NotaResumo['itens'] = []
    for (const i of custeio.itens) {
      try {
        const mov = await this.estoque.registrarEntrada({
          insumoId: i.insumoId,
          depositoId: cmd.depositoId,
          qtd: i.qtdConsumo,
          custoUnitario: i.custoUnitarioFinal,
          origemTipo: 'nota_entrada',
          origemId: notaId,
          data: cmd.dataEntrada,
        })
        resumoItens.push({
          insumoId: i.insumoId,
          qtdCompra: i.qtdCompra,
          qtdConsumo: i.qtdConsumo,
          freteRateado: i.freteRateado,
          custoUnitarioFinal: i.custoUnitarioFinal,
          custoMedioApos: mov.custoMedio,
        })
      } catch (e) {
        // A nota fica em RASCUNHO, com movimentos parciais. Falha ALTO, dizendo o que fazer.
        return fail(ComprasError.movimentoParcial(notaId, (e as Error).message))
      }
    }

    // --- tudo entrou: a nota está lançada
    const nota = await this.store.get(notaId)
    if (nota) await this.store.update(notaId, { ...nota.data, status: 'lancada' }, nota.version)

    if (cmd.pedidoId) await this.atualizarPedido(ids.itens_pedido_compra, cmd.pedidoId, cmd.itens)

    return ok({ notaId, valorTotal, itens: resumoItens })
  }

  // Sem linha cadastrada, vale o padrão (tudo ligado, rateio por valor). É LINHA ÚNICA:
  // se houver mais de uma, a primeira que o engine devolver (a mais RECENTE, porque a
  // ordem é created_at DESC) é a que vale.
  private async carregarPolitica(entityId: string): Promise<PoliticaCusto> {
    const rows = await this.store.query(entityId, [], LIMITE)
    const p = rows[0]
    if (!p) return POLITICA_PADRAO
    const criterio = p.data.criterio_rateio_frete === 'quantidade' ? 'quantidade' : 'valor'
    return {
      incluirFrete: p.data.incluir_frete !== false,
      incluirImpostos: p.data.incluir_impostos !== false,
      incluirDescontos: p.data.incluir_descontos !== false,
      criterioRateioFrete: criterio,
    }
  }

  // Acumula a quantidade recebida por item e fecha o pedido quando tudo chegou.
  // Entrega parcial é normal: um pedido pode receber VÁRIAS notas.
  private async atualizarPedido(
    itensPedidoId: string,
    pedidoId: string,
    itensNota: LancarNotaEntradaCommand['itens'],
  ): Promise<void> {
    const itens = await this.store.query(itensPedidoId, [{ field: 'pedido', op: 'eq', value: pedidoId }], LIMITE)
    for (const item of itens) {
      const recebidoAgora = itensNota
        .filter((i) => i.insumoId === String(item.data.insumo))
        .reduce((s, i) => s + i.qtd, 0)
      if (recebidoAgora === 0) continue
      await this.store.update(
        item.id,
        { ...item.data, qtd_recebida: num(item.data.qtd_recebida) + recebidoAgora },
        item.version,
      )
    }

    // Relê para decidir o status com os valores JÁ atualizados.
    const atualizados = await this.store.query(itensPedidoId, [{ field: 'pedido', op: 'eq', value: pedidoId }], LIMITE)
    const completo = atualizados.every((i) => num(i.data.qtd_recebida) >= num(i.data.qtd))
    const pedido = await this.store.get(pedidoId)
    if (!pedido) return
    await this.store.update(
      pedidoId,
      { ...pedido.data, status: completo ? 'recebido' : 'parcial' },
      pedido.version,
    )
  }

  private async resolveEntities() {
    const slugs = [
      'produtos', 'depositos', 'pedidos_de_compra', 'itens_pedido_compra',
      'notas_de_entrada', 'itens_nota_entrada', 'politica_de_custo_compra',
    ] as const
    const out = {} as Record<(typeof slugs)[number], string>
    for (const s of slugs) {
      const id = await this.registry.entityIdBySlug(s)
      if (!id) return null
      out[s] = id
    }
    return out
  }
}

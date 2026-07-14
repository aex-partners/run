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
// NÃO HÁ TRANSAÇÃO entre gravar a nota e registrar os movimentos. A defesa é validar TUDO
// antes de escrever a primeira linha: a nota não é duplicada (numero+fornecedor, e
// chave_nfe quando houver), o pedido (se houver) existe, o depósito existe, o insumo
// existe, controla_estoque está ligado, o fator de conversão é válido, e o custeio fechou.
// Depois disso um movimento só falha por erro de infra -- e aí a nota fica em `rascunho` e
// o erro diz o que fazer.
//
// DEPOIS que os movimentos entraram (o estoque JÁ mudou, e é a verdade), nada do que falhar
// desfaz a operação: virar `lancada` e atualizar o pedido são best-effort, com o erro
// reportado como AVISO, nunca como falha da escrita que já aconteceu.
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

    // '' e null são "sem pedido". Tratar '' como truthy gravaria `pedido: ''` na nota (e
    // tentaria validar um id vazio) em vez de `null`.
    const pedidoId = cmd.pedidoId ? cmd.pedidoId : null

    // --- validação DURA, antes de qualquer escrita

    // IDEMPOTÊNCIA. Sem esta guarda, lançar a mesma nota duas vezes (duplo clique, retry do
    // MCP, timeout do HTTP, ou um retry cego depois de um erro de movimento parcial) grava a
    // nota de novo, empurra os movimentos de novo, e PONDERA O CUSTO MÉDIO DUAS VEZES.
    // Permanente, silencioso, e com cara de certo — e o replay reconstrói fielmente o custo
    // dobrado, porque o livro dobrado é o que está lá.
    const jaExiste = await this.store.query(ids.notas_de_entrada, [
      { field: 'numero', op: 'eq', value: cmd.numero },
      { field: 'fornecedor', op: 'eq', value: cmd.fornecedorId },
    ], LIMITE)
    const duplicada = jaExiste[0]
    if (duplicada) return fail(ComprasError.notaDuplicada(cmd.numero, duplicada.id))

    if (cmd.chaveNfe) {
      const porChave = await this.store.query(ids.notas_de_entrada, [
        { field: 'chave_nfe', op: 'eq', value: cmd.chaveNfe },
      ], LIMITE)
      const duplicadaPorChave = porChave[0]
      if (duplicadaPorChave) return fail(ComprasError.notaDuplicada(cmd.numero, duplicadaPorChave.id))
    }

    // `store.get` devolve QUALQUER registro por id: um produto passado como pedido seria
    // aceito, a nota gravaria `pedido: <produtoId>`, e o motor de atualização do pedido, ao
    // não achar itens com esse `pedido`, carimbaria `status: 'recebido'` DIRETO NO PRODUTO.
    // Confere a pertinência à entidade `pedidos_de_compra`.
    if (pedidoId) {
      const pedidos = await this.store.query(ids.pedidos_de_compra, [], LIMITE)
      if (!pedidos.some((p) => p.id === pedidoId)) return fail(ComprasError.pedidoNaoEncontrado)
    }

    // `store.get` devolve QUALQUER registro por id, então não serve para checar o TIPO. Confere
    // a pertinência à entidade `depositos`. Sem isto, um id errado só é recusado lá no estoque,
    // com a nota JÁ gravada e presa em rascunho, e o usuário recebe uma mensagem de "movimento
    // parcial" que descreve um problema de infraestrutura quando o que houve foi um erro de digitação.
    const depositos = await this.store.query(ids.depositos, [], LIMITE)
    if (!depositos.some((d) => d.id === cmd.depositoId)) return fail(ComprasError.depositoNaoEncontrado(cmd.depositoId))

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

    // `custearNota` devolve UM item por entrada, NA MESMA ORDEM, sempre que `erros` vem vazio
    // (um item ruim só sai da lista via `continue` ou via um `return { itens: [], erros }`
    // global, e as duas rotas SEMPRE empurram para `erros` antes — já checado e recusado
    // acima). Ainda assim, confere o tamanho antes de zipar por índice: não dá pra adivinhar
    // qual linha da nota corresponde a qual item custeado se algum dia isso não bater.
    if (custeio.itens.length !== cmd.itens.length) return fail(ComprasError.custeioDessincronizado)

    const valorProdutos = itensCusteio.reduce((s, i) => s + i.qtdCompra * i.precoUnitario, 0)
    const valorDesconto = itensCusteio.reduce((s, i) => s + i.desconto, 0)
    const valorImpostos = itensCusteio.reduce((s, i) => s + i.imposto, 0)
    // O valor do DOCUMENTO, não o valor CUSTEADO. A política de custo (incluir ou não o frete,
    // os impostos, os descontos) decide o que compõe o CUSTO do insumo, e não pode mudar quanto
    // o fornecedor cobrou. A Fase 5 (contas a pagar) lê este campo.
    const valorTotal = valorProdutos - valorDesconto + (cmd.valorFrete ?? 0) + valorImpostos

    // --- escrita. A nota nasce em `rascunho` e só vira `lancada` depois que TODOS os
    // movimentos entraram. Se um falhar, ela fica em rascunho, visível, e o erro manda
    // rodar o replay.
    const notaId = await this.store.insert(ids.notas_de_entrada, {
      numero: cmd.numero,
      serie: cmd.serie ?? null,
      fornecedor: cmd.fornecedorId,
      pedido: pedidoId,
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

    for (const [i, custeado] of custeio.itens.entries()) {
      const entrada = cmd.itens[i]
      // Não pode acontecer (índice confirmado acima); se acontecer mesmo assim, não adivinha
      // qual preço vai em qual linha.
      if (!entrada) return fail(ComprasError.custeioDessincronizado)
      await this.store.insert(ids.itens_nota_entrada, {
        nota: notaId,
        insumo: custeado.insumoId,
        qtd: custeado.qtdCompra,
        preco_unitario: entrada.precoUnitario,
        desconto: entrada.desconto ?? 0,
        imposto: entrada.imposto ?? 0,
        frete_rateado: custeado.freteRateado,
        custo_unitario_final: custeado.custoUnitarioFinal,
      })
    }

    // --- empurra as entradas para o estoque, JÁ em unidade de CONSUMO
    const resumoItens: NotaResumo['itens'] = []
    const avisos: string[] = []
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
        // O movimento FOI aceito, mas o estoque pode reportar um erro SUAVE (ex.: a projeção
        // de custo_medio/preco_custo falhou depois de o livro já estar gravado). `preco_custo`
        // é o campo que o `costing` lê como custo do material: se ficou desatualizado, isto
        // NÃO pode passar como sucesso silencioso.
        for (const e of mov.erros) avisos.push(`insumo ${i.insumoId}: ${e}`)
      } catch (e) {
        // A nota fica em RASCUNHO, com movimentos parciais. Falha ALTO, dizendo o que fazer.
        return fail(ComprasError.movimentoParcial(notaId, (e as Error).message))
      }
    }

    // --- tudo entrou: os movimentos JÁ ESTÃO no estoque (é a verdade). Marcar a nota como
    // `lancada` e atualizar o pedido são passos DE PROJEÇÃO: se qualquer um deles falhar
    // (a nota sumiu entre o insert e este get, um conflito de versão no pedido sob dois
    // lançamentos concorrentes), a operação já SUCEDEU — o estoque moveu e o custo pesou.
    // Falhar aqui faria o chamador repetir e lançar a nota de novo (hoje barrado pela guarda
    // de duplicidade, mas ainda assim: o certo é dizer a verdade). A nota fica em `rascunho`
    // e o erro diz exatamente o que corrigir.
    try {
      const nota = await this.store.get(notaId)
      if (!nota) throw new Error('nota não encontrada logo após ser gravada')
      await this.store.update(notaId, { ...nota.data, status: 'lancada' }, nota.version)
      if (pedidoId) avisos.push(...(await this.atualizarPedido(ids.itens_pedido_compra, pedidoId, cmd.itens)))
    } catch (e) {
      avisos.push(ComprasError.notaNaoFinalizada(notaId, (e as Error).message))
    }

    return ok({ notaId, valorTotal, itens: resumoItens, avisos })
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

  // Acumula a quantidade recebida por LINHA do pedido, CONSUMINDO a quantidade da nota linha
  // a linha (em vez de somá-la em TODAS as linhas do mesmo insumo), e fecha o pedido quando
  // tudo chegou. Entrega parcial é normal: um pedido pode receber VÁRIAS notas.
  private async atualizarPedido(
    itensPedidoId: string,
    pedidoId: string,
    itensNota: LancarNotaEntradaCommand['itens'],
  ): Promise<string[]> {
    const avisos: string[] = []
    const itens = await this.store.query(itensPedidoId, [{ field: 'pedido', op: 'eq', value: pedidoId }], LIMITE)

    // Quantidade recebida por insumo, nesta nota.
    const porInsumo = new Map<string, number>()
    for (const i of itensNota) porInsumo.set(i.insumoId, (porInsumo.get(i.insumoId) ?? 0) + i.qtd)

    // CONSOME a quantidade linha a linha, em vez de somá-la em TODAS as linhas do insumo. Um
    // pedido com o mesmo insumo em duas linhas (50 + 50) recebendo uma nota de 50 fecharia
    // como `recebido` com METADE do material, se a quantidade fosse somada nas duas. Uma
    // linha JÁ completa (nada faltando) é PULADA — não recebe mais nada por cima: senão a
    // nota que completa a segunda metade sobrecarregaria a linha que já estava cheia (a
    // ordem de leitura não é a ordem das linhas) e a outra ficaria `parcial` para sempre.
    for (const item of itens) {
      const insumoId = String(item.data.insumo)
      const disponivel = porInsumo.get(insumoId) ?? 0
      if (disponivel <= 0) continue
      const pedida = num(item.data.qtd)
      const jaRecebida = num(item.data.qtd_recebida)
      const falta = pedida - jaRecebida
      if (falta <= 0) continue
      const aplicar = Math.min(disponivel, falta)
      porInsumo.set(insumoId, disponivel - aplicar)
      await this.store.update(item.id, { ...item.data, qtd_recebida: jaRecebida + aplicar }, item.version)
    }

    // O que sobrou não casou com nenhuma linha do pedido (com espaço): ou o insumo não estava
    // no pedido, ou veio MAIS do que foi pedido. Os dois são sinal de que a nota foi amarrada
    // ao pedido errado — ou de uma entrega maior que a encomendada.
    for (const [insumoId, sobra] of porInsumo) {
      if (sobra > 0) avisos.push(ComprasError.sobraNoPedido(insumoId, sobra))
    }

    // Relê para decidir o status com os valores JÁ atualizados.
    const atualizados = await this.store.query(itensPedidoId, [{ field: 'pedido', op: 'eq', value: pedidoId }], LIMITE)
    const completo = atualizados.every((i) => num(i.data.qtd_recebida) >= num(i.data.qtd))
    const pedido = await this.store.get(pedidoId)
    if (pedido) {
      await this.store.update(pedidoId, { ...pedido.data, status: completo ? 'recebido' : 'parcial' }, pedido.version)
    }
    return avisos
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

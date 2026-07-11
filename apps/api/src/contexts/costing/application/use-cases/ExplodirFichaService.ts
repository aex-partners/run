import { Result, ok, fail } from '@/shared/kernel/Result'
import { EntityRegistry } from '@/contexts/costing/application/ports/out/EntityRegistry'
import { RecordStore, RecordRow } from '@/contexts/costing/application/ports/out/RecordStore'
import { ExplodirFicha, ExplodirFichaCommand, ExplosaoResumo } from '@/contexts/costing/application/ports/in/ExplodirFicha'
import { RoteiroProvider } from '@/contexts/costing/application/ports/out/RoteiroProvider'
import { explodeFicha, FichaLineInput, SkuVariacao, Substituicao } from '@/contexts/costing/domain/Explosion'
import {
  computeConversao, taxasVigentes, totalizarCusto, CONVERSAO_VAZIA,
  CentroInput, ConversaoResult, TaxaRow, TaxaVigente,
} from '@/contexts/costing/domain/Conversao'
import { CostingError } from '@/contexts/costing/domain/CostingError'

const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v ?? 0)) || 0
const parseMap = (v: unknown): Record<string, number> => {
  if (v == null || v === '') return {}
  try { const o = typeof v === 'string' ? JSON.parse(v) : v; return o && typeof o === 'object' ? (o as Record<string, number>) : {} }
  catch { return {} }
}

export class ExplodirFichaService implements ExplodirFicha {
  constructor(
    private readonly store: RecordStore,
    private readonly registry: EntityRegistry,
    private readonly roteiro: RoteiroProvider,
  ) {}

  async execute(cmd: ExplodirFichaCommand): Promise<Result<ExplosaoResumo>> {
    const ids = await this.resolveEntities()
    if (!ids) return fail(CostingError.entidadeFaltando)

    const sku = await this.store.get(cmd.skuId)
    if (!sku) return fail(CostingError.skuNotFound)
    const modeloId = String(sku.data.modelo ?? '')
    if (!modeloId) return fail(CostingError.skuSemModelo)
    const variacaoIds = (Array.isArray(sku.data.variacoes) ? sku.data.variacoes : []).map(String)

    // ficha lines of the modelo, latest published rev
    const fichaRows = await this.store.query(ids.fichas_tecnicas, [
      { field: 'modelo', op: 'eq', value: modeloId },
      { field: 'status', op: 'eq', value: 'publicada' },
    ])
    if (fichaRows.length === 0) return fail(CostingError.semFichaPublicada)
    const maxRev = Math.max(...fichaRows.map((r) => num(r.data.rev)))
    const lines: FichaLineInput[] = []
    // operação que CONSOME cada insumo, alinhada por índice com `lines` (e com
    // result.lines: explodeFicha faz map 1:1 e preserva a ordem).
    const operacaoPorLinha: (string | null)[] = []

    // load the item Produtos referenced by the ficha (for fantasma flag + cost)
    const fichaItemIds = fichaRows.filter((r) => num(r.data.rev) === maxRev).map((r) => String(r.data.item))
    const subs = await this.loadSubs(ids.substituicoes, variacaoIds)
    const paraIds = subs.map((s) => s.paraItemId)
    const produtos = await this.byId([...new Set([...fichaItemIds, ...paraIds])])

    for (const r of fichaRows.filter((r) => num(r.data.rev) === maxRev)) {
      const itemId = String(r.data.item)
      lines.push({
        itemId,
        isFantasma: produtos.get(itemId)?.data.fantasma === true,
        unidade: String(r.data.unidade ?? ''),
        qtyBase: num(r.data.qty_base),
        qtyPorTamanho: parseMap(r.data.qty_por_tamanho),
      })
      operacaoPorLinha.push(String(r.data.operacao ?? '') || null)
    }

    const skuVariacoes = await this.loadVariacoes(variacaoIds)
    const custos: Record<string, number | null> = {}
    for (const [id, p] of produtos) custos[id] = p.data.preco_custo == null ? null : num(p.data.preco_custo)

    const result = explodeFicha({ lines, skuVariacoes, substituicoes: subs, custos })

    // delete stale exploded lines, preserving editado_manual ones (unless forcar)
    const existing = await this.store.query(ids.fichas_explodidas, [{ field: 'sku', op: 'eq', value: cmd.skuId }])
    const manuais = existing.filter((r) => r.data.editado_manual === true)
    const toDelete = cmd.forcar ? existing : existing.filter((r) => r.data.editado_manual !== true)
    for (const r of toDelete) await this.store.delete(r.id)

    // a preserved manual line OVERRIDES the fresh recompute for that same item
    const manualItemIds = new Set((cmd.forcar ? [] : manuais).map((r) => String(r.data.item)))

    // write fresh exploded lines, skipping items already covered by a preserved manual row
    let custoFreshInserted = 0
    let linhasInseridas = 0
    for (const [i, line] of result.lines.entries()) {
      if (!cmd.forcar && manualItemIds.has(line.itemIdResolvido)) continue
      await this.store.insert(ids.fichas_explodidas, {
        sku: cmd.skuId, item: line.itemIdResolvido, qty: line.qty,
        custo_unit: line.custoUnit, custo_total: line.custoTotal, origem_rev: maxRev,
        operacao: operacaoPorLinha[i] ?? null, editado_manual: false,
      })
      custoFreshInserted += line.custoTotal
      linhasInseridas++
    }
    const manuaisPreservados = cmd.forcar ? 0 : manuais.length

    // MATERIAIS = linhas frescas + linhas manuais preservadas (que sobrepõem o recálculo).
    const custoManuais = (cmd.forcar ? [] : manuais).reduce((s, r) => s + num(r.data.custo_total), 0)
    const custoMateriais = custoFreshInserted + custoManuais
    const erros = [...result.erros]

    // CONVERSÃO: MOD + indireto do roteiro publicado do modelo (soft failure se não houver).
    const rp = await this.roteiro.roteiroPublicado(modeloId)
    let conv: ConversaoResult = CONVERSAO_VAZIA
    // As taxas EFETIVAMENTE usadas no cálculo. Calculadas UMA vez e reaproveitadas no
    // payload do snapshot: o histórico se explica por si e NUNCA é recalculado.
    let taxasUsadas: TaxaVigente[] = []
    if (!rp) {
      erros.push('modelo sem roteiro publicado: custo de conversão não calculado')
    } else {
      const taxaRows: TaxaRow[] = (await this.store.query(ids.parametros_de_custo, [])).map((r) => ({
        chave: String(r.data.chave ?? ''),
        centroId: r.data.escopo_centro == null || r.data.escopo_centro === '' ? null : String(r.data.escopo_centro),
        valor: num(r.data.valor),
        vigenciaInicio: String(r.data.vigencia_inicio ?? '1970-01-01'),
        vigenciaFim: r.data.vigencia_fim == null || r.data.vigencia_fim === '' ? null : String(r.data.vigencia_fim),
      }))
      const agora = new Date().toISOString().slice(0, 10)   // YYYY-MM-DD: compara com as datas de vigência
      const centros: Record<string, CentroInput> = {}
      for (const c of rp.centros) centros[c.id] = c
      taxasUsadas = taxasVigentes(taxaRows, agora)
      conv = computeConversao({ operacoes: rp.operacoes, centros, taxas: taxasUsadas, skuVariacoes })
      erros.push(...conv.erros)
    }
    const tot = totalizarCusto(custoMateriais, conv)

    // custos_de_operacao: substitui as linhas deste SKU (não acumula entre re-explosões).
    const antigos = await this.store.query(ids.custos_de_operacao, [{ field: 'sku', op: 'eq', value: cmd.skuId }])
    for (const a of antigos) await this.store.delete(a.id)
    for (const o of conv.operacoes) {
      await this.store.insert(ids.custos_de_operacao, {
        sku: cmd.skuId, operacao: o.operacaoId, centro: o.centroId,
        tempo_min: o.tempoMin, custo_mod: o.custoMod, custo_indireto: o.custoIndireto,
        custo_total: o.custoTotal, origem_rev: rp?.rev ?? 0,
      })
    }

    // update the SKU cost + write a snapshot
    try {
      await this.store.update(cmd.skuId, {
        ...sku.data,
        preco_custo: custoMateriais,            // MATERIAIS (semântica Bling — inalterado)
        custo_conversao: conv.custoConversao,
        custo_unitario_total: tot.total,
        tempo_total_min: conv.tempoTotalMin,
      }, sku.version)
    } catch (e) {
      erros.push(`custo calculado mas não salvo em Produtos: ${(e as Error).message}`)
    }
    await this.store.insert(ids.snapshots_custo, {
      sku: cmd.skuId, data: new Date().toISOString(),
      custo_total: tot.total,                   // CHEIO: materiais + MOD + indireto
      custo_materiais: custoMateriais,
      custo_mod: conv.custoMod,
      custo_indireto: conv.custoIndireto,
      tempo_total_min: conv.tempoTotalMin,
      origem_rev: maxRev,
      origem_rev_roteiro: rp?.rev ?? 0,
      detalhe: JSON.stringify(result.lines),
      detalhe_conversao: JSON.stringify({ operacoes: conv.operacoes, taxas: taxasUsadas }),
    })

    return ok({
      skuId: cmd.skuId,
      custoMateriais,
      custoMod: conv.custoMod,
      custoIndireto: conv.custoIndireto,
      custoTotal: tot.total,
      tempoTotalMin: conv.tempoTotalMin,
      linhas: linhasInseridas + manuaisPreservados,
      erros,
      manuaisPreservados,
    })
  }

  private async resolveEntities() {
    const slugs = [
      'produtos', 'modelos', 'variacoes', 'fichas_tecnicas', 'substituicoes', 'fichas_explodidas',
      'snapshots_custo', 'parametros_de_custo', 'custos_de_operacao',
    ] as const
    const out = {} as Record<(typeof slugs)[number], string>
    for (const s of slugs) {
      const id = await this.registry.entityIdBySlug(s)
      if (!id) return null
      out[s] = id
    }
    return out
  }
  private async loadSubs(entityId: string, variacaoIds: string[]): Promise<Substituicao[]> {
    if (variacaoIds.length === 0) return []
    const rows = await this.store.query(entityId, [{ field: 'variacao', op: 'in', values: variacaoIds }])
    return rows.map((r) => ({ variacaoId: String(r.data.variacao), deItemId: String(r.data.de_item), paraItemId: String(r.data.para_item) }))
  }
  private async loadVariacoes(ids: string[]): Promise<SkuVariacao[]> {
    const rows: SkuVariacao[] = []
    for (const id of ids) {
      const r = await this.store.get(id)
      if (r) rows.push({ id: r.id, fatorQtd: r.data.fator_qtd == null ? null : num(r.data.fator_qtd) })
    }
    return rows
  }
  private async byId(ids: string[]): Promise<Map<string, RecordRow>> {
    const map = new Map<string, RecordRow>()
    for (const id of ids) {
      const r = await this.store.get(id)
      if (r) map.set(r.id, r)
    }
    return map
  }
}

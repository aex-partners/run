import { Result, ok, fail } from '@/shared/kernel/Result'
import { EntityRegistry } from '@/contexts/precificacao/application/ports/out/EntityRegistry'
import { RecordStore } from '@/contexts/precificacao/application/ports/out/RecordStore'
import { GerarPrecos } from '@/contexts/precificacao/application/ports/in/GerarPrecos'
import { custearPreco, Componentes } from '@/contexts/precificacao/domain/Marcacao'
import { PrecificacaoError } from '@/contexts/precificacao/domain/PrecificacaoError'

const LIMITE = 500
const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v ?? 0)) || 0

export class GerarPrecosService implements GerarPrecos {
  constructor(private readonly store: RecordStore, private readonly registry: EntityRegistry) {}

  async execute(cmd: { skuId?: string; modeloId?: string; skuIds?: string[] }): Promise<Result<{ gravados: number; erros: string[] }>> {
    const ids = await this.resolveEntities()
    if (!ids) return fail(PrecificacaoError.entidadeFaltando)

    // alvo (espelha RecalcularCusto)
    const skuIds: string[] = []
    if (cmd.skuId) skuIds.push(cmd.skuId)
    else if (cmd.skuIds) { if (cmd.skuIds.length === 0) return fail(PrecificacaoError.listaVazia); skuIds.push(...cmd.skuIds) }
    else if (cmd.modeloId) {
      const rows = await this.store.query(ids.produtos, [{ field: 'modelo', op: 'eq', value: cmd.modeloId }], LIMITE)
      skuIds.push(...rows.map((r) => r.id))
    } else return fail(PrecificacaoError.informeAlvo)

    // política global, uma vez
    const canais = (await this.store.query(ids.canais, [], LIMITE)).filter((c) => c.data.ativo === true)
    if (canais.length === 0) return fail(PrecificacaoError.semCanaisAtivos)
    const condicoes = await this.store.query(ids.condicoes, [], LIMITE)
    if (condicoes.length === 0) return fail(PrecificacaoError.semCondicoes)
    const par = (await this.store.query(ids.parametros, [], LIMITE))[0]
    const imposto = num(par?.data.imposto), iss = num(par?.data.iss)
    const erros: string[] = []
    if (!par) erros.push(PrecificacaoError.semImposto)

    // cache das políticas (modelo, canal) -> lucro
    const politicas = await this.store.query(ids.politica, [], LIMITE)
    const lucroDe = (modeloId: string, canalId: string): number | null => {
      const p = politicas.find((x) => String(x.data.modelo) === modeloId && String(x.data.canal) === canalId)
      return p ? num(p.data.lucro_alvo) : null
    }

    let gravados = 0
    for (const skuId of skuIds) {
      const sku = await this.store.get(skuId)
      if (!sku) { erros.push(`SKU ${skuId} não encontrado`); continue }
      const custo = num(sku.data.custo_unitario_total)
      if (!(custo > 0)) { erros.push(`SKU ${skuId} sem custo real (custo_unitario_total=${custo}): não precificado`); continue }
      const modeloId = String(sku.data.modelo ?? '')

      // substitui as linhas anteriores DESTE sku (não acumula)
      const antigas = await this.store.query(ids.precos, [{ field: 'sku', op: 'eq', value: skuId }], LIMITE)
      for (const a of antigas) await this.store.delete(a.id)

      for (const canal of canais) {
        const lucro = lucroDe(modeloId, canal.id) ?? 0
        if (lucroDe(modeloId, canal.id) === null) erros.push(`sem política de lucro para (modelo ${modeloId}, canal ${canal.data.nome}): usando lucro 0`)
        for (const cond of condicoes) {
          const comp: Componentes = {
            imposto, iss, comissao: num(canal.data.comissao), despFinanceira: num(cond.data.desp_financeira),
            frete: num(canal.data.frete), lucro,
          }
          const r = custearPreco(custo, comp)
          if (!r.ok) { erros.push(`SKU ${skuId} / ${canal.data.nome} / ${cond.data.nome}: ${r.error}`); continue }
          await this.store.insert(ids.precos, {
            sku: skuId, canal: canal.id, condicao: cond.id, preco: r.value.pv, lucro_usado: lucro,
            custo_base: custo, componentes: JSON.stringify(comp), data: new Date().toISOString(),
          })
          gravados++
        }
      }
    }
    return ok({ gravados, erros })
  }

  private async resolveEntities() {
    const slugs = ['produtos', 'canais_de_venda', 'condicoes_pagamento', 'parametros_de_preco', 'politica_de_preco', 'precos_de_venda'] as const
    const out = {} as Record<'produtos'|'canais'|'condicoes'|'parametros'|'politica'|'precos', string>
    const map: Record<string, keyof typeof out> = {
      produtos: 'produtos', canais_de_venda: 'canais', condicoes_pagamento: 'condicoes',
      parametros_de_preco: 'parametros', politica_de_preco: 'politica', precos_de_venda: 'precos',
    }
    for (const s of slugs) { const id = await this.registry.entityIdBySlug(s); if (!id) return null; out[map[s]!] = id }
    return out
  }
}

import { Json } from '@/shared/domain/Json'
import { ok, fail } from '@/shared/kernel/Result'
import { ToolDefinition } from '@/platform/ai-runtime/tool'
import { DefinirCanal } from '@/contexts/precificacao/application/ports/in/DefinirCanal'
import { asObject, optString, reqString, reqPercent, optPercent, optBoolean } from '@/contexts/precificacao/adapters/in/mcp/precificacaoInput'

export const definirCanalTool = (uc: DefinirCanal): ToolDefinition => ({
  name: 'definir_canal',
  readOnly: false,
  description:
    'Cria ou atualiza um canal de venda (ex.: loja física, marketplace, e-commerce). ' +
    'Input: { id?: string, nome: string, comissao: number, frete?: number, ativo?: boolean }. ' +
    'comissao e frete são FRAÇÃO em [0,1]: 10% é 0,10, não 10. Sem id, cria um canal novo; com id, atualiza o existente (frete/ativo mantêm o padrão quando omitidos). ' +
    'Retorna { id }.',
  async execute(input: Json) {
    const obj = asObject('definir_canal', input)
    if (!obj.ok) return fail(obj.error)
    const id = optString('definir_canal', obj.value, 'id')
    if (!id.ok) return fail(id.error)
    const nome = reqString('definir_canal', obj.value, 'nome')
    if (!nome.ok) return fail(nome.error)
    const comissao = reqPercent('definir_canal', obj.value, 'comissao')
    if (!comissao.ok) return fail(comissao.error)
    const frete = optPercent('definir_canal', obj.value, 'frete')
    if (!frete.ok) return fail(frete.error)
    const ativo = optBoolean('definir_canal', obj.value, 'ativo')
    if (!ativo.ok) return fail(ativo.error)

    const r = await uc.execute({
      id: id.value,
      nome: nome.value,
      comissao: comissao.value,
      frete: frete.value,
      ativo: ativo.value,
    })
    return r.ok ? ok({ ...r.value }) : fail(r.error)
  },
})

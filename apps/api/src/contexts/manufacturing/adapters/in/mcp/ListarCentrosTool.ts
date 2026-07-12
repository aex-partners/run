import { Json } from '@/shared/domain/Json'
import { ok } from '@/shared/kernel/Result'
import { ToolDefinition } from '@/platform/ai-runtime/tool'
import { ListarCentros } from '@/contexts/manufacturing/application/ports/in/ListarCentros'

// Driving adapter for the AI (Eric). Read-only (readOnly: true) -> auto-executes, no
// confirmation. Existe para fechar um buraco de usabilidade: `definir_centro_trabalho`
// devolve só o id, e sem uma listagem com nome/setor não há como REACHAR o id de um centro
// já cadastrado — que é o `centroId` exigido por `definir_operacao`. Não recebe input.
export const listarCentrosTool = (uc: ListarCentros): ToolDefinition => ({
  name: 'listar_centros',
  readOnly: true,
  description:
    'Lista os centros de trabalho (células/setores produtivos) cadastrados. Sem input. Retorna { centros: [{ id, nome, setor, custoMinMod }] }. Use para descobrir o `id` de um centro pelo nome/setor — é esse id que vai em `centroId` de definir_operacao. custoMinMod = custo de mão de obra direta por MINUTO (R$/min).',
  async execute(_input: Json) {
    const centros = await uc.execute()
    return ok({
      centros: centros.map((c) => ({
        id: c.id, nome: c.nome, setor: c.setor, custoMinMod: c.custoMinMod,
      })),
    })
  },
})

// Process-engineering data model: work centers + the per-Modelo routing.
// Every displayName slugifies exactly to its declared slug (locked by the test).
import { EntitySpec } from '@/scripts/schemaSpec'

export const MANUFACTURING_ENTITIES: EntitySpec[] = [
  {
    slug: 'centros_de_trabalho',
    displayName: 'Centros de Trabalho',
    fields: [
      { slug: 'nome', displayName: 'Nome', kind: 'text' },
      { slug: 'setor', displayName: 'Setor', kind: 'select',
        options: ['corte', 'preparacao', 'costura', 'acabamento', 'bordado'] },
      // R$ por MINUTO de mão de obra direta, derivado da folha. 4 casas: 0,2805.
      { slug: 'custo_min_mod', displayName: 'Custo min MOD', kind: 'currency', decimalPlaces: 4 },
      { slug: 'capacidade_min_dia', displayName: 'Capacidade min dia', kind: 'number' },
      { slug: 'num_operadores', displayName: 'Num operadores', kind: 'number' },
      { slug: 'ativo', displayName: 'Ativo', kind: 'boolean' },
    ],
  },
  {
    slug: 'operacoes',
    displayName: 'Operações',
    fields: [
      { slug: 'modelo', displayName: 'Modelo', kind: 'relation', targetSlug: 'modelos' },
      // IDENTIDADE ESTÁVEL da operação DENTRO do modelo (CORTE, COSTURA, ACABAMENTO...).
      // Cada revisão cria LINHAS novas de `operacoes`, então o id da linha morre a cada
      // revisão: é o `codigo` que sobrevive (preservado no clone de abrir_revisao_roteiro).
      // É por ele que a linha da ficha técnica atribui o insumo à operação que o consome
      // (fichas_tecnicas.operacao_codigo), e NÃO pelo id da linha da revisão.
      { slug: 'codigo', displayName: 'Codigo', kind: 'text' },
      { slug: 'seq', displayName: 'Seq', kind: 'number' },
      { slug: 'nome', displayName: 'Nome', kind: 'text' },
      { slug: 'centro', displayName: 'Centro', kind: 'relation', targetSlug: 'centros_de_trabalho' },
      { slug: 'tempo_padrao_min', displayName: 'Tempo padrao min', kind: 'duration' },
      // JSON string: { [variacaoTamanhoId]: minutos } — overrides por tamanho.
      { slug: 'tempo_por_tamanho', displayName: 'Tempo por tamanho', kind: 'long_text' },
      { slug: 'tempo_setup_min', displayName: 'Tempo setup min', kind: 'duration' },
      { slug: 'lote_setup', displayName: 'Lote setup', kind: 'number' },
      // true = uma linha agregada por setor (o que eles medem hoje). Refinar = publicar
      // uma rev nova com várias linhas agregada=false. Sem migração.
      { slug: 'agregada', displayName: 'Agregada', kind: 'boolean' },
      { slug: 'rev', displayName: 'Rev', kind: 'number' },
      { slug: 'status', displayName: 'Status', kind: 'select', options: ['rascunho', 'publicada'] },
    ],
  },
]

// Assembles the MCP ToolDefinition[] the AI runtime exposes. Each tool is a
// driving adapter over a context in-port (the same in-port the tRPC controller
// uses). The composition root turns this list into the assistant ToolBox.
import { ToolDefinition } from '@/platform/ai-runtime/tool'

import { CreateEntity } from '@/contexts/data/application/ports/in/CreateEntity'
import { InsertRecord } from '@/contexts/data/application/ports/in/InsertRecord'
import { UpdateRecord } from '@/contexts/data/application/ports/in/UpdateRecord'
import { DeleteRecord } from '@/contexts/data/application/ports/in/DeleteRecord'
import { DescribeEntity } from '@/contexts/data/application/ports/in/DescribeEntity'
import { ListEntities } from '@/contexts/data/application/queries/ListEntities'
import { QueryRecords } from '@/contexts/data/application/queries/QueryRecords'
import { createEntityTool } from '@/contexts/data/adapters/in/mcp/CreateEntityTool'
import { insertRecordTool } from '@/contexts/data/adapters/in/mcp/InsertRecordTool'
import { updateRecordTool } from '@/contexts/data/adapters/in/mcp/UpdateRecordTool'
import { deleteRecordTool } from '@/contexts/data/adapters/in/mcp/DeleteRecordTool'
import { describeEntityTool } from '@/contexts/data/adapters/in/mcp/DescribeEntityTool'
import { listEntitiesTool } from '@/contexts/data/adapters/in/mcp/ListEntitiesTool'
import { queryTool } from '@/contexts/data/adapters/in/mcp/QueryTool'

import { CreateKnowledge } from '@/contexts/knowledge/application/ports/in/CreateKnowledge'
import { QueryKnowledge } from '@/contexts/knowledge/application/ports/in/QueryKnowledge'
import { DeleteKnowledge } from '@/contexts/knowledge/application/ports/in/DeleteKnowledge'
import { saveKnowledgeTool } from '@/contexts/knowledge/adapters/in/mcp/SaveKnowledgeTool'
import { queryKnowledgeTool } from '@/contexts/knowledge/adapters/in/mcp/QueryKnowledgeTool'
import { deleteKnowledgeTool } from '@/contexts/knowledge/adapters/in/mcp/DeleteKnowledgeTool'

import { CreateCharge } from '@/contexts/payments/application/ports/in/CreateCharge'
import { GetCharge } from '@/contexts/payments/application/ports/in/GetCharge'
import { CreatePaymentLink } from '@/contexts/payments/application/ports/in/CreatePaymentLink'
import { CreateBoleto } from '@/contexts/payments/application/ports/in/CreateBoleto'
import { createChargeTool } from '@/contexts/payments/adapters/in/mcp/CreateChargeTool'
import { getChargeTool } from '@/contexts/payments/adapters/in/mcp/GetChargeTool'
import { createPaymentLinkTool } from '@/contexts/payments/adapters/in/mcp/CreatePaymentLinkTool'
import { criarBoletoTool } from '@/contexts/payments/adapters/in/mcp/CriarBoletoTool'

import { EmitNfe } from '@/contexts/fiscal/application/ports/in/EmitNfe'
import { EmitNfce } from '@/contexts/fiscal/application/ports/in/EmitNfce'
import { emitirNfeTool } from '@/contexts/fiscal/adapters/in/mcp/EmitirNfeTool'
import { emitirNfceTool } from '@/contexts/fiscal/adapters/in/mcp/EmitirNfceTool'

import { ListBlingResource } from '@/contexts/bling/application/ports/in/ListBlingResource'
import { GetBlingRecord } from '@/contexts/bling/application/ports/in/GetBlingRecord'
import { listProdutosTool } from '@/contexts/bling/adapters/in/mcp/ListProdutosTool'
import { listPedidosTool } from '@/contexts/bling/adapters/in/mcp/ListPedidosTool'
import { buscarContatoTool } from '@/contexts/bling/adapters/in/mcp/BuscarContatoTool'

import { ExplodirFicha } from '@/contexts/costing/application/ports/in/ExplodirFicha'
import { RecalcularCusto } from '@/contexts/costing/application/ports/in/RecalcularCusto'
import { PublicarRevisao } from '@/contexts/costing/application/ports/in/PublicarRevisao'
import { HistoricoCusto } from '@/contexts/costing/application/ports/in/HistoricoCusto'
import { DefinirTaxaCusto } from '@/contexts/costing/application/ports/in/DefinirTaxaCusto'
import { CustoUnitario } from '@/contexts/costing/application/ports/in/CustoUnitario'
import { explodirFichaTool } from '@/contexts/costing/adapters/in/mcp/ExplodirFichaTool'
import { recalcularCustoTool } from '@/contexts/costing/adapters/in/mcp/RecalcularCustoTool'
import { publicarRevisaoTool } from '@/contexts/costing/adapters/in/mcp/PublicarRevisaoTool'
import { historicoCustoTool } from '@/contexts/costing/adapters/in/mcp/HistoricoCustoTool'
import { definirTaxaCustoTool } from '@/contexts/costing/adapters/in/mcp/DefinirTaxaCustoTool'
import { custoUnitarioTool } from '@/contexts/costing/adapters/in/mcp/CustoUnitarioTool'

import { ObterRoteiro } from '@/contexts/manufacturing/application/ports/in/ObterRoteiro'
import { DefinirCentro } from '@/contexts/manufacturing/application/ports/in/DefinirCentro'
import { ListarCentros } from '@/contexts/manufacturing/application/ports/in/ListarCentros'
import { DefinirOperacao } from '@/contexts/manufacturing/application/ports/in/DefinirOperacao'
import { PublicarRoteiro } from '@/contexts/manufacturing/application/ports/in/PublicarRoteiro'
import { AbrirRevisaoRoteiro } from '@/contexts/manufacturing/application/ports/in/AbrirRevisaoRoteiro'
import { obterRoteiroTool } from '@/contexts/manufacturing/adapters/in/mcp/ObterRoteiroTool'
import { definirCentroTool } from '@/contexts/manufacturing/adapters/in/mcp/DefinirCentroTool'
import { listarCentrosTool } from '@/contexts/manufacturing/adapters/in/mcp/ListarCentrosTool'
import { definirOperacaoTool } from '@/contexts/manufacturing/adapters/in/mcp/DefinirOperacaoTool'
import { publicarRoteiroTool } from '@/contexts/manufacturing/adapters/in/mcp/PublicarRoteiroTool'
import { abrirRevisaoRoteiroTool } from '@/contexts/manufacturing/adapters/in/mcp/AbrirRevisaoRoteiroTool'

export interface McpToolDeps {
  // data in-ports
  createEntity: CreateEntity
  insertRecord: InsertRecord
  updateRecord: UpdateRecord
  deleteRecord: DeleteRecord
  describeEntity: DescribeEntity
  listEntities: ListEntities
  queryRecords: QueryRecords
  // knowledge in-ports (the knowledge tools carry the acting user)
  createKnowledge: CreateKnowledge
  queryKnowledge: QueryKnowledge
  deleteKnowledge: DeleteKnowledge
  knowledgeUserId: string
  // payments in-ports (PagSeguro charges + payment links; Sicredi boletos)
  createCharge: CreateCharge
  getCharge: GetCharge
  createPaymentLink: CreatePaymentLink
  createBoleto: CreateBoleto
  // fiscal in-ports (NF-e modelo 55 + NFC-e modelo 65, direct to SEFAZ)
  emitNfe: EmitNfe
  emitNfce: EmitNfce
  // bling in-ports (read-only ERP: produtos / pedidos / contatos, via Bling v3)
  listBlingResource: ListBlingResource
  getBlingRecord: GetBlingRecord
  // costing in-ports (ficha técnica explosion + cost snapshots + taxas/custo unitário)
  explodirFicha: ExplodirFicha
  recalcularCusto: RecalcularCusto
  publicarRevisao: PublicarRevisao
  historicoCusto: HistoricoCusto
  definirTaxaCusto: DefinirTaxaCusto
  custoUnitario: CustoUnitario
  // manufacturing in-ports (centros de trabalho + roteiro de produção)
  obterRoteiro: ObterRoteiro
  definirCentro: DefinirCentro
  listarCentros: ListarCentros
  definirOperacao: DefinirOperacao
  publicarRoteiro: PublicarRoteiro
  abrirRevisaoRoteiro: AbrirRevisaoRoteiro
}

export function assembleMcpTools(deps: McpToolDeps): ToolDefinition[] {
  return [
    // data
    createEntityTool(deps.createEntity),
    insertRecordTool(deps.insertRecord),
    updateRecordTool(deps.updateRecord),
    deleteRecordTool(deps.deleteRecord),
    describeEntityTool(deps.describeEntity),
    listEntitiesTool(deps.listEntities),
    queryTool(deps.queryRecords),
    // knowledge
    saveKnowledgeTool(deps.createKnowledge, deps.knowledgeUserId),
    queryKnowledgeTool(deps.queryKnowledge, deps.knowledgeUserId),
    deleteKnowledgeTool(deps.deleteKnowledge, deps.knowledgeUserId),
    // payments
    createChargeTool(deps.createCharge),
    getChargeTool(deps.getCharge),
    createPaymentLinkTool(deps.createPaymentLink),
    criarBoletoTool(deps.createBoleto),
    // fiscal
    emitirNfeTool(deps.emitNfe),
    emitirNfceTool(deps.emitNfce),
    // bling
    listProdutosTool(deps.listBlingResource),
    listPedidosTool(deps.listBlingResource),
    buscarContatoTool(deps.listBlingResource, deps.getBlingRecord),
    // costing
    explodirFichaTool(deps.explodirFicha),
    recalcularCustoTool(deps.recalcularCusto),
    publicarRevisaoTool(deps.publicarRevisao),
    historicoCustoTool(deps.historicoCusto),
    // costing (processo): taxas de custo + leitura do custo unitário aberto
    definirTaxaCustoTool(deps.definirTaxaCusto),
    custoUnitarioTool(deps.custoUnitario),
    // manufacturing (centros de trabalho + roteiro de produção)
    obterRoteiroTool(deps.obterRoteiro),
    definirCentroTool(deps.definirCentro),
    listarCentrosTool(deps.listarCentros),
    definirOperacaoTool(deps.definirOperacao),
    publicarRoteiroTool(deps.publicarRoteiro),
    abrirRevisaoRoteiroTool(deps.abrirRevisaoRoteiro),
  ]
}

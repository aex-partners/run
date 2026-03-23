/**
 * PT-BR translations for entity names, descriptions, field names, and select options.
 * Used at entity creation time (setup) to store localized values in the DB.
 */

import type { EntityKnowledge, FieldDefinition } from "./entity-knowledge.js";

interface FieldTranslation {
  name: string;
  options?: Record<string, string>;
}

interface EntityTranslation {
  name: string;
  description: string;
  fields: Record<string, FieldTranslation>;
}

const ptBR: Record<string, EntityTranslation> = {
  Leads: {
    name: "Leads",
    description: "Potenciais clientes captados de diversos canais antes de se tornarem clientes pagantes.",
    fields: {
      Name: { name: "Nome" },
      Email: { name: "E-mail" },
      Phone: { name: "Telefone" },
      Source: {
        name: "Origem",
        options: { Website: "Site", Referral: "Indicação", "Social Media": "Redes Sociais", "Cold Call": "Ligação Fria", Event: "Evento", Other: "Outro" },
      },
      Status: {
        name: "Status",
        options: { New: "Novo", Contacted: "Contatado", Qualified: "Qualificado", Unqualified: "Não Qualificado" },
      },
      Notes: { name: "Observações" },
    },
  },
  Deals: {
    name: "Negócios",
    description: "Oportunidades de venda ativas acompanhadas por etapas do pipeline até o fechamento.",
    fields: {
      Title: { name: "Título" },
      Value: { name: "Valor" },
      Stage: {
        name: "Etapa",
        options: { Prospecting: "Prospecção", Qualification: "Qualificação", Proposal: "Proposta", Negotiation: "Negociação", "Closed Won": "Fechado Ganho", "Closed Lost": "Fechado Perdido" },
      },
      Contact: { name: "Contato" },
      "Expected Close": { name: "Previsão de Fechamento" },
      Notes: { name: "Observações" },
    },
  },
  Quotations: {
    name: "Cotações",
    description: "Propostas formais de preço enviadas a clientes antes da confirmação do pedido.",
    fields: {
      Number: { name: "Número" },
      Client: { name: "Cliente" },
      Date: { name: "Data" },
      "Valid Until": { name: "Válido Até" },
      Total: { name: "Total" },
      Status: {
        name: "Status",
        options: { Draft: "Rascunho", Sent: "Enviada", Accepted: "Aceita", Rejected: "Rejeitada", Expired: "Expirada" },
      },
      Notes: { name: "Observações" },
    },
  },
  Customers: {
    name: "Clientes",
    description: "Clientes ativos com informações de contato e histórico de relacionamento.",
    fields: {
      Name: { name: "Nome" },
      Email: { name: "E-mail" },
      Phone: { name: "Telefone" },
      Company: { name: "Empresa" },
      Address: { name: "Endereço" },
      Segment: {
        name: "Segmento",
        options: { Individual: "Pessoa Física", "Small Business": "Pequena Empresa", Enterprise: "Grande Empresa" },
      },
      Notes: { name: "Observações" },
    },
  },
  Orders: {
    name: "Pedidos",
    description: "Pedidos de venda acompanhando o ciclo desde a criação até a entrega.",
    fields: {
      Number: { name: "Número" },
      Customer: { name: "Cliente" },
      Date: { name: "Data" },
      Total: { name: "Total" },
      Status: {
        name: "Status",
        options: { Pending: "Pendente", Processing: "Em Processamento", Shipped: "Enviado", Delivered: "Entregue", Cancelled: "Cancelado" },
      },
      Tracking: { name: "Rastreamento" },
      Notes: { name: "Observações" },
    },
  },
  Commissions: {
    name: "Comissões",
    description: "Cálculos de comissão de vendas vinculados a negócios e vendedores.",
    fields: {
      Salesperson: { name: "Vendedor" },
      Deal: { name: "Negócio" },
      Amount: { name: "Valor" },
      Rate: { name: "Taxa" },
      Date: { name: "Data" },
      Status: {
        name: "Status",
        options: { Pending: "Pendente", Approved: "Aprovada", Paid: "Paga" },
      },
      Notes: { name: "Observações" },
    },
  },

  // ── Finance ────────────────────────────────────────────────────────
  Receivables: {
    name: "Contas a Receber",
    description: "Valores devidos à empresa por clientes, rastreados por fatura.",
    fields: {
      Invoice: { name: "Fatura" },
      Customer: { name: "Cliente" },
      Amount: { name: "Valor" },
      "Due Date": { name: "Vencimento" },
      Status: {
        name: "Status",
        options: { Open: "Em Aberto", Partial: "Parcial", Paid: "Pago", Overdue: "Vencido" },
      },
      "Paid Amount": { name: "Valor Pago" },
      Notes: { name: "Observações" },
    },
  },
  Payables: {
    name: "Contas a Pagar",
    description: "Valores que a empresa deve a fornecedores.",
    fields: {
      Bill: { name: "Boleto" },
      Vendor: { name: "Fornecedor" },
      Amount: { name: "Valor" },
      "Due Date": { name: "Vencimento" },
      Status: {
        name: "Status",
        options: { Open: "Em Aberto", Partial: "Parcial", Paid: "Pago", Overdue: "Vencido" },
      },
      "Paid Amount": { name: "Valor Pago" },
      Notes: { name: "Observações" },
    },
  },
  "Cash Flow": {
    name: "Fluxo de Caixa",
    description: "Registro diário de entradas e saídas financeiras do negócio.",
    fields: {
      Date: { name: "Data" },
      Description: { name: "Descrição" },
      Type: {
        name: "Tipo",
        options: { Income: "Receita", Expense: "Despesa" },
      },
      Category: { name: "Categoria" },
      Amount: { name: "Valor" },
      Balance: { name: "Saldo" },
      Notes: { name: "Observações" },
    },
  },
  Expenses: {
    name: "Despesas",
    description: "Despesas do negócio categorizadas para controle e reembolso.",
    fields: {
      Date: { name: "Data" },
      Description: { name: "Descrição" },
      Category: {
        name: "Categoria",
        options: { Travel: "Viagem", Office: "Escritório", Software: "Software", Marketing: "Marketing", Utilities: "Utilidades", Other: "Outro" },
      },
      Amount: { name: "Valor" },
      "Paid By": { name: "Pago Por" },
      Receipt: { name: "Comprovante" },
      Notes: { name: "Observações" },
    },
  },
  "Tax Obligations": {
    name: "Obrigações Fiscais",
    description: "Prazos fiscais, declarações e acompanhamento de pagamentos.",
    fields: {
      Name: { name: "Nome" },
      Type: { name: "Tipo" },
      Period: { name: "Período" },
      "Due Date": { name: "Vencimento" },
      Amount: { name: "Valor" },
      Status: {
        name: "Status",
        options: { Pending: "Pendente", Filed: "Declarado", Paid: "Pago" },
      },
      Notes: { name: "Observações" },
    },
  },
  Budgets: {
    name: "Orçamentos",
    description: "Alocações orçamentárias por departamento com acompanhamento planejado vs realizado.",
    fields: {
      Department: { name: "Departamento" },
      Period: { name: "Período" },
      Planned: { name: "Planejado" },
      Actual: { name: "Realizado" },
      Variance: { name: "Variação" },
      Status: {
        name: "Status",
        options: { Draft: "Rascunho", Active: "Ativo", Closed: "Encerrado" },
      },
      Notes: { name: "Observações" },
    },
  },

  // ── Inventory ──────────────────────────────────────────────────────
  Inventory: {
    name: "Estoque",
    description: "Níveis atuais de estoque dos produtos com alertas de estoque mínimo.",
    fields: {
      Product: { name: "Produto" },
      SKU: { name: "SKU" },
      Quantity: { name: "Quantidade" },
      "Min Stock": { name: "Estoque Mínimo" },
      Location: { name: "Localização" },
      "Last Updated": { name: "Última Atualização" },
      Notes: { name: "Observações" },
    },
  },
  "Purchase Orders": {
    name: "Ordens de Compra",
    description: "Pedidos feitos a fornecedores para repor estoque.",
    fields: {
      Number: { name: "Número" },
      Supplier: { name: "Fornecedor" },
      Date: { name: "Data" },
      Total: { name: "Total" },
      Status: {
        name: "Status",
        options: { Draft: "Rascunho", Sent: "Enviada", Confirmed: "Confirmada", Received: "Recebida", Cancelled: "Cancelada" },
      },
      "Delivery Date": { name: "Data de Entrega" },
      Notes: { name: "Observações" },
    },
  },
  Suppliers: {
    name: "Fornecedores",
    description: "Cadastro de fornecedores com informações de contato e condições de pagamento.",
    fields: {
      Name: { name: "Nome" },
      Contact: { name: "Contato" },
      Email: { name: "E-mail" },
      Phone: { name: "Telefone" },
      Address: { name: "Endereço" },
      "Payment Terms": { name: "Condições de Pagamento" },
      Notes: { name: "Observações" },
    },
  },
  Products: {
    name: "Produtos",
    description: "Catálogo de produtos com preços, custos e categorização.",
    fields: {
      Name: { name: "Nome" },
      SKU: { name: "SKU" },
      Category: { name: "Categoria" },
      Price: { name: "Preço" },
      Cost: { name: "Custo" },
      Description: { name: "Descrição" },
      Active: { name: "Ativo" },
    },
  },
  Warehouses: {
    name: "Armazéns",
    description: "Locais de armazenamento com controle de capacidade.",
    fields: {
      Name: { name: "Nome" },
      Location: { name: "Localização" },
      Capacity: { name: "Capacidade" },
      Used: { name: "Utilizado" },
      Manager: { name: "Responsável" },
      Notes: { name: "Observações" },
    },
  },
  "Inventory Audits": {
    name: "Inventários Físicos",
    description: "Contagens periódicas de estoque e rastreamento de divergências.",
    fields: {
      Date: { name: "Data" },
      Location: { name: "Localização" },
      Auditor: { name: "Auditor" },
      Status: {
        name: "Status",
        options: { Planned: "Planejado", "In Progress": "Em Andamento", Completed: "Concluído" },
      },
      Discrepancies: { name: "Divergências" },
      Notes: { name: "Observações" },
    },
  },

  // ── HR ─────────────────────────────────────────────────────────────
  Employees: {
    name: "Funcionários",
    description: "Registros de funcionários com contato, departamento e status de emprego.",
    fields: {
      Name: { name: "Nome" },
      Email: { name: "E-mail" },
      Phone: { name: "Telefone" },
      Department: { name: "Departamento" },
      Position: { name: "Cargo" },
      "Hire Date": { name: "Data de Admissão" },
      Status: {
        name: "Status",
        options: { Active: "Ativo", "On Leave": "Afastado", Terminated: "Desligado" },
      },
      Notes: { name: "Observações" },
    },
  },
  Attendance: {
    name: "Frequência",
    description: "Controle diário de ponto com entrada/saída e horas trabalhadas.",
    fields: {
      Employee: { name: "Funcionário" },
      Date: { name: "Data" },
      "Clock In": { name: "Entrada" },
      "Clock Out": { name: "Saída" },
      Hours: { name: "Horas" },
      Status: {
        name: "Status",
        options: { Present: "Presente", Absent: "Ausente", Late: "Atrasado", "Half Day": "Meio Período" },
      },
      Notes: { name: "Observações" },
    },
  },
  Payroll: {
    name: "Folha de Pagamento",
    description: "Processamento mensal de salários com base, descontos e líquido.",
    fields: {
      Employee: { name: "Funcionário" },
      Period: { name: "Período" },
      "Base Salary": { name: "Salário Base" },
      Deductions: { name: "Descontos" },
      "Net Pay": { name: "Salário Líquido" },
      Status: {
        name: "Status",
        options: { Draft: "Rascunho", Processed: "Processado", Paid: "Pago" },
      },
      "Payment Date": { name: "Data de Pagamento" },
    },
  },
  "Leave Requests": {
    name: "Solicitações de Férias",
    description: "Solicitações de afastamento com fluxo de aprovação.",
    fields: {
      Employee: { name: "Funcionário" },
      Type: {
        name: "Tipo",
        options: { Vacation: "Férias", Sick: "Licença Médica", Personal: "Pessoal", Maternity: "Maternidade", Other: "Outro" },
      },
      "Start Date": { name: "Data de Início" },
      "End Date": { name: "Data de Término" },
      Days: { name: "Dias" },
      Status: {
        name: "Status",
        options: { Pending: "Pendente", Approved: "Aprovada", Rejected: "Rejeitada" },
      },
      Notes: { name: "Observações" },
    },
  },
  Candidates: {
    name: "Candidatos",
    description: "Candidatos a vagas acompanhados pelo pipeline de contratação.",
    fields: {
      Name: { name: "Nome" },
      Email: { name: "E-mail" },
      Phone: { name: "Telefone" },
      Position: { name: "Vaga" },
      Source: { name: "Origem" },
      Stage: {
        name: "Etapa",
        options: { Applied: "Inscrito", Screening: "Triagem", Interview: "Entrevista", Offer: "Proposta", Hired: "Contratado", Rejected: "Rejeitado" },
      },
      Notes: { name: "Observações" },
    },
  },
  "Training Programs": {
    name: "Programas de Treinamento",
    description: "Programas de treinamento e certificação para funcionários.",
    fields: {
      Name: { name: "Nome" },
      Instructor: { name: "Instrutor" },
      "Start Date": { name: "Data de Início" },
      "End Date": { name: "Data de Término" },
      Participants: { name: "Participantes" },
      Status: {
        name: "Status",
        options: { Planned: "Planejado", Active: "Ativo", Completed: "Concluído" },
      },
      Certification: { name: "Certificação" },
      Notes: { name: "Observações" },
    },
  },

  // ── Operations ─────────────────────────────────────────────────────
  Projects: {
    name: "Projetos",
    description: "Acompanhamento de projetos com marcos, prazos e controle orçamentário.",
    fields: {
      Name: { name: "Nome" },
      Client: { name: "Cliente" },
      "Start Date": { name: "Data de Início" },
      Deadline: { name: "Prazo" },
      Budget: { name: "Orçamento" },
      Status: {
        name: "Status",
        options: { Planning: "Planejamento", Active: "Ativo", "On Hold": "Pausado", Completed: "Concluído", Cancelled: "Cancelado" },
      },
      Owner: { name: "Responsável" },
      Notes: { name: "Observações" },
    },
  },
  Tickets: {
    name: "Chamados",
    description: "Solicitações de suporte e atendimento ao cliente com rastreamento de prioridade.",
    fields: {
      Title: { name: "Título" },
      Customer: { name: "Cliente" },
      Priority: {
        name: "Prioridade",
        options: { Low: "Baixa", Medium: "Média", High: "Alta", Critical: "Crítica" },
      },
      Status: {
        name: "Status",
        options: { Open: "Aberto", "In Progress": "Em Andamento", Waiting: "Aguardando", Resolved: "Resolvido", Closed: "Fechado" },
      },
      "Assigned To": { name: "Atribuído A" },
      "Created Date": { name: "Data de Criação" },
      Notes: { name: "Observações" },
    },
  },
  Appointments: {
    name: "Agendamentos",
    description: "Reuniões agendadas, reservas e compromissos com clientes.",
    fields: {
      Title: { name: "Título" },
      Client: { name: "Cliente" },
      Date: { name: "Data" },
      Time: { name: "Horário" },
      Duration: { name: "Duração" },
      Status: {
        name: "Status",
        options: { Scheduled: "Agendado", Confirmed: "Confirmado", Completed: "Concluído", Cancelled: "Cancelado", "No Show": "Não Compareceu" },
      },
      Notes: { name: "Observações" },
    },
  },
  Inspections: {
    name: "Inspeções",
    description: "Inspeções de controle de qualidade com resultados aprovado/reprovado.",
    fields: {
      Product: { name: "Produto" },
      Date: { name: "Data" },
      Inspector: { name: "Inspetor" },
      Result: {
        name: "Resultado",
        options: { Pass: "Aprovado", Fail: "Reprovado", Conditional: "Condicional" },
      },
      Defects: { name: "Defeitos" },
      Batch: { name: "Lote" },
      Notes: { name: "Observações" },
    },
  },
  Vehicles: {
    name: "Veículos",
    description: "Frota da empresa com atribuição de motoristas e rastreamento de manutenção.",
    fields: {
      Plate: { name: "Placa" },
      Model: { name: "Modelo" },
      Driver: { name: "Motorista" },
      Mileage: { name: "Quilometragem" },
      "Fuel Type": {
        name: "Combustível",
        options: { Gasoline: "Gasolina", Diesel: "Diesel", Electric: "Elétrico", Hybrid: "Híbrido" },
      },
      "Last Maintenance": { name: "Última Manutenção" },
      Status: {
        name: "Status",
        options: { Available: "Disponível", "In Use": "Em Uso", Maintenance: "Em Manutenção" },
      },
      Notes: { name: "Observações" },
    },
  },
  Documents: {
    name: "Documentos",
    description: "Registro de documentos empresariais com rastreamento de validade.",
    fields: {
      Title: { name: "Título" },
      Category: {
        name: "Categoria",
        options: { Contract: "Contrato", Certificate: "Certificado", Report: "Relatório", Invoice: "Nota Fiscal", Policy: "Política", Other: "Outro" },
      },
      Date: { name: "Data" },
      Owner: { name: "Responsável" },
      "Expiry Date": { name: "Data de Validade" },
      Status: {
        name: "Status",
        options: { Draft: "Rascunho", Active: "Ativo", Expired: "Expirado", Archived: "Arquivado" },
      },
      Notes: { name: "Observações" },
    },
  },
  "Maintenance Orders": {
    name: "Ordens de Manutenção",
    description: "Agendamento e acompanhamento de manutenção de equipamentos e instalações.",
    fields: {
      Equipment: { name: "Equipamento" },
      Type: {
        name: "Tipo",
        options: { Preventive: "Preventiva", Corrective: "Corretiva", Emergency: "Emergencial" },
      },
      Date: { name: "Data" },
      "Assigned To": { name: "Atribuído A" },
      Status: {
        name: "Status",
        options: { Planned: "Planejada", "In Progress": "Em Andamento", Completed: "Concluída" },
      },
      Cost: { name: "Custo" },
      Notes: { name: "Observações" },
    },
  },
  "Compliance Items": {
    name: "Itens de Conformidade",
    description: "Requisitos regulatórios e rastreamento de prazos de conformidade.",
    fields: {
      Requirement: { name: "Requisito" },
      Regulation: { name: "Regulamentação" },
      "Due Date": { name: "Prazo" },
      Responsible: { name: "Responsável" },
      Status: {
        name: "Status",
        options: { Compliant: "Conforme", "Non-Compliant": "Não Conforme", "In Progress": "Em Andamento", "Pending Review": "Revisão Pendente" },
      },
      "Last Review": { name: "Última Revisão" },
      Notes: { name: "Observações" },
    },
  },
};

const TRANSLATIONS: Record<string, Record<string, EntityTranslation>> = {
  "pt-BR": ptBR,
};

/**
 * Translate an EntityKnowledge entry to the target locale.
 * Returns a shallow copy with translated name, description, fields (names + options).
 * Falls back to the original English values for any missing translation.
 */
export function translateEntity(
  entity: EntityKnowledge,
  locale: string,
): EntityKnowledge {
  const localeMap = TRANSLATIONS[locale];
  if (!localeMap) return entity;

  const t = localeMap[entity.name];
  if (!t) return entity;

  const translatedFields: FieldDefinition[] = entity.fields.map((f) => {
    const ft = t.fields[f.name];
    if (!ft) return f;
    return {
      ...f,
      name: ft.name,
      ...(ft.options && f.options
        ? { options: f.options.map((o) => ft.options![o] ?? o) }
        : {}),
    };
  });

  return {
    ...entity,
    name: t.name,
    description: t.description,
    fields: translatedFields,
  };
}

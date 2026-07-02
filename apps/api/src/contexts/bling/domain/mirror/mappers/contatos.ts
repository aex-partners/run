import { BlingContatoFull } from '@/contexts/bling/domain/mirror/BlingApiTypes'
import { MappedRecord, relRef } from '@/contexts/bling/domain/mirror/MappedRecord'
import { nStr, nDate } from '@/contexts/bling/domain/mirror/normalize'

export function mapContato(full: BlingContatoFull): MappedRecord[] {
  const out: MappedRecord[] = []
  out.push({
    slug: 'bling_contatos',
    externalId: String(full.id),
    data: {
      nome: full.nome,
      codigo: nStr(full.codigo),
      situacao: nStr(full.situacao),
      numero_documento: nStr(full.numeroDocumento),
      telefone: nStr(full.telefone),
      celular: nStr(full.celular),
      fantasia: nStr(full.fantasia),
      tipo: nStr(full.tipo),
      indicador_ie: nStr(full.indicadorIe),
      ie: nStr(full.ie),
      rg: nStr(full.rg),
      orgao_emissor: nStr(full.orgaoEmissor),
      email: nStr(full.email),
      endereco_geral_logradouro: nStr(full.endereco?.geral?.endereco),
      endereco_geral_cep: nStr(full.endereco?.geral?.cep),
      endereco_geral_bairro: nStr(full.endereco?.geral?.bairro),
      endereco_geral_municipio: nStr(full.endereco?.geral?.municipio),
      endereco_geral_uf: nStr(full.endereco?.geral?.uf),
      endereco_geral_numero: nStr(full.endereco?.geral?.numero),
      endereco_geral_complemento: nStr(full.endereco?.geral?.complemento),
      endereco_cobranca_logradouro: nStr(full.endereco?.cobranca?.endereco),
      endereco_cobranca_cep: nStr(full.endereco?.cobranca?.cep),
      endereco_cobranca_bairro: nStr(full.endereco?.cobranca?.bairro),
      endereco_cobranca_municipio: nStr(full.endereco?.cobranca?.municipio),
      endereco_cobranca_uf: nStr(full.endereco?.cobranca?.uf),
      endereco_cobranca_numero: nStr(full.endereco?.cobranca?.numero),
      endereco_cobranca_complemento: nStr(full.endereco?.cobranca?.complemento),
      vendedor_id: full.vendedor?.id ? String(full.vendedor.id) : null,
      data_nascimento: nDate(full.dadosAdicionais?.dataNascimento),
      sexo: nStr(full.dadosAdicionais?.sexo),
      naturalidade: nStr(full.dadosAdicionais?.naturalidade),
      limite_credito: full.financeiro?.limiteCredito ?? null,
      condicao_pagamento: nStr(full.financeiro?.condicaoPagamento),
      categoria_financeira_id: full.financeiro?.categoria?.id ? String(full.financeiro.categoria.id) : null,
      pais: nStr(full.pais?.nome),
    },
  })
  for (const p of full.pessoasContato ?? []) {
    if (!p.id) continue
    out.push({
      slug: 'bling_pessoas_contato',
      externalId: String(p.id),
      data: { contato: relRef('bling_contatos', full.id), descricao: nStr(p.descricao) ?? nStr(p.nome) ?? '(sem nome)' },
    })
  }
  for (const t of full.tiposContato ?? []) {
    out.push({
      slug: 'bling_contato_tipos_assigned',
      externalId: `${full.id}:${t.id}`,
      data: { contato: relRef('bling_contatos', full.id), tipo: relRef('bling_tipos_contato', t.id) },
    })
  }
  return out
}

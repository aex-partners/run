import { BlingContatoFull } from '@/contexts/bling/domain/mirror/BlingApiTypes'
import { MappedRecord, relRef } from '@/contexts/bling/domain/mirror/MappedRecord'
import { nStr, nDate, nAddress } from '@/contexts/bling/domain/mirror/normalize'

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
      endereco_geral: nAddress({
        logradouro: full.endereco?.geral?.endereco,
        numero: full.endereco?.geral?.numero,
        complemento: full.endereco?.geral?.complemento,
        bairro: full.endereco?.geral?.bairro,
        cep: full.endereco?.geral?.cep,
        municipio: full.endereco?.geral?.municipio,
        uf: full.endereco?.geral?.uf,
      }),
      endereco_cobranca: nAddress({
        logradouro: full.endereco?.cobranca?.endereco,
        numero: full.endereco?.cobranca?.numero,
        complemento: full.endereco?.cobranca?.complemento,
        bairro: full.endereco?.cobranca?.bairro,
        cep: full.endereco?.cobranca?.cep,
        municipio: full.endereco?.cobranca?.municipio,
        uf: full.endereco?.cobranca?.uf,
      }),
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

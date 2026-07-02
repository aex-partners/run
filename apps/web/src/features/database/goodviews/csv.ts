/**
 * Exibição de valor como texto + export CSV. Compartilhado por todas as views
 * (extraído da TableView). `cellToText` resolve options/relation/arquivo p/ texto
 * plano; `exportCsv` monta o arquivo sobre um conjunto de linhas + campos.
 */
import type { Field, Row } from './types'

export function formatCurrency(val: unknown, code = 'BRL'): string {
  const n = Number(val)
  if (isNaN(n)) return ''
  return n.toLocaleString('pt-BR', { style: 'currency', currency: code })
}

// valor da celula como texto (p/ CSV / copiar)
export function cellToText(field: Field, value: unknown, recordsById: Map<string, Row>): string {
  if (value == null || value === '') return ''
  if (field.type === 'file') {
    const arr = Array.isArray(value) ? value : [value]
    return (arr as { name?: string }[]).map((f) => f?.name ?? '').filter(Boolean).join(', ')
  }
  if (field.type === 'currency') return formatCurrency(value, field.currency || 'BRL')
  if ((field.type === 'status' || field.type === 'select' || field.type === 'person' || field.type === 'multiselect') && field.options) {
    const ids = Array.isArray(value) ? value : [value]
    return (ids as unknown[]).map((v) => field.options!.find((o) => o.value === v)?.label ?? String(v)).join(', ')
  }
  if (field.type === 'relation') {
    const ids = Array.isArray(value) ? value : [value]
    return (ids as unknown[]).map((v) => String(recordsById.get(String(v))?.nome ?? v)).join(', ')
  }
  if (Array.isArray(value)) return value.map(String).join(', ')
  return String(value)
}

// monta e baixa um CSV (com BOM p/ Excel). Retorna o nº de linhas exportadas.
export function exportCsv(fields: Field[], rows: Row[], recordsById: Map<string, Row>, filename = 'dados.csv'): number {
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)
  const lines = [fields.map((f) => esc(f.label)).join(',')]
  for (const row of rows) lines.push(fields.map((f) => esc(cellToText(f, row[f.id], recordsById))).join(','))
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
  return rows.length
}

// Máscaras BR aplicadas por célula (display + edição). O tipo de máscara é
// escolhido por um campo-irmão da linha (ver Field.formatByField / formatMap):
// ex Meios de Contato -> `valor` mascara conforme `tipo` (Telefone/Celular ->
// phone, Email -> passthrough). Puro, sem IO.

export type MaskKind = 'phone' | 'cep' | 'cpfcnpj' | 'email'

const digits = (s: unknown): string => String(s ?? '').replace(/\D/g, '')

// Telefone BR: (99) 9999-9999 (fixo) ou (99) 99999-9999 (celular). Progressivo
// enquanto digita.
function maskPhone(raw: unknown): string {
  const d = digits(raw).slice(0, 11)
  if (!d) return ''
  if (d.length <= 2) return `(${d}`
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

function maskCep(raw: unknown): string {
  const d = digits(raw).slice(0, 8)
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}

// CPF (000.000.000-00) até 11 dígitos; CNPJ (00.000.000/0000-00) acima.
function maskCpfCnpj(raw: unknown): string {
  const d = digits(raw).slice(0, 14)
  if (d.length <= 11) {
    return d
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2')
  }
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
}

// Aplica a máscara a um valor cru (usado na edição, a cada tecla, e na exibição).
// Email é passthrough (só trim). Kind desconhecido devolve o valor como string.
export function applyMask(kind: MaskKind | undefined, raw: unknown): string {
  switch (kind) {
    case 'phone': return maskPhone(raw)
    case 'cep': return maskCep(raw)
    case 'cpfcnpj': return maskCpfCnpj(raw)
    case 'email': return String(raw ?? '').trim()
    default: return raw == null ? '' : String(raw)
  }
}

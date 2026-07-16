import { PrecificacaoError } from '@/contexts/precificacao/domain/PrecificacaoError'
// Percent é FRAÇÃO em [0,1]. Fora disso quase sempre é "10" no lugar de "0,10".
export function validarPercent(campo: string, v: number): string | null {
  if (!Number.isFinite(v) || v < 0 || v > 1) return PrecificacaoError.percentForaDaFaixa(campo, v)
  return null
}

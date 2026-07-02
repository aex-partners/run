import type { AuditAdapter, AuditEntry } from './types'

/**
 * Mock do backend de auditoria do sandbox. No produto isto vira uma tabela
 * (ex `auditoria_lancamentos`): `log` = INSERT, `list` = SELECT ordenado.
 * Mantemos o store em memoria (module-level) p/ sobreviver a remontagem da view.
 */
const STORE: AuditEntry[] = []

export function makeAuditAdapter(currentUser: string): AuditAdapter {
  return {
    enabled: true,
    currentUser,
    log: (entry) => {
      STORE.push(entry)
    },
    list: () => [...STORE],
  }
}

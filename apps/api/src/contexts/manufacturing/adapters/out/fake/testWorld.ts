import { InMemoryRecordStore } from '@/contexts/manufacturing/adapters/out/fake/InMemoryRecordStore'

// Mundo mínimo: entidades de manufatura + 1 centro (COSTURA, R$ 1,00/min) + 1 modelo M1.
export function seedManufacturing(): InMemoryRecordStore {
  const s = new InMemoryRecordStore()
  s.seedEntity('centros_de_trabalho', 'CENTROS')
  s.seedEntity('operacoes', 'OPERACOES')
  s.seedRecord('CENTROS', { id: 'C1', version: 1, data: { nome: 'COSTURA', setor: 'costura', custo_min_mod: 1, ativo: true } })
  return s
}

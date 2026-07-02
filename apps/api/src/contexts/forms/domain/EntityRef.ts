import { Identifier } from '@/shared/kernel/Identifier'

// Reference to an entity owned by the `data` context. A form links to an entity
// but never imports its domain — this typed id is the anti-corruption boundary
// value. Resolution to the real entity happens through ACL out-ports
// (EntityCatalog / EntityRecordSink), wired in main.
export class EntityRef extends Identifier {
  static of(value: string): EntityRef {
    return new EntityRef(value)
  }
}

import { Identifier } from '@/shared/kernel/Identifier'

// Reference to a record created in the `data` context by a submission. Forms only
// holds the id handed back by the EntityRecordSink ACL — it never loads the
// record itself.
export class EntityRecordRef extends Identifier {
  static of(value: string): EntityRecordRef {
    return new EntityRecordRef(value)
  }
}

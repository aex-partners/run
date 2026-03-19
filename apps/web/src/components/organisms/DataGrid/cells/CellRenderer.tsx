import type { CellProps } from '../types'
import { TextCell } from './TextCell'
import { NumberCell } from './NumberCell'
import { BadgeCell } from './BadgeCell'
import { StatusCell } from './StatusCell'
import { PersonCell } from './PersonCell'
import { CurrencyCell } from './CurrencyCell'
import { TimelineCell } from './TimelineCell'
import { PriorityCell } from './PriorityCell'
import { CheckboxCell } from './CheckboxCell'
import { SelectCell } from './SelectCell'
import { MultiSelectCell } from './MultiSelectCell'
import { EmailCell } from './EmailCell'
import { UrlCell } from './UrlCell'
import { PhoneCell } from './PhoneCell'
import { RelationshipCell } from './RelationshipCell'
import { AICell } from './AICell'

export function CellRenderer(props: CellProps) {
  switch (props.column.type) {
    case 'badge':
      return <BadgeCell {...props} />
    case 'status':
      return <StatusCell {...props} />
    case 'person':
      return <PersonCell {...props} />
    case 'currency':
      return <CurrencyCell {...props} />
    case 'timeline':
      return <TimelineCell {...props} />
    case 'priority':
      return <PriorityCell {...props} />
    case 'number':
      return <NumberCell {...props} />
    case 'checkbox':
      return <CheckboxCell {...props} />
    case 'select':
      return <SelectCell {...props} />
    case 'multiselect':
      return <MultiSelectCell {...props} />
    case 'email':
      return <EmailCell {...props} />
    case 'url':
      return <UrlCell {...props} />
    case 'phone':
      return <PhoneCell {...props} />
    case 'relationship':
      return <RelationshipCell {...props} />
    case 'ai':
      return <AICell {...props} />
    case 'text':
    case 'date':
    default:
      return <TextCell {...props} />
  }
}

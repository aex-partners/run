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
import { DateCell } from './DateCell'
import { DateTimeCell } from './DateTimeCell'
import { LongTextCell } from './LongTextCell'
import { PercentCell } from './PercentCell'
import { DecimalCell } from './DecimalCell'
import { RatingCell } from './RatingCell'
import { DurationCell } from './DurationCell'
import { FormulaCell } from './FormulaCell'
import { LookupCell } from './LookupCell'
import { RollupCell } from './RollupCell'
import { AutoNumberCell } from './AutoNumberCell'
import { AttachmentCell } from './AttachmentCell'
import { JsonCell } from './JsonCell'
import { BarcodeCell } from './BarcodeCell'
import { SystemCell } from './SystemCell'

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
    case 'date':
      return <DateCell {...props} />
    case 'datetime':
      return <DateTimeCell {...props} />
    case 'long_text':
    case 'rich_text':
      return <LongTextCell {...props} />
    case 'percent':
      return <PercentCell {...props} />
    case 'decimal':
      return <DecimalCell {...props} />
    case 'rating':
      return <RatingCell {...props} />
    case 'duration':
      return <DurationCell {...props} />
    case 'formula':
      return <FormulaCell {...props} />
    case 'lookup':
      return <LookupCell {...props} />
    case 'rollup':
      return <RollupCell {...props} />
    case 'autonumber':
      return <AutoNumberCell {...props} />
    case 'attachment':
      return <AttachmentCell {...props} />
    case 'json':
      return <JsonCell {...props} />
    case 'barcode':
      return <BarcodeCell {...props} />
    case 'created_at':
    case 'updated_at':
    case 'created_by':
    case 'updated_by':
      return <SystemCell {...props} />
    case 'text':
    default:
      return <TextCell {...props} />
  }
}

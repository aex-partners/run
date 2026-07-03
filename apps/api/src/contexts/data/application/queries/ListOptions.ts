// Read side. Lists an entity's records as picker options: each record's id paired
// with its TITLE (label) field value, optionally filtered by a case-insensitive
// search over that title, capped at `limit`. Powers the web Table View's relation
// edit combobox — the target entity's records populate + search the picker.
export interface ListOptionsInput {
  entityId: string
  search?: string
  limit?: number
}

export interface OptionPair {
  value: string
  label: string
}

export interface ListOptionsResult {
  options: OptionPair[]
}

export interface ListOptions {
  execute(input: ListOptionsInput): Promise<ListOptionsResult>
}

// Read side. Resolves a batch of record ids belonging to ONE entity into their
// human-readable TITLE (label) — the value of the entity's designated title
// field. Powers the web Table View's relation columns: a relation cell stores a
// target record id, and this query turns those ids into the target's label.
export interface ResolveLabelsInput {
  entityId: string
  ids: string[]
}

export interface LabelPair {
  id: string
  label: string
}

export interface ResolveLabelsResult {
  labels: LabelPair[]
}

export interface ResolveLabels {
  execute(input: ResolveLabelsInput): Promise<ResolveLabelsResult>
}

// ACL value: forms' own view of a field belonging to a `data`-context entity.
// Forms never imports the data context; the EntityCatalog out-port translates the
// real entity field into this shape, and SubmissionValidator validates against it.
export interface EntityFieldOption {
  value: string
  label: string
  color?: string
}

export interface EntityFieldSpec {
  id: string
  name: string
  slug: string
  type: string
  required: boolean
  options?: EntityFieldOption[]
  maxRating?: number
}

// VO config: how one entity field is presented inside a form. `entityFieldId`
// points at a field of the linked entity (in the `data` context); `required` here
// can tighten or loosen the entity's own requirement for this form only.
export interface FormField {
  id: string
  entityFieldId: string
  order: number
  required: boolean
  placeholder?: string
  helpText?: string
  visible: boolean
}

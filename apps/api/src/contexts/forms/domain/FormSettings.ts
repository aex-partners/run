// VO config: presentation/behaviour of a form's submit experience.
export interface FormSettings {
  submitButtonText: string
  successMessage: string
  title?: string
  description?: string
}

export const defaultFormSettings = (): FormSettings => ({
  submitButtonText: 'Submit',
  successMessage: 'Thank you for your submission.',
})

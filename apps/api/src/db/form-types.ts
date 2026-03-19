export interface FormField {
  id: string;
  entityFieldId: string;
  order: number;
  required: boolean;
  placeholder?: string;
  helpText?: string;
  visible: boolean;
}

export interface FormSettings {
  submitButtonText: string;
  successMessage: string;
  title?: string;
  description?: string;
}

export function parseFormFields(json: string): FormField[] {
  try {
    return JSON.parse(json) as FormField[];
  } catch {
    return [];
  }
}

export function serializeFormFields(fields: FormField[]): string {
  return JSON.stringify(fields);
}

export function parseFormSettings(json: string): FormSettings {
  try {
    return JSON.parse(json) as FormSettings;
  } catch {
    return { submitButtonText: "Submit", successMessage: "Thank you for your submission." };
  }
}

export function serializeFormSettings(settings: FormSettings): string {
  return JSON.stringify(settings);
}

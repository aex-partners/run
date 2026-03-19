export interface EntityField {
  id: string;
  name: string;
  slug: string;
  type: "text" | "number" | "email" | "phone" | "date" | "select" | "checkbox";
  required: boolean;
  unique?: boolean;
  options?: string[];
}

const VALID_FIELD_TYPES = new Set([
  "text", "number", "email", "phone", "date", "select", "checkbox",
]);

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export function parseFields(fieldsJson: string): EntityField[] {
  try {
    return JSON.parse(fieldsJson) as EntityField[];
  } catch {
    return [];
  }
}

export function serializeFields(fields: EntityField[]): string {
  return JSON.stringify(fields);
}

export function validateFieldType(type: string): type is EntityField["type"] {
  return VALID_FIELD_TYPES.has(type);
}

export function validateRecordData(
  data: Record<string, unknown>,
  fields: EntityField[],
  partial = false,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const fieldMap = new Map(fields.map((f) => [f.slug, f]));

  // Check required fields (only for full inserts, not partial updates)
  if (!partial) {
    for (const field of fields) {
      if (field.required && (data[field.slug] === undefined || data[field.slug] === null || data[field.slug] === "")) {
        errors.push(`Field "${field.name}" is required.`);
      }
    }
  }

  // Type-check provided values
  for (const [key, value] of Object.entries(data)) {
    const field = fieldMap.get(key);
    if (!field) continue; // ignore unknown fields silently

    if (value === null || value === undefined || value === "") continue;

    switch (field.type) {
      case "number":
        if (typeof value !== "number" && isNaN(Number(value))) {
          errors.push(`Field "${field.name}" must be a number.`);
        }
        break;
      case "email":
        if (typeof value === "string" && !value.includes("@")) {
          errors.push(`Field "${field.name}" must be a valid email.`);
        }
        break;
      case "checkbox":
        if (typeof value !== "boolean" && value !== "true" && value !== "false") {
          errors.push(`Field "${field.name}" must be a boolean.`);
        }
        break;
      case "select":
        if (field.options && field.options.length > 0 && !field.options.includes(String(value))) {
          errors.push(`Field "${field.name}" must be one of: ${field.options.join(", ")}.`);
        }
        break;
    }
  }

  return { valid: errors.length === 0, errors };
}

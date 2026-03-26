import { ENTITY_FIELD_TYPES, type EntityFieldType, type EntityFieldOption } from "@aex/shared";

export interface EntityField {
  id: string;
  name: string;
  slug: string;
  type: EntityFieldType;
  required: boolean;
  unique?: boolean;
  description?: string;
  defaultValue?: string;
  options?: EntityFieldOption[];
  formula?: string;
  relationshipEntityId?: string;
  relationshipEntityName?: string;
  lookupFieldId?: string;
  rollupFunction?: "count" | "sum" | "avg" | "min" | "max";
  currencyCode?: string;
  aiPrompt?: string;
  maxRating?: number;
  decimalPlaces?: number;
}

const VALID_FIELD_TYPES = new Set<string>(ENTITY_FIELD_TYPES);

export function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  // Fallback to a short random ID if slug is empty (e.g. emoji-only names)
  return slug || `field_${crypto.randomUUID().slice(0, 8)}`;
}

/** Backward-compat: convert old string[] options to {value, label}[] */
function migrateOptions(
  options: unknown,
): EntityFieldOption[] | undefined {
  if (!Array.isArray(options) || options.length === 0) return undefined;
  if (typeof options[0] === "string") {
    return (options as string[]).map((s) => ({ value: s, label: s }));
  }
  return options as EntityFieldOption[];
}

export function parseFields(fieldsJson: string): EntityField[] {
  try {
    const raw = JSON.parse(fieldsJson) as EntityField[];
    return raw.map((f) => ({
      ...f,
      options: migrateOptions(f.options),
    }));
  } catch {
    return [];
  }
}

export function serializeFields(fields: EntityField[]): string {
  return JSON.stringify(fields);
}

export function validateFieldType(type: string): type is EntityFieldType {
  return VALID_FIELD_TYPES.has(type);
}

const COMPUTED_TYPES = new Set<string>([
  "formula", "lookup", "rollup", "autonumber",
  "created_at", "updated_at", "created_by", "updated_by",
]);

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
      if (COMPUTED_TYPES.has(field.type)) continue;
      if (field.required && (data[field.slug] === undefined || data[field.slug] === null || data[field.slug] === "")) {
        errors.push(`Field "${field.name}" is required.`);
      }
    }
  }

  // Type-check provided values
  for (const [key, value] of Object.entries(data)) {
    const field = fieldMap.get(key);
    if (!field) continue;
    if (COMPUTED_TYPES.has(field.type)) continue;
    if (value === null || value === undefined || value === "") continue;

    switch (field.type) {
      case "number":
      case "decimal":
      case "currency":
      case "percent":
      case "duration":
        if (typeof value !== "number" && isNaN(Number(value))) {
          errors.push(`Field "${field.name}" must be a number.`);
        }
        break;
      case "email":
        if (typeof value === "string" && !value.includes("@")) {
          errors.push(`Field "${field.name}" must be a valid email.`);
        }
        break;
      case "url":
        if (typeof value === "string" && !/^https?:\/\/.+/.test(value)) {
          errors.push(`Field "${field.name}" must be a valid URL.`);
        }
        break;
      case "checkbox":
        if (typeof value !== "boolean" && value !== "true" && value !== "false") {
          errors.push(`Field "${field.name}" must be a boolean.`);
        }
        break;
      case "select":
      case "status":
      case "priority": {
        const optValues = field.options?.map((o) => o.value) ?? [];
        if (optValues.length > 0 && !optValues.includes(String(value))) {
          errors.push(`Field "${field.name}" must be one of: ${optValues.join(", ")}.`);
        }
        break;
      }
      case "multiselect": {
        const optValues = field.options?.map((o) => o.value) ?? [];
        if (optValues.length > 0) {
          const values = String(value).split(",").map((v) => v.trim()).filter(Boolean);
          for (const v of values) {
            if (!optValues.includes(v)) {
              errors.push(`Field "${field.name}": "${v}" is not a valid option.`);
            }
          }
        }
        break;
      }
      case "rating": {
        const num = Number(value);
        const max = field.maxRating ?? 5;
        if (isNaN(num) || num < 0 || num > max) {
          errors.push(`Field "${field.name}" must be between 0 and ${max}.`);
        }
        break;
      }
      case "json":
        if (typeof value === "string") {
          try { JSON.parse(value); } catch {
            errors.push(`Field "${field.name}" must be valid JSON.`);
          }
        }
        break;
      case "date":
        if (typeof value === "string" && isNaN(Date.parse(value))) {
          errors.push(`Field "${field.name}" must be a valid date.`);
        }
        break;
      case "datetime":
        if (typeof value === "string" && isNaN(Date.parse(value))) {
          errors.push(`Field "${field.name}" must be a valid date-time.`);
        }
        break;
      // text, long_text, rich_text, phone, person, relationship, attachment,
      // barcode, ai: no special validation needed
    }
  }

  return { valid: errors.length === 0, errors };
}

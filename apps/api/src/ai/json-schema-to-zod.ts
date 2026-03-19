import { z, type ZodTypeAny } from "zod";

/**
 * Converts a JSON Schema object to a Zod schema.
 * Supports: string, number, integer, boolean, array, object, enum, optional, describe.
 */
export function jsonSchemaToZod(schema: Record<string, unknown>): ZodTypeAny {
  const type = schema.type as string | undefined;
  const description = schema.description as string | undefined;

  let result: ZodTypeAny;

  if (schema.enum && Array.isArray(schema.enum)) {
    const values = schema.enum as [string, ...string[]];
    result = z.enum(values);
  } else {
    switch (type) {
      case "string":
        result = z.string();
        break;
      case "number":
      case "integer":
        result = z.number();
        break;
      case "boolean":
        result = z.boolean();
        break;
      case "array": {
        const items = (schema.items as Record<string, unknown>) ?? {};
        result = z.array(jsonSchemaToZod(items));
        break;
      }
      case "object": {
        const properties = (schema.properties as Record<string, Record<string, unknown>>) ?? {};
        const required = new Set((schema.required as string[]) ?? []);
        const shape: Record<string, ZodTypeAny> = {};

        for (const [key, propSchema] of Object.entries(properties)) {
          let field = jsonSchemaToZod(propSchema);
          if (!required.has(key)) {
            field = field.optional();
          }
          shape[key] = field;
        }
        result = z.object(shape);
        break;
      }
      default:
        result = z.unknown();
    }
  }

  if (description) {
    result = result.describe(description);
  }

  return result;
}

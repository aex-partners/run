/**
 * Utility functions for ActivePieces piece actions.
 * AI SDK integration removed. These utilities remain for plugin management.
 */

import type { Piece } from "@activepieces/pieces-framework";
import { PropertyType } from "@activepieces/pieces-framework";

/**
 * Convert AP property definitions to a JSON Schema object.
 */
export function propsToJsonSchema(props: Record<string, unknown>): Record<string, unknown> {
  const properties: Record<string, Record<string, unknown>> = {};
  const required: string[] = [];

  for (const [key, propDef] of Object.entries(props)) {
    if (!propDef || typeof propDef !== "object") continue;
    const prop = propDef as {
      type: PropertyType;
      required?: boolean;
      displayName?: string;
      description?: string;
    };

    const propSchema = propertyTypeToJsonSchema(prop.type);

    if (prop.description) {
      propSchema.description = prop.description;
    } else if (prop.displayName) {
      propSchema.description = prop.displayName;
    }

    properties[key] = propSchema;

    if (prop.required) {
      required.push(key);
    }
  }

  const schema: Record<string, unknown> = {
    type: "object",
    properties,
  };

  if (required.length > 0) {
    schema.required = required;
  }

  return schema;
}

function propertyTypeToJsonSchema(type: PropertyType): Record<string, unknown> {
  switch (type) {
    case PropertyType.SHORT_TEXT:
    case PropertyType.LONG_TEXT:
    case PropertyType.DATE_TIME:
    case PropertyType.COLOR:
      return { type: "string" };
    case PropertyType.NUMBER:
      return { type: "number" };
    case PropertyType.CHECKBOX:
      return { type: "boolean" };
    case PropertyType.JSON:
    case PropertyType.OBJECT:
    case PropertyType.DYNAMIC:
    case PropertyType.CUSTOM:
      return { type: "object", additionalProperties: true };
    case PropertyType.ARRAY:
    case PropertyType.MULTI_SELECT_DROPDOWN:
    case PropertyType.STATIC_MULTI_SELECT_DROPDOWN:
      return { type: "array", items: { type: "string" } };
    case PropertyType.DROPDOWN:
    case PropertyType.STATIC_DROPDOWN:
      return { type: "string" };
    case PropertyType.FILE:
      return { type: "string", description: "File URL or base64 content" };
    case PropertyType.MARKDOWN:
      return { type: "string" };
    default:
      return { type: "string" };
  }
}

export function sanitizeToolName(name: string): string {
  return name
    .replace(/^@[^/]+\//, "")
    .replace(/^piece-/, "")
    .replace(/[^a-zA-Z0-9_-]/g, "_");
}

export function getPieceName(piece: Piece): string {
  try {
    const meta = piece.metadata();
    if (meta?.name) return meta.name;
  } catch {
    // metadata() may not exist on npm-installed pieces
  }
  return piece.displayName.toLowerCase().replace(/\s+/g, "-");
}

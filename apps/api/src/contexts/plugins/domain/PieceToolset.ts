import { Json, JsonObject } from '@/shared/domain/Json'
import { PieceMetadata, PieceProperty } from '@/contexts/plugins/domain/PieceMetadata'
import { PiecePropertyType } from '@/contexts/plugins/domain/PiecePropertyType'

// A single AI/MCP-exposable tool derived from one piece action. `name` is the
// sanitized, length-capped, de-duplicated MCP identifier; `pieceName`/`actionName`
// are the REAL identifiers used to invoke the action. `inputSchema` is JSON Schema
// (the npm-free counterpart of the source `propsToZodShape`; main converts it to a
// zod shape when registering the SDK tool).
export interface PieceToolDescriptor {
  name: string
  displayName: string
  description: string
  readOnly: boolean
  inputSchema: JsonObject
  pieceName: string
  actionName: string
  pluginName: string
  pluginLogoUrl: string | null
}

// One installed plugin paired with its loaded metadata, the input to tool
// derivation.
export interface InstalledPiece {
  pluginName: string
  pluginLogoUrl: string | null
  meta: PieceMetadata
}

const READ_ONLY_PREFIXES = ['list', 'get', 'search', 'fetch', 'read', 'find']
// Any of these tokens anywhere in the action name forces a mutating
// classification, even when the first token looks read-only
// (e.g. `find_or_create_contact`).
const MUTATING_TOKENS = new Set([
  'create', 'update', 'delete', 'insert', 'send', 'remove', 'set', 'write',
  'add', 'archive', 'move', 'cancel', 'pay', 'refund', 'upload', 'post', 'put',
])

// PURE DOMAIN RULES for turning loaded piece metadata into tool descriptors.
// Ported verbatim from the source `ai/piece-tools.ts` (classify / sanitize /
// dedupe) and `piece-to-tool.ts` (props -> JSON Schema).
export const PieceToolset = {
  // Classify an action as read-only by its name verb. Read-only actions
  // auto-execute (no confirmation, no mutation budget), so this MUST fail closed:
  // only the FIRST token being a read verb AND no mutating token anywhere
  // qualifies. Classify on the ACTION name, never the combined tool name.
  classifyAction(actionName: string): boolean {
    const tokens = actionName.toLowerCase().split(/[_-]/).filter(Boolean)
    const first = tokens[0]
    if (first === undefined) return false
    if (tokens.some((t) => MUTATING_TOKENS.has(t))) return false
    return READ_ONLY_PREFIXES.includes(first)
  },

  // Sanitize a name to `[a-z0-9_]`, lowercased.
  sanitizeName(raw: string): string {
    return raw.toLowerCase().replace(/[^a-z0-9_]/g, '_')
  },

  // Slug of a piece name for the tool prefix: drop the `@scope/` and `piece-`
  // prefixes, then sanitize.
  pieceSlug(pieceName: string): string {
    return PieceToolset.sanitizeName(pieceName.replace(/^@[^/]+\//, '').replace(/^piece-/, ''))
  },

  // Map a piece input property map to JSON Schema (the UI/tool input shape).
  propsToJsonSchema(props: PieceProperty[]): JsonObject {
    const properties: JsonObject = {}
    const required: string[] = []
    for (const prop of props) {
      const schema = propertyTypeToJsonSchema(prop.type)
      const description = prop.description ?? prop.displayName
      if (description) schema.description = description
      properties[prop.name] = schema
      if (prop.required) required.push(prop.name)
    }
    const out: JsonObject = { type: 'object', properties }
    if (required.length > 0) out.required = required
    return out
  },

  // Build the full de-duplicated tool list across every installed piece. The
  // dedupe set is shared across all pieces because sanitize+slice can collide;
  // collisions get a numeric suffix, mirroring the source `buildPieceTools`.
  buildToolDescriptors(pieces: readonly InstalledPiece[]): PieceToolDescriptor[] {
    const used = new Set<string>()
    const tools: PieceToolDescriptor[] = []

    for (const { pluginName, pluginLogoUrl, meta } of pieces) {
      const slug = PieceToolset.pieceSlug(meta.pieceName)
      for (const action of meta.actions) {
        const name = dedupe(PieceToolset.sanitizeName(`${slug}_${action.name}`).slice(0, 54), used)
        used.add(name)
        tools.push({
          name,
          displayName: action.displayName ?? action.name,
          description: action.description || action.displayName || `${meta.pieceName} / ${action.name}`,
          readOnly: PieceToolset.classifyAction(action.name),
          inputSchema: PieceToolset.propsToJsonSchema(action.props),
          pieceName: meta.pieceName,
          actionName: action.name,
          pluginName,
          pluginLogoUrl,
        })
      }
    }

    return tools
  },
}

// Sanitize -> slice(54) already applied; if taken, append `_<n>` after slicing to
// 50 to leave room for the suffix. Mirrors the source dedupe loop.
function dedupe(toolName: string, used: Set<string>): string {
  if (!used.has(toolName)) return toolName
  let suffix = 1
  let candidate = `${toolName.slice(0, 50)}_${suffix}`
  while (used.has(candidate)) {
    suffix += 1
    candidate = `${toolName.slice(0, 50)}_${suffix}`
  }
  return candidate
}

function propertyTypeToJsonSchema(type: PiecePropertyType): JsonObject {
  switch (type) {
    case 'SHORT_TEXT':
    case 'LONG_TEXT':
    case 'DATE_TIME':
    case 'COLOR':
    case 'MARKDOWN':
      return { type: 'string' }
    case 'NUMBER':
      return { type: 'number' }
    case 'CHECKBOX':
      return { type: 'boolean' }
    case 'JSON':
    case 'OBJECT':
    case 'DYNAMIC':
    case 'CUSTOM':
      return { type: 'object', additionalProperties: true }
    case 'ARRAY':
    case 'MULTI_SELECT_DROPDOWN':
    case 'STATIC_MULTI_SELECT_DROPDOWN':
      return { type: 'array', items: { type: 'string' } as Json }
    case 'DROPDOWN':
    case 'STATIC_DROPDOWN':
      return { type: 'string' }
    case 'FILE':
      return { type: 'string', description: 'File URL or base64 content' }
    default:
      return { type: 'string' }
  }
}

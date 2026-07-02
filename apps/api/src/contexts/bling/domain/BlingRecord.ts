import { JsonObject } from '@/shared/domain/Json'

// A single Bling ERP record (a produto, pedido de venda or contato). Bling's
// payloads are large and vary per resource, so the context keeps them as opaque
// JSON objects and surfaces them verbatim to the AI rather than modelling every
// field. PURE data.
export type BlingRecord = JsonObject

// Pure (de)serialization for the settings store. Values are persisted in a single
// text column: strings pass through verbatim, everything else is JSON-encoded.
// Reads try JSON.parse and fall back to the raw string. Mirrors AEX exactly.
export const serializeValue = (value: unknown): string =>
  typeof value === 'string' ? value : JSON.stringify(value)

export const parseValue = (raw: string): unknown => {
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

// The one-time setup sentinel. completeSetup writes this last; isSetupComplete
// and the re-run guard compare the raw stored string against it.
export const SETUP_COMPLETE_KEY = 'system.setupComplete'
export const SETUP_COMPLETE_VALUE = 'true'

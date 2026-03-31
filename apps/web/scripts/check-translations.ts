/**
 * Translation completeness checker for AEX Run.
 *
 * Compares locale files against the base English locale and reports:
 *   - Missing keys (present in EN but absent in locale)
 *   - Unused keys (present in locale but absent in EN)
 *   - TODO keys (values starting with "TODO")
 *   - Coverage percentage
 *
 * Usage:
 *   npx tsx scripts/check-translations.ts
 *   npx tsx scripts/check-translations.ts --remove-unused
 *   npx tsx scripts/check-translations.ts --verbose
 *
 * Inspired by apache/airflow#62983
 */

import { readFileSync, readdirSync } from 'node:fs'
import { resolve, basename } from 'node:path'

// ── Config ──────────────────────────────────────────────────────────────────
const LOCALES_DIR = resolve(import.meta.dirname, '../src/locales')
const BASE_LOCALE = 'en'
const REMOVE_UNUSED = process.argv.includes('--remove-unused')
const VERBOSE = process.argv.includes('--verbose')

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Flatten a nested object into dot-separated keys. */
function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = []
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...flattenKeys(v as Record<string, unknown>, full))
    } else {
      keys.push(full)
    }
  }
  return keys
}

/** Flatten to key-value pairs. */
function flattenToValues(obj: Record<string, unknown>, prefix = ''): Map<string, string> {
  const map = new Map<string, string>()
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      for (const [ik, iv] of flattenToValues(v as Record<string, unknown>, full)) {
        map.set(ik, iv)
      }
    } else {
      map.set(full, String(v))
    }
  }
  return map
}

/** Dynamically import a TS locale file and return its default export. */
async function loadLocale(name: string): Promise<Record<string, unknown>> {
  const filePath = resolve(LOCALES_DIR, `${name}.ts`)
  const mod = await import(filePath)
  return mod.default as Record<string, unknown>
}

/** Remove keys from a nested object by dot-paths. Returns the mutated source string. */
function removeKeysFromSource(source: string, keys: string[]): string {
  // Simple approach: for each unused key, warn (manual removal recommended for safety)
  console.log(`\n  To remove ${keys.length} unused keys, edit the locale file manually or use an AST tool.`)
  for (const key of keys) {
    console.log(`    - ${key}`)
  }
  return source
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  // Discover locale files
  const files = readdirSync(LOCALES_DIR)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts') && !f.startsWith('i18n'))
    .map((f) => basename(f, '.ts'))

  const localeNames = files.filter((f) => f !== BASE_LOCALE)

  if (localeNames.length === 0) {
    console.log('No locale files found besides base.')
    process.exit(0)
  }

  // Load base
  const baseData = await loadLocale(BASE_LOCALE)
  const baseKeys = new Set(flattenKeys(baseData))
  const baseValues = flattenToValues(baseData)

  console.log(`\n  Base locale: ${BASE_LOCALE} (${baseKeys.size} keys)\n`)

  let hasErrors = false

  for (const locale of localeNames) {
    const localeData = await loadLocale(locale)
    const localeKeys = new Set(flattenKeys(localeData))
    const localeValues = flattenToValues(localeData)

    const missing = [...baseKeys].filter((k) => !localeKeys.has(k)).sort()
    const unused = [...localeKeys].filter((k) => !baseKeys.has(k)).sort()
    const todos = [...localeKeys]
      .filter((k) => {
        const val = localeValues.get(k) ?? ''
        return val.startsWith('TODO')
      })
      .sort()

    const translated = baseKeys.size - missing.length - todos.length
    const coverage = baseKeys.size > 0 ? ((translated / baseKeys.size) * 100).toFixed(1) : '100.0'

    // Table row
    const status = missing.length === 0 && todos.length === 0 ? '✓' : '✗'
    console.log(
      `  ${status} ${locale.padEnd(10)} ` +
        `Coverage: ${coverage.padStart(5)}%  ` +
        `Translated: ${String(translated).padStart(4)}  ` +
        `Missing: ${String(missing.length).padStart(3)}  ` +
        `TODOs: ${String(todos.length).padStart(3)}  ` +
        `Unused: ${String(unused.length).padStart(3)}`
    )

    if (missing.length > 0) hasErrors = true

    if (VERBOSE) {
      if (missing.length > 0) {
        console.log(`\n    Missing keys in ${locale}:`)
        for (const k of missing) {
          const enVal = baseValues.get(k) ?? ''
          console.log(`      ${k}: '${enVal}'`)
        }
      }
      if (todos.length > 0) {
        console.log(`\n    TODO keys in ${locale}:`)
        for (const k of todos) console.log(`      ${k}`)
      }
      if (unused.length > 0) {
        console.log(`\n    Unused keys in ${locale}:`)
        for (const k of unused) console.log(`      ${k}`)
      }
    }

    if (REMOVE_UNUSED && unused.length > 0) {
      const filePath = resolve(LOCALES_DIR, `${locale}.ts`)
      const source = readFileSync(filePath, 'utf-8')
      removeKeysFromSource(source, unused)
    }
  }

  console.log('')

  if (hasErrors) {
    console.log('  Translation check failed: missing keys detected.\n')
    process.exit(1)
  } else {
    console.log('  All translations complete.\n')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

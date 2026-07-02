import 'i18next'
import type { DefaultNamespace, Namespace } from 'i18next'
import type en from './en'

// Keep the nested KEY structure typed (so dotted keys are still checked +
// autocompleted) but widen every leaf to a plain `string`. i18next infers
// interpolation param types from the literal placeholder strings; widening the
// leaves stops that inference, so `t('k', { n: 1 })` no longer fails on
// number-vs-string param typing (i18next coerces at runtime anyway). This drops
// only interpolation-param strictness, not key safety.
type LooseLeaves<T> = {
  [K in keyof T]: T[K] extends string ? string : LooseLeaves<T[K]>
}

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation'
    resources: {
      translation: LooseLeaves<typeof en>
    }
  }

  // Permissive fallback overload. The strict, resource-derived overloads from
  // i18next stay in place (so literal keys keep autocomplete + key-name
  // checking), but this extra call signature also accepts dynamic keys
  // (`t(someVar)`, `t(`prefix.${x}`)`) and arbitrary interpolation params,
  // which the strict overloads reject. i18next resolves keys at runtime, so
  // this is a type-only relaxation with no behavior change.
  interface TFunction<
    Ns extends Namespace = DefaultNamespace,
    KPrefix = undefined,
  > {
    (
      key: string | readonly string[],
      options?: Record<string, unknown>,
    ): string
  }
}

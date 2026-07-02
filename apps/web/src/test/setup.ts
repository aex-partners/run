import '@testing-library/jest-dom/vitest'
import i18n from 'i18next'

// jsdom lacks ResizeObserver, which Radix primitives and the DataGrid editor use.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}

import { initReactI18next } from 'react-i18next'
import en from '../platform/i18n/en'

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
    },
    lng: 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  })

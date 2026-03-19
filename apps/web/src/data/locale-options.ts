// Countries, languages, and timezones for Setup Wizard preferences step

export interface SelectFieldOption {
  value: string
  label: string
}

export interface CountryLocale extends SelectFieldOption {
  dateFormat: string
  currencyCode: string
  currencySymbol: string
}

export const COUNTRIES: CountryLocale[] = [
  { value: 'BR', label: 'Brazil', dateFormat: 'DD/MM/YYYY', currencyCode: 'BRL', currencySymbol: 'R$' },
  { value: 'US', label: 'United States', dateFormat: 'MM/DD/YYYY', currencyCode: 'USD', currencySymbol: '$' },
  { value: 'GB', label: 'United Kingdom', dateFormat: 'DD/MM/YYYY', currencyCode: 'GBP', currencySymbol: '£' },
  { value: 'DE', label: 'Germany', dateFormat: 'DD.MM.YYYY', currencyCode: 'EUR', currencySymbol: '€' },
  { value: 'FR', label: 'France', dateFormat: 'DD/MM/YYYY', currencyCode: 'EUR', currencySymbol: '€' },
  { value: 'ES', label: 'Spain', dateFormat: 'DD/MM/YYYY', currencyCode: 'EUR', currencySymbol: '€' },
  { value: 'PT', label: 'Portugal', dateFormat: 'DD/MM/YYYY', currencyCode: 'EUR', currencySymbol: '€' },
  { value: 'IT', label: 'Italy', dateFormat: 'DD/MM/YYYY', currencyCode: 'EUR', currencySymbol: '€' },
  { value: 'NL', label: 'Netherlands', dateFormat: 'DD-MM-YYYY', currencyCode: 'EUR', currencySymbol: '€' },
  { value: 'CA', label: 'Canada', dateFormat: 'MM/DD/YYYY', currencyCode: 'CAD', currencySymbol: 'C$' },
  { value: 'MX', label: 'Mexico', dateFormat: 'DD/MM/YYYY', currencyCode: 'MXN', currencySymbol: '$' },
  { value: 'AR', label: 'Argentina', dateFormat: 'DD/MM/YYYY', currencyCode: 'ARS', currencySymbol: '$' },
  { value: 'CL', label: 'Chile', dateFormat: 'DD/MM/YYYY', currencyCode: 'CLP', currencySymbol: '$' },
  { value: 'CO', label: 'Colombia', dateFormat: 'DD/MM/YYYY', currencyCode: 'COP', currencySymbol: '$' },
  { value: 'JP', label: 'Japan', dateFormat: 'YYYY/MM/DD', currencyCode: 'JPY', currencySymbol: '¥' },
  { value: 'KR', label: 'South Korea', dateFormat: 'YYYY.MM.DD', currencyCode: 'KRW', currencySymbol: '₩' },
  { value: 'CN', label: 'China', dateFormat: 'YYYY/MM/DD', currencyCode: 'CNY', currencySymbol: '¥' },
  { value: 'IN', label: 'India', dateFormat: 'DD/MM/YYYY', currencyCode: 'INR', currencySymbol: '₹' },
  { value: 'AU', label: 'Australia', dateFormat: 'DD/MM/YYYY', currencyCode: 'AUD', currencySymbol: 'A$' },
  { value: 'NZ', label: 'New Zealand', dateFormat: 'DD/MM/YYYY', currencyCode: 'NZD', currencySymbol: 'NZ$' },
  { value: 'ZA', label: 'South Africa', dateFormat: 'YYYY/MM/DD', currencyCode: 'ZAR', currencySymbol: 'R' },
  { value: 'NG', label: 'Nigeria', dateFormat: 'DD/MM/YYYY', currencyCode: 'NGN', currencySymbol: '₦' },
  { value: 'AE', label: 'United Arab Emirates', dateFormat: 'DD/MM/YYYY', currencyCode: 'AED', currencySymbol: 'د.إ' },
  { value: 'SA', label: 'Saudi Arabia', dateFormat: 'DD/MM/YYYY', currencyCode: 'SAR', currencySymbol: 'ر.س' },
  { value: 'IL', label: 'Israel', dateFormat: 'DD/MM/YYYY', currencyCode: 'ILS', currencySymbol: '₪' },
  { value: 'SE', label: 'Sweden', dateFormat: 'YYYY-MM-DD', currencyCode: 'SEK', currencySymbol: 'kr' },
  { value: 'NO', label: 'Norway', dateFormat: 'DD.MM.YYYY', currencyCode: 'NOK', currencySymbol: 'kr' },
  { value: 'DK', label: 'Denmark', dateFormat: 'DD-MM-YYYY', currencyCode: 'DKK', currencySymbol: 'kr' },
  { value: 'FI', label: 'Finland', dateFormat: 'DD.MM.YYYY', currencyCode: 'EUR', currencySymbol: '€' },
  { value: 'PL', label: 'Poland', dateFormat: 'DD.MM.YYYY', currencyCode: 'PLN', currencySymbol: 'zł' },
]

export interface CurrencyOption {
  value: string
  label: string
  symbol: string
}

export const CURRENCIES: CurrencyOption[] = [
  { value: 'USD', label: 'US Dollar', symbol: '$' },
  { value: 'EUR', label: 'Euro', symbol: '€' },
  { value: 'BRL', label: 'Brazilian Real', symbol: 'R$' },
  { value: 'GBP', label: 'British Pound', symbol: '£' },
  { value: 'CAD', label: 'Canadian Dollar', symbol: 'C$' },
  { value: 'AUD', label: 'Australian Dollar', symbol: 'A$' },
  { value: 'JPY', label: 'Japanese Yen', symbol: '¥' },
  { value: 'CNY', label: 'Chinese Yuan', symbol: '¥' },
  { value: 'INR', label: 'Indian Rupee', symbol: '₹' },
  { value: 'MXN', label: 'Mexican Peso', symbol: '$' },
  { value: 'ARS', label: 'Argentine Peso', symbol: '$' },
  { value: 'CLP', label: 'Chilean Peso', symbol: '$' },
  { value: 'COP', label: 'Colombian Peso', symbol: '$' },
  { value: 'KRW', label: 'South Korean Won', symbol: '₩' },
  { value: 'ZAR', label: 'South African Rand', symbol: 'R' },
  { value: 'AED', label: 'UAE Dirham', symbol: 'د.إ' },
  { value: 'SEK', label: 'Swedish Krona', symbol: 'kr' },
  { value: 'NOK', label: 'Norwegian Krone', symbol: 'kr' },
  { value: 'PLN', label: 'Polish Zloty', symbol: 'zł' },
  { value: 'ILS', label: 'Israeli Shekel', symbol: '₪' },
]

export const LANGUAGES: SelectFieldOption[] = [
  { value: 'en', label: 'English' },
  { value: 'pt-BR', label: 'Portuguese (Brazil)' },
  { value: 'pt-PT', label: 'Portuguese (Portugal)' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'it', label: 'Italian' },
  { value: 'nl', label: 'Dutch' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'zh', label: 'Chinese (Simplified)' },
  { value: 'ar', label: 'Arabic' },
  { value: 'hi', label: 'Hindi' },
  { value: 'pl', label: 'Polish' },
  { value: 'sv', label: 'Swedish' },
]

export const TIMEZONES: SelectFieldOption[] = [
  { value: 'America/Sao_Paulo', label: '(UTC-03:00) Sao Paulo' },
  { value: 'America/New_York', label: '(UTC-05:00) New York' },
  { value: 'America/Chicago', label: '(UTC-06:00) Chicago' },
  { value: 'America/Denver', label: '(UTC-07:00) Denver' },
  { value: 'America/Los_Angeles', label: '(UTC-08:00) Los Angeles' },
  { value: 'America/Anchorage', label: '(UTC-09:00) Anchorage' },
  { value: 'Pacific/Honolulu', label: '(UTC-10:00) Honolulu' },
  { value: 'America/Argentina/Buenos_Aires', label: '(UTC-03:00) Buenos Aires' },
  { value: 'America/Santiago', label: '(UTC-04:00) Santiago' },
  { value: 'America/Bogota', label: '(UTC-05:00) Bogota' },
  { value: 'America/Mexico_City', label: '(UTC-06:00) Mexico City' },
  { value: 'America/Toronto', label: '(UTC-05:00) Toronto' },
  { value: 'Europe/London', label: '(UTC+00:00) London' },
  { value: 'Europe/Paris', label: '(UTC+01:00) Paris' },
  { value: 'Europe/Berlin', label: '(UTC+01:00) Berlin' },
  { value: 'Europe/Madrid', label: '(UTC+01:00) Madrid' },
  { value: 'Europe/Rome', label: '(UTC+01:00) Rome' },
  { value: 'Europe/Lisbon', label: '(UTC+00:00) Lisbon' },
  { value: 'Europe/Amsterdam', label: '(UTC+01:00) Amsterdam' },
  { value: 'Europe/Stockholm', label: '(UTC+01:00) Stockholm' },
  { value: 'Europe/Warsaw', label: '(UTC+01:00) Warsaw' },
  { value: 'Europe/Helsinki', label: '(UTC+02:00) Helsinki' },
  { value: 'Europe/Istanbul', label: '(UTC+03:00) Istanbul' },
  { value: 'Asia/Dubai', label: '(UTC+04:00) Dubai' },
  { value: 'Asia/Kolkata', label: '(UTC+05:30) Kolkata' },
  { value: 'Asia/Shanghai', label: '(UTC+08:00) Shanghai' },
  { value: 'Asia/Tokyo', label: '(UTC+09:00) Tokyo' },
  { value: 'Asia/Seoul', label: '(UTC+09:00) Seoul' },
  { value: 'Australia/Sydney', label: '(UTC+11:00) Sydney' },
  { value: 'Pacific/Auckland', label: '(UTC+13:00) Auckland' },
]

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { Eye, EyeOff, Plus, Search, Check } from 'lucide-react'
import { trpc } from '../../../lib/trpc'
import { WizardStepLayout } from '../../molecules/WizardStepLayout/WizardStepLayout'
import { Input } from '../../atoms/Input/Input'
import { SelectField } from '../../atoms/SelectField/SelectField'
import { ChipSelect } from '../../atoms/ChipSelect/ChipSelect'
import { ColorPicker } from '../../atoms/ColorPicker/ColorPicker'
import { FileUpload } from '../../atoms/FileUpload/FileUpload'
import { MultiSelect } from '../../molecules/MultiSelect/MultiSelect'
import { TeamInviteRow } from '../../molecules/TeamInviteRow/TeamInviteRow'
import { OnboardingPathCard } from '../../molecules/OnboardingPathCard/OnboardingPathCard'
import { RoutineSelector } from '../../organisms/RoutineSelector/RoutineSelector'
import { Button } from '../../atoms/Button/Button'
import { WelcomePanel } from '../../molecules/WizardShowcasePanel/panels/WelcomePanel'
import { OrgPreviewPanel } from '../../molecules/WizardShowcasePanel/panels/OrgPreviewPanel'
import { NichePreviewPanel } from '../../molecules/WizardShowcasePanel/panels/NichePreviewPanel'
import { LocalePreviewPanel } from '../../molecules/WizardShowcasePanel/panels/LocalePreviewPanel'
import { TeamPreviewPanel } from '../../molecules/WizardShowcasePanel/panels/TeamPreviewPanel'
import { PathPreviewPanel } from '../../molecules/WizardShowcasePanel/panels/PathPreviewPanel'
import { RoutinesPreviewPanel } from '../../molecules/WizardShowcasePanel/panels/RoutinesPreviewPanel'
import { EmailPreviewPanel } from '../../molecules/WizardShowcasePanel/panels/EmailPreviewPanel'
import { PluginsPreviewPanel } from '../../molecules/WizardShowcasePanel/panels/PluginsPreviewPanel'
import { AIPreviewPanel } from '../../molecules/WizardShowcasePanel/panels/AIPreviewPanel'
import type { AIProvider, OllamaModel } from '../../molecules/WizardShowcasePanel/panels/AIPreviewPanel'
import { useTranslation } from 'react-i18next'
import { NICHES } from '../../../data/niches'
import { COUNTRIES, LANGUAGES, TIMEZONES, CURRENCIES, type CountryLocale } from '../../../data/locale-options'
import { ROUTINE_TEMPLATES } from '../../../data/routine-templates'
import type { OnboardingPath } from '../../molecules/WizardShowcasePanel/panels/PathPreviewPanel'

// Step and strength label keys (resolved inside component with useTranslation)
const STEP_KEYS = [
  'setup.steps.account',
  'setup.steps.organization',
  'setup.steps.details',
  'setup.steps.preferences',
  'setup.steps.team',
  'setup.steps.path',
  'setup.steps.routines',
  'setup.steps.email',
  'setup.steps.ai',
  'setup.steps.plugins',
]

export interface NewWorkspaceWizardData {
  // Account
  name: string
  email: string
  password: string
  confirmPassword: string
  // Organization
  orgName: string
  orgLogo: string
  accentColor: string
  // Details
  website: string
  niche: string
  subNiche: string
  // Preferences
  country: string
  language: string
  timezone: string
  currencies: string[]
  // Team
  invites: string[]
  // Path
  onboardingPath: OnboardingPath
  // Routines
  selectedRoutines: string[]
  // Email
  emailProvider: 'gmail' | 'outlook' | 'smtp' | null
  smtpHost: string
  smtpPort: string
  smtpUser: string
  smtpPass: string
  smtpFrom: string
  smtpSecure: boolean
  // AI
  aiProvider: AIProvider
  aiApiKey: string
  aiOllamaModel: OllamaModel
  // Plugins
  selectedPlugins: string[]
}

export interface NewWorkspaceWizardProps {
  onSubmit?: (data: NewWorkspaceWizardData) => void
  /** Called when leaving step 0 to create and authenticate the user account. */
  onCreateAccount?: (name: string, email: string, password: string) => Promise<void>
  /** Called when user wants to connect Gmail/Outlook. Should return the connected email address or null. */
  onConnectEmail?: (provider: 'gmail' | 'outlook') => Promise<string | null>
  /** Email address of currently connected account (if any) */
  connectedEmail?: string | null
  /** Called when user wants to connect OpenRouter via OAuth. Should return true on success. */
  onConnectOpenRouter?: () => Promise<boolean>
  /** Whether OpenRouter is already connected */
  openRouterConnected?: boolean
  /** Start on a specific step (for Storybook previews) */
  initialStep?: number
  /** Pre-fill form data (for Storybook previews) */
  initialData?: Partial<NewWorkspaceWizardData>
}

function getPasswordStrength(pw: string): number {
  if (!pw) return 0
  let score = 0
  if (pw.length >= 8) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  return score
}

const STRENGTH_LABEL_KEYS = [
  'setup.account.strength.weak',
  'setup.account.strength.weak',
  'setup.account.strength.fair',
  'setup.account.strength.good',
  'setup.account.strength.strong',
]
const STRENGTH_COLORS = ['#e2445c', '#e2445c', '#fdab3d', '#00c875', '#00c875']

/** Map browser locale to country/language/timezone from our option lists */
function detectBrowserLocale() {
  const browserLang = navigator.language || 'en' // e.g. "pt-BR", "en-US"
  const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone // e.g. "America/Sao_Paulo"

  // Extract region code from browser language (e.g. "pt-BR" -> "BR", "en-US" -> "US")
  const parts = browserLang.split('-')
  const regionCode = parts.length > 1 ? parts[1].toUpperCase() : ''
  const langCode = parts[0].toLowerCase()

  // Match country: first try region code, then try language -> country mapping
  const LANG_TO_COUNTRY: Record<string, string> = {
    pt: 'BR', en: 'US', es: 'ES', fr: 'FR', de: 'DE', it: 'IT', nl: 'NL',
    ja: 'JP', ko: 'KR', zh: 'CN', hi: 'IN', pl: 'PL', sv: 'SE', ar: 'AE',
  }
  const countryMatch = COUNTRIES.find((c) => c.value === regionCode)
    || COUNTRIES.find((c) => c.value === LANG_TO_COUNTRY[langCode])
    || COUNTRIES.find((c) => c.value === 'US')

  // Match language: try full tag first (e.g. "pt-BR"), then base code
  const languageMatch = LANGUAGES.find((l) => l.value.toLowerCase() === browserLang.toLowerCase())
    || LANGUAGES.find((l) => l.value.toLowerCase() === langCode)
    || LANGUAGES.find((l) => l.value === 'en')

  // Match timezone directly
  const timezoneMatch = TIMEZONES.find((tz) => tz.value === browserTz)
    || TIMEZONES.find((tz) => tz.value === 'America/New_York')

  // Default currency from matched country
  const currencyCode = countryMatch?.currencyCode
  const defaultCurrencies = currencyCode ? [currencyCode] : ['USD']

  return {
    country: countryMatch?.value || 'US',
    language: languageMatch?.value || 'en',
    timezone: timezoneMatch?.value || 'America/New_York',
    currencies: defaultCurrencies,
  }
}

const STORAGE_KEY = 'aex-setup-wizard'

function loadSavedState(): { step: number; data: Partial<NewWorkspaceWizardData> } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function clearSavedState() {
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem('aex-tour-completed')
}

export function NewWorkspaceWizard({ onSubmit, onCreateAccount, onConnectEmail, connectedEmail, onConnectOpenRouter, openRouterConnected = false, initialStep = 0, initialData }: NewWorkspaceWizardProps) {
  const { t } = useTranslation()

  const STEPS = useMemo(() => STEP_KEYS.map((key) => ({ label: t(key) })), [t])
  const STRENGTH_LABELS = useMemo(() => STRENGTH_LABEL_KEYS.map((key) => t(key)), [t])

  const [connectingEmail, setConnectingEmail] = useState(false)
  const [connectingOpenRouter, setConnectingOpenRouter] = useState(false)
  const [orConnected, setOrConnected] = useState(openRouterConnected)
  const [accountCreated, setAccountCreated] = useState(false)
  const saved = useMemo(() => loadSavedState(), [])
  const source = saved?.data ?? initialData

  const [step, setStep] = useState(saved?.step ?? initialStep)
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [data, setData] = useState<NewWorkspaceWizardData>({
    name: source?.name ?? '',
    email: source?.email ?? '',
    password: '',
    confirmPassword: '',
    orgName: source?.orgName ?? '',
    orgLogo: source?.orgLogo ?? '',
    accentColor: source?.accentColor ?? '#EA580C',
    website: source?.website ?? '',
    niche: source?.niche ?? '',
    subNiche: source?.subNiche ?? '',
    country: source?.country ?? '',
    language: source?.language ?? '',
    timezone: source?.timezone ?? '',
    currencies: source?.currencies ?? [],
    invites: source?.invites ?? [''],
    onboardingPath: source?.onboardingPath ?? null,
    selectedRoutines: source?.selectedRoutines ?? [],
    emailProvider: source?.emailProvider ?? null,
    smtpHost: source?.smtpHost ?? '',
    smtpPort: source?.smtpPort ?? '587',
    smtpUser: source?.smtpUser ?? '',
    smtpPass: '',
    smtpFrom: source?.smtpFrom ?? '',
    smtpSecure: source?.smtpSecure ?? true,
    aiProvider: source?.aiProvider ?? null,
    aiApiKey: '',
    aiOllamaModel: source?.aiOllamaModel ?? null,
    selectedPlugins: source?.selectedPlugins ?? [],
  })

  // Persist wizard state to localStorage (excluding passwords)
  useEffect(() => {
    const { password, confirmPassword, smtpPass, aiApiKey, ...safe } = data
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ step, data: safe }))
  }, [step, data])

  // Refs for team invite inputs
  const inviteRefs = useRef<(HTMLInputElement | null)[]>([])

  // Pre-fill locale fields from browser on mount (only if not provided via initialData)
  useEffect(() => {
    if (initialData?.country && initialData?.language && initialData?.timezone) return
    const locale = detectBrowserLocale()
    setData((prev) => ({
      ...prev,
      country: prev.country || locale.country,
      language: prev.language || locale.language,
      timezone: prev.timezone || locale.timezone,
      currencies: prev.currencies.length > 0 ? prev.currencies : locale.currencies,
    }))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const update = useCallback(<K extends keyof NewWorkspaceWizardData>(key: K, value: NewWorkspaceWizardData[K]) => {
    setData((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }, [])

  // Niche chip options
  const nicheOptions = useMemo(
    () => NICHES.map((n) => ({ value: n.id, label: n.label })),
    []
  )

  const subNicheOptions = useMemo(() => {
    const niche = NICHES.find((n) => n.id === data.niche)
    return niche ? niche.subNiches.map((s) => ({ value: s.id, label: s.label })) : []
  }, [data.niche])

  // Routines recommended for the selected niche (used for pre-selection)
  const nicheRoutineIds = useMemo(() => {
    if (!data.niche) return ROUTINE_TEMPLATES.map((r) => r.id)
    return ROUTINE_TEMPLATES.filter((r) => r.niches.includes(data.niche)).map((r) => r.id)
  }, [data.niche])

  // Validation
  const validate = useCallback((): boolean => {
    const errs: Record<string, string> = {}
    switch (step) {
      case 0:
        if (!data.name.trim()) errs.name = t('setup.validation.nameRequired')
        if (!data.email.trim()) errs.email = t('setup.validation.emailRequired')
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errs.email = t('setup.validation.emailInvalid')
        if (!data.password) errs.password = t('setup.validation.passwordRequired')
        else if (data.password.length < 8) errs.password = t('setup.validation.passwordMinLength')
        if (data.password !== data.confirmPassword) errs.confirmPassword = t('setup.validation.passwordMismatch')
        break
      case 1:
        if (!data.orgName.trim()) errs.orgName = t('setup.validation.orgNameRequired')
        break
      case 2:
        if (!data.niche) errs.niche = t('setup.validation.nicheRequired')
        break
      case 3:
        if (!data.country) errs.country = t('setup.validation.countryRequired')
        if (!data.language) errs.language = t('setup.validation.languageRequired')
        if (!data.timezone) errs.timezone = t('setup.validation.timezoneRequired')
        break
      case 5:
        if (!data.onboardingPath) errs.onboardingPath = t('setup.validation.pathRequired')
        break
      case 8:
        if (!data.aiProvider) errs.aiProvider = t('setup.ai.providerRequired')
        if (data.aiProvider === 'openai' && !data.aiApiKey.trim()) errs.aiApiKey = t('setup.ai.apiKeyRequired')
        if (data.aiProvider === 'openrouter' && !orConnected) errs.aiProvider = t('setup.ai.openrouter.connectButton')
        if (data.aiProvider === 'ollama' && !data.aiOllamaModel) errs.aiOllamaModel = t('setup.ai.modelRequired')
        break
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }, [step, data, orConnected])

  const handleNext = useCallback(async () => {
    if (!validate()) return

    // Create account when leaving step 0 (so user has a session for OAuth later)
    if (step === 0 && !accountCreated && onCreateAccount) {
      try {
        setSubmitting(true)
        await onCreateAccount(data.name, data.email, data.password)
        setAccountCreated(true)
      } catch (err) {
        setErrors({ email: err instanceof Error ? err.message : 'Failed to create account' })
        return
      } finally {
        setSubmitting(false)
      }
    }

    if (step === 5 && data.onboardingPath === 'default') {
      // Pre-select routines matching the niche
      setData((prev) => ({
        ...prev,
        selectedRoutines: nicheRoutineIds,
      }))
      setStep(6)
      return
    }

    if (step === 5 && data.onboardingPath === 'scratch') {
      // Skip routines, go to SMTP
      setStep(7)
      return
    }

    if (step === STEPS.length - 1) {
      setSubmitting(true)
      clearSavedState()
      onSubmit?.(data)
      return
    }

    setStep((s) => s + 1)
  }, [step, data, validate, onSubmit, onCreateAccount, accountCreated, nicheRoutineIds])

  const handleBack = useCallback(() => {
    if (step === 7 && data.onboardingPath === 'scratch') {
      // Skip routines going back
      setStep(5)
      return
    }
    setStep((s) => Math.max(0, s - 1))
  }, [step, data.onboardingPath])

  const [showSmtpPass, setShowSmtpPass] = useState(false)

  const toggleRoutine = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      selectedRoutines: prev.selectedRoutines.includes(id)
        ? prev.selectedRoutines.filter((r) => r !== id)
        : [...prev.selectedRoutines, id],
    }))
  }, [])

  // Team invite helpers
  const addInvite = useCallback(() => {
    setData((prev) => ({ ...prev, invites: [...prev.invites, ''] }))
  }, [])

  const removeInvite = useCallback((index: number) => {
    setData((prev) => ({
      ...prev,
      invites: prev.invites.filter((_, i) => i !== index),
    }))
  }, [])

  const updateInvite = useCallback((index: number, value: string) => {
    setData((prev) => ({
      ...prev,
      invites: prev.invites.map((v, i) => (i === index ? value : v)),
    }))
  }, [])

  // Password strength
  const pwStrength = getPasswordStrength(data.password)

  // Determine next button label
  const isLastStep = step === STEPS.length - 1
  const nextLabel = isLastStep ? t('setup.navigation.finish') : t('setup.navigation.next')

  // Build showcase content
  const showcaseContent = useMemo(() => {
    switch (step) {
      case 0:
        return <WelcomePanel />
      case 1:
        return <OrgPreviewPanel orgName={data.orgName} orgLogo={data.orgLogo} accentColor={data.accentColor} />
      case 2:
        return <NichePreviewPanel niche={data.niche} subNiche={data.subNiche} />
      case 3:
        return <LocalePreviewPanel country={data.country} language={data.language} timezone={data.timezone} />
      case 4:
        return <TeamPreviewPanel adminName={data.name} adminEmail={data.email} invites={data.invites} />
      case 5:
        return <PathPreviewPanel selectedPath={data.onboardingPath} />
      case 6:
        return <RoutinesPreviewPanel selectedRoutineIds={data.selectedRoutines} />
      case 7:
        return <EmailPreviewPanel provider={data.emailProvider} />
      case 8:
        return <AIPreviewPanel provider={data.aiProvider} ollamaModel={data.aiOllamaModel} />
      case 9:
        return <PluginsPreviewPanel selectedPlugins={data.selectedPlugins} />
      default:
        return <WelcomePanel />
    }
  }, [step, data])

  // Build step title and description
  const stepConfig = useMemo(() => {
    switch (step) {
      case 0:
        return { title: t('setup.account.title'), description: t('setup.account.description') }
      case 1:
        return { title: t('setup.organization.title'), description: t('setup.organization.description') }
      case 2:
        return { title: t('setup.details.title'), description: t('setup.details.description') }
      case 3:
        return { title: t('setup.preferences.title'), description: t('setup.preferences.description') }
      case 4:
        return { title: t('setup.team.title'), description: t('setup.team.description') }
      case 5:
        return { title: t('setup.path.title'), description: t('setup.path.description') }
      case 6:
        return { title: t('setup.routines.title'), description: t('setup.routines.description') }
      case 7:
        return { title: t('setup.email.title'), description: t('setup.email.description') }
      case 8:
        return { title: t('setup.ai.title'), description: t('setup.ai.description') }
      case 9:
        return { title: t('setup.plugins.title'), description: t('setup.plugins.description') }
      default:
        return { title: '', description: '' }
    }
  }, [step])

  return (
    <WizardStepLayout
      steps={STEPS}
      currentStep={step}
      title={stepConfig.title}
      description={stepConfig.description}
      showcaseContent={showcaseContent}
      onBack={step > 0 ? handleBack : undefined}
      onNext={handleNext}
      nextLabel={isLastStep ? (submitting ? t('setup.navigation.finishing') : t('setup.navigation.finish')) : t('setup.navigation.next')}
      nextDisabled={submitting}
      loading={submitting}
    >
      {/* Step 0: Account */}
      {step === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>
              {t('setup.account.name')}
            </label>
            <Input
              placeholder={t('setup.account.namePlaceholder')}
              value={data.name}
              onChange={(e) => update('name', e.target.value)}
              error={errors.name}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>
              {t('setup.account.email')}
            </label>
            <Input
              placeholder={t('setup.account.emailPlaceholder')}
              value={data.email}
              onChange={(e) => update('email', e.target.value)}
              type="email"
              error={errors.email}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>
              {t('setup.account.password')}
            </label>
            <Input
              placeholder={t('setup.account.passwordPlaceholder')}
              value={data.password}
              onChange={(e) => update('password', e.target.value)}
              type={showPassword ? 'text' : 'password'}
              error={errors.password}
              rightIcon={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? t('setup.account.hidePassword') : t('setup.account.showPassword')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 0 }}
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              }
            />
            {data.password && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <div style={{ flex: 1, display: 'flex', gap: 3 }}>
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      style={{
                        flex: 1,
                        height: 3,
                        borderRadius: 2,
                        background: i < pwStrength ? STRENGTH_COLORS[pwStrength] : 'var(--border)',
                        transition: 'background 0.2s',
                      }}
                    />
                  ))}
                </div>
                <span style={{ fontSize: 11, color: STRENGTH_COLORS[pwStrength], fontWeight: 500 }}>
                  {STRENGTH_LABELS[pwStrength]}
                </span>
              </div>
            )}
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>
              {t('setup.account.confirmPassword')}
            </label>
            <Input
              placeholder={t('setup.account.confirmPasswordPlaceholder')}
              value={data.confirmPassword}
              onChange={(e) => update('confirmPassword', e.target.value)}
              type={showPassword ? 'text' : 'password'}
              error={errors.confirmPassword}
              rightIcon={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? t('setup.account.hidePassword') : t('setup.account.showPassword')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 0 }}
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              }
            />
          </div>
        </div>
      )}

      {/* Step 1: Organization */}
      {step === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>
              {t('setup.organization.name')}
            </label>
            <Input
              placeholder={t('setup.organization.namePlaceholder')}
              value={data.orgName}
              onChange={(e) => update('orgName', e.target.value)}
              error={errors.orgName}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>
              {t('setup.organization.logo')}
            </label>
            <FileUpload
              value={data.orgLogo}
              onChange={(file) => {
                if (file) {
                  const reader = new FileReader()
                  reader.onload = (e) => update('orgLogo', e.target?.result as string)
                  reader.readAsDataURL(file)
                } else {
                  update('orgLogo', '')
                }
              }}
              hint={t('setup.organization.logoHint')}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>
              {t('setup.organization.accentColor')}
            </label>
            <ColorPicker
              value={data.accentColor}
              onChange={(color) => update('accentColor', color)}
            />
          </div>
        </div>
      )}

      {/* Step 2: Details */}
      {step === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>
              {t('setup.details.website')}
            </label>
            <Input
              placeholder={t('setup.details.websitePlaceholder')}
              value={data.website}
              onChange={(e) => update('website', e.target.value)}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 10 }}>
              {t('setup.details.niche')}
            </label>
            <ChipSelect
              options={nicheOptions}
              value={data.niche}
              onChange={(v) => {
                const val = Array.isArray(v) ? v[0] : v
                update('niche', val || '')
                update('subNiche', '')
              }}
              error={errors.niche}
            />
          </div>
          {subNicheOptions.length > 0 && (
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 10 }}>
                {t('setup.details.subNiche')}
              </label>
              <ChipSelect
                options={subNicheOptions}
                value={data.subNiche}
                onChange={(v) => update('subNiche', Array.isArray(v) ? v[0] : v || '')}
              />
            </div>
          )}
        </div>
      )}

      {/* Step 3: Preferences */}
      {step === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SelectField
            label={t('setup.preferences.country')}
            placeholder={t('setup.preferences.countryPlaceholder')}
            options={COUNTRIES}
            value={data.country}
            onChange={(e) => update('country', e.target.value)}
            error={errors.country}
          />
          <SelectField
            label={t('setup.preferences.language')}
            placeholder={t('setup.preferences.languagePlaceholder')}
            options={LANGUAGES}
            value={data.language}
            onChange={(e) => update('language', e.target.value)}
            error={errors.language}
          />
          <SelectField
            label={t('setup.preferences.timezone')}
            placeholder={t('setup.preferences.timezonePlaceholder')}
            options={TIMEZONES}
            value={data.timezone}
            onChange={(e) => update('timezone', e.target.value)}
            error={errors.timezone}
          />
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>
              {t('setup.preferences.currencies')}
            </label>
            <MultiSelect
              options={CURRENCIES}
              selected={data.currencies}
              onChange={(selected) => update('currencies', selected)}
              placeholder={t('setup.preferences.currenciesPlaceholder')}
            />
          </div>
        </div>
      )}

      {/* Step 4: Team */}
      {step === 4 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {data.invites.map((email, i) => (
            <TeamInviteRow
              key={i}
              value={email}
              placeholder={t('setup.team.emailPlaceholder')}
              onChange={(val) => {
                updateInvite(i, val)
                // Clear error for this invite when typing
                setErrors((prev) => {
                  const next = { ...prev }
                  delete next[`invite_${i}`]
                  return next
                })
              }}
              error={errors[`invite_${i}`]}
              onRemove={data.invites.length > 1 ? () => removeInvite(i) : undefined}
              onCommit={() => {
                const trimmed = email.trim()
                if (!trimmed) return
                // Validate email format
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
                  setErrors((prev) => ({ ...prev, [`invite_${i}`]: t('setup.validation.emailInvalid') }))
                  return
                }
                // Add new row and focus it
                setData((prev) => ({ ...prev, invites: [...prev.invites, ''] }))
                setTimeout(() => {
                  inviteRefs.current[i + 1]?.focus()
                }, 50)
              }}
              inputRef={(el) => { inviteRefs.current[i] = el }}
            />
          ))}
          <Button variant="ghost" size="sm" onClick={addInvite} leftIcon={<Plus size={14} />}>
            {t('setup.team.addAnother')}
          </Button>
        </div>
      )}

      {/* Step 5: Path Selection */}
      {step === 5 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 16 }}>
            <OnboardingPathCard
              title={t('setup.path.optionDefault.title')}
              description={t('setup.path.optionDefault.description')}
              icon="Sparkles"
              selected={data.onboardingPath === 'default'}
              onClick={() => update('onboardingPath', 'default')}
            />
            <OnboardingPathCard
              title={t('setup.path.optionScratch.title')}
              description={t('setup.path.optionScratch.description')}
              icon="Hammer"
              selected={data.onboardingPath === 'scratch'}
              onClick={() => update('onboardingPath', 'scratch')}
            />
          </div>
          {errors.onboardingPath && (
            <span style={{ fontSize: 12, color: 'var(--danger)' }}>{errors.onboardingPath}</span>
          )}
        </div>
      )}

      {/* Step 6: Routines */}
      {step === 6 && (
        <RoutineSelector
          routines={ROUTINE_TEMPLATES}
          selectedIds={data.selectedRoutines}
          onToggle={toggleRoutine}
        />
      )}

      {/* Step 7: Email */}
      {step === 7 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {/* Provider selection */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <OnboardingPathCard
              title={t('setup.email.gmail.title')}
              description={t('setup.email.gmail.description')}
              icon="Mail"
              selected={data.emailProvider === 'gmail'}
              onClick={() => update('emailProvider', data.emailProvider === 'gmail' ? null : 'gmail')}
            />
            <OnboardingPathCard
              title={t('setup.email.outlook.title')}
              description={t('setup.email.outlook.description')}
              icon="Mail"
              selected={data.emailProvider === 'outlook'}
              onClick={() => update('emailProvider', data.emailProvider === 'outlook' ? null : 'outlook')}
            />
            <OnboardingPathCard
              title={t('setup.email.smtp.title')}
              description={t('setup.email.smtp.description')}
              icon="Server"
              selected={data.emailProvider === 'smtp'}
              onClick={() => update('emailProvider', data.emailProvider === 'smtp' ? null : 'smtp')}
            />
          </div>

          {/* Gmail / Outlook connect */}
          {(data.emailProvider === 'gmail' || data.emailProvider === 'outlook') && (
            <div style={{ padding: 20, background: 'var(--accent-light)', borderRadius: 10, border: '1px solid var(--accent)', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {connectedEmail ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>
                    {t('setup.email.connected')} <strong>{connectedEmail}</strong>
                  </span>
                </div>
              ) : (
                <>
                  <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5, margin: 0 }}>
                    {t('setup.email.oauthNote')}
                  </p>
                  <Button
                    variant="primary"
                    loading={connectingEmail}
                    onClick={async () => {
                      if (!onConnectEmail) return
                      setConnectingEmail(true)
                      try {
                        await onConnectEmail(data.emailProvider as 'gmail' | 'outlook')
                      } finally {
                        setConnectingEmail(false)
                      }
                    }}
                  >
                    {connectingEmail ? t('setup.email.connecting') : t('setup.email.connectButton', { provider: data.emailProvider === 'gmail' ? 'Gmail' : 'Outlook' })}
                  </Button>
                </>
              )}
            </div>
          )}

          {/* SMTP form */}
          {data.emailProvider === 'smtp' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>
                    {t('setup.smtp.host')}
                  </label>
                  <Input
                    placeholder={t('setup.smtp.hostPlaceholder')}
                    value={data.smtpHost}
                    onChange={(e) => update('smtpHost', e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>
                    {t('setup.smtp.port')}
                  </label>
                  <Input
                    placeholder="587"
                    value={data.smtpPort}
                    onChange={(e) => update('smtpPort', e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>
                  {t('setup.smtp.user')}
                </label>
                <Input
                  placeholder={t('setup.smtp.userPlaceholder')}
                  value={data.smtpUser}
                  onChange={(e) => update('smtpUser', e.target.value)}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>
                  {t('setup.smtp.pass')}
                </label>
                <Input
                  placeholder={t('setup.smtp.passPlaceholder')}
                  value={data.smtpPass}
                  onChange={(e) => update('smtpPass', e.target.value)}
                  type={showSmtpPass ? 'text' : 'password'}
                  rightIcon={
                    <button
                      type="button"
                      onClick={() => setShowSmtpPass(!showSmtpPass)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 0 }}
                    >
                      {showSmtpPass ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  }
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>
                  {t('setup.smtp.from')}
                </label>
                <Input
                  placeholder={t('setup.smtp.fromPlaceholder')}
                  value={data.smtpFrom}
                  onChange={(e) => update('smtpFrom', e.target.value)}
                />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={data.smtpSecure}
                  onChange={(e) => update('smtpSecure', e.target.checked)}
                  style={{ accentColor: 'var(--accent)' }}
                />
                {t('setup.smtp.secure')}
              </label>
            </div>
          )}

          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
            {t('setup.email.hint')}
          </p>
        </div>
      )}

      {/* Step 8: AI Provider */}
      {step === 8 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {/* Provider selection */}
          <div style={{ display: 'flex', gap: 16 }}>
            <OnboardingPathCard
              title={t('setup.ai.openrouter.title')}
              description={t('setup.ai.openrouter.description')}
              icon="Zap"
              badge={t('setup.showcase.ai.recommended')}
              selected={data.aiProvider === 'openrouter'}
              onClick={() => update('aiProvider', data.aiProvider === 'openrouter' ? null : 'openrouter')}
            />
            <OnboardingPathCard
              title={t('setup.ai.openai.title')}
              description={t('setup.ai.openai.description')}
              icon="Cloud"
              selected={data.aiProvider === 'openai'}
              onClick={() => update('aiProvider', data.aiProvider === 'openai' ? null : 'openai')}
            />
            <OnboardingPathCard
              title={t('setup.ai.ollama.title')}
              description={t('setup.ai.ollama.description')}
              icon="Server"
              selected={data.aiProvider === 'ollama'}
              onClick={() => update('aiProvider', data.aiProvider === 'ollama' ? null : 'ollama')}
            />
          </div>
          {errors.aiProvider && (
            <span style={{ fontSize: 12, color: 'var(--danger)' }}>{errors.aiProvider}</span>
          )}

          {/* OpenRouter: OAuth connect */}
          {data.aiProvider === 'openrouter' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {orConnected ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: '#f0fdf4', borderRadius: 10, border: '1px solid #bbf7d0' }}>
                  <Check size={18} color="#16a34a" />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#15803d' }}>{t('setup.ai.openrouter.connected')}</div>
                    <div style={{ fontSize: 12, color: '#166534', marginTop: 2 }}>{t('setup.ai.openrouter.connectedHint')}</div>
                  </div>
                </div>
              ) : (
                <Button
                  onClick={async () => {
                    if (!onConnectOpenRouter) return
                    setConnectingOpenRouter(true)
                    try {
                      const ok = await onConnectOpenRouter()
                      if (ok) setOrConnected(true)
                    } finally {
                      setConnectingOpenRouter(false)
                    }
                  }}
                  disabled={connectingOpenRouter}
                  style={{ alignSelf: 'flex-start' }}
                >
                  {connectingOpenRouter ? t('setup.ai.openrouter.connecting') : t('setup.ai.openrouter.connectButton')}
                </Button>
              )}
            </div>
          )}

          {/* OpenAI: API Key input */}
          {data.aiProvider === 'openai' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>
                  {t('setup.ai.apiKey')}
                </label>
                <Input
                  placeholder={t('setup.ai.apiKeyPlaceholder')}
                  value={data.aiApiKey}
                  onChange={(e) => update('aiApiKey', e.target.value)}
                  type="password"
                  error={errors.aiApiKey}
                />
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '6px 0 0', lineHeight: 1.4 }}>
                  {t('setup.ai.apiKeyHint')}
                </p>
              </div>
            </div>
          )}

          {/* Ollama: Model selection */}
          {data.aiProvider === 'ollama' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
                {t('setup.ai.selectModel')}
              </label>
              {([
                { id: 'qwen3:72b' as OllamaModel, name: 'Qwen 3 72B', size: '~42 GB', badge: t('setup.showcase.ai.bestQuality'), badgeColor: '#00c875' },
                { id: 'qwen3:14b' as OllamaModel, name: 'Qwen 3 14B', size: '~9 GB', badge: t('setup.showcase.ai.recommended'), badgeColor: 'var(--accent)' },
                { id: 'qwen3:8b' as OllamaModel, name: 'Qwen 3 8B', size: '~5 GB', badge: t('setup.showcase.ai.budgetFriendly'), badgeColor: '#fdab3d' },
                { id: 'llama3.1:8b' as OllamaModel, name: 'Llama 3.1 8B', size: '~4.7 GB', badge: t('setup.showcase.ai.minimalSetup'), badgeColor: '#fdab3d' },
              ]).map((model) => (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => update('aiOllamaModel', data.aiOllamaModel === model.id ? null : model.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '14px 16px',
                    borderRadius: 10,
                    border: data.aiOllamaModel === model.id ? '2px solid var(--accent)' : '1px solid var(--border)',
                    background: data.aiOllamaModel === model.id ? 'var(--accent-light)' : '#fff',
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{model.name}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: '#fff', background: model.badgeColor, padding: '2px 8px', borderRadius: 10 }}>{model.badge}</span>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, display: 'block' }}>{t('setup.showcase.ai.downloadSize', { size: model.size })}</span>
                  </div>
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      border: data.aiOllamaModel === model.id ? '6px solid var(--accent)' : '2px solid var(--border)',
                      flexShrink: 0,
                      transition: 'border 0.15s ease',
                    }}
                  />
                </button>
              ))}
              {errors.aiOllamaModel && (
                <span style={{ fontSize: 12, color: 'var(--danger)' }}>{errors.aiOllamaModel}</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Step 9: Plugins */}
      {step === 9 && (
        <PluginSetupStep
          selectedPlugins={data.selectedPlugins}
          onToggle={(id) => {
            setData((prev) => ({
              ...prev,
              selectedPlugins: prev.selectedPlugins.includes(id)
                ? prev.selectedPlugins.filter((p) => p !== id)
                : [...prev.selectedPlugins, id],
            }))
          }}
        />
      )}
    </WizardStepLayout>
  )
}

// --- Plugin Setup Step Component ---

const PLUGIN_CATEGORIES = [
  { value: 'all', label: 'All' },
  { value: 'ARTIFICIAL_INTELLIGENCE', label: 'AI' },
  { value: 'COMMUNICATION', label: 'Communication' },
  { value: 'PRODUCTIVITY', label: 'Productivity' },
  { value: 'DEVELOPER_TOOLS', label: 'Dev Tools' },
  { value: 'SALES_AND_CRM', label: 'Sales & CRM' },
  { value: 'COMMERCE', label: 'Commerce' },
  { value: 'PAYMENT_PROCESSING', label: 'Payments' },
  { value: 'MARKETING', label: 'Marketing' },
  { value: 'CONTENT_AND_FILES', label: 'Content & Files' },
  { value: 'CUSTOMER_SUPPORT', label: 'Support' },
  { value: 'FORMS_AND_SURVEYS', label: 'Forms' },
  { value: 'BUSINESS_INTELLIGENCE', label: 'Analytics' },
  { value: 'ACCOUNTING', label: 'Accounting' },
  { value: 'HUMAN_RESOURCES', label: 'HR' },
]

interface CatalogEntry {
  id: string
  name: string
  displayName: string
  description: string
  version: string
  category: string
  logoUrl: string
}

// Fetch catalog from backend (single source of truth)
function usePieceCatalog() {
  const { data } = trpc.plugins.catalog.useQuery(undefined, { staleTime: Infinity })
  return (data ?? []) as CatalogEntry[]
}

function PluginSetupStep({ selectedPlugins, onToggle }: { selectedPlugins: string[]; onToggle: (id: string) => void }) {
  const { t } = useTranslation()
  const catalog = usePieceCatalog()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')

  const filtered = useMemo(() => {
    let result = catalog
    if (search) {
      const q = search.toLowerCase()
      result = result.filter((p) => p.displayName.toLowerCase().includes(q) || p.description.toLowerCase().includes(q))
    }
    if (category !== 'all') {
      result = result.filter((p) => p.category === category)
    }
    return result
  }, [catalog, search, category])

  // Show max 60 items at a time
  const [page, setPage] = useState(1)
  const visible = filtered.slice(0, page * 60)
  const hasMore = visible.length < filtered.length

  // Reset page on filter change
  useEffect(() => { setPage(1) }, [search, category])

  const CATEGORY_LABELS: Record<string, string> = {
    ARTIFICIAL_INTELLIGENCE: 'AI',
    COMMUNICATION: 'Communication',
    COMMERCE: 'Commerce',
    PRODUCTIVITY: 'Productivity',
    DEVELOPER_TOOLS: 'Dev Tools',
    SALES_AND_CRM: 'Sales & CRM',
    PAYMENT_PROCESSING: 'Payments',
    MARKETING: 'Marketing',
    CONTENT_AND_FILES: 'Content',
    CUSTOMER_SUPPORT: 'Support',
    FORMS_AND_SURVEYS: 'Forms',
    BUSINESS_INTELLIGENCE: 'Analytics',
    ACCOUNTING: 'Accounting',
    HUMAN_RESOURCES: 'HR',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Selected count */}
      {selectedPlugins.length > 0 && (
        <div style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>
          {selectedPlugins.length} {selectedPlugins.length === 1 ? 'plugin' : 'plugins'} selected
        </div>
      )}

      {/* Search */}
      <div style={{ position: 'relative' }}>
        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input
          type="text"
          placeholder={t('setup.plugins.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%', padding: '8px 12px 8px 30px', borderRadius: 8,
            border: '1px solid var(--border)', background: 'var(--surface)',
            color: 'var(--text)', fontSize: 13, fontFamily: 'inherit',
            outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Category tabs */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {PLUGIN_CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            type="button"
            onClick={() => setCategory(cat.value)}
            style={{
              padding: '3px 8px', borderRadius: 6, fontSize: 11, fontFamily: 'inherit',
              border: '1px solid ' + (category === cat.value ? 'var(--accent)' : 'var(--border)'),
              background: category === cat.value ? 'var(--accent-light)' : 'transparent',
              color: category === cat.value ? 'var(--accent)' : 'var(--text-muted)',
              cursor: 'pointer', fontWeight: category === cat.value ? 600 : 400,
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Plugin list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 340, overflowY: 'auto' }}>
        {visible.map((plugin) => {
          const selected = selectedPlugins.includes(plugin.id)
          return (
            <button
              key={plugin.id}
              type="button"
              onClick={() => onToggle(plugin.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 8, textAlign: 'left', width: '100%',
                border: selected ? '2px solid var(--accent)' : '1px solid var(--border)',
                background: selected ? 'var(--accent-light)' : '#fff',
                cursor: 'pointer', transition: 'all 0.12s ease',
              }}
            >
              {/* Plugin logo */}
              {selected ? (
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  background: 'var(--accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Check size={14} color="#fff" />
                </div>
              ) : (
                <img
                  src={plugin.logoUrl}
                  alt={plugin.displayName}
                  style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, objectFit: 'contain' }}
                  onError={(e) => { (e.target as HTMLImageElement).src = '' }}
                />
              )}

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{plugin.displayName}</span>
                  <span style={{
                    fontSize: 9, color: 'var(--text-muted)', background: 'var(--surface-2)',
                    padding: '1px 5px', borderRadius: 8, border: '1px solid var(--border)',
                  }}>
                    {CATEGORY_LABELS[plugin.category] ?? plugin.category}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {plugin.description}
                </div>
              </div>
            </button>
          )
        })}

        {/* Load more */}
        {hasMore && (
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            style={{
              padding: '8px 16px', borderRadius: 8, fontSize: 12, fontFamily: 'inherit',
              border: '1px solid var(--border)', background: 'var(--surface)',
              color: 'var(--text-muted)', cursor: 'pointer', textAlign: 'center',
            }}
          >
            Load more ({filtered.length - visible.length} remaining)
          </button>
        )}

        {filtered.length === 0 && catalog.length > 0 && (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            No plugins match your search.
          </div>
        )}

        {catalog.length === 0 && (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            Loading plugin catalog...
          </div>
        )}
      </div>
    </div>
  )
}

export default NewWorkspaceWizard

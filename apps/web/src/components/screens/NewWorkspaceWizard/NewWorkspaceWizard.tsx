import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { Eye, EyeOff, Plus } from 'lucide-react'
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
import { PluginsPreviewPanel } from '../../molecules/WizardShowcasePanel/panels/PluginsPreviewPanel'
import { t } from '../../../locales/en'
import { NICHES } from '../../../data/niches'
import { COUNTRIES, LANGUAGES, TIMEZONES, CURRENCIES, type CountryLocale } from '../../../data/locale-options'
import { ROUTINE_TEMPLATES } from '../../../data/routine-templates'
import type { OnboardingPath } from '../../molecules/WizardShowcasePanel/panels/PathPreviewPanel'

// Step definitions
const STEPS = [
  { label: t.setup.steps.account },
  { label: t.setup.steps.organization },
  { label: t.setup.steps.details },
  { label: t.setup.steps.preferences },
  { label: t.setup.steps.team },
  { label: t.setup.steps.path },
  { label: t.setup.steps.routines },
  { label: t.setup.steps.plugins },
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
}

export interface NewWorkspaceWizardProps {
  onSubmit?: (data: NewWorkspaceWizardData) => void
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

const STRENGTH_LABELS = [
  t.setup.account.strength.weak,
  t.setup.account.strength.weak,
  t.setup.account.strength.fair,
  t.setup.account.strength.good,
  t.setup.account.strength.strong,
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

export function NewWorkspaceWizard({ onSubmit, initialStep = 0, initialData }: NewWorkspaceWizardProps) {
  const [step, setStep] = useState(initialStep)
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [data, setData] = useState<NewWorkspaceWizardData>({
    name: initialData?.name ?? '',
    email: initialData?.email ?? '',
    password: initialData?.password ?? '',
    confirmPassword: initialData?.confirmPassword ?? '',
    orgName: initialData?.orgName ?? '',
    orgLogo: initialData?.orgLogo ?? '',
    accentColor: initialData?.accentColor ?? '#EA580C',
    website: initialData?.website ?? '',
    niche: initialData?.niche ?? '',
    subNiche: initialData?.subNiche ?? '',
    country: initialData?.country ?? '',
    language: initialData?.language ?? '',
    timezone: initialData?.timezone ?? '',
    currencies: initialData?.currencies ?? [],
    invites: initialData?.invites ?? [''],
    onboardingPath: initialData?.onboardingPath ?? null,
    selectedRoutines: initialData?.selectedRoutines ?? [],
  })

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

  // Filtered routines by niche
  const filteredRoutines = useMemo(() => {
    if (!data.niche) return ROUTINE_TEMPLATES
    return ROUTINE_TEMPLATES.filter((r) => r.niches.includes(data.niche))
  }, [data.niche])

  // Validation
  const validate = useCallback((): boolean => {
    const errs: Record<string, string> = {}
    switch (step) {
      case 0:
        if (!data.name.trim()) errs.name = t.setup.validation.nameRequired
        if (!data.email.trim()) errs.email = t.setup.validation.emailRequired
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errs.email = t.setup.validation.emailInvalid
        if (!data.password) errs.password = t.setup.validation.passwordRequired
        else if (data.password.length < 8) errs.password = t.setup.validation.passwordMinLength
        if (data.password !== data.confirmPassword) errs.confirmPassword = t.setup.validation.passwordMismatch
        break
      case 1:
        if (!data.orgName.trim()) errs.orgName = t.setup.validation.orgNameRequired
        break
      case 2:
        if (!data.niche) errs.niche = t.setup.validation.nicheRequired
        break
      case 3:
        if (!data.country) errs.country = t.setup.validation.countryRequired
        if (!data.language) errs.language = t.setup.validation.languageRequired
        if (!data.timezone) errs.timezone = t.setup.validation.timezoneRequired
        break
      case 5:
        if (!data.onboardingPath) errs.onboardingPath = t.setup.validation.pathRequired
        break
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }, [step, data])

  const handleNext = useCallback(() => {
    if (!validate()) return

    if (step === 5 && data.onboardingPath === 'default') {
      // Pre-select all filtered routines
      setData((prev) => ({
        ...prev,
        selectedRoutines: filteredRoutines.map((r) => r.id),
      }))
      setStep(6)
      return
    }

    if (step === 5 && data.onboardingPath === 'scratch') {
      // Skip routines, go to plugins
      setStep(7)
      return
    }

    if (step === STEPS.length - 1) {
      setSubmitting(true)
      onSubmit?.(data)
      return
    }

    setStep((s) => s + 1)
  }, [step, data, validate, onSubmit, filteredRoutines])

  const handleBack = useCallback(() => {
    if (step === 7 && data.onboardingPath === 'scratch') {
      // Skip routines going back
      setStep(5)
      return
    }
    setStep((s) => Math.max(0, s - 1))
  }, [step, data.onboardingPath])

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
  const nextLabel = isLastStep ? t.setup.navigation.finish : t.setup.navigation.next

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
        return <PluginsPreviewPanel />
      default:
        return <WelcomePanel />
    }
  }, [step, data])

  // Build step title and description
  const stepConfig = useMemo(() => {
    switch (step) {
      case 0:
        return { title: t.setup.account.title, description: t.setup.account.description }
      case 1:
        return { title: t.setup.organization.title, description: t.setup.organization.description }
      case 2:
        return { title: t.setup.details.title, description: t.setup.details.description }
      case 3:
        return { title: t.setup.preferences.title, description: t.setup.preferences.description }
      case 4:
        return { title: t.setup.team.title, description: t.setup.team.description }
      case 5:
        return { title: t.setup.path.title, description: t.setup.path.description }
      case 6:
        return { title: t.setup.routines.title, description: t.setup.routines.description }
      case 7:
        return { title: t.setup.plugins.title, description: t.setup.plugins.description }
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
      nextLabel={isLastStep ? (submitting ? t.setup.navigation.finishing : t.setup.navigation.finish) : t.setup.navigation.next}
      nextDisabled={submitting}
      loading={submitting}
    >
      {/* Step 0: Account */}
      {step === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>
              {t.setup.account.name}
            </label>
            <Input
              placeholder={t.setup.account.namePlaceholder}
              value={data.name}
              onChange={(e) => update('name', e.target.value)}
              error={errors.name}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>
              {t.setup.account.email}
            </label>
            <Input
              placeholder={t.setup.account.emailPlaceholder}
              value={data.email}
              onChange={(e) => update('email', e.target.value)}
              type="email"
              error={errors.email}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>
              {t.setup.account.password}
            </label>
            <Input
              placeholder={t.setup.account.passwordPlaceholder}
              value={data.password}
              onChange={(e) => update('password', e.target.value)}
              type={showPassword ? 'text' : 'password'}
              error={errors.password}
              rightIcon={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? t.setup.account.hidePassword : t.setup.account.showPassword}
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
              {t.setup.account.confirmPassword}
            </label>
            <Input
              placeholder={t.setup.account.confirmPasswordPlaceholder}
              value={data.confirmPassword}
              onChange={(e) => update('confirmPassword', e.target.value)}
              type={showPassword ? 'text' : 'password'}
              error={errors.confirmPassword}
            />
          </div>
        </div>
      )}

      {/* Step 1: Organization */}
      {step === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>
              {t.setup.organization.name}
            </label>
            <Input
              placeholder={t.setup.organization.namePlaceholder}
              value={data.orgName}
              onChange={(e) => update('orgName', e.target.value)}
              error={errors.orgName}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>
              {t.setup.organization.logo}
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
              hint={t.setup.organization.logoHint}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>
              {t.setup.organization.accentColor}
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
              {t.setup.details.website}
            </label>
            <Input
              placeholder={t.setup.details.websitePlaceholder}
              value={data.website}
              onChange={(e) => update('website', e.target.value)}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 10 }}>
              {t.setup.details.niche}
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
                {t.setup.details.subNiche}
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
            label={t.setup.preferences.country}
            placeholder={t.setup.preferences.countryPlaceholder}
            options={COUNTRIES}
            value={data.country}
            onChange={(e) => update('country', e.target.value)}
            error={errors.country}
          />
          <SelectField
            label={t.setup.preferences.language}
            placeholder={t.setup.preferences.languagePlaceholder}
            options={LANGUAGES}
            value={data.language}
            onChange={(e) => update('language', e.target.value)}
            error={errors.language}
          />
          <SelectField
            label={t.setup.preferences.timezone}
            placeholder={t.setup.preferences.timezonePlaceholder}
            options={TIMEZONES}
            value={data.timezone}
            onChange={(e) => update('timezone', e.target.value)}
            error={errors.timezone}
          />
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>
              {t.setup.preferences.currencies}
            </label>
            <MultiSelect
              options={CURRENCIES}
              selected={data.currencies}
              onChange={(selected) => update('currencies', selected)}
              placeholder={t.setup.preferences.currenciesPlaceholder}
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
              placeholder={t.setup.team.emailPlaceholder}
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
                  setErrors((prev) => ({ ...prev, [`invite_${i}`]: t.setup.validation.emailInvalid }))
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
            {t.setup.team.addAnother}
          </Button>
        </div>
      )}

      {/* Step 5: Path Selection */}
      {step === 5 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 16 }}>
            <OnboardingPathCard
              title={t.setup.path.optionDefault.title}
              description={t.setup.path.optionDefault.description}
              icon="Sparkles"
              selected={data.onboardingPath === 'default'}
              onClick={() => update('onboardingPath', 'default')}
            />
            <OnboardingPathCard
              title={t.setup.path.optionScratch.title}
              description={t.setup.path.optionScratch.description}
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
          routines={filteredRoutines}
          selectedIds={data.selectedRoutines}
          onToggle={toggleRoutine}
        />
      )}

      {/* Step 7: Plugins */}
      {step === 7 && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 14 }}>
          {t.setup.plugins.placeholder}
        </div>
      )}
    </WizardStepLayout>
  )
}

export default NewWorkspaceWizard

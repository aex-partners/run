import { useState, useCallback } from 'react'
import Joyride, { type CallBackProps, type Step, STATUS, ACTIONS, EVENTS } from 'react-joyride'
import { t } from '../../../locales/en'

const TOUR_STORAGE_KEY = 'aex-tour-completed'

function buildSteps(isAdmin: boolean): Step[] {
  const steps: Step[] = [
    {
      target: '[data-tour="nav-chat"]',
      title: t.tour.chat.title,
      content: t.tour.chat.content,
      disableBeacon: true,
      placement: 'right',
    },
    {
      target: '[data-tour="conversation-list"]',
      title: t.tour.conversationList.title,
      content: t.tour.conversationList.content,
      placement: 'right',
    },
    {
      target: '[data-tour="new-conversation"]',
      title: t.tour.newConversation.title,
      content: t.tour.newConversation.content,
      placement: 'bottom',
    },
    {
      target: '[data-tour="nav-database"]',
      title: t.tour.database.title,
      content: t.tour.database.content,
      placement: 'right',
    },
    {
      target: '[data-tour="nav-tasks"]',
      title: t.tour.tasks.title,
      content: t.tour.tasks.content,
      placement: 'right',
    },
    {
      target: '[data-tour="nav-workflows"]',
      title: t.tour.workflows.title,
      content: t.tour.workflows.content,
      placement: 'right',
    },
  ]

  if (isAdmin) {
    steps.push({
      target: '[data-tour="nav-settings"]',
      title: t.tour.settings.title,
      content: t.tour.settings.content,
      placement: 'right',
    })
  }

  return steps
}

export interface OnboardingTourProps {
  /** Whether the user is an admin (shows settings step) */
  isAdmin?: boolean
  /** Called when tour finishes or is skipped */
  onComplete?: () => void
}

export function OnboardingTour({ isAdmin = false, onComplete }: OnboardingTourProps) {
  const [run, setRun] = useState(() => {
    return !localStorage.getItem(TOUR_STORAGE_KEY)
  })

  const steps = buildSteps(isAdmin)

  const handleCallback = useCallback(
    (data: CallBackProps) => {
      const { status, action, type } = data

      const finished = status === STATUS.FINISHED || status === STATUS.SKIPPED
      const closed = action === ACTIONS.CLOSE && type === EVENTS.STEP_AFTER

      if (finished || closed) {
        setRun(false)
        localStorage.setItem(TOUR_STORAGE_KEY, 'true')
        onComplete?.()
      }
    },
    [onComplete],
  )

  if (!run) return null

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      showSkipButton
      showProgress
      disableOverlayClose
      spotlightClicks={false}
      callback={handleCallback}
      locale={{
        next: t.tour.next,
        back: t.tour.back,
        skip: t.tour.skip,
        last: t.tour.finish,
      }}
      styles={{
        options: {
          primaryColor: '#EA580C',
          zIndex: 10000,
          arrowColor: '#fff',
          backgroundColor: '#fff',
          textColor: '#1a1a1a',
        },
        tooltip: {
          borderRadius: 12,
          padding: '20px 24px',
          fontSize: 14,
        },
        tooltipTitle: {
          fontSize: 16,
          fontWeight: 600,
          marginBottom: 4,
        },
        tooltipContent: {
          fontSize: 13,
          lineHeight: 1.5,
          color: '#6b7280',
          padding: '8px 0 0',
        },
        buttonNext: {
          borderRadius: 8,
          padding: '8px 16px',
          fontSize: 13,
          fontWeight: 500,
        },
        buttonBack: {
          borderRadius: 8,
          padding: '8px 16px',
          fontSize: 13,
          fontWeight: 500,
          color: '#6b7280',
          marginRight: 8,
        },
        buttonSkip: {
          fontSize: 13,
          color: '#9ca3af',
        },
        spotlight: {
          borderRadius: 8,
        },
        overlay: {
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
        },
      }}
    />
  )
}

/** Reset the tour so it runs again on next mount */
export function resetOnboardingTour() {
  localStorage.removeItem(TOUR_STORAGE_KEY)
}

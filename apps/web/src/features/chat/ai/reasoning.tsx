import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/shared/ui/collapsible"
import { cn } from "@/shared/lib/utils"
import { useControllableState } from "@radix-ui/react-use-controllable-state"
import { BrainIcon, ChevronDownIcon } from "lucide-react"
import type { ComponentProps } from "react"
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Shimmer } from "./shimmer"

interface ReasoningContextValue {
  isStreaming: boolean
  duration?: number
}

const ReasoningContext = createContext<ReasoningContextValue>({ isStreaming: false })

const useReasoning = () => useContext(ReasoningContext)

export type ReasoningProps = ComponentProps<typeof Collapsible> & {
  isStreaming?: boolean
  duration?: number
}

export const Reasoning = ({ className, isStreaming = false, duration, children, open: openProp, onOpenChange, defaultOpen, ...props }: ReasoningProps) => {
  const [open, setOpen] = useControllableState({ prop: openProp, onChange: onOpenChange, defaultProp: defaultOpen ?? isStreaming })
  const hasAutoClosedRef = useRef(false)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (isStreaming) {
      setOpen(true)
      hasAutoClosedRef.current = false
      const start = Date.now()
      const interval = setInterval(() => {
        setElapsed(Math.floor((Date.now() - start) / 1000))
      }, 1000)
      return () => clearInterval(interval)
    }
    if (!hasAutoClosedRef.current) {
      const timer = setTimeout(() => {
        setOpen(false)
        hasAutoClosedRef.current = true
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [isStreaming, setOpen])

  const contextValue = useMemo(() => ({ isStreaming, duration: duration ?? elapsed }), [isStreaming, duration, elapsed])

  return (
    <ReasoningContext.Provider value={contextValue}>
      <Collapsible open={open} onOpenChange={setOpen} className={cn("not-prose mb-4", className)} {...props}>
        {children}
      </Collapsible>
    </ReasoningContext.Provider>
  )
}

export const ReasoningTrigger = ({ className, children, ...props }: ComponentProps<typeof CollapsibleTrigger>) => {
  const { isStreaming, duration } = useReasoning()
  const { t } = useTranslation()

  return (
    <CollapsibleTrigger className={cn("flex w-full items-center gap-2 text-[var(--text-muted)] text-sm hover:text-[var(--text)] transition-colors cursor-pointer", className)} {...props}>
      <BrainIcon className="size-4" />
      {isStreaming ? (
        <Shimmer duration={1}>{t('reasoning.thinking')}</Shimmer>
      ) : (
        <span className="text-xs">{t('reasoning.thoughtForDuration', { duration: duration ?? 0 })}</span>
      )}
      {children}
      <ChevronDownIcon className="size-4 ml-auto transition-transform [[data-state=open]_&]:rotate-180" />
    </CollapsibleTrigger>
  )
}

export const ReasoningContent = ({ className, children, ...props }: ComponentProps<"div">) => (
  <CollapsibleContent>
    <div className={cn("mt-4 text-sm text-[var(--text-muted)] leading-relaxed", className)} {...props}>
      {children}
    </div>
  </CollapsibleContent>
)

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import { useControllableState } from "@radix-ui/react-use-controllable-state"
import { BrainIcon, ChevronDownIcon } from "lucide-react"
import type { ComponentProps } from "react"
import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react"
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
  const elapsedRef = useRef(0)

  useEffect(() => {
    if (isStreaming) {
      setOpen(true)
      hasAutoClosedRef.current = false
      const start = Date.now()
      const interval = setInterval(() => {
        elapsedRef.current = Math.floor((Date.now() - start) / 1000)
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

  const contextValue = useMemo(() => ({ isStreaming, duration: duration ?? elapsedRef.current }), [isStreaming, duration])

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

  return (
    <CollapsibleTrigger className={cn("flex w-full items-center gap-2 text-[var(--text-muted)] text-sm hover:text-[var(--text)] transition-colors cursor-pointer", className)} {...props}>
      <BrainIcon className="size-4" />
      {isStreaming ? (
        <Shimmer duration={1}>Thinking...</Shimmer>
      ) : (
        <span className="text-xs">Thought for {duration ?? 0}s</span>
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

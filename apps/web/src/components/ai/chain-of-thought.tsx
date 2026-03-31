import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import { useControllableState } from "@radix-ui/react-use-controllable-state"
import { BrainIcon, ChevronDownIcon, CheckCircle2, Loader2, Circle } from "lucide-react"
import type { ComponentProps } from "react"

export interface ChainOfThoughtStepData {
  id: string
  label: string
  status: "pending" | "active" | "complete"
  detail?: string
}

export const ChainOfThought = ({ className, children, open: openProp, onOpenChange, defaultOpen = true, ...props }: ComponentProps<typeof Collapsible>) => {
  const [open, setOpen] = useControllableState({ prop: openProp, onChange: onOpenChange, defaultProp: defaultOpen })
  return (
    <Collapsible open={open} onOpenChange={setOpen} className={cn("not-prose mb-4", className)} {...props}>
      {children}
    </Collapsible>
  )
}

export const ChainOfThoughtHeader = ({ className, children, ...props }: ComponentProps<typeof CollapsibleTrigger>) => (
  <CollapsibleTrigger className={cn("flex w-full items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors cursor-pointer", className)} {...props}>
    <BrainIcon className="size-4" />
    {children}
    <ChevronDownIcon className="size-4 ml-auto transition-transform [[data-state=open]_&]:rotate-180" />
  </CollapsibleTrigger>
)

export const ChainOfThoughtStep = ({ step, className }: { step: ChainOfThoughtStepData; className?: string }) => (
  <div className={cn("flex items-start gap-2", className)}>
    {step.status === "complete" && <CheckCircle2 className="size-4 text-green-600 mt-0.5 shrink-0" />}
    {step.status === "active" && <Loader2 className="size-4 text-[var(--accent)] animate-spin mt-0.5 shrink-0" />}
    {step.status === "pending" && <Circle className="size-4 text-[var(--text-muted)] mt-0.5 shrink-0" />}
    <div>
      <span className={cn("text-sm", step.status === "complete" && "text-[var(--text-muted)]", step.status === "active" && "text-[var(--text)] font-medium")}>
        {step.label}
      </span>
      {step.detail && <div className="text-xs text-[var(--text-muted)] mt-0.5">{step.detail}</div>}
    </div>
  </div>
)

export const ChainOfThoughtContent = ({ className, ...props }: ComponentProps<"div">) => (
  <CollapsibleContent>
    <div className={cn("mt-2 flex flex-col gap-1.5 pl-6", className)} {...props} />
  </CollapsibleContent>
)

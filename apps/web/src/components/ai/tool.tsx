import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import { CheckCircle2Icon, ChevronDownIcon, CircleIcon, ClockIcon, WrenchIcon, XCircleIcon } from "lucide-react"
import type { ComponentProps } from "react"
import type { ToolState } from "./types"

const statusConfig: Record<ToolState, { label: string; Icon: typeof CheckCircle2Icon; className: string }> = {
  "input-streaming": { label: "Pending", Icon: CircleIcon, className: "" },
  "input-available": { label: "Running", Icon: ClockIcon, className: "animate-pulse" },
  "output-available": { label: "Completed", Icon: CheckCircle2Icon, className: "text-green-600" },
  "output-error": { label: "Error", Icon: XCircleIcon, className: "text-red-600" },
  "output-denied": { label: "Denied", Icon: XCircleIcon, className: "text-orange-600" },
  "approval-requested": { label: "Awaiting Approval", Icon: ClockIcon, className: "text-yellow-600" },
  "approval-responded": { label: "Responded", Icon: CheckCircle2Icon, className: "text-blue-600" },
}

// eslint-disable-next-line react-refresh/only-export-components
export function getStatusBadge(state: ToolState) {
  const config = statusConfig[state]
  const { Icon } = config
  return (
    <Badge variant="secondary" className="rounded-full text-xs gap-1.5">
      <Icon className={cn("size-3", config.className)} />
      {config.label}
    </Badge>
  )
}

export type ToolProps = ComponentProps<typeof Collapsible>

export const Tool = ({ className, children, ...props }: ToolProps) => (
  <Collapsible className={cn("rounded-md border border-[var(--border)] mb-4 w-full", className)} {...props}>
    {children}
  </Collapsible>
)

export type ToolHeaderProps = ComponentProps<typeof CollapsibleTrigger> & {
  type?: string
  state?: ToolState
}

export const ToolHeader = ({ className, type, state = "output-available", children, ...props }: ToolHeaderProps) => {
  const toolName = type?.replace(/^tool-/, "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) ?? "Tool"

  return (
    <CollapsibleTrigger className={cn("flex w-full items-center justify-between gap-4 p-3 hover:bg-[var(--surface-2)] transition-colors cursor-pointer group", className)} {...props}>
      <div className="flex items-center gap-2 min-w-0">
        <WrenchIcon className="size-4 text-[var(--text-muted)] shrink-0" />
        <span className="font-medium text-sm truncate">{children ?? toolName}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {getStatusBadge(state)}
        <ChevronDownIcon className="size-4 text-[var(--text-muted)] transition-transform group-data-[state=open]:rotate-180" />
      </div>
    </CollapsibleTrigger>
  )
}

export const ToolContent = ({ className, children, ...props }: ComponentProps<"div">) => (
  <CollapsibleContent>
    <div className={cn("space-y-4 p-4 border-t border-[var(--border)]", className)} {...props}>
      {children}
    </div>
  </CollapsibleContent>
)

export const ToolInput = ({ input, className }: { input?: Record<string, unknown>; className?: string }) => {
  if (!input || Object.keys(input).length === 0) return null
  return (
    <div className={className}>
      <div className="font-medium text-[var(--text-muted)] text-xs uppercase tracking-wide mb-1">Parameters</div>
      <pre className="whitespace-pre-wrap break-words bg-[var(--surface-2)] rounded-md p-3 text-xs overflow-auto max-h-40 border border-[var(--border)]">
        {JSON.stringify(input, null, 2)}
      </pre>
    </div>
  )
}

export const ToolOutput = ({ output, errorText, className }: { output?: string; errorText?: string; className?: string }) => {
  if (!output && !errorText) return null
  return (
    <div className={className}>
      <div className="font-medium text-[var(--text-muted)] text-xs uppercase tracking-wide mb-1">{errorText ? "Error" : "Result"}</div>
      {errorText ? (
        <div className="text-xs text-[var(--danger)] bg-red-50 rounded-md p-3 border border-red-200">{errorText}</div>
      ) : (
        <pre className="whitespace-pre-wrap break-words bg-[var(--surface-2)] rounded-md p-3 text-xs overflow-auto max-h-40 border border-[var(--border)]">{output}</pre>
      )}
    </div>
  )
}

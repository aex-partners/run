import { Badge } from "@/shared/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/shared/ui/collapsible"
import { cn } from "@/shared/lib/utils"
import { CheckCircle2Icon, ChevronDownIcon, CircleIcon, ClockIcon, WrenchIcon, XCircleIcon } from "lucide-react"
import type { ComponentProps } from "react"
import { useTranslation } from "react-i18next"
import i18n from "@/platform/i18n/i18n"
import type { ToolState } from "./types"

const statusConfig: Record<ToolState, { labelKey: string; Icon: typeof CheckCircle2Icon; className: string }> = {
  "input-streaming": { labelKey: "status.pending", Icon: CircleIcon, className: "" },
  "input-available": { labelKey: "status.running", Icon: ClockIcon, className: "animate-pulse" },
  "output-available": { labelKey: "status.completed", Icon: CheckCircle2Icon, className: "text-green-600" },
  "output-error": { labelKey: "status.error", Icon: XCircleIcon, className: "text-red-600" },
  "output-denied": { labelKey: "status.denied", Icon: XCircleIcon, className: "text-orange-600" },
  "approval-requested": { labelKey: "status.awaitingApproval", Icon: ClockIcon, className: "text-yellow-600" },
  "approval-responded": { labelKey: "status.responded", Icon: CheckCircle2Icon, className: "text-blue-600" },
}

// eslint-disable-next-line react-refresh/only-export-components
export function getStatusBadge(state: ToolState) {
  const config = statusConfig[state]
  const { Icon } = config
  return (
    <Badge variant="secondary" className="rounded-full text-xs gap-1.5">
      <Icon className={cn("size-3", config.className)} />
      {i18n.t(config.labelKey)}
    </Badge>
  )
}

export type ToolProps = ComponentProps<typeof Collapsible>

export const Tool = ({ className, children, ...props }: ToolProps) => (
  <Collapsible className={cn("rounded-md border border-[var(--border)] mb-4 w-full", className)} {...props}>
    {children}
  </Collapsible>
)

export type ToolHeaderProps = Omit<ComponentProps<typeof CollapsibleTrigger>, 'type'> & {
  // The tool name (e.g. "tool-create_entity"); overrides the HTML button `type`.
  type?: string
  state?: ToolState
}

export const ToolHeader = ({ className, type, state = "output-available", children, ...props }: ToolHeaderProps) => {
  const { t } = useTranslation()
  const toolName = type?.replace(/^tool-/, "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) ?? t("aiTool.fallbackName")

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
  const { t } = useTranslation()
  if (!input || Object.keys(input).length === 0) return null
  return (
    <div className={className}>
      <div className="font-medium text-[var(--text-muted)] text-xs uppercase tracking-wide mb-1">{t("aiTool.parameters")}</div>
      <pre className="whitespace-pre-wrap break-words bg-[var(--surface-2)] rounded-md p-3 text-xs overflow-auto max-h-40 border border-[var(--border)]">
        {JSON.stringify(input, null, 2)}
      </pre>
    </div>
  )
}

export const ToolOutput = ({ output, errorText, className }: { output?: string; errorText?: string; className?: string }) => {
  const { t } = useTranslation()
  if (!output && !errorText) return null
  return (
    <div className={className}>
      <div className="font-medium text-[var(--text-muted)] text-xs uppercase tracking-wide mb-1">{errorText ? t("status.error") : t("aiTool.result")}</div>
      {errorText ? (
        <div className="text-xs text-[var(--danger)] bg-red-50 rounded-md p-3 border border-red-200">{errorText}</div>
      ) : (
        <pre className="whitespace-pre-wrap break-words bg-[var(--surface-2)] rounded-md p-3 text-xs overflow-auto max-h-40 border border-[var(--border)]">{output}</pre>
      )}
    </div>
  )
}

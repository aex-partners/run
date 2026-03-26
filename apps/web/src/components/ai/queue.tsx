import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import { ChevronDownIcon, PaperclipIcon } from "lucide-react"
import type { ComponentProps } from "react"

export const Queue = ({ className, children, ...props }: ComponentProps<"div">) => (
  <div className={cn("flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 pt-2 pb-2 shadow-xs", className)} {...props}>
    {children}
  </div>
)

export const QueueSection = ({ className, children, defaultOpen = true, ...props }: ComponentProps<typeof Collapsible>) => (
  <Collapsible defaultOpen={defaultOpen} className={className} {...props}>{children}</Collapsible>
)

export const QueueSectionTrigger = ({ className, children, ...props }: ComponentProps<typeof CollapsibleTrigger>) => (
  <CollapsibleTrigger className={cn("flex w-full items-center justify-between bg-[var(--surface-2)]/40 px-3 py-2 font-medium text-[var(--text-muted)] text-sm hover:bg-[var(--surface-2)] rounded-md cursor-pointer", className)} {...props}>
    {children}
    <ChevronDownIcon className="size-4 transition-transform [[data-state=closed]_&]:-rotate-90" />
  </CollapsibleTrigger>
)

export const QueueSectionLabel = ({ className, children, ...props }: ComponentProps<"span">) => (
  <span className={cn("flex items-center gap-2", className)} {...props}>{children}</span>
)

export const QueueSectionContent = ({ className, ...props }: ComponentProps<"div">) => (
  <CollapsibleContent><div className={cn("flex flex-col py-1", className)} {...props} /></CollapsibleContent>
)

export const QueueItem = ({ className, children, completed, ...props }: ComponentProps<"div"> & { completed?: boolean }) => (
  <div className={cn("flex items-center gap-2 rounded-md px-3 py-1 text-sm hover:bg-[var(--surface-2)] group", className)} {...props}>
    <div className={cn("size-2.5 rounded-full border shrink-0", completed ? "border-[var(--text-muted)]/20 bg-[var(--text-muted)]/10" : "border-[var(--text-muted)]/50")} />
    <span className={cn("flex-1 truncate", completed ? "text-[var(--text-muted)]/50 line-through" : "text-[var(--text-muted)]")}>
      {children}
    </span>
  </div>
)

export const QueueItemActions = ({ className, ...props }: ComponentProps<"div">) => (
  <div className={cn("flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity", className)} {...props} />
)

export const QueueItemAction = (props: ComponentProps<typeof Button>) => (
  <Button variant="ghost" className="size-auto rounded p-1" {...props} />
)

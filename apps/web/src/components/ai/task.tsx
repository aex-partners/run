import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import { SearchIcon, ChevronDownIcon } from "lucide-react"
import type { ComponentProps } from "react"

export const Task = ({ className, children, ...props }: ComponentProps<typeof Collapsible>) => (
  <Collapsible className={cn("not-prose", className)} {...props}>{children}</Collapsible>
)

export const TaskTrigger = ({ className, children, ...props }: ComponentProps<typeof CollapsibleTrigger>) => (
  <CollapsibleTrigger className={cn("flex w-full items-center gap-2 text-sm cursor-pointer group", className)} {...props}>
    <SearchIcon className="size-4 text-[var(--text-muted)] shrink-0" />
    <span className="font-medium text-[var(--text)] flex-1 text-left">{children}</span>
    <ChevronDownIcon className="size-4 text-[var(--text-muted)] transition-transform [[data-state=open]_&]:rotate-180" />
  </CollapsibleTrigger>
)

export const TaskContent = ({ className, ...props }: ComponentProps<"div">) => (
  <CollapsibleContent>
    <div className={cn("mt-1 ml-6 border-l-2 border-[var(--border)] pl-3 flex flex-col gap-0.5", className)} {...props} />
  </CollapsibleContent>
)

export const TaskItem = ({ className, children, icon, ...props }: ComponentProps<"div"> & { icon?: React.ReactNode }) => (
  <div className={cn("flex items-center gap-2 py-1 text-sm text-[var(--text-muted)]", className)} {...props}>
    {icon && <span className="shrink-0">{icon}</span>}
    <span>{children}</span>
  </div>
)

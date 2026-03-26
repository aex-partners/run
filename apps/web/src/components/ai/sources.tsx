import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import { BookOpenIcon, ChevronDownIcon } from "lucide-react"
import type { ComponentProps } from "react"

export interface Source {
  url: string
  title?: string
}

export const Sources = ({ className, children, ...props }: ComponentProps<typeof Collapsible>) => (
  <Collapsible className={cn("not-prose mb-4 text-[var(--accent)] text-xs", className)} {...props}>
    {children}
  </Collapsible>
)

export const SourcesTrigger = ({ className, children, ...props }: ComponentProps<typeof CollapsibleTrigger>) => (
  <CollapsibleTrigger className={cn("flex items-center gap-2 font-medium", className)} {...props}>
    {children}
    <ChevronDownIcon className="h-4 w-4 transition-transform [[data-state=open]_&]:rotate-180" />
  </CollapsibleTrigger>
)

export const SourcesContent = ({ className, ...props }: ComponentProps<"div">) => (
  <CollapsibleContent>
    <div className={cn("mt-3 flex w-fit flex-col gap-2", className)} {...props} />
  </CollapsibleContent>
)

export const SourceItem = ({ href, title, className }: { href: string; title?: string; className?: string }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className={cn("flex items-center gap-2 font-medium hover:underline", className)}>
    <BookOpenIcon className="h-4 w-4" />
    {title || href}
  </a>
)

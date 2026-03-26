import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import { ChevronsUpDownIcon } from "lucide-react"
import type { ComponentProps } from "react"
import { createContext, useContext, useMemo } from "react"
import { Shimmer } from "./shimmer"

interface PlanContextValue { isStreaming: boolean }
const PlanContext = createContext<PlanContextValue>({ isStreaming: false })

export type PlanProps = ComponentProps<typeof Collapsible> & { isStreaming?: boolean }

export const Plan = ({ className, isStreaming = false, children, ...props }: PlanProps) => {
  const contextValue = useMemo(() => ({ isStreaming }), [isStreaming])
  return (
    <PlanContext.Provider value={contextValue}>
      <Collapsible asChild data-slot="plan" {...props}>
        <Card className={cn("shadow-none", className)}>{children}</Card>
      </Collapsible>
    </PlanContext.Provider>
  )
}

export const PlanHeader = ({ className, ...props }: ComponentProps<typeof CardHeader>) => (
  <CardHeader className={cn("flex items-start justify-between", className)} data-slot="plan-header" {...props} />
)

export const PlanTitle = ({ children, ...props }: Omit<ComponentProps<typeof CardTitle>, "children"> & { children: string }) => {
  const { isStreaming } = useContext(PlanContext)
  return <CardTitle data-slot="plan-title" {...props}>{isStreaming ? <Shimmer>{children}</Shimmer> : children}</CardTitle>
}

export const PlanDescription = ({ className, children, ...props }: Omit<ComponentProps<typeof CardDescription>, "children"> & { children: string }) => {
  const { isStreaming } = useContext(PlanContext)
  return <CardDescription className={cn("text-balance", className)} data-slot="plan-description" {...props}>{isStreaming ? <Shimmer>{children}</Shimmer> : children}</CardDescription>
}

export const PlanAction = (props: ComponentProps<typeof CardAction>) => <CardAction data-slot="plan-action" {...props} />
export const PlanContent = (props: ComponentProps<typeof CardContent>) => <CollapsibleContent asChild><CardContent data-slot="plan-content" {...props} /></CollapsibleContent>
export const PlanFooter = (props: ComponentProps<"div">) => <CardFooter data-slot="plan-footer" {...props} />

export const PlanTrigger = ({ className, ...props }: ComponentProps<typeof CollapsibleTrigger>) => (
  <CollapsibleTrigger asChild>
    <Button className={cn("size-8", className)} data-slot="plan-trigger" size="icon" variant="ghost" {...props}>
      <ChevronsUpDownIcon className="size-4" />
      <span className="sr-only">Toggle plan</span>
    </Button>
  </CollapsibleTrigger>
)

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { ComponentProps, ReactNode } from "react"
import { createContext, useContext, useMemo } from "react"
import type { ToolState } from "./types"

interface ConfirmationContextValue {
  approval?: { id: string; approved?: boolean; reason?: string }
  state: ToolState
}

const ConfirmationContext = createContext<ConfirmationContextValue | null>(null)
const useConfirmation = () => {
  const ctx = useContext(ConfirmationContext)
  if (!ctx) throw new Error("Confirmation components must be used within Confirmation")
  return ctx
}

export type ConfirmationProps = ComponentProps<typeof Alert> & {
  approval?: { id: string; approved?: boolean; reason?: string }
  state: ToolState
}

export const Confirmation = ({ className, approval, state, ...props }: ConfirmationProps) => {
  const contextValue = useMemo(() => ({ approval, state }), [approval, state])
  if (!approval || state === "input-streaming" || state === "input-available") return null

  return (
    <ConfirmationContext.Provider value={contextValue}>
      <Alert className={cn("flex flex-col gap-2", className)} {...props} />
    </ConfirmationContext.Provider>
  )
}

export const ConfirmationTitle = ({ className, ...props }: ComponentProps<typeof AlertDescription>) => (
  <AlertDescription className={cn("inline", className)} {...props} />
)

export const ConfirmationRequest = ({ children }: { children?: ReactNode }) => {
  const { state } = useConfirmation()
  return state === "approval-requested" ? <>{children}</> : null
}

export const ConfirmationAccepted = ({ children }: { children?: ReactNode }) => {
  const { approval, state } = useConfirmation()
  if (!approval?.approved || (state !== "approval-responded" && state !== "output-denied" && state !== "output-available")) return null
  return <>{children}</>
}

export const ConfirmationRejected = ({ children }: { children?: ReactNode }) => {
  const { approval, state } = useConfirmation()
  if (approval?.approved !== false || (state !== "approval-responded" && state !== "output-denied" && state !== "output-available")) return null
  return <>{children}</>
}

export const ConfirmationActions = ({ className, ...props }: ComponentProps<"div">) => {
  const { state } = useConfirmation()
  if (state !== "approval-requested") return null
  return <div className={cn("flex items-center justify-end gap-2 self-end", className)} {...props} />
}

export const ConfirmationAction = (props: ComponentProps<typeof Button>) => (
  <Button className="h-8 px-3 text-sm" type="button" {...props} />
)

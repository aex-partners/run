import { cn } from "@/lib/utils"
import type { ComponentProps } from "react"

export type MessageRole = "user" | "assistant" | "system"

export type MessageProps = ComponentProps<"div"> & {
  from: MessageRole
}

export const Message = ({ from, className, children, ...props }: MessageProps) => (
  <div
    className={cn(
      "flex w-full max-w-[95%] flex-col gap-2",
      from === "user" && "ml-auto justify-end",
      className
    )}
    data-role={from}
    {...props}
  >
    {children}
  </div>
)

export type MessageContentProps = ComponentProps<"div"> & {
  from: MessageRole
}

export const MessageContent = ({ from, className, children, ...props }: MessageContentProps) => (
  <div
    className={cn(
      "text-sm min-w-0 max-w-full flex flex-col gap-2",
      from === "user" && "ml-auto rounded-2xl bg-[var(--accent-light)] border border-[var(--accent-border)] px-4 py-3 text-[var(--text)]",
      from === "assistant" && "text-[var(--text)]",
      from === "system" && "text-center text-[var(--text-muted)] text-xs",
      className
    )}
    {...props}
  >
    {children}
  </div>
)

export const MessageResponse = ({ className, children, ...props }: ComponentProps<"div">) => (
  <div className={cn("size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0", className)} {...props}>
    {children}
  </div>
)

export type MessageToolbarProps = ComponentProps<"div">

export const MessageToolbar = ({ className, children, ...props }: MessageToolbarProps) => (
  <div className={cn("mt-2 flex w-full items-center justify-between gap-4", className)} {...props}>
    {children}
  </div>
)

export const MessageActions = ({ className, children, ...props }: ComponentProps<"div">) => (
  <div className={cn("flex items-center gap-1", className)} {...props}>
    {children}
  </div>
)

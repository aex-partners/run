// Driving port (public read). Reports whether the one-time setup wizard has run.
export interface CheckSetupComplete {
  execute(): Promise<{ complete: boolean }>
}

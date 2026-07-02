import { ValidateVersion, ValidateVersionCommand } from '@/contexts/automation/application/ports/in/ValidateVersion'
import {
  FlowValidationResult,
  validateFlowVersion,
  ValidationCode,
} from '@/contexts/automation/domain/FlowValidator'
import { FlowTrigger } from '@/contexts/automation/domain/FlowDsl'

// Thin application service around the pure domain validator. Parses the raw
// trigger JSON (the exact string the builder autosaves) and returns the full
// FlowValidationResult so the UI can render per-field errors/warnings live.
export class ValidateVersionService implements ValidateVersion {
  execute(cmd: ValidateVersionCommand): FlowValidationResult {
    let trigger: FlowTrigger
    try {
      trigger = JSON.parse(cmd.trigger) as FlowTrigger
    } catch {
      return {
        valid: false,
        errors: [{ code: ValidationCode.INVALID_JSON, path: 'trigger', message: 'Trigger is not valid JSON.' }],
        warnings: [],
      }
    }
    return validateFlowVersion(trigger, { publish: cmd.publish === true })
  }
}

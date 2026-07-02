import { Json } from '@/shared/domain/Json'
import { Result, ok } from '@/shared/kernel/Result'
import {
  PieceClient,
  PieceCall,
  PieceTriggerCall,
  PieceTriggerResult,
} from '@/contexts/plugins/application/ports/out/PieceClient'

// Placeholder driven adapter. A real client does an authenticated HTTP request
// to the integration. Here it returns a deterministic canned response so flows
// run end-to-end without network.
export class StubPieceClient implements PieceClient {
  async call(req: PieceCall): Promise<Result<Json>> {
    return ok({ piece: req.pieceId, action: req.action, status: 'ok', received: req.input })
  }

  // Canned trigger dispatch. `run` returns a single synthetic item so polling
  // wiring can be exercised; onEnable/onDisable emit no items.
  async callTrigger(req: PieceTriggerCall): Promise<Result<PieceTriggerResult>> {
    if (req.hook === 'run') {
      return ok({
        items: [{ piece: req.pieceId, trigger: req.triggerName, status: 'ok', received: req.input }],
      })
    }
    return ok({ items: [], strategy: 'POLLING' })
  }
}

// Driving port. Enqueues a one-off full-mirror sync job (the "Sincronizar Bling"
// button) instead of running it inline in the HTTP request. The BlingController
// calls this and returns immediately; the BullMQ BlingSyncWorker consumes the
// job and runs SyncBlingMirror in the background (resilient to api restarts).
export interface EnqueueBlingSync {
  enqueue(scope?: 'all' | 'categorias'): Promise<void>
}

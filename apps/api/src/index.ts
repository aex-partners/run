// Production entrypoint. The Dockerfile + railpack.json start the API via
// `tsx src/index.ts`; the real bootstrap (Fastify + workers) lives in main/server.ts
// and self-invokes on import (its `main()` runs at module load). Keep this thin.
import './main/server'

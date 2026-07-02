import { z } from 'zod'
import { router, protectedProcedure } from '@/platform/http/trpc'
import { Geocode } from '@/contexts/geocode/application/ports/in/Geocode'

// Driving adapter (tRPC). Modeled as a query so TanStack Query caches the result
// client-side too. Wire the returned router under `geocode`.
export const geocodeController = (deps: { geocode: Geocode }) =>
  router({
    geocode: protectedProcedure
      .input(z.object({ address: z.string().min(1) }))
      .query(({ input }) => deps.geocode.execute(input)),
  })

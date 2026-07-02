import { JsonObject } from '@/shared/domain/Json'
import { GetPublicForm } from '@/contexts/forms/application/queries/GetPublicForm'
import { SubmitForm } from '@/contexts/forms/application/ports/in/SubmitForm'

// Driving adapter for the two PUBLIC (unauthenticated) tRPC procedures. Wired in
// main to publicProcedure; the protected operations live in FormController.
export const publicFormController = (deps: { getPublic: GetPublicForm; submit: SubmitForm }) => ({
  getPublicForm: (input: { token: string }) => deps.getPublic.execute({ token: input.token }),

  submitPublicForm: async (input: { token: string; data: JsonObject; submitterIp?: string | null }) => {
    const r = await deps.submit.execute(input)
    if (!r.ok) throw new Error(r.error)
    return r.value
  },
})

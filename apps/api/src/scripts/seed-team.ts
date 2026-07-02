// Seed the Eric AI agent (+ backing bot user + chat) and a team of employees
// with DM conversations, so the chat UI has people + history to look at. The
// base seed (seed-buenaca) bypassed completeSetup, so the SetupProvisioner saga
// that normally creates Eric never ran — this fills that in.
import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { makeDb } from '@/platform/db/client'
import { makeAuth } from '@/platform/auth/better-auth'
import { loadEnv } from '@/platform/config/env'
import * as schema from '@/platform/db/schema'

const ERIC_PROMPT =
  'You are Eric, the AI assistant for this AEX workspace. You understand the ' +
  "company's data, execute tasks, and manage operations through natural " +
  'conversation. Be concise, proactive, and helpful.'

interface Employee {
  first: string
  email: string
  role: string
}
const EMPLOYEES: Employee[] = [
  { first: 'Sendi', email: 'sendi@buenaca.app', role: 'admin' },
  { first: 'Sandro', email: 'sandro@buenaca.app', role: 'user' },
  { first: 'Neusa', email: 'neusa@buenaca.app', role: 'user' },
  { first: 'Pedro', email: 'pedro@buenaca.app', role: 'user' },
]

// A short, realistic PT-BR exchange per employee (Buenaça = textile / bombachas).
const DM_SCRIPTS: Record<string, { from: 'admin' | 'them'; text: string }[]> = {
  Sendi: [
    { from: 'admin', text: 'Sendi, fechou o balanço de setembro?' },
    { from: 'them', text: 'Fechou sim! DRE já está no Drive. Margem subiu 4%.' },
    { from: 'admin', text: 'Boa. Manda o resumo dos maiores clientes depois.' },
    { from: 'them', text: 'Mando ainda hoje. 1 Mundial Têxtil segue em primeiro.' },
  ],
  Sandro: [
    { from: 'admin', text: 'Sandro, como tá o estoque das bombachas brancas tam 34?' },
    { from: 'them', text: 'Zerado na Fábrica Panambi, tem 12 pares na loja.' },
    { from: 'admin', text: 'Programa produção de mais 200 então.' },
    { from: 'them', text: 'Beleza, lanço a OP hoje.' },
  ],
  Neusa: [
    { from: 'admin', text: 'Neusa, contas a receber de hoje bateram?' },
    { from: 'them', text: 'Bateram. R$ 416,10 do consumidor final via Stone/Sicredi.' },
    { from: 'admin', text: 'Perfeito, obrigado.' },
  ],
  Pedro: [
    { from: 'admin', text: 'Pedro, os pedidos de venda do dia já saíram pra expedição?' },
    { from: 'them', text: 'Saíram. 6 pedidos, alpargatas e bombachas. NFes emitidas.' },
    { from: 'admin', text: 'Show. Qualquer atraso me avisa.' },
  ],
}

async function main() {
  const env = loadEnv()
  const db = makeDb(env.DATABASE_URL)
  const auth = makeAuth(db, env)
  const now = new Date()

  const [admin] = await db.select().from(schema.users).where(eq(schema.users.email, 'admin@aex.app')).limit(1)
  if (!admin) throw new Error('seed-team: admin user not found (run seed-buenaca first)')

  // --- Eric: bot user + agent + AI conversation ---
  let [ericUser] = await db.select().from(schema.users).where(eq(schema.users.email, 'eric@aex.app')).limit(1)
  if (!ericUser) {
    const id = randomUUID()
    await db.insert(schema.users).values({
      id, name: 'Eric', email: 'eric@aex.app', emailVerified: true, role: 'user', kind: 'bot',
    })
    ;[ericUser] = await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1)
  }
  const ericAgentId = randomUUID()
  await db.insert(schema.agents).values({
    id: ericAgentId, name: 'Eric', slug: 'eric', description: 'Default AI assistant',
    systemPrompt: ERIC_PROMPT, skillIds: '[]', toolIds: '[]', isSystem: true,
    userId: ericUser!.id, createdBy: admin.id,
  }).onConflictDoNothing()

  const ericConvId = randomUUID()
  await db.insert(schema.conversations).values({ id: ericConvId, name: 'Eric', type: 'ai', agentId: ericAgentId })
  await db.insert(schema.conversationMembers).values({ conversationId: ericConvId, userId: admin.id })
  await db.insert(schema.messages).values({
    id: randomUUID(), conversationId: ericConvId, authorId: null, agentId: ericAgentId, role: 'ai',
    content: 'Olá! Sou o Eric, seu assistente da Buenaça. Posso criar entidades, rodar tarefas e responder sobre seus dados. Em que posso ajudar?',
    createdAt: now,
  })
  console.log('[seed-team] Eric agent + bot user + AI conversation created')

  // --- Employees + DM conversations ---
  for (const emp of EMPLOYEES) {
    let [u] = await db.select().from(schema.users).where(eq(schema.users.email, emp.email)).limit(1)
    if (!u) {
      try {
        await auth.api.signUpEmail({ body: { email: emp.email, password: 'buenaca123', name: emp.first } })
      } catch (e) {
        console.log(`[seed-team] signUp ${emp.first} skipped (${(e as Error).message})`)
      }
      ;[u] = await db.select().from(schema.users).where(eq(schema.users.email, emp.email)).limit(1)
    }
    if (!u) continue
    if (emp.role !== 'user') await db.update(schema.users).set({ role: emp.role }).where(eq(schema.users.id, u.id))

    // DM conversation admin <-> employee
    const convId = randomUUID()
    await db.insert(schema.conversations).values({ id: convId, type: 'dm' })
    await db.insert(schema.conversationMembers).values([
      { conversationId: convId, userId: admin.id },
      { conversationId: convId, userId: u.id },
    ])
    const script = DM_SCRIPTS[emp.first] ?? []
    let t = now.getTime() - script.length * 60_000
    for (const line of script) {
      await db.insert(schema.messages).values({
        id: randomUUID(),
        conversationId: convId,
        authorId: line.from === 'admin' ? admin.id : u.id,
        role: 'user',
        content: line.text,
        createdAt: new Date(t),
      })
      t += 60_000
    }
    console.log(`[seed-team] ${emp.first}: user + DM (${script.length} messages)`)
  }

  // --- Team channel with everyone ---
  const all = await db.select().from(schema.users)
  const humans = all.filter((u) => u.kind === 'human')
  const chanId = randomUUID()
  await db.insert(schema.conversations).values({ id: chanId, name: 'Equipe Buenaça', type: 'channel' })
  await db.insert(schema.conversationMembers).values(humans.map((u) => ({ conversationId: chanId, userId: u.id })))
  await db.insert(schema.messages).values({
    id: randomUUID(), conversationId: chanId, authorId: admin.id, role: 'user',
    content: 'Bom dia equipe! Semana de fechamento, foco nas entregas. 💪', createdAt: now,
  })
  console.log(`[seed-team] #Equipe Buenaça channel with ${humans.length} members`)

  console.log('[seed-team] done')
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

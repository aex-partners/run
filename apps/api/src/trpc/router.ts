import { router } from "./index.js";
import { authRouter } from "./routers/auth.js";
import { conversationsRouter } from "./routers/conversations.js";
import { messagesRouter } from "./routers/messages.js";
import { usersRouter } from "./routers/users.js";
import { aiRouter } from "./routers/ai.js";
import { tasksRouter } from "./routers/tasks.js";
import { entitiesRouter } from "./routers/entities.js";
import { settingsRouter } from "./routers/settings.js";
import { workflowsRouter } from "./routers/workflows.js";
import { customToolsRouter } from "./routers/custom-tools.js";
import { agentsRouter } from "./routers/agents.js";
import { skillsRouter } from "./routers/skills.js";
import { integrationsRouter } from "./routers/integrations.js";
import { formsRouter } from "./routers/forms.js";
import { pluginsRouter } from "./routers/plugins.js";
import { filesRouter } from "./routers/files.js";
import { emailsRouter } from "./routers/emails.js";
import { credentialsRouter } from "./routers/credentials.js";
import { flowsRouter } from "./routers/flows.js";
import { blingRouter } from "./routers/bling.js";
import { knowledgeRouter } from "./routers/knowledge.js";

export const appRouter = router({
  auth: authRouter,
  conversations: conversationsRouter,
  messages: messagesRouter,
  users: usersRouter,
  ai: aiRouter,
  tasks: tasksRouter,
  entities: entitiesRouter,
  settings: settingsRouter,
  workflows: workflowsRouter,
  customTools: customToolsRouter,
  agents: agentsRouter,
  skills: skillsRouter,
  integrations: integrationsRouter,
  forms: formsRouter,
  plugins: pluginsRouter,
  files: filesRouter,
  emails: emailsRouter,
  credentials: credentialsRouter,
  flows: flowsRouter,
  bling: blingRouter,
  knowledge: knowledgeRouter,
});

export type AppRouter = typeof appRouter;

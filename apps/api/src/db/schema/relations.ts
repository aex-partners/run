import { relations } from "drizzle-orm";
import { users, sessions, accounts } from "./auth";
import {
  conversations,
  conversationMembers,
  messages,
  entities,
  entityRecords,
  workflows,
  workflowExecutions,
  agents,
  skills,
  plugins,
  customTools,
  integrations,
  tasks,
  forms,
  formSubmissions,
  files,
  fileShares,
  emailAccounts,
  mailAccountMembers,
  emails,
  emailAttachments,
  emailLabels,
  reminders,
} from "./app";

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
  conversationMembers: many(conversationMembers),
  messages: many(messages),
  mailAccountMembers: many(mailAccountMembers),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  members: many(conversationMembers),
  messages: many(messages),
  agent: one(agents, { fields: [conversations.agentId], references: [agents.id] }),
}));

export const conversationMembersRelations = relations(
  conversationMembers,
  ({ one }) => ({
    conversation: one(conversations, {
      fields: [conversationMembers.conversationId],
      references: [conversations.id],
    }),
    user: one(users, {
      fields: [conversationMembers.userId],
      references: [users.id],
    }),
  }),
);

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  author: one(users, {
    fields: [messages.authorId],
    references: [users.id],
  }),
  agent: one(agents, {
    fields: [messages.agentId],
    references: [agents.id],
  }),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  createdByUser: one(users, { fields: [tasks.createdBy], references: [users.id] }),
  conversation: one(conversations, { fields: [tasks.conversationId], references: [conversations.id] }),
  agent: one(agents, { fields: [tasks.agentId], references: [agents.id] }),
  workflowExecution: one(workflowExecutions, { fields: [tasks.workflowExecutionId], references: [workflowExecutions.id] }),
}));

export const entitiesRelations = relations(entities, ({ one, many }) => ({
  createdByUser: one(users, { fields: [entities.createdBy], references: [users.id] }),
  records: many(entityRecords),
}));

export const entityRecordsRelations = relations(entityRecords, ({ one }) => ({
  entity: one(entities, { fields: [entityRecords.entityId], references: [entities.id] }),
  createdByUser: one(users, { fields: [entityRecords.createdBy], references: [users.id] }),
}));

export const workflowsRelations = relations(workflows, ({ one, many }) => ({
  createdByUser: one(users, { fields: [workflows.createdBy], references: [users.id] }),
  executions: many(workflowExecutions),
}));

export const workflowExecutionsRelations = relations(workflowExecutions, ({ one, many }) => ({
  workflow: one(workflows, { fields: [workflowExecutions.workflowId], references: [workflows.id] }),
  triggeredByUser: one(users, { fields: [workflowExecutions.triggeredBy], references: [users.id] }),
  tasks: many(tasks),
}));

export const agentsRelations = relations(agents, ({ one, many }) => ({
  createdByUser: one(users, { fields: [agents.createdBy], references: [users.id] }),
  messages: many(messages),
}));

export const skillsRelations = relations(skills, ({ one }) => ({
  createdByUser: one(users, { fields: [skills.createdBy], references: [users.id] }),
}));

export const pluginsRelations = relations(plugins, ({ one, many }) => ({
  installedByUser: one(users, { fields: [plugins.installedBy], references: [users.id] }),
  tools: many(customTools),
}));

export const customToolsRelations = relations(customTools, ({ one }) => ({
  createdByUser: one(users, { fields: [customTools.createdBy], references: [users.id] }),
  integration: one(integrations, { fields: [customTools.integrationId], references: [integrations.id] }),
  plugin: one(plugins, { fields: [customTools.pluginId], references: [plugins.id] }),
}));

export const integrationsRelations = relations(integrations, ({ one, many }) => ({
  createdByUser: one(users, { fields: [integrations.createdBy], references: [users.id] }),
  tools: many(customTools),
}));

export const formsRelations = relations(forms, ({ one, many }) => ({
  entity: one(entities, { fields: [forms.entityId], references: [entities.id] }),
  createdByUser: one(users, { fields: [forms.createdBy], references: [users.id] }),
  submissions: many(formSubmissions),
}));

export const formSubmissionsRelations = relations(formSubmissions, ({ one }) => ({
  form: one(forms, { fields: [formSubmissions.formId], references: [forms.id] }),
  entityRecord: one(entityRecords, { fields: [formSubmissions.entityRecordId], references: [entityRecords.id] }),
}));

// --- Files & Email relations ---

export const filesRelations = relations(files, ({ one, many }) => ({
  owner: one(users, { fields: [files.ownerId], references: [users.id] }),
  parent: one(files, { fields: [files.parentId], references: [files.id] }),
  shares: many(fileShares),
  emailAttachments: many(emailAttachments),
}));

export const fileSharesRelations = relations(fileShares, ({ one }) => ({
  file: one(files, { fields: [fileShares.fileId], references: [files.id] }),
  user: one(users, { fields: [fileShares.userId], references: [users.id] }),
}));

export const emailAccountsRelations = relations(emailAccounts, ({ one, many }) => ({
  owner: one(users, { fields: [emailAccounts.ownerId], references: [users.id] }),
  members: many(mailAccountMembers),
  emails: many(emails),
  labels: many(emailLabels),
}));

export const mailAccountMembersRelations = relations(mailAccountMembers, ({ one }) => ({
  account: one(emailAccounts, { fields: [mailAccountMembers.accountId], references: [emailAccounts.id] }),
  user: one(users, { fields: [mailAccountMembers.userId], references: [users.id] }),
}));

export const emailsRelations = relations(emails, ({ one, many }) => ({
  account: one(emailAccounts, { fields: [emails.accountId], references: [emailAccounts.id] }),
  attachments: many(emailAttachments),
}));

export const emailAttachmentsRelations = relations(emailAttachments, ({ one }) => ({
  email: one(emails, { fields: [emailAttachments.emailId], references: [emails.id] }),
  file: one(files, { fields: [emailAttachments.fileId], references: [files.id] }),
}));

export const emailLabelsRelations = relations(emailLabels, ({ one }) => ({
  account: one(emailAccounts, { fields: [emailLabels.accountId], references: [emailAccounts.id] }),
}));

export const remindersRelations = relations(reminders, ({ one }) => ({
  user: one(users, { fields: [reminders.userId], references: [users.id] }),
  conversation: one(conversations, { fields: [reminders.conversationId], references: [conversations.id] }),
}));

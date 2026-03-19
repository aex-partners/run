import { tool } from "ai";
import { z } from "zod";
import { eq, ilike, sql } from "drizzle-orm";
import {
  conversations,
  conversationMembers,
  messages,
  users,
  tasks,
  entities,
  entityRecords,
  settings,
  workflows,
  workflowExecutions,
  agents,
  files,
  emails,
  emailAccounts,
} from "../db/schema/index.js";
import {
  slugify,
  parseFields,
  serializeFields,
  validateFieldType,
  validateRecordData,
  type EntityField,
} from "../db/entity-fields.js";
import type { Database } from "../db/index.js";

export interface ToolContext {
  db: Database;
  userId: string;
  conversationId?: string;
  agentId?: string;
}

export const READ_ONLY_TOOLS = new Set([
  "list_users",
  "list_tasks",
  "query_records",
  "list_entities",
  "list_workflows",
  "list_agents",
  "web_search",
  "fetch_url",
  "list_files",
  "search_files",
  "list_emails",
  "search_emails",
  "summarize_email",
  "draft_email_reply",
]);

export const WORKER_BLOCKED_TOOLS = new Set([
  "create_task",
  "cancel_task",
  "list_tasks",
]);

// ---- Shared helpers ----

async function resolveEntity(db: Database, identifier: string) {
  let [entity] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, identifier))
    .limit(1);
  if (entity) return entity;

  [entity] = await db
    .select()
    .from(entities)
    .where(eq(entities.slug, slugify(identifier)))
    .limit(1);
  if (entity) return entity;

  [entity] = await db
    .select()
    .from(entities)
    .where(ilike(entities.name, identifier))
    .limit(1);
  return entity ?? null;
}

// ---- Tool factory ----

/**
 * Creates all AI SDK tools with the given context injected.
 * Tools returned here include `execute` for ALL tools.
 * The caller decides which tools to include or exclude `execute` from.
 */
export function createTools(ctx: ToolContext) {
  return {
    create_conversation: tool({
      description: "Create a new AI conversation",
      inputSchema: z.object({
        name: z.string().describe("Conversation name"),
      }),
      execute: async ({ name }) => {
        const id = crypto.randomUUID();
        const [conversation] = await ctx.db
          .insert(conversations)
          .values({ id, name, type: "ai" })
          .returning();
        await ctx.db
          .insert(conversationMembers)
          .values({ conversationId: id, userId: ctx.userId });
        return { id: conversation.id, name: conversation.name };
      },
    }),

    rename_conversation: tool({
      description: "Rename an existing conversation",
      inputSchema: z.object({
        conversation_id: z.string().describe("Conversation ID"),
        name: z.string().describe("New conversation name"),
      }),
      execute: async ({ conversation_id, name }) => {
        const [updated] = await ctx.db
          .update(conversations)
          .set({ name, updatedAt: new Date() })
          .where(eq(conversations.id, conversation_id))
          .returning();
        return { id: updated.id, name: updated.name };
      },
    }),

    delete_conversation: tool({
      description: "Delete a conversation",
      inputSchema: z.object({
        conversation_id: z.string().describe("Conversation ID to delete"),
      }),
      execute: async ({ conversation_id }) => {
        await ctx.db
          .delete(conversations)
          .where(eq(conversations.id, conversation_id));
        return { deleted: true, id: conversation_id };
      },
    }),

    list_users: tool({
      description: "List all users in the system",
      inputSchema: z.object({}),
      execute: async () => {
        const rows = await ctx.db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            role: users.role,
          })
          .from(users);
        return { users: rows };
      },
    }),

    send_message: tool({
      description: "Send a message to a conversation",
      inputSchema: z.object({
        conversation_id: z.string().describe("Conversation ID"),
        content: z.string().describe("Message content"),
      }),
      execute: async ({ conversation_id, content }) => {
        const id = crypto.randomUUID();
        const [message] = await ctx.db
          .insert(messages)
          .values({
            id,
            conversationId: conversation_id,
            authorId: null,
            agentId: ctx.agentId ?? null,
            content,
            role: "ai",
          })
          .returning();
        return { id: message.id, conversationId: conversation_id };
      },
    }),

    create_task: tool({
      description:
        "Create a background task for long-running operations like bulk operations, report generation, or multi-step processes. The task runs asynchronously. Can be scheduled to run after a delay. Supports structured tasks (deterministic tool call) and inference tasks (AI-driven).",
      inputSchema: z.object({
        title: z.string().describe("Short task title"),
        description: z.string().describe("Detailed instructions for what the task should do"),
        schedule_in_minutes: z
          .number()
          .optional()
          .describe("Optional delay in minutes before the task starts. If omitted, the task starts immediately."),
        type: z
          .enum(["inference", "structured"])
          .optional()
          .describe("Task type: inference (default, AI-driven) or structured (direct tool call, no LLM)"),
        tool_name: z
          .string()
          .optional()
          .describe("For structured tasks: the tool name to call directly"),
        structured_input: z
          .record(z.unknown())
          .optional()
          .describe("For structured tasks: the input to pass to the tool"),
        agent_id: z
          .string()
          .optional()
          .describe("Optional agent ID to use for inference tasks"),
      }),
      execute: async ({ title, description, schedule_in_minutes, type, tool_name, structured_input, agent_id }) => {
        const { enqueueTask } = await import("../queue/task-queue.js");
        const id = crypto.randomUUID();
        const scheduledAt =
          schedule_in_minutes && schedule_in_minutes > 0
            ? new Date(Date.now() + schedule_in_minutes * 60_000)
            : null;
        const delayMs = scheduledAt ? schedule_in_minutes! * 60_000 : undefined;

        const taskType = type || "inference";

        const [task] = await ctx.db
          .insert(tasks)
          .values({
            id,
            title,
            description,
            input: description,
            createdBy: ctx.userId,
            conversationId: ctx.conversationId ?? null,
            scheduledAt,
            type: taskType,
            agentId: agent_id ?? null,
            toolName: tool_name ?? null,
            structuredInput: structured_input ? JSON.stringify(structured_input) : null,
          })
          .returning();
        await enqueueTask(task.id, delayMs);
        return {
          id: task.id,
          title: task.title,
          status: task.status,
          type: taskType,
          scheduledAt: scheduledAt?.toISOString() ?? null,
        };
      },
    }),

    list_tasks: tool({
      description: "List tasks with optional status filter",
      inputSchema: z.object({
        status: z
          .enum(["pending", "running", "completed", "failed", "cancelled"])
          .optional()
          .describe("Filter by status"),
        limit: z.number().optional().describe("Max results (default 10)"),
      }),
      execute: async ({ status, limit }) => {
        const maxResults = limit || 10;
        const baseQuery = ctx.db
          .select({
            id: tasks.id,
            title: tasks.title,
            status: tasks.status,
            progress: tasks.progress,
            createdAt: tasks.createdAt,
          })
          .from(tasks);

        const rows = status
          ? await baseQuery
              .where(eq(tasks.status, status as typeof tasks.status.enumValues[number]))
              .limit(maxResults)
          : await baseQuery.limit(maxResults);

        return { tasks: rows };
      },
    }),

    cancel_task: tool({
      description: "Cancel a pending or running task",
      inputSchema: z.object({
        task_id: z.string().describe("Task ID to cancel"),
      }),
      execute: async ({ task_id }) => {
        const { broadcast } = await import("../ws/index.js");
        const [task] = await ctx.db
          .select()
          .from(tasks)
          .where(eq(tasks.id, task_id))
          .limit(1);

        if (!task) return { error: "Task not found" };
        if (task.status !== "pending" && task.status !== "running") {
          return { error: `Cannot cancel task with status: ${task.status}` };
        }

        await ctx.db
          .update(tasks)
          .set({ status: "cancelled", completedAt: new Date() })
          .where(eq(tasks.id, task_id));

        broadcast({
          type: "task_updated",
          task: { id: task_id, status: "cancelled", progress: task.progress, title: task.title },
        });

        return { id: task_id, status: "cancelled" };
      },
    }),

    create_entity: tool({
      description:
        "Create a new database entity (table) with fields. Use this when the user wants to create a table or store structured data. Always provide description and ai_context to help future AI interactions understand this entity.",
      inputSchema: z.object({
        name: z.string().describe("Entity name (e.g. Customers, Products)"),
        description: z.string().describe("One-line description of what this entity represents"),
        ai_context: z.string().describe("Rich context for AI: what this entity is, typical operations, how it relates to other entities, business rules. Write as if explaining to a new employee."),
        fields: z
          .array(
            z.object({
              name: z.string().describe("Field name"),
              type: z
                .enum(["text", "number", "email", "phone", "date", "select", "checkbox"])
                .describe("Field type"),
              required: z.boolean().optional().describe("Whether the field is required"),
              options: z
                .array(z.string())
                .optional()
                .describe("Options for select type"),
            }),
          )
          .describe("List of fields for the entity"),
      }),
      execute: async ({ name, description, ai_context, fields: rawFields }) => {
        const { broadcast } = await import("../ws/index.js");
        const slug = slugify(name);

        const [existing] = await ctx.db
          .select({ id: entities.id })
          .from(entities)
          .where(eq(entities.slug, slug))
          .limit(1);
        if (existing) {
          return { error: `Entity "${name}" already exists.` };
        }

        const fields: EntityField[] = rawFields.map((f) => {
          const fieldType = validateFieldType(f.type) ? f.type : "text";
          return {
            id: crypto.randomUUID(),
            name: f.name,
            slug: slugify(f.name),
            type: fieldType,
            required: f.required ?? false,
            ...(f.options ? { options: f.options } : {}),
          };
        });

        const id = crypto.randomUUID();
        const [entity] = await ctx.db
          .insert(entities)
          .values({
            id,
            name,
            slug,
            description: description || null,
            aiContext: ai_context || null,
            fields: serializeFields(fields),
            createdBy: ctx.userId,
          })
          .returning();

        broadcast({ type: "entity_updated" });

        return {
          id: entity.id,
          name: entity.name,
          slug: entity.slug,
          fields: fields.map((f) => ({ name: f.name, type: f.type, required: f.required })),
        };
      },
    }),

    add_field: tool({
      description: "Add a new field (column) to an existing entity",
      inputSchema: z.object({
        entity_id: z.string().describe("Entity ID"),
        name: z.string().describe("Field name"),
        type: z
          .enum(["text", "number", "email", "phone", "date", "select", "checkbox"])
          .describe("Field type"),
        required: z.boolean().optional().describe("Whether the field is required"),
        options: z.array(z.string()).optional().describe("Options for select type"),
      }),
      execute: async ({ entity_id, name, type, required, options }) => {
        const { broadcast } = await import("../ws/index.js");
        const [entity] = await ctx.db
          .select()
          .from(entities)
          .where(eq(entities.id, entity_id))
          .limit(1);
        if (!entity) return { error: "Entity not found." };

        if (!validateFieldType(type)) {
          return { error: `Invalid field type: ${type}` };
        }

        const fields = parseFields(entity.fields);
        const newField: EntityField = {
          id: crypto.randomUUID(),
          name,
          slug: slugify(name),
          type: type as EntityField["type"],
          required: required ?? false,
          ...(options ? { options } : {}),
        };
        fields.push(newField);

        await ctx.db
          .update(entities)
          .set({ fields: serializeFields(fields), updatedAt: new Date() })
          .where(eq(entities.id, entity_id));

        broadcast({ type: "entity_updated" });

        return { entityId: entity_id, field: { id: newField.id, name: newField.name, type: newField.type } };
      },
    }),

    query_records: tool({
      description: "Query records from a database entity. Can look up entity by ID, slug, or name.",
      inputSchema: z.object({
        entity_id_or_name: z.string().describe("Entity ID, slug, or name"),
        limit: z.number().optional().describe("Max records to return (default 50)"),
      }),
      execute: async ({ entity_id_or_name, limit }) => {
        const maxRecords = limit || 50;
        const entity = await resolveEntity(ctx.db, entity_id_or_name);
        if (!entity) return { error: `Entity "${entity_id_or_name}" not found.` };

        const fields = parseFields(entity.fields);
        const records = await ctx.db
          .select()
          .from(entityRecords)
          .where(eq(entityRecords.entityId, entity.id))
          .limit(maxRecords);

        const rows = records.map((r) => {
          const data = JSON.parse(r.data) as Record<string, unknown>;
          return { id: r.id, ...data };
        });

        return {
          entity: entity.name,
          fields: fields.map((f) => f.name),
          count: rows.length,
          records: rows,
        };
      },
    }),

    insert_record: tool({
      description: "Insert a new record into a database entity. If a record with the same unique fields already exists, returns the existing record ID and suggests using update_record instead.",
      inputSchema: z.object({
        entity_id_or_name: z.string().describe("Entity ID, slug, or name"),
        data: z.record(z.unknown()).describe("Record data keyed by field name or slug"),
      }),
      execute: async ({ entity_id_or_name, data: rawData }) => {
        const { broadcast } = await import("../ws/index.js");
        const entity = await resolveEntity(ctx.db, entity_id_or_name);
        if (!entity) return { error: `Entity "${entity_id_or_name}" not found.` };

        const fields = parseFields(entity.fields);
        const normalizedData: Record<string, unknown> = {};
        const nameToSlug = new Map(fields.map((f) => [f.name.toLowerCase(), f.slug]));
        for (const [key, value] of Object.entries(rawData)) {
          const slug = nameToSlug.get(key.toLowerCase()) ?? slugify(key);
          normalizedData[slug] = value;
        }

        const validation = validateRecordData(normalizedData, fields, false);
        if (!validation.valid) {
          return { error: validation.errors.join(" ") };
        }

        // Check for duplicates on unique fields
        const uniqueFields = fields.filter((f) => f.unique);
        if (uniqueFields.length > 0) {
          const existingRecords = await ctx.db
            .select({ id: entityRecords.id, data: entityRecords.data })
            .from(entityRecords)
            .where(eq(entityRecords.entityId, entity.id));

          for (const existing of existingRecords) {
            const existingData = JSON.parse(existing.data) as Record<string, unknown>;
            for (const uf of uniqueFields) {
              const newVal = normalizedData[uf.slug];
              const oldVal = existingData[uf.slug];
              if (newVal && oldVal && String(newVal).toLowerCase() === String(oldVal).toLowerCase()) {
                return {
                  error: `Duplicate: a record with ${uf.name} = "${newVal}" already exists (ID: ${existing.id}). Use update_record to modify it.`,
                  existingRecordId: existing.id,
                  existingData,
                };
              }
            }
          }
        }

        // Also do a name-based fuzzy check as a safety net
        const nameField = fields.find((f) => f.slug === "nome" || f.slug === "name");
        if (nameField && normalizedData[nameField.slug]) {
          const newName = String(normalizedData[nameField.slug]).toLowerCase().trim();
          const existingRecords = await ctx.db
            .select({ id: entityRecords.id, data: entityRecords.data })
            .from(entityRecords)
            .where(eq(entityRecords.entityId, entity.id));

          for (const existing of existingRecords) {
            const existingData = JSON.parse(existing.data) as Record<string, unknown>;
            const existingName = String(existingData[nameField.slug] || "").toLowerCase().trim();
            if (existingName && existingName === newName) {
              return {
                error: `Duplicate: a record named "${normalizedData[nameField.slug]}" already exists (ID: ${existing.id}). Use update_record to modify it.`,
                existingRecordId: existing.id,
                existingData,
              };
            }
          }
        }

        const id = crypto.randomUUID();
        await ctx.db.insert(entityRecords).values({
          id,
          entityId: entity.id,
          data: JSON.stringify(normalizedData),
          createdBy: ctx.userId,
        });

        broadcast({ type: "record_updated", entityId: entity.id });

        return { id, entity: entity.name, data: normalizedData };
      },
    }),

    update_record: tool({
      description: "Update an existing record",
      inputSchema: z.object({
        record_id: z.string().describe("Record ID"),
        data: z.record(z.unknown()).describe("Partial record data to update"),
      }),
      execute: async ({ record_id, data: rawData }) => {
        const { broadcast } = await import("../ws/index.js");
        const [record] = await ctx.db
          .select()
          .from(entityRecords)
          .where(eq(entityRecords.id, record_id))
          .limit(1);
        if (!record) return { error: "Record not found." };

        const [entity] = await ctx.db
          .select()
          .from(entities)
          .where(eq(entities.id, record.entityId))
          .limit(1);
        if (!entity) return { error: "Entity not found." };

        const fields = parseFields(entity.fields);
        const nameToSlug = new Map(fields.map((f) => [f.name.toLowerCase(), f.slug]));
        const normalizedData: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(rawData)) {
          const slug = nameToSlug.get(key.toLowerCase()) ?? slugify(key);
          normalizedData[slug] = value;
        }

        const validation = validateRecordData(normalizedData, fields, true);
        if (!validation.valid) {
          return { error: validation.errors.join(" ") };
        }

        const existingData = JSON.parse(record.data) as Record<string, unknown>;
        const mergedData = { ...existingData, ...normalizedData };

        await ctx.db
          .update(entityRecords)
          .set({ data: JSON.stringify(mergedData), updatedAt: new Date() })
          .where(eq(entityRecords.id, record_id));

        broadcast({ type: "record_updated", entityId: record.entityId });

        return { id: record_id, data: mergedData };
      },
    }),

    delete_record: tool({
      description: "Delete a record by ID",
      inputSchema: z.object({
        record_id: z.string().describe("Record ID to delete"),
      }),
      execute: async ({ record_id }) => {
        const { broadcast } = await import("../ws/index.js");
        const [record] = await ctx.db
          .select({ id: entityRecords.id, entityId: entityRecords.entityId })
          .from(entityRecords)
          .where(eq(entityRecords.id, record_id))
          .limit(1);
        if (!record) return { error: "Record not found." };

        await ctx.db
          .delete(entityRecords)
          .where(eq(entityRecords.id, record_id));

        broadcast({ type: "record_updated", entityId: record.entityId });

        return { deleted: true, id: record_id };
      },
    }),

    list_entities: tool({
      description:
        "List all database entities (tables) with their fields and record counts. Use this to understand the current data model.",
      inputSchema: z.object({}),
      execute: async () => {
        const allEntities = await ctx.db
          .select({
            id: entities.id,
            name: entities.name,
            slug: entities.slug,
            fields: entities.fields,
          })
          .from(entities);

        const counts = await ctx.db
          .select({
            entityId: entityRecords.entityId,
            count: sql<number>`count(*)::int`,
          })
          .from(entityRecords)
          .groupBy(entityRecords.entityId);

        const countMap = new Map(counts.map((c) => [c.entityId, c.count]));

        return {
          entities: allEntities.map((e) => ({
            id: e.id,
            name: e.name,
            slug: e.slug,
            fields: parseFields(e.fields).map((f) => ({
              name: f.name,
              type: f.type,
              required: f.required,
            })),
            recordCount: countMap.get(e.id) ?? 0,
          })),
        };
      },
    }),

    save_company_profile: tool({
      description:
        "Save or update the company profile. Use this during onboarding to persist information about the user's business.",
      inputSchema: z.object({
        name: z.string().optional().describe("Company name"),
        type: z.string().describe("Business type (e.g. retail, services, manufacturing, consulting, distribution)"),
        processes: z
          .array(z.string())
          .describe("Key business processes (e.g. sales, purchasing, inventory, invoicing)"),
        notes: z.string().optional().describe("Additional notes about the business"),
      }),
      execute: async ({ name, type, processes, notes }) => {
        const profile = {
          name: name || undefined,
          type,
          processes,
          notes: notes || undefined,
        };

        await ctx.db
          .insert(settings)
          .values({
            key: "company_profile",
            value: JSON.stringify(profile),
          })
          .onConflictDoUpdate({
            target: settings.key,
            set: {
              value: JSON.stringify(profile),
              updatedAt: new Date(),
            },
          });

        return { saved: true, profile };
      },
    }),

    create_workflow: tool({
      description:
        "Create a complete workflow with trigger, steps, and graph. Use when the user describes an automation, recurring process, or workflow. The graph is auto-generated from the steps array. Steps can be structured (direct tool call) or inference (AI-driven).",
      inputSchema: z.object({
        name: z.string().describe("Workflow name"),
        trigger_type: z.enum(["manual", "cron", "event"]).describe("Trigger type"),
        trigger_config: z
          .record(z.unknown())
          .optional()
          .describe("Trigger configuration. For cron: { cronExpression: '0 9 * * *' }. For event: { eventType: 'record_updated', entityId?: 'id' }"),
        steps: z
          .array(
            z.object({
              type: z.enum(["action", "condition", "notification"]).describe("Step type"),
              label: z.string().describe("Step description/instruction"),
              config: z.record(z.unknown()).optional().describe("Optional step configuration"),
              task_type: z.enum(["inference", "structured"]).optional().describe("For action steps: inference (AI) or structured (direct tool call)"),
              tool_name: z.string().optional().describe("For structured action steps: the tool to call"),
              tool_input: z.record(z.unknown()).optional().describe("For structured action steps: tool input"),
              agent_id: z.string().optional().describe("Optional agent ID for action steps"),
            }),
          )
          .describe("Workflow steps in execution order"),
      }),
      execute: async ({ name, trigger_type, trigger_config, steps }) => {
        const { broadcast } = await import("../ws/index.js");
        const { generateGraphFromSteps } = await import("../workflows/executor.js");

        const id = crypto.randomUUID();
        const slug = slugify(name);
        const triggerCfg = trigger_config || {};
        const graph = generateGraphFromSteps(steps.map((s) => ({
          type: s.type,
          label: s.label,
          config: s.config,
          taskType: s.task_type,
          toolName: s.tool_name,
          toolInput: s.tool_input,
          agentId: s.agent_id,
        })));

        const [workflow] = await ctx.db
          .insert(workflows)
          .values({
            id,
            name,
            slug,
            status: "paused",
            triggerType: trigger_type,
            triggerConfig: JSON.stringify(triggerCfg),
            graph: JSON.stringify(graph),
            createdBy: ctx.userId,
          })
          .returning();

        broadcast({ type: "workflow_updated" });

        return {
          id: workflow.id,
          name: workflow.name,
          slug: workflow.slug,
          status: workflow.status,
          triggerType: workflow.triggerType,
          steps: steps.length,
          nodes: graph.nodes.length,
        };
      },
    }),

    list_workflows: tool({
      description: "List all workflows with their status and trigger type",
      inputSchema: z.object({
        status: z.enum(["active", "paused"]).optional().describe("Filter by status"),
      }),
      execute: async ({ status }) => {
        const baseQuery = ctx.db
          .select({
            id: workflows.id,
            name: workflows.name,
            status: workflows.status,
            triggerType: workflows.triggerType,
            createdAt: workflows.createdAt,
          })
          .from(workflows);

        const rows = status
          ? await baseQuery.where(eq(workflows.status, status as "active" | "paused"))
          : await baseQuery;

        return { workflows: rows };
      },
    }),

    execute_workflow: tool({
      description: "Manually trigger a workflow execution",
      inputSchema: z.object({
        workflow_id: z.string().describe("Workflow ID to execute"),
      }),
      execute: async ({ workflow_id }) => {
        const { enqueueWorkflowExecution } = await import("../queue/workflow-queue.js");
        const { broadcast } = await import("../ws/index.js");

        const [workflow] = await ctx.db
          .select()
          .from(workflows)
          .where(eq(workflows.id, workflow_id))
          .limit(1);

        if (!workflow) return { error: "Workflow not found" };

        const executionId = crypto.randomUUID();
        await ctx.db.insert(workflowExecutions).values({
          id: executionId,
          workflowId: workflow_id,
          triggeredBy: ctx.userId,
        });

        await enqueueWorkflowExecution(executionId);

        broadcast({
          type: "workflow_execution_started",
          executionId,
          workflowId: workflow_id,
          status: "pending",
        });

        return { executionId, workflowId: workflow_id, status: "pending" };
      },
    }),

    update_workflow: tool({
      description:
        "Update an existing workflow. Can change name, status, trigger, or steps. If steps are provided, the graph is regenerated.",
      inputSchema: z.object({
        workflow_id: z.string().describe("Workflow ID"),
        name: z.string().optional().describe("New name"),
        status: z.enum(["active", "paused"]).optional().describe("New status"),
        trigger_type: z.enum(["manual", "cron", "event"]).optional().describe("New trigger type"),
        trigger_config: z.record(z.unknown()).optional().describe("New trigger configuration"),
        steps: z
          .array(
            z.object({
              type: z.enum(["action", "condition", "notification"]),
              label: z.string(),
              config: z.record(z.unknown()).optional(),
              task_type: z.enum(["inference", "structured"]).optional(),
              tool_name: z.string().optional(),
              tool_input: z.record(z.unknown()).optional(),
              agent_id: z.string().optional(),
            }),
          )
          .optional()
          .describe("New steps (replaces existing graph)"),
      }),
      execute: async ({ workflow_id, name, status, trigger_type, trigger_config, steps }) => {
        const { broadcast } = await import("../ws/index.js");
        const { generateGraphFromSteps } = await import("../workflows/executor.js");
        const {
          registerCronTrigger,
          unregisterCronTrigger,
          registerEventTrigger,
          unregisterEventTrigger,
        } = await import("../workflows/triggers.js");

        const [existing] = await ctx.db
          .select()
          .from(workflows)
          .where(eq(workflows.id, workflow_id))
          .limit(1);

        if (!existing) return { error: "Workflow not found" };

        const updates: Record<string, unknown> = { updatedAt: new Date() };

        if (name) {
          updates.name = name;
          updates.slug = slugify(name);
        }
        if (status) updates.status = status;
        if (trigger_type) updates.triggerType = trigger_type;
        if (trigger_config) updates.triggerConfig = JSON.stringify(trigger_config);
        if (steps) {
          const graph = generateGraphFromSteps(steps.map((s) => ({
            type: s.type,
            label: s.label,
            config: s.config,
            taskType: s.task_type,
            toolName: s.tool_name,
            toolInput: s.tool_input,
            agentId: s.agent_id,
          })));
          updates.graph = JSON.stringify(graph);
        }

        await ctx.db
          .update(workflows)
          .set(updates)
          .where(eq(workflows.id, workflow_id));

        // Handle trigger changes
        const newStatus = status || existing.status;
        const newTriggerType = trigger_type || existing.triggerType;
        const newTriggerConfig = trigger_config
          ? trigger_config
          : JSON.parse(existing.triggerConfig);

        // Unregister old triggers
        if (existing.triggerType === "cron") await unregisterCronTrigger(workflow_id);
        if (existing.triggerType === "event") unregisterEventTrigger(workflow_id);

        // Register new triggers if active
        if (newStatus === "active") {
          if (newTriggerType === "cron" && newTriggerConfig.cronExpression) {
            await registerCronTrigger(workflow_id, newTriggerConfig.cronExpression as string);
          } else if (newTriggerType === "event") {
            registerEventTrigger(workflow_id, newTriggerConfig as Record<string, unknown>);
          }
        }

        broadcast({ type: "workflow_updated" });

        return { id: workflow_id, updated: true };
      },
    }),

    // --- Agent tools ---

    list_agents: tool({
      description: "List all available AI agents",
      inputSchema: z.object({}),
      execute: async () => {
        const rows = await ctx.db
          .select({
            id: agents.id,
            name: agents.name,
            slug: agents.slug,
            description: agents.description,
            modelId: agents.modelId,
          })
          .from(agents);
        return { agents: rows };
      },
    }),

    assign_agent: tool({
      description: "Assign a specific AI agent to the current conversation. Use null to reset to default.",
      inputSchema: z.object({
        agent_id: z.string().nullable().describe("Agent ID to assign, or null to reset to default"),
      }),
      execute: async ({ agent_id }) => {
        if (!ctx.conversationId) {
          return { error: "No conversation context" };
        }

        await ctx.db
          .update(conversations)
          .set({ agentId: agent_id, updatedAt: new Date() })
          .where(eq(conversations.id, ctx.conversationId));

        return {
          conversationId: ctx.conversationId,
          agentId: agent_id,
          message: agent_id
            ? "Agent assigned. It will take effect on the next message."
            : "Reset to default agent.",
        };
      },
    }),

    // --- File tools ---

    list_files: tool({
      description: "List files and folders with optional filters. Returns file names, types, sizes, and metadata.",
      inputSchema: z.object({
        search: z.string().optional().describe("Search by file name"),
        source: z.enum(["all", "email", "chat", "generated", "upload", "workflow"]).optional().describe("Filter by source"),
        starred: z.boolean().optional().describe("Filter starred files only"),
        limit: z.number().optional().describe("Max results (default 20)"),
      }),
      execute: async ({ search, source, starred, limit }) => {
        const maxResults = limit || 20;
        const conditions = [eq(files.ownerId, ctx.userId)];
        const { isNull: isNullFn } = await import("drizzle-orm");
        conditions.push(isNullFn(files.deletedAt));

        if (search) conditions.push(ilike(files.name, `%${search}%`));
        if (source && source !== "all") conditions.push(eq(files.source, source));
        if (starred) conditions.push(eq(files.starred, 1));

        const { and: andFn } = await import("drizzle-orm");
        const rows = await ctx.db
          .select({
            id: files.id,
            name: files.name,
            type: files.type,
            size: files.size,
            source: files.source,
            isFolder: files.isFolder,
            starred: files.starred,
            createdAt: files.createdAt,
          })
          .from(files)
          .where(andFn(...conditions))
          .limit(maxResults);

        return {
          files: rows.map((f) => ({
            id: f.id,
            name: f.name,
            type: f.type,
            size: f.size,
            source: f.source,
            isFolder: f.isFolder === 1,
            starred: f.starred === 1,
          })),
        };
      },
    }),

    search_files: tool({
      description: "Search files by name. Returns matching files with their IDs and metadata.",
      inputSchema: z.object({
        query: z.string().describe("Search query to match against file names"),
        limit: z.number().optional().describe("Max results (default 10)"),
      }),
      execute: async ({ query, limit }) => {
        const maxResults = limit || 10;
        const { and: andFn, isNull: isNullFn } = await import("drizzle-orm");

        const rows = await ctx.db
          .select({
            id: files.id,
            name: files.name,
            type: files.type,
            size: files.size,
            source: files.source,
          })
          .from(files)
          .where(andFn(
            eq(files.ownerId, ctx.userId),
            isNullFn(files.deletedAt),
            ilike(files.name, `%${query}%`),
          ))
          .limit(maxResults);

        return { query, results: rows };
      },
    }),

    create_file: tool({
      description: "Create a file from AI-generated content (text, CSV, JSON, etc.)",
      inputSchema: z.object({
        name: z.string().describe("File name with extension (e.g. report.csv, data.json)"),
        content: z.string().describe("File content as text"),
        source: z.enum(["generated", "chat"]).optional().describe("File source (default: generated)"),
      }),
      execute: async ({ name, content, source }) => {
        const { broadcast } = await import("../ws/index.js");
        const { localStorage: storage, getFileType, getMimeType } = await import("../files/storage.js");

        const buffer = Buffer.from(content, "utf8");
        const relativePath = await storage.saveFile(buffer, name);

        const id = crypto.randomUUID();
        await ctx.db.insert(files).values({
          id,
          name,
          type: getFileType(name),
          mimeType: getMimeType(name),
          size: buffer.length,
          path: relativePath,
          source: source || "generated",
          ownerId: ctx.userId,
        });

        broadcast({ type: "file_updated" });
        return { id, name, size: buffer.length };
      },
    }),

    create_folder: tool({
      description: "Create a new folder in the file system",
      inputSchema: z.object({
        name: z.string().describe("Folder name"),
        parent_id: z.string().optional().describe("Parent folder ID (null for root)"),
      }),
      execute: async ({ name, parent_id }) => {
        const { broadcast } = await import("../ws/index.js");

        const id = crypto.randomUUID();
        await ctx.db.insert(files).values({
          id,
          name,
          type: "folder",
          isFolder: 1,
          ownerId: ctx.userId,
          parentId: parent_id || null,
        });

        broadcast({ type: "file_updated" });
        return { id, name };
      },
    }),

    // --- Email tools ---

    list_emails: tool({
      description: "List emails from the user's connected email account. Can filter by folder (inbox, sent, drafts, spam, trash, starred) and search.",
      inputSchema: z.object({
        folder: z.enum(["inbox", "sent", "drafts", "spam", "trash", "starred"]).optional().describe("Email folder (default: inbox)"),
        search: z.string().optional().describe("Search in subject, sender, or preview"),
        limit: z.number().optional().describe("Max results (default 10)"),
      }),
      execute: async ({ folder, search, limit }) => {
        const maxResults = limit || 10;
        const conditions = [];

        // Get user's email accounts
        const accounts = await ctx.db
          .select({ id: emailAccounts.id })
          .from(emailAccounts)
          .where(eq(emailAccounts.ownerId, ctx.userId));

        if (accounts.length === 0) {
          return { error: "No email account connected. The user needs to connect their email first in Settings." };
        }

        const accountIds = accounts.map((a) => a.id);
        conditions.push(sql`${emails.accountId} IN (${sql.join(accountIds.map(id => sql`${id}`), sql`, `)})`);

        const targetFolder = folder || "inbox";
        if (targetFolder === "starred") {
          conditions.push(eq(emails.starred, 1));
        } else {
          conditions.push(eq(emails.folder, targetFolder));
        }

        if (search) {
          const { or: orFn } = await import("drizzle-orm");
          conditions.push(
            orFn(
              ilike(emails.subject, `%${search}%`),
              ilike(emails.fromName, `%${search}%`),
              ilike(emails.preview, `%${search}%`),
            )!,
          );
        }

        const { and: andFn } = await import("drizzle-orm");
        const { desc: descFn } = await import("drizzle-orm");
        const rows = await ctx.db
          .select({
            id: emails.id,
            from: emails.fromName,
            fromEmail: emails.fromEmail,
            subject: emails.subject,
            preview: emails.preview,
            date: emails.date,
            read: emails.read,
            starred: emails.starred,
            folder: emails.folder,
          })
          .from(emails)
          .where(andFn(...conditions))
          .orderBy(descFn(emails.date))
          .limit(maxResults);

        return {
          folder: targetFolder,
          count: rows.length,
          emails: rows.map((e) => ({
            id: e.id,
            from: `${e.from} <${e.fromEmail}>`,
            subject: e.subject,
            preview: e.preview,
            date: e.date,
            read: e.read === 1,
            starred: e.starred === 1,
          })),
        };
      },
    }),

    search_emails: tool({
      description: "Full-text search across all emails in the user's connected accounts",
      inputSchema: z.object({
        query: z.string().describe("Search query"),
        limit: z.number().optional().describe("Max results (default 10)"),
      }),
      execute: async ({ query, limit }) => {
        const maxResults = limit || 10;
        const accounts = await ctx.db
          .select({ id: emailAccounts.id })
          .from(emailAccounts)
          .where(eq(emailAccounts.ownerId, ctx.userId));

        if (accounts.length === 0) {
          return { error: "No email account connected." };
        }

        const accountIds = accounts.map((a) => a.id);
        const { and: andFn, or: orFn, desc: descFn } = await import("drizzle-orm");

        const rows = await ctx.db
          .select({
            id: emails.id,
            from: emails.fromName,
            fromEmail: emails.fromEmail,
            subject: emails.subject,
            preview: emails.preview,
            date: emails.date,
            folder: emails.folder,
          })
          .from(emails)
          .where(andFn(
            sql`${emails.accountId} IN (${sql.join(accountIds.map(id => sql`${id}`), sql`, `)})`,
            orFn(
              ilike(emails.subject, `%${query}%`),
              ilike(emails.fromName, `%${query}%`),
              ilike(emails.fromEmail, `%${query}%`),
              ilike(emails.preview, `%${query}%`),
            ),
          ))
          .orderBy(descFn(emails.date))
          .limit(maxResults);

        return {
          query,
          count: rows.length,
          results: rows.map((e) => ({
            id: e.id,
            from: `${e.from} <${e.fromEmail}>`,
            subject: e.subject,
            preview: e.preview,
            date: e.date,
            folder: e.folder,
          })),
        };
      },
    }),

    send_email: tool({
      description: "Send an email via the user's connected email account. This is a mutating action that requires user confirmation.",
      inputSchema: z.object({
        to: z.string().describe("Recipient email address(es), comma-separated"),
        subject: z.string().describe("Email subject"),
        body: z.string().describe("Email body (can include HTML)"),
        cc: z.string().optional().describe("CC recipients, comma-separated"),
      }),
      execute: async ({ to, subject, body, cc }) => {
        const accounts = await ctx.db
          .select()
          .from(emailAccounts)
          .where(eq(emailAccounts.ownerId, ctx.userId))
          .limit(1);

        if (accounts.length === 0) {
          return { error: "No email account connected. The user needs to connect their email first." };
        }

        const account = accounts[0];
        const { integrations: integrationsTable } = await import("../db/schema/index.js");
        const [integration] = await ctx.db
          .select()
          .from(integrationsTable)
          .where(eq(integrationsTable.id, account.integrationId))
          .limit(1);

        if (!integration) return { error: "Integration not found" };

        const { decryptCredentials } = await import("../integrations/crypto.js");
        const credentials = decryptCredentials(integration.credentials);
        const { getProvider } = await import("../email/provider.js");
        const provider = getProvider(account.provider);

        const toAddresses = to.split(",").map((e) => e.trim()).filter(Boolean);
        const ccAddresses = cc ? cc.split(",").map((e) => e.trim()).filter(Boolean) : [];

        await provider.sendMessage(credentials.accessToken as string, {
          from: account.emailAddress,
          fromName: account.displayName || undefined,
          to: toAddresses,
          cc: ccAddresses,
          subject,
          bodyHtml: body,
        });

        return { sent: true, to: toAddresses, subject };
      },
    }),

    summarize_email: tool({
      description: "Generate an AI summary of a specific email",
      inputSchema: z.object({
        email_id: z.string().describe("Email ID to summarize"),
      }),
      execute: async ({ email_id }) => {
        const [email] = await ctx.db
          .select()
          .from(emails)
          .where(eq(emails.id, email_id))
          .limit(1);

        if (!email) return { error: "Email not found" };
        if (email.aiSummary) return { summary: email.aiSummary };

        const bodyText = email.bodyText || email.bodyHtml?.replace(/<[^>]+>/g, "") || "";
        return {
          id: email.id,
          from: `${email.fromName} <${email.fromEmail}>`,
          subject: email.subject,
          content: bodyText.slice(0, 2000),
          instruction: "Please summarize the email content above in 2-3 sentences.",
        };
      },
    }),

    draft_email_reply: tool({
      description: "Generate an AI draft reply for a specific email",
      inputSchema: z.object({
        email_id: z.string().describe("Email ID to draft a reply for"),
        instructions: z.string().optional().describe("Optional instructions for the draft (e.g. 'accept the proposal', 'ask for more details')"),
      }),
      execute: async ({ email_id, instructions }) => {
        const [email] = await ctx.db
          .select()
          .from(emails)
          .where(eq(emails.id, email_id))
          .limit(1);

        if (!email) return { error: "Email not found" };

        const bodyText = email.bodyText || email.bodyHtml?.replace(/<[^>]+>/g, "") || "";
        return {
          id: email.id,
          from: `${email.fromName} <${email.fromEmail}>`,
          subject: email.subject,
          content: bodyText.slice(0, 2000),
          instructions: instructions || "Draft a professional reply.",
          instruction: "Please draft a reply email based on the original email and instructions above.",
        };
      },
    }),

    // --- Web tools (gated by internetAccess) ---

    web_search: tool({
      description:
        "Search the web for public information like company details, CNPJ, addresses, news, product info, etc. Returns top search results with titles, snippets and URLs.",
      inputSchema: z.object({
        query: z.string().describe("Search query (e.g. 'CNPJ CTG de Panambi')"),
        num_results: z.number().optional().describe("Number of results to return (default 5, max 10)"),
      }),
      execute: async ({ query, num_results }) => {
        const maxResults = Math.min(num_results || 5, 10);
        try {
          const response = await fetch("https://lite.duckduckgo.com/lite/", {
            method: "POST",
            headers: {
              "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: `q=${encodeURIComponent(query)}`,
          });

          if (!response.ok) {
            return { error: `Search failed with status ${response.status}` };
          }

          const html = await response.text();
          const results = parseDuckDuckGoResults(html, maxResults);

          if (results.length === 0) {
            return { query, results: [], message: "No results found. Try a different query." };
          }

          return { query, results };
        } catch (err) {
          return { error: `Search failed: ${(err as Error).message}` };
        }
      },
    }),

    fetch_url: tool({
      description:
        "Fetch the content of a web page and extract its text. Use this to read detailed information from a URL found via web_search. Returns the page text content (limited to 8000 chars).",
      inputSchema: z.object({
        url: z.string().url().describe("The URL to fetch"),
      }),
      execute: async ({ url }) => {
        try {
          const parsed = new URL(url);
          if (!["http:", "https:"].includes(parsed.protocol)) {
            return { error: "Only http and https URLs are supported" };
          }

          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10_000);

          const response = await fetch(url, {
            headers: {
              "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
              "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
              "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
            },
            signal: controller.signal,
          });

          clearTimeout(timeout);

          if (!response.ok) {
            return { error: `Fetch failed with status ${response.status}` };
          }

          const contentType = response.headers.get("content-type") || "";
          if (!contentType.includes("text/") && !contentType.includes("application/json") && !contentType.includes("application/xml")) {
            return { error: `Unsupported content type: ${contentType}` };
          }

          const html = await response.text();
          const text = extractTextFromHtml(html);
          const truncated = text.slice(0, 8000);

          return {
            url,
            title: extractTitle(html),
            content: truncated,
            truncated: text.length > 8000,
          };
        } catch (err) {
          const msg = (err as Error).name === "AbortError" ? "Request timed out (10s)" : (err as Error).message;
          return { error: `Fetch failed: ${msg}` };
        }
      },
    }),
  };
}

// --- HTML parsing helpers for web tools ---

function parseDuckDuckGoResults(html: string, max: number) {
  const results: { title: string; snippet: string; url: string }[] = [];

  // Match result links: <a ... class='result-link'>Title</a>
  const linkRegex = /<a[^>]*href="(https?:\/\/[^"]+)"[^>]*class='result-link'>([\s\S]*?)<\/a>/g;
  let match;

  while ((match = linkRegex.exec(html)) !== null && results.length < max) {
    const url = match[1];
    const title = cleanHtml(match[2]);

    // Find the snippet after this link (class='result-snippet'>...</td>)
    const afterLink = html.slice(match.index, match.index + 2000);
    const snippetMatch = /class='result-snippet'>([\s\S]*?)<\/td>/s.exec(afterLink);
    const snippet = snippetMatch ? cleanHtml(snippetMatch[1]) : "";

    if (title && url) {
      results.push({ title, snippet, url });
    }
  }

  return results;
}

function cleanHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTitle(html: string): string {
  const match = /<title[^>]*>(.*?)<\/title>/si.exec(html);
  return match ? cleanHtml(match[1]) : "";
}

function extractTextFromHtml(html: string): string {
  // Remove script, style, nav, header, footer tags and their content
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "");

  // Convert block elements to newlines
  text = text.replace(/<(br|p|div|h[1-6]|li|tr|blockquote)[^>]*>/gi, "\n");

  // Remove all remaining tags
  text = text.replace(/<[^>]+>/g, " ");

  // Decode entities
  text = text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");

  // Clean whitespace
  text = text
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length > 0)
    .join("\n");

  return text;
}

/** Full tool set type */
export type AllTools = ReturnType<typeof createTools>;

/**
 * Checks if a tool should auto-execute in chat context.
 * Custom tools marked as read-only also auto-execute (checked by caller via isCustomToolReadOnly).
 */
export function shouldAutoExecute(
  toolName: string,
  _isOnboarding: boolean,
  customReadOnlyTools?: Set<string>,
): boolean {
  return (
    READ_ONLY_TOOLS.has(toolName) ||
    (customReadOnlyTools?.has(toolName) ?? false)
  );
}

/**
 * Creates a filtered tool set for background workers (tasks/workflows).
 * Blocks task-management tools to prevent infinite loops. All tools have execute.
 */
export function createWorkerTools(ctx: ToolContext) {
  const allTools = createTools(ctx);
  const filtered: Record<string, unknown> = {};

  for (const [name, t] of Object.entries(allTools)) {
    if (!WORKER_BLOCKED_TOOLS.has(name)) {
      filtered[name] = t;
    }
  }

  return filtered as Omit<AllTools, "create_task" | "cancel_task" | "list_tasks">;
}

import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { eq, and, or } from "drizzle-orm";
import type { ToolContext } from "../types.js";
import { knowledge } from "../../db/schema/index.js";

export function buildKnowledgeTools(ctx: ToolContext) {
  return [
    tool(
      "save_knowledge",
      `Save a piece of knowledge to persistent memory. Use this when the user explicitly asks you to remember something, or when you learn important facts about the company that all users should know.

Rules:
- scope "company": visible to ALL users. Use for company facts (products, clients, policies, processes).
- scope "personal": visible only to THIS user. Use for personal preferences (report format, language, shortcuts).
- NEVER save confidential conversation content as "company" scope.
- Only save when the user explicitly asks or when it's clearly factual company information.`,
      {
        scope: z.enum(["company", "personal"]).describe("Who can see this: 'company' (everyone) or 'personal' (only this user)"),
        category: z.string().describe("Category: company-info, client, supplier, product, process, policy, preference, or any relevant category"),
        title: z.string().describe("Short title for this knowledge entry"),
        content: z.string().describe("The knowledge content to remember"),
      },
      async ({ scope, category, title, content }) => {
        const id = crypto.randomUUID();
        await ctx.db.insert(knowledge).values({
          id,
          scope,
          category,
          title,
          content,
          createdBy: ctx.userId,
        });
        return {
          content: [{ type: "text" as const, text: `Knowledge saved: "${title}" (${scope} scope, ${category})` }],
        };
      },
    ),

    tool(
      "query_knowledge",
      "Search persistent memory for previously saved knowledge. Returns matching entries from company-wide and personal knowledge.",
      {
        category: z.string().optional().describe("Filter by category (e.g. 'company-info', 'client', 'product'). Omit to search all."),
        query: z.string().optional().describe("Search term to filter by title or content"),
      },
      async ({ category, query: searchQuery }) => {
        const conditions = [
          or(
            eq(knowledge.scope, "company"),
            and(eq(knowledge.scope, "personal"), eq(knowledge.createdBy, ctx.userId)),
          ),
        ];

        if (category) {
          conditions.push(eq(knowledge.category, category));
        }

        const rows = await ctx.db
          .select({
            id: knowledge.id,
            scope: knowledge.scope,
            category: knowledge.category,
            title: knowledge.title,
            content: knowledge.content,
          })
          .from(knowledge)
          .where(and(...conditions))
          .limit(50);

        // Filter by search query in-memory if provided
        let results = rows;
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          results = rows.filter(
            (r) => r.title.toLowerCase().includes(q) || r.content.toLowerCase().includes(q),
          );
        }

        if (results.length === 0) {
          return { content: [{ type: "text" as const, text: "No knowledge entries found." }] };
        }

        const formatted = results.map(
          (r) => `[${r.scope}/${r.category}] ${r.title}\n${r.content}`,
        ).join("\n\n---\n\n");

        return { content: [{ type: "text" as const, text: formatted }] };
      },
      { annotations: { readOnlyHint: true } },
    ),

    tool(
      "delete_knowledge",
      "Delete a knowledge entry by ID. Only the creator can delete personal entries. Company entries can be deleted by any user.",
      {
        id: z.string().describe("The ID of the knowledge entry to delete"),
      },
      async ({ id }) => {
        const [entry] = await ctx.db
          .select()
          .from(knowledge)
          .where(eq(knowledge.id, id))
          .limit(1);

        if (!entry) {
          return { content: [{ type: "text" as const, text: "Knowledge entry not found." }], isError: true };
        }

        if (entry.scope === "personal" && entry.createdBy !== ctx.userId) {
          return { content: [{ type: "text" as const, text: "Cannot delete another user's personal knowledge." }], isError: true };
        }

        await ctx.db.delete(knowledge).where(eq(knowledge.id, id));
        return { content: [{ type: "text" as const, text: `Deleted: "${entry.title}"` }] };
      },
    ),
  ];
}

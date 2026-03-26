import { z } from "zod";

export const UserRole = {
  USER: "user",
  ADMIN: "admin",
  OWNER: "owner",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const ConversationType = {
  DM: "dm",
  CHANNEL: "channel",
  AI: "ai",
} as const;
export type ConversationType =
  (typeof ConversationType)[keyof typeof ConversationType];

export const MessageRole = {
  USER: "user",
  AI: "ai",
  SYSTEM: "system",
} as const;
export type MessageRole = (typeof MessageRole)[keyof typeof MessageRole];

export const signUpSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});
export type SignUpInput = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type SignInInput = z.infer<typeof signInSchema>;

// ─── Entity Field Types ──────────────────────────────────────────────────────

export const ENTITY_FIELD_TYPES = [
  "text",
  "long_text",
  "rich_text",
  "number",
  "decimal",
  "currency",
  "percent",
  "date",
  "datetime",
  "duration",
  "checkbox",
  "select",
  "multiselect",
  "status",
  "priority",
  "rating",
  "email",
  "url",
  "phone",
  "person",
  "relationship",
  "lookup",
  "rollup",
  "formula",
  "autonumber",
  "attachment",
  "json",
  "barcode",
  "ai",
  "created_at",
  "updated_at",
  "created_by",
  "updated_by",
] as const;

export type EntityFieldType = (typeof ENTITY_FIELD_TYPES)[number];

export const entityFieldTypeSchema = z.enum(ENTITY_FIELD_TYPES);

export interface EntityFieldOption {
  value: string;
  label: string;
  color?: string;
}

export const entityFieldOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
  color: z.string().optional(),
});

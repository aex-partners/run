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

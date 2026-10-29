export type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
export type Op =
  | { op: "set"; path: string; value: Json }
  | { op: "define"; path: string; name: string; expr: string }
  | { op: "pointer"; path: string; target: string }
  | { op: "remove"; path: string; key: string }
  | { op: "secret"; path: string }
  | { op: "noise"; path: string }
  | { op: "identity"; handle: string }
  | { op: "query"; paths: string[] };
export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
/** A model is any function from chat messages to the reply text. Adapters build one. */
export type ChatModel = (messages: ChatMessage[]) => Promise<string>;
export type ParseInput = { text: string; state?: Json; schema?: string; namespace?: string; speaker?: string };
export type DiffEntry = { path: string; before: Json | undefined; after: Json | undefined };
export type ParseResult = {
  ok: boolean; ops: Op[]; needsConfirm: Op[]; diff: DiffEntry[]; reads: Record<string, Json | undefined>;
  errors: string[]; attempts: number; raw: string[];
};
export const CONFIRM_OPS = ["secret", "noise", "identity", "remove"] as const;

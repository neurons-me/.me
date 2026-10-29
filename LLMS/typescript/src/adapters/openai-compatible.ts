// Shared client for OpenAI-style /chat/completions endpoints. The key is only placed in the Authorization header; it is never
// logged, thrown or returned.
import type { ChatModel, ChatMessage } from "../types.ts";

export type CompatOptions = { apiKey?: string; baseUrl: string; model: string; temperature?: number; fetchImpl?: typeof fetch; responseFormat?: object; timeoutMs?: number; label: string; keyEnv: string };

export function openAICompatible(o: CompatOptions): ChatModel {
  if (!o.apiKey) throw new Error(`${o.label}: ${o.keyEnv} is not set`);
  const f = o.fetchImpl ?? fetch;
  const url = o.baseUrl.replace(/\/$/, "") + "/chat/completions";
  return async (messages: ChatMessage[]) => {
    const body: any = { model: o.model, messages, temperature: o.temperature ?? 0 };
    if (o.responseFormat) body.response_format = o.responseFormat;
    const res = await f(url, { method: "POST", headers: { Authorization: "Bearer " + o.apiKey, "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(o.timeoutMs ?? 60000) }).catch((e: any) => { throw new Error(`${o.label}: request failed (${e.name === "TimeoutError" ? "timeout" : e.name})`); });
    const j: any = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`${o.label} ${res.status}: ${(j.error && (j.error.code || j.error.message)) || j.detail || "error"}`);
    const c = j.choices?.[0]?.message?.content;
    if (typeof c !== "string") throw new Error(`${o.label}: reply has no message content`);
    return c;
  };
}

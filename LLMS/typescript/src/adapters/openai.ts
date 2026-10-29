// OpenAI adapter: https://api.openai.com/v1/chat/completions, key from OPENAI_API_KEY, model from OPENAI_MODEL (default gpt-4o-mini).
// Sends response_format json_object, which that API supports.
import { openAICompatible } from "./openai-compatible.ts";
import type { ChatModel } from "../types.ts";
export function openaiModel(o: { apiKey?: string; baseUrl?: string; model?: string; temperature?: number; fetchImpl?: typeof fetch } = {}): ChatModel {
  return openAICompatible({
    label: "OpenAI API", keyEnv: "OPENAI_API_KEY",
    apiKey: o.apiKey ?? process.env.OPENAI_API_KEY,
    baseUrl: o.baseUrl ?? process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
    model: o.model ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    temperature: o.temperature, fetchImpl: o.fetchImpl, responseFormat: { type: "json_object" },
  });
}

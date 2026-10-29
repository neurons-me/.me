// Meta Model API adapter: https://api.meta.ai/v1/chat/completions, default model muse-spark-1.3, key from META_API_KEY.
import { openAICompatible } from "./openai-compatible.ts";
import type { ChatModel } from "../types.ts";
export const META_DEFAULTS = { baseUrl: "https://api.meta.ai/v1", model: "muse-spark-1.3" };
export function metaModel(o: { apiKey?: string; baseUrl?: string; model?: string; temperature?: number; fetchImpl?: typeof fetch } = {}): ChatModel {
  return openAICompatible({
    label: "Meta Model API", keyEnv: "META_API_KEY",
    apiKey: o.apiKey ?? process.env.META_API_KEY,
    baseUrl: o.baseUrl ?? process.env.META_BASE_URL ?? META_DEFAULTS.baseUrl,
    model: o.model ?? process.env.META_MODEL ?? META_DEFAULTS.model,
    temperature: o.temperature, fetchImpl: o.fetchImpl,
  });
}

import type { ChatMessage, ParseInput, Json } from "./types.ts";
import { SYSTEM_PROMPT, EXAMPLES } from "./spec.ts";
import { flattenState } from "./kernel.ts";

/** State is sent as leaf paths. Values under secretPaths are never sent, only their path marked as secret. */
export function userMessage(i: ParseInput, secretPaths: string[] = []): string {
  const leaves = flattenState(i.state as Json).map(([p, v]) => (secretPaths.some((s) => p === s || p.startsWith(s + ".")) ? `${p} = <secret>` : `${p} = ${JSON.stringify(v)}`));
  return [
    i.namespace ? `Namespace: ${i.namespace}` : "",
    i.speaker ? `Speaker ("I"/"me"/"yo"): ${i.speaker}` : "",
    `State:\n${leaves.length ? leaves.join("\n") : "(empty)"}`,
    i.schema ? `Schema:\n${i.schema}` : "",
    `Text: ${i.text}`,
  ].filter(Boolean).join("\n");
}

export function buildMessages(i: ParseInput, opts: { secretPaths?: string[]; examples?: typeof EXAMPLES } = {}): ChatMessage[] {
  const msgs: ChatMessage[] = [{ role: "system", content: SYSTEM_PROMPT }];
  for (const ex of opts.examples ?? EXAMPLES) {
    msgs.push({ role: "user", content: userMessage({ text: ex.text, state: ex.state, speaker: ex.speaker }) });
    msgs.push({ role: "assistant", content: JSON.stringify({ ops: ex.ops }) });
  }
  msgs.push({ role: "user", content: userMessage(i, opts.secretPaths) });
  return msgs;
}

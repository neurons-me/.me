// Loads the language-neutral spec (LLMS/*). In the repo it is read from ../; a packed npm tarball carries a copy in ./spec/.
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
const here = path.dirname(fileURLToPath(import.meta.url));
const roots = [path.join(here, "../spec"), path.join(here, "../..")];
const root = roots.find((r) => fs.existsSync(path.join(r, "ops.schema.json")))!;
const txt = (f: string) => fs.readFileSync(path.join(root, f), "utf8");
export const SPEC_ROOT = root;
export const SYSTEM_PROMPT: string = txt("prompt/system.md").trim();
export const EXAMPLES: { lang: string; text: string; state?: any; speaker?: string; ops: any[] }[] = JSON.parse(txt("prompt/examples.json"));
export const OPS_SCHEMA: object = JSON.parse(txt("ops.schema.json"));

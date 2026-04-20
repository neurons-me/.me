import { readdir } from "node:fs/promises";

const demos = (await readdir(new URL(".", import.meta.url)))
  .filter((file) => file.endsWith(".ts") && file !== "run-all.ts")
  .sort((a, b) => a.localeCompare(b));

for (const demo of demos) {
  console.log(`\n>>> Running ${demo}`);
  await import(`./${demo}`);
}

console.log("\nPASS: all .me demos\n");

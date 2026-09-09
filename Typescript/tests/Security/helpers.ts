/// <reference types="node" />
/**
 * Shared helpers for the Identity-Bound Secrets adversarial security battery
 * (tests/Security/*.test.ts). Deliberately mirrors the conventions already
 * used by tests/identity-bound-secrets.test.ts (same `test()` runner shape,
 * same tamper/base64url helpers) rather than inventing a second style.
 *
 * Every identity/password/secret string used anywhere in this battery is
 * synthetic and scoped to a single test run — see each test file's own
 * literals. No real user data, snapshots, or services are touched.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
// @ts-ignore -- runtime verification intentionally targets the built artifact,
// matching tests/identity-bound-secrets.test.ts's own convention.
import ME from "../../dist/me.es.js";

export { assert };
export const MEConstructor = ME as any;

export interface TestFailure {
  name: string;
  error: unknown;
}

/**
 * Minimal collecting test runner: unlike identity-bound-secrets.test.ts's
 * `test()` (which throws on first failure), this one records every failure
 * so one file can report a full pass/fail matrix instead of stopping at the
 * first broken assertion — useful for a battery meant to enumerate distinct
 * attack variants, not just prove the first one works.
 */
export function makeSuite(suiteName: string) {
  const failures: TestFailure[] = [];
  let passCount = 0;

  async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
    try {
      await fn();
      passCount++;
      console.log(`  ✅ ${name}`);
    } catch (error) {
      failures.push({ name, error });
      console.error(`  ❌ ${name}`);
      console.error(`     ${error instanceof Error ? error.stack || error.message : String(error)}`);
    }
  }

  function summarize(): boolean {
    console.log(`\n${suiteName}: ${passCount} passed, ${failures.length} failed`);
    if (failures.length > 0) {
      console.log(`Failed:`);
      for (const f of failures) console.log(`  - ${f.name}`);
    }
    return failures.length === 0;
  }

  return { test, summarize, get failures() { return failures; } };
}

export function clone<T>(value: T): T {
  return typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}

export function base64UrlToBytes(input: string): Uint8Array {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(input.length / 4) * 4, "=");
  return new Uint8Array(Buffer.from(normalized, "base64"));
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/** Flips the last decoded byte of a `b64u:`-prefixed or bare base64url blob. */
export function tamperB64u(blob: string): string {
  const prefix = blob.startsWith("b64u:") ? "b64u:" : "";
  const payload = prefix ? blob.slice(prefix.length) : blob;
  const bytes = base64UrlToBytes(payload);
  bytes[bytes.length - 1] = bytes[bytes.length - 1] ^ 0xff;
  return prefix + bytesToBase64Url(bytes);
}

/** Flips one byte at a given offset (from the start of the decoded payload). */
export function tamperB64uAt(blob: string, offsetFromStart: number): string {
  const prefix = blob.startsWith("b64u:") ? "b64u:" : "";
  const payload = prefix ? blob.slice(prefix.length) : blob;
  const bytes = base64UrlToBytes(payload);
  const idx = ((offsetFromStart % bytes.length) + bytes.length) % bytes.length;
  bytes[idx] = bytes[idx] ^ 0xff;
  return prefix + bytesToBase64Url(bytes);
}

export function truncateB64u(blob: string, keepBytes: number): string {
  const prefix = blob.startsWith("b64u:") ? "b64u:" : "";
  const payload = prefix ? blob.slice(prefix.length) : blob;
  const bytes = base64UrlToBytes(payload);
  return prefix + bytesToBase64Url(bytes.subarray(0, Math.max(0, Math.min(keepBytes, bytes.length))));
}

export function tempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function cleanup(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

/** Every file DiskStore/exportSnapshot could have produced, read as UTF-8 (skips binary). */
export function readAllTextFiles(dir: string): Array<{ file: string; contents: string }> {
  const out: Array<{ file: string; contents: string }> = [];
  const files = fs.readdirSync(dir, { recursive: true } as any) as string[];
  for (const file of files) {
    const fullPath = path.join(dir, String(file));
    if (!fs.statSync(fullPath).isFile()) continue;
    try {
      out.push({ file: String(file), contents: fs.readFileSync(fullPath, "utf8") });
    } catch {
      // not a text file; nothing meaningful to scan
    }
  }
  return out;
}

/** Asserts none of `markers` appear anywhere in `haystack`. */
export function assertNoMarkers(haystack: string, markers: string[], context: string): void {
  for (const marker of markers) {
    assert.ok(!haystack.includes(marker), `${context} must not contain marker "${marker}"`);
  }
}

/**
 * Deterministic xorshift32 PRNG for reproducible generative tests (§9 of the
 * task spec: "usa semillas reproducibles"). Not cryptographic — only used to
 * script test *scenarios*, never as key material.
 */
export function makeRng(seed: number) {
  let state = seed >>> 0 || 0xdeadbeef;
  return {
    seed,
    next(): number {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      state >>>= 0;
      return state;
    },
    nextFloat(): number {
      return this.next() / 0x100000000;
    },
    int(maxExclusive: number): number {
      return Math.floor(this.nextFloat() * maxExclusive);
    },
    pick<T>(arr: T[]): T {
      return arr[this.int(arr.length)];
    },
    string(len: number): string {
      const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-";
      let out = "";
      for (let i = 0; i < len; i++) out += chars[this.int(chars.length)];
      return out;
    },
  };
}

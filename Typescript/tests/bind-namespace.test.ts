import assert from "node:assert/strict";
import { ME } from "../src/me.ts";
import type { MEProxy } from "../src/types.ts";

// bindNamespace() requires an active expression — only the 2-arg
// constructor (ME(who, secret)) sets it; the 1-arg seed-string form never
// does (see createSeedSession.ts's use of the 1-arg form, and me.ts's
// prove() using the identical guard).
assert.throws(
  () => new ME("raw-seed-no-who").bindNamespace("local.cleaker"),
  /ACTIVE_EXPRESSION_REQUIRED/,
);

// Typed as MEProxy (not the plain ME class type) so `me(path)` read calls
// below type-check — the runtime object new ME(...) returns really is
// callable (a Proxy), but the class type alone has no call signature; same
// convention axioms.test.ts already uses for this exact reason.
const me = new ME("jabellae", "test-secret-not-real") as unknown as MEProxy;

// Empty/whitespace-only root is rejected.
assert.throws(() => me.bindNamespace("   "), /ROOT_NAMESPACE_REQUIRED/);

// Real bind writes both profile.rootNamespace and profile.namespace, via
// the same convention createThisMe()'s configureIdentity() already uses.
const result = me.bindNamespace("local.cleaker");
assert.equal(me("profile.rootNamespace"), "local.cleaker");
assert.equal(me("profile.namespace"), "jabellae.local.cleaker");

// Returns a proxy (not the raw kernel instance) so further chained calls
// keep the path-DSL behavior — same reasoning as(scope) already follows.
assert.equal(typeof result.profile, "function");
assert.equal(result("profile.namespace"), "jabellae.local.cleaker");

console.log("bind-namespace.test.ts: all assertions passed");

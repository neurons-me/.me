export const NODE_INSPECT_CUSTOM = Symbol.for("nodejs.util.inspect.custom");
export const ME_SEED_SYMBOL = Symbol.for("me.seed");
export const ME_EXPRESSION_SYMBOL = Symbol.for("me.expression");
export const ME_IDENTITY_SYMBOL = Symbol.for("me.identity");
export const ME_SET_ACTIVE_EXPRESSION_SYMBOL = Symbol.for("me.internal.setActiveExpression");
// Derives a compound seed from (who, secret) and re-initialises the kernel.
// seed = keccak256("me.seed/compound:v1::" + who + "::" + secret)
export const ME_RESEED_SYMBOL = Symbol.for("me.internal.reseed");

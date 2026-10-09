// Independent exact reference for aggregate sums (contract v3 §8, v4.1 §3.2). Copied verbatim from the contract probe.
// computed exactly in BigInt scaled by 2^1074. Independent of term order by construction.
const SCALE = 1074n;
export function toScaled(x) {            // finite double -> BigInt N with x = N * 2^-1074 exactly
  if (!Number.isFinite(x)) throw new TypeError("non-finite term");
  const dv = new DataView(new ArrayBuffer(8)); dv.setFloat64(0, x);
  const hi = dv.getUint32(0), lo = dv.getUint32(4);
  const sign = hi >>> 31, exp = (hi >>> 20) & 0x7ff;
  let mant = (BigInt(hi & 0xfffff) << 32n) | BigInt(lo);
  let shift;
  if (exp === 0) shift = 0n;                          // subnormal / zero: mant * 2^-1074
  else { mant |= 1n << 52n; shift = BigInt(exp - 1); } // normal: mant * 2^(exp-1075) = mant*2^(exp-1) * 2^-1074
  const n = mant << shift;
  return sign ? -n : n;
}
export function roundScaled(N) {         // BigInt N -> nearest double of N * 2^-1074 (ties to even); +0 for zero
  if (N === 0n) return 0;
  const neg = N < 0n; let A = neg ? -N : N;
  const L = A.toString(2).length;
  let q, shift = 0;
  if (L <= 53) q = A;
  else {
    shift = L - 53;
    const s = BigInt(shift);
    q = A >> s; const r = A - (q << s), half = 1n << (s - 1n);
    if (r > half || (r === half && (q & 1n) === 1n)) q += 1n;
    if (q === 1n << 53n) { q >>= 1n; shift += 1; }
  }
  const v = Number(q) * 2 ** (shift - 1074);
  return neg ? -v : v;
}
export const exactSum = (terms) => roundScaled(terms.reduce((acc, t) => acc + toScaled(t), 0n));

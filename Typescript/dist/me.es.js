var Lr = (e) => {
  throw TypeError(e);
};
var Vr = (e, t, n) => t.has(e) || Lr("Cannot " + n);
var W = (e, t, n) => (Vr(e, t, "read from private field"), n ? n.call(e) : t.get(e)), nn = (e, t, n) => t.has(e) ? Lr("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(e) : t.set(e, n), Q = (e, t, n, r) => (Vr(e, t, "write to private field"), r ? r.call(e, n) : t.set(e, n), n);
var da = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {};
function pa(e) {
  return e && e.__esModule && Object.prototype.hasOwnProperty.call(e, "default") ? e.default : e;
}
var In = { exports: {} };
var zr;
function ma() {
  return zr || (zr = 1, (function(e) {
    (function() {
      var t = "input is invalid type", n = "finalize already called", r = typeof window == "object", o = r ? window : {};
      o.JS_SHA3_NO_WINDOW && (r = !1);
      var i = !r && typeof self == "object", a = !o.JS_SHA3_NO_NODE_JS && typeof process == "object" && process.versions && process.versions.node;
      a ? o = da : i && (o = self);
      for (var s = !o.JS_SHA3_NO_COMMON_JS && !0 && e.exports, u = !o.JS_SHA3_NO_ARRAY_BUFFER && typeof ArrayBuffer < "u", l = "0123456789abcdef".split(""), h = [31, 7936, 2031616, 520093696], f = [4, 1024, 262144, 67108864], d = [1, 256, 65536, 16777216], p = [6, 1536, 393216, 100663296], m = [0, 8, 16, 24], b = [
        1,
        0,
        32898,
        0,
        32906,
        2147483648,
        2147516416,
        2147483648,
        32907,
        0,
        2147483649,
        0,
        2147516545,
        2147483648,
        32777,
        2147483648,
        138,
        0,
        136,
        0,
        2147516425,
        0,
        2147483658,
        0,
        2147516555,
        0,
        139,
        2147483648,
        32905,
        2147483648,
        32771,
        2147483648,
        32770,
        2147483648,
        128,
        2147483648,
        32778,
        0,
        2147483658,
        2147483648,
        2147516545,
        2147483648,
        32896,
        2147483648,
        2147483649,
        0,
        2147516424,
        2147483648
      ], S = [224, 256, 384, 512], g = [128, 256], k = ["hex", "buffer", "arrayBuffer", "array", "digest"], M = {
        128: 168,
        256: 136
      }, w = o.JS_SHA3_NO_NODE_JS || !Array.isArray ? function(c) {
        return Object.prototype.toString.call(c) === "[object Array]";
      } : Array.isArray, D = u && (o.JS_SHA3_NO_ARRAY_BUFFER_IS_VIEW || !ArrayBuffer.isView) ? function(c) {
        return typeof c == "object" && c.buffer && c.buffer.constructor === ArrayBuffer;
      } : ArrayBuffer.isView, R = function(c) {
        var y = typeof c;
        if (y === "string")
          return [c, !0];
        if (y !== "object" || c === null)
          throw new Error(t);
        if (u && c.constructor === ArrayBuffer)
          return [new Uint8Array(c), !1];
        if (!w(c) && !D(c))
          throw new Error(t);
        return [c, !1];
      }, O = function(c) {
        return R(c)[0].length === 0;
      }, I = function(c) {
        for (var y = [], x = 0; x < c.length; ++x)
          y[x] = c[x];
        return y;
      }, N = function(c, y, x) {
        return function(v) {
          return new $(c, y, c).update(v)[x]();
        };
      }, H = function(c, y, x) {
        return function(v, B) {
          return new $(c, y, B).update(v)[x]();
        };
      }, _e = function(c, y, x) {
        return function(v, B, C, A) {
          return ue["cshake" + c].update(v, B, C, A)[x]();
        };
      }, De = function(c, y, x) {
        return function(v, B, C, A) {
          return ue["kmac" + c].update(v, B, C, A)[x]();
        };
      }, P = function(c, y, x, v) {
        for (var B = 0; B < k.length; ++B) {
          var C = k[B];
          c[C] = y(x, v, C);
        }
        return c;
      }, Fr = function(c, y) {
        var x = N(c, y, "hex");
        return x.create = function() {
          return new $(c, y, c);
        }, x.update = function(v) {
          return x.create().update(v);
        }, P(x, N, c, y);
      }, la = function(c, y) {
        var x = H(c, y, "hex");
        return x.create = function(v) {
          return new $(c, y, v);
        }, x.update = function(v, B) {
          return x.create(B).update(v);
        }, P(x, H, c, y);
      }, fa = function(c, y) {
        var x = M[c], v = _e(c, y, "hex");
        return v.create = function(B, C, A) {
          return O(C) && O(A) ? ue["shake" + c].create(B) : new $(c, y, B).bytepad([C, A], x);
        }, v.update = function(B, C, A, E) {
          return v.create(C, A, E).update(B);
        }, P(v, _e, c, y);
      }, ha = function(c, y) {
        var x = M[c], v = De(c, y, "hex");
        return v.create = function(B, C, A) {
          return new Pn(c, y, C).bytepad(["KMAC", A], x).bytepad([B], x);
        }, v.update = function(B, C, A, E) {
          return v.create(B, A, E).update(C);
        }, P(v, De, c, y);
      }, jr = [
        { name: "keccak", padding: d, bits: S, createMethod: Fr },
        { name: "sha3", padding: p, bits: S, createMethod: Fr },
        { name: "shake", padding: h, bits: g, createMethod: la },
        { name: "cshake", padding: f, bits: g, createMethod: fa },
        { name: "kmac", padding: f, bits: g, createMethod: ha }
      ], ue = {}, Ue = [], le = 0; le < jr.length; ++le)
        for (var Pe = jr[le], nt = Pe.bits, Te = 0; Te < nt.length; ++Te) {
          var Dn = Pe.name + "_" + nt[Te];
          if (Ue.push(Dn), ue[Dn] = Pe.createMethod(nt[Te], Pe.padding), Pe.name !== "sha3") {
            var $r = Pe.name + nt[Te];
            Ue.push($r), ue[$r] = ue[Dn];
          }
        }
      function $(c, y, x) {
        this.blocks = [], this.s = [], this.padding = y, this.outputBits = x, this.reset = !0, this.finalized = !1, this.block = 0, this.start = 0, this.blockCount = 1600 - (c << 1) >> 5, this.byteCount = this.blockCount << 2, this.outputBlocks = x >> 5, this.extraBytes = (x & 31) >> 3;
        for (var v = 0; v < 50; ++v)
          this.s[v] = 0;
      }
      $.prototype.update = function(c) {
        if (this.finalized)
          throw new Error(n);
        var y = R(c);
        c = y[0];
        for (var x = y[1], v = this.blocks, B = this.byteCount, C = c.length, A = this.blockCount, E = 0, L = this.s, _, j; E < C; ) {
          if (this.reset)
            for (this.reset = !1, v[0] = this.block, _ = 1; _ < A + 1; ++_)
              v[_] = 0;
          if (x)
            for (_ = this.start; E < C && _ < B; ++E)
              j = c.charCodeAt(E), j < 128 ? v[_ >> 2] |= j << m[_++ & 3] : j < 2048 ? (v[_ >> 2] |= (192 | j >> 6) << m[_++ & 3], v[_ >> 2] |= (128 | j & 63) << m[_++ & 3]) : j < 55296 || j >= 57344 ? (v[_ >> 2] |= (224 | j >> 12) << m[_++ & 3], v[_ >> 2] |= (128 | j >> 6 & 63) << m[_++ & 3], v[_ >> 2] |= (128 | j & 63) << m[_++ & 3]) : (j = 65536 + ((j & 1023) << 10 | c.charCodeAt(++E) & 1023), v[_ >> 2] |= (240 | j >> 18) << m[_++ & 3], v[_ >> 2] |= (128 | j >> 12 & 63) << m[_++ & 3], v[_ >> 2] |= (128 | j >> 6 & 63) << m[_++ & 3], v[_ >> 2] |= (128 | j & 63) << m[_++ & 3]);
          else
            for (_ = this.start; E < C && _ < B; ++E)
              v[_ >> 2] |= c[E] << m[_++ & 3];
          if (this.lastByteIndex = _, _ >= B) {
            for (this.start = _ - B, this.block = v[A], _ = 0; _ < A; ++_)
              L[_] ^= v[_];
            We(L), this.reset = !0;
          } else
            this.start = _;
        }
        return this;
      }, $.prototype.encode = function(c, y) {
        var x = c & 255, v = 1, B = [x];
        for (c = c >> 8, x = c & 255; x > 0; )
          B.unshift(x), c = c >> 8, x = c & 255, ++v;
        return y ? B.push(v) : B.unshift(v), this.update(B), B.length;
      }, $.prototype.encodeString = function(c) {
        var y = R(c);
        c = y[0];
        var x = y[1], v = 0, B = c.length;
        if (x)
          for (var C = 0; C < c.length; ++C) {
            var A = c.charCodeAt(C);
            A < 128 ? v += 1 : A < 2048 ? v += 2 : A < 55296 || A >= 57344 ? v += 3 : (A = 65536 + ((A & 1023) << 10 | c.charCodeAt(++C) & 1023), v += 4);
          }
        else
          v = B;
        return v += this.encode(v * 8), this.update(c), v;
      }, $.prototype.bytepad = function(c, y) {
        for (var x = this.encode(y), v = 0; v < c.length; ++v)
          x += this.encodeString(c[v]);
        var B = (y - x % y) % y, C = [];
        return C.length = B, this.update(C), this;
      }, $.prototype.finalize = function() {
        if (!this.finalized) {
          this.finalized = !0;
          var c = this.blocks, y = this.lastByteIndex, x = this.blockCount, v = this.s;
          if (c[y >> 2] |= this.padding[y & 3], this.lastByteIndex === this.byteCount)
            for (c[0] = c[x], y = 1; y < x + 1; ++y)
              c[y] = 0;
          for (c[x - 1] |= 2147483648, y = 0; y < x; ++y)
            v[y] ^= c[y];
          We(v);
        }
      }, $.prototype.toString = $.prototype.hex = function() {
        this.finalize();
        for (var c = this.blockCount, y = this.s, x = this.outputBlocks, v = this.extraBytes, B = 0, C = 0, A = "", E; C < x; ) {
          for (B = 0; B < c && C < x; ++B, ++C)
            E = y[B], A += l[E >> 4 & 15] + l[E & 15] + l[E >> 12 & 15] + l[E >> 8 & 15] + l[E >> 20 & 15] + l[E >> 16 & 15] + l[E >> 28 & 15] + l[E >> 24 & 15];
          C % c === 0 && (y = I(y), We(y), B = 0);
        }
        return v && (E = y[B], A += l[E >> 4 & 15] + l[E & 15], v > 1 && (A += l[E >> 12 & 15] + l[E >> 8 & 15]), v > 2 && (A += l[E >> 20 & 15] + l[E >> 16 & 15])), A;
      }, $.prototype.arrayBuffer = function() {
        this.finalize();
        var c = this.blockCount, y = this.s, x = this.outputBlocks, v = this.extraBytes, B = 0, C = 0, A = this.outputBits >> 3, E;
        v ? E = new ArrayBuffer(x + 1 << 2) : E = new ArrayBuffer(A);
        for (var L = new Uint32Array(E); C < x; ) {
          for (B = 0; B < c && C < x; ++B, ++C)
            L[C] = y[B];
          C % c === 0 && (y = I(y), We(y));
        }
        return v && (L[C] = y[B], E = E.slice(0, A)), E;
      }, $.prototype.buffer = $.prototype.arrayBuffer, $.prototype.digest = $.prototype.array = function() {
        this.finalize();
        for (var c = this.blockCount, y = this.s, x = this.outputBlocks, v = this.extraBytes, B = 0, C = 0, A = [], E, L; C < x; ) {
          for (B = 0; B < c && C < x; ++B, ++C)
            E = C << 2, L = y[B], A[E] = L & 255, A[E + 1] = L >> 8 & 255, A[E + 2] = L >> 16 & 255, A[E + 3] = L >> 24 & 255;
          C % c === 0 && (y = I(y), We(y));
        }
        return v && (E = C << 2, L = y[B], A[E] = L & 255, v > 1 && (A[E + 1] = L >> 8 & 255), v > 2 && (A[E + 2] = L >> 16 & 255)), A;
      };
      function Pn(c, y, x) {
        $.call(this, c, y, x);
      }
      Pn.prototype = new $(), Pn.prototype.finalize = function() {
        return this.encode(this.outputBits, !0), $.prototype.finalize.call(this);
      };
      var We = function(c) {
        var y, x, v, B, C, A, E, L, _, j, rt, ot, it, at, st, ct, ut, lt, ft, ht, dt, pt, mt, yt, gt, xt, bt, St, vt, wt, Mt, kt, Bt, Ct, Et, At, _t, Dt, Pt, It, Rt, Nt, Ot, Kt, Ft, jt, $t, Lt, Vt, zt, Ut, Tt, Wt, Ht, Jt, qt, Gt, Xt, Yt, Zt, Qt, en, tn;
        for (v = 0; v < 48; v += 2)
          B = c[0] ^ c[10] ^ c[20] ^ c[30] ^ c[40], C = c[1] ^ c[11] ^ c[21] ^ c[31] ^ c[41], A = c[2] ^ c[12] ^ c[22] ^ c[32] ^ c[42], E = c[3] ^ c[13] ^ c[23] ^ c[33] ^ c[43], L = c[4] ^ c[14] ^ c[24] ^ c[34] ^ c[44], _ = c[5] ^ c[15] ^ c[25] ^ c[35] ^ c[45], j = c[6] ^ c[16] ^ c[26] ^ c[36] ^ c[46], rt = c[7] ^ c[17] ^ c[27] ^ c[37] ^ c[47], ot = c[8] ^ c[18] ^ c[28] ^ c[38] ^ c[48], it = c[9] ^ c[19] ^ c[29] ^ c[39] ^ c[49], y = ot ^ (A << 1 | E >>> 31), x = it ^ (E << 1 | A >>> 31), c[0] ^= y, c[1] ^= x, c[10] ^= y, c[11] ^= x, c[20] ^= y, c[21] ^= x, c[30] ^= y, c[31] ^= x, c[40] ^= y, c[41] ^= x, y = B ^ (L << 1 | _ >>> 31), x = C ^ (_ << 1 | L >>> 31), c[2] ^= y, c[3] ^= x, c[12] ^= y, c[13] ^= x, c[22] ^= y, c[23] ^= x, c[32] ^= y, c[33] ^= x, c[42] ^= y, c[43] ^= x, y = A ^ (j << 1 | rt >>> 31), x = E ^ (rt << 1 | j >>> 31), c[4] ^= y, c[5] ^= x, c[14] ^= y, c[15] ^= x, c[24] ^= y, c[25] ^= x, c[34] ^= y, c[35] ^= x, c[44] ^= y, c[45] ^= x, y = L ^ (ot << 1 | it >>> 31), x = _ ^ (it << 1 | ot >>> 31), c[6] ^= y, c[7] ^= x, c[16] ^= y, c[17] ^= x, c[26] ^= y, c[27] ^= x, c[36] ^= y, c[37] ^= x, c[46] ^= y, c[47] ^= x, y = j ^ (B << 1 | C >>> 31), x = rt ^ (C << 1 | B >>> 31), c[8] ^= y, c[9] ^= x, c[18] ^= y, c[19] ^= x, c[28] ^= y, c[29] ^= x, c[38] ^= y, c[39] ^= x, c[48] ^= y, c[49] ^= x, at = c[0], st = c[1], jt = c[11] << 4 | c[10] >>> 28, $t = c[10] << 4 | c[11] >>> 28, St = c[20] << 3 | c[21] >>> 29, vt = c[21] << 3 | c[20] >>> 29, Zt = c[31] << 9 | c[30] >>> 23, Qt = c[30] << 9 | c[31] >>> 23, Nt = c[40] << 18 | c[41] >>> 14, Ot = c[41] << 18 | c[40] >>> 14, Ct = c[2] << 1 | c[3] >>> 31, Et = c[3] << 1 | c[2] >>> 31, ct = c[13] << 12 | c[12] >>> 20, ut = c[12] << 12 | c[13] >>> 20, Lt = c[22] << 10 | c[23] >>> 22, Vt = c[23] << 10 | c[22] >>> 22, wt = c[33] << 13 | c[32] >>> 19, Mt = c[32] << 13 | c[33] >>> 19, en = c[42] << 2 | c[43] >>> 30, tn = c[43] << 2 | c[42] >>> 30, Ht = c[5] << 30 | c[4] >>> 2, Jt = c[4] << 30 | c[5] >>> 2, At = c[14] << 6 | c[15] >>> 26, _t = c[15] << 6 | c[14] >>> 26, lt = c[25] << 11 | c[24] >>> 21, ft = c[24] << 11 | c[25] >>> 21, zt = c[34] << 15 | c[35] >>> 17, Ut = c[35] << 15 | c[34] >>> 17, kt = c[45] << 29 | c[44] >>> 3, Bt = c[44] << 29 | c[45] >>> 3, yt = c[6] << 28 | c[7] >>> 4, gt = c[7] << 28 | c[6] >>> 4, qt = c[17] << 23 | c[16] >>> 9, Gt = c[16] << 23 | c[17] >>> 9, Dt = c[26] << 25 | c[27] >>> 7, Pt = c[27] << 25 | c[26] >>> 7, ht = c[36] << 21 | c[37] >>> 11, dt = c[37] << 21 | c[36] >>> 11, Tt = c[47] << 24 | c[46] >>> 8, Wt = c[46] << 24 | c[47] >>> 8, Kt = c[8] << 27 | c[9] >>> 5, Ft = c[9] << 27 | c[8] >>> 5, xt = c[18] << 20 | c[19] >>> 12, bt = c[19] << 20 | c[18] >>> 12, Xt = c[29] << 7 | c[28] >>> 25, Yt = c[28] << 7 | c[29] >>> 25, It = c[38] << 8 | c[39] >>> 24, Rt = c[39] << 8 | c[38] >>> 24, pt = c[48] << 14 | c[49] >>> 18, mt = c[49] << 14 | c[48] >>> 18, c[0] = at ^ ~ct & lt, c[1] = st ^ ~ut & ft, c[10] = yt ^ ~xt & St, c[11] = gt ^ ~bt & vt, c[20] = Ct ^ ~At & Dt, c[21] = Et ^ ~_t & Pt, c[30] = Kt ^ ~jt & Lt, c[31] = Ft ^ ~$t & Vt, c[40] = Ht ^ ~qt & Xt, c[41] = Jt ^ ~Gt & Yt, c[2] = ct ^ ~lt & ht, c[3] = ut ^ ~ft & dt, c[12] = xt ^ ~St & wt, c[13] = bt ^ ~vt & Mt, c[22] = At ^ ~Dt & It, c[23] = _t ^ ~Pt & Rt, c[32] = jt ^ ~Lt & zt, c[33] = $t ^ ~Vt & Ut, c[42] = qt ^ ~Xt & Zt, c[43] = Gt ^ ~Yt & Qt, c[4] = lt ^ ~ht & pt, c[5] = ft ^ ~dt & mt, c[14] = St ^ ~wt & kt, c[15] = vt ^ ~Mt & Bt, c[24] = Dt ^ ~It & Nt, c[25] = Pt ^ ~Rt & Ot, c[34] = Lt ^ ~zt & Tt, c[35] = Vt ^ ~Ut & Wt, c[44] = Xt ^ ~Zt & en, c[45] = Yt ^ ~Qt & tn, c[6] = ht ^ ~pt & at, c[7] = dt ^ ~mt & st, c[16] = wt ^ ~kt & yt, c[17] = Mt ^ ~Bt & gt, c[26] = It ^ ~Nt & Ct, c[27] = Rt ^ ~Ot & Et, c[36] = zt ^ ~Tt & Kt, c[37] = Ut ^ ~Wt & Ft, c[46] = Zt ^ ~en & Ht, c[47] = Qt ^ ~tn & Jt, c[8] = pt ^ ~at & ct, c[9] = mt ^ ~st & ut, c[18] = kt ^ ~yt & xt, c[19] = Bt ^ ~gt & bt, c[28] = Nt ^ ~Ct & At, c[29] = Ot ^ ~Et & _t, c[38] = Tt ^ ~Kt & jt, c[39] = Wt ^ ~Ft & $t, c[48] = en ^ ~Ht & qt, c[49] = tn ^ ~Jt & Gt, c[0] ^= b[v], c[1] ^= b[v + 1];
      };
      if (s)
        e.exports = ue;
      else
        for (le = 0; le < Ue.length; ++le)
          o[Ue[le]] = ue[Ue[le]];
    })();
  })(In)), In.exports;
}
var ya = ma();
const lo = /* @__PURE__ */ pa(ya), { keccak256: fo } = lo, ga = "this.me/wrapped-secret/v1", xa = "me.prove.v1", ba = ":", J = new Uint8Array([254, 109, 101]), mn = 2, Fn = 16, jn = 16, yn = 3, $n = 16, Ln = 16, He = 136, Sa = "this.me/blob/v2/salt", va = "this.me/blob/v2/enc", wa = "this.me/blob/v2/mac", Ma = "this.me/blob/v2/stream", ka = "this.me/blob/v2/tag", Ba = "this.me/blob/v3/kdf", Ca = "this.me/blob/v3/enc", Ea = "this.me/blob/v3/mac", Aa = "this.me/blob/v3/stream", _a = "this.me/blob/v3/tag", qe = "b64u:";
function tr() {
  return {
    encryptCalls: 0,
    decryptCalls: 0,
    totalEncryptJsonMs: 0,
    totalEncryptAsciiMs: 0,
    totalEncryptKeystreamMs: 0,
    totalEncryptXorMs: 0,
    totalEncryptEncodeMs: 0,
    maxEncryptJsonMs: 0,
    maxEncryptAsciiMs: 0,
    maxEncryptKeystreamMs: 0,
    maxEncryptXorMs: 0,
    maxEncryptEncodeMs: 0,
    maxJsonBytes: 0,
    maxClearBytes: 0,
    maxKeystreamBytes: 0,
    maxCiphertextBytes: 0,
    maxHexBytes: 0,
    maxEncryptResidentBytes: 0,
    maxDecodedBytes: 0,
    maxDecryptClearBytes: 0,
    maxDecryptJsonBytes: 0,
    maxDecryptResidentBytes: 0,
    maxEncryptHeapDelta: 0,
    maxEncryptExternalDelta: 0,
    maxEncryptArrayBuffersDelta: 0,
    maxDecryptHeapDelta: 0,
    maxDecryptExternalDelta: 0,
    maxDecryptArrayBuffersDelta: 0
  };
}
const be = {
  enabled: !1,
  window: tr()
};
function an() {
  const e = typeof process < "u" ? process : null, t = e?.memoryUsage;
  if (typeof t != "function")
    return {
      heapUsed: 0,
      external: 0,
      arrayBuffers: 0
    };
  const n = t.call(e);
  return {
    heapUsed: n.heapUsed ?? 0,
    external: n.external ?? 0,
    arrayBuffers: n.arrayBuffers ?? 0
  };
}
function Vn(e) {
  const t = String(e ?? "");
  return typeof Buffer < "u" ? Math.max(t.length * 2, Buffer.byteLength(t, "utf8")) : t.length * 2;
}
function te() {
  return typeof performance < "u" && typeof performance.now == "function" ? performance.now() : Date.now();
}
function Oe(e, t) {
  return Math.max(0, e - t);
}
function Da(e = !0) {
  be.enabled = e, be.window = tr();
}
function Pa() {
  const e = { ...be.window };
  return be.window = tr(), e;
}
function F(e) {
  const t = String(e ?? "");
  if (typeof TextEncoder < "u")
    return new TextEncoder().encode(t);
  if (typeof Buffer < "u")
    return new Uint8Array(Buffer.from(t, "utf8"));
  const n = unescape(encodeURIComponent(t)), r = new Uint8Array(n.length);
  for (let o = 0; o < n.length; o++) r[o] = n.charCodeAt(o);
  return r;
}
function gn(e) {
  if (typeof TextDecoder < "u")
    return new TextDecoder().decode(e);
  if (typeof Buffer < "u")
    return Buffer.from(e).toString("utf8");
  let t = "";
  for (let n = 0; n < e.length; n++) t += String.fromCharCode(e[n]);
  return decodeURIComponent(escape(t));
}
function xn(e) {
  const t = e.startsWith("0x") ? e.slice(2) : e, n = new Uint8Array(t.length / 2);
  for (let r = 0; r < n.length; r++)
    n[r] = parseInt(t.substring(r * 2, r * 2 + 2), 16);
  return n;
}
function Ia(e) {
  let t = "";
  for (let n = 0; n < e.length; n++)
    t += e[n].toString(16).padStart(2, "0");
  return "0x" + t;
}
function Ra(e) {
  return `${qe}${Me(e)}`;
}
function nr(e) {
  return e.startsWith(qe) ? me(e.slice(qe.length)) : xn(e);
}
function Na(e) {
  const t = new Uint8Array(4);
  return new DataView(t.buffer).setUint32(0, e >>> 0, !1), t;
}
function ho(e) {
  const t = new Uint8Array(8), n = new DataView(t.buffer), r = Math.floor(e / 4294967296), o = e >>> 0;
  return n.setUint32(0, r >>> 0, !1), n.setUint32(4, o, !1), t;
}
function Ce(...e) {
  const t = e.reduce((o, i) => o + i.length, 0), n = new Uint8Array(t);
  let r = 0;
  for (const o of e)
    n.set(o, r), r += o.length;
  return n;
}
function U(...e) {
  for (const t of e)
    t && t.fill(0);
}
function po(e) {
  const t = globalThis.crypto;
  if (!t?.getRandomValues)
    throw new Error("Secure random values are required for encrypted branch writes.");
  const n = new Uint8Array(e);
  return t.getRandomValues(n), n;
}
function Ke(...e) {
  const t = fo.create();
  for (const n of e) t.update(n);
  return new Uint8Array(t.arrayBuffer());
}
function mo(e) {
  return F(e.join("."));
}
function z(e) {
  return Ce(Na(e.length), e);
}
function yo(e, t) {
  if (e.length !== t.length) return !1;
  let n = 0;
  for (let r = 0; r < e.length; r++) n |= e[r] ^ t[r];
  return n === 0;
}
function pe(e, ...t) {
  const n = e.length > He ? Ke(e) : Uint8Array.from(e), r = new Uint8Array(He);
  r.set(n);
  const o = new Uint8Array(He), i = new Uint8Array(He);
  try {
    for (let s = 0; s < He; s++)
      o[s] = r[s] ^ 54, i[s] = r[s] ^ 92;
    const a = Ke(o, ...t);
    try {
      return Ke(i, a);
    } finally {
      U(a);
    }
  } finally {
    U(n, r, o, i);
  }
}
function go(e, t) {
  const n = F(String(e ?? "")), r = mo(t), o = F(Sa), i = F(va), a = F(wa);
  let s = null, u = null;
  try {
    s = pe(o, z(r)), u = pe(s, z(n));
    const l = pe(u, i, z(r)), h = pe(u, a, z(r));
    return { encKey: l, macKey: h, pathContext: r };
  } finally {
    U(n, o, i, a, s, u);
  }
}
function xo(e, t, n, r) {
  const o = new Uint8Array(r);
  let i = 0, a = 0;
  const s = F(Ma), u = z(e), l = z(t), h = z(n), f = new Uint8Array(4), d = new DataView(f.buffer);
  try {
    for (; i < r; ) {
      d.setUint32(0, a >>> 0, !1);
      const p = Ke(
        s,
        u,
        l,
        f,
        h
      );
      try {
        const m = Math.min(p.length, r - i);
        o.set(p.subarray(0, m), i), i += m, a++;
      } finally {
        U(p);
      }
    }
    return o;
  } finally {
    U(s, u, l, h, f);
  }
}
function bo(e, t, n, r, o) {
  const i = F(ka), a = ho(o.length);
  let s = null;
  try {
    return s = pe(
      e,
      i,
      z(t),
      z(n),
      z(r),
      a,
      o
    ), Uint8Array.from(s.subarray(0, jn));
  } finally {
    U(i, a, s);
  }
}
function Oa(e, t, n) {
  return Ia(
    Ce(J, new Uint8Array([mn]), e, t, n)
  );
}
function Ka(e) {
  const t = nr(e), n = J.length + 1, r = n + Fn + jn + 1;
  if (t.length < r) return null;
  for (let u = 0; u < J.length; u++)
    if (t[u] !== J[u]) return null;
  if (t[J.length] !== mn) return null;
  const o = t.subarray(0, n), i = n, a = i + Fn, s = a + jn;
  return {
    header: o,
    nonce: t.subarray(i, a),
    tag: t.subarray(a, s),
    ciphertext: t.subarray(s)
  };
}
function Fa(e, t, n) {
  return Ra(
    Ce(J, new Uint8Array([yn]), e, t, n)
  );
}
function ja(e) {
  const t = nr(e), n = J.length + 1, r = n + $n + Ln + 1;
  if (t.length < r) return null;
  for (let u = 0; u < J.length; u++)
    if (t[u] !== J[u]) return null;
  if (t[J.length] !== yn) return null;
  const o = t.subarray(0, n), i = n, a = i + $n, s = a + Ln;
  return {
    header: o,
    nonce: t.subarray(i, a),
    tag: t.subarray(a, s),
    ciphertext: t.subarray(s)
  };
}
function So(e, t, n) {
  const o = za(e, t === "branch" ? "this.me/blob/v3/branch" : "this.me/blob/v3/value"), i = mo(n), a = F(Ca), s = F(Ea);
  try {
    const u = pe(o, a, z(i)), l = pe(o, s, z(i));
    return { encKey: u, macKey: l, pathContext: i };
  } finally {
    U(o, a, s);
  }
}
function vo(e, t, n, r) {
  const o = new Uint8Array(r);
  let i = 0, a = 0;
  const s = F(Aa), u = z(e), l = z(t), h = z(n), f = new Uint8Array(4), d = new DataView(f.buffer);
  try {
    for (; i < r; ) {
      d.setUint32(0, a >>> 0, !1);
      const p = Ke(
        s,
        u,
        l,
        f,
        h
      );
      try {
        const m = Math.min(p.length, r - i);
        o.set(p.subarray(0, m), i), i += m, a++;
      } finally {
        U(p);
      }
    }
    return o;
  } finally {
    U(s, u, l, h, f);
  }
}
function wo(e, t, n, r, o) {
  const i = F(_a), a = ho(o.length);
  let s = null;
  try {
    return s = pe(
      e,
      i,
      z(t),
      z(n),
      z(r),
      a,
      o
    ), Uint8Array.from(s.subarray(0, Ln));
  } finally {
    U(i, a, s);
  }
}
function $a(e, t, n) {
  const r = JSON.stringify(e), o = F(String(r)), i = po(Fn), { encKey: a, macKey: s, pathContext: u } = go(t, n);
  let l = null, h = null, f = null, d = null;
  try {
    l = xo(a, i, u, o.length), h = new Uint8Array(o.length);
    for (let p = 0; p < o.length; p++)
      h[p] = o[p] ^ l[p];
    return f = Ce(J, new Uint8Array([mn])), d = bo(s, f, i, u, h), Oa(i, d, h);
  } finally {
    U(o, i, a, s, u, l, h, f, d);
  }
}
function La(e, t, n) {
  const { encKey: r, macKey: o, pathContext: i } = go(t, n);
  let a = null, s = null, u = null;
  try {
    if (a = bo(o, e.header, e.nonce, i, e.ciphertext), !yo(a, e.tag)) return null;
    s = xo(r, e.nonce, i, e.ciphertext.length), u = new Uint8Array(e.ciphertext.length);
    for (let h = 0; h < e.ciphertext.length; h++)
      u[h] = e.ciphertext[h] ^ s[h];
    const l = gn(u);
    return JSON.parse(l);
  } catch {
    return null;
  } finally {
    U(r, o, i, a, s, u);
  }
}
function Va(e, t, n) {
  let r = null, o = null, i = null;
  try {
    r = xn(e);
    const a = fo(t + ba + n.join("."));
    o = F(a), i = new Uint8Array(r.length);
    for (let u = 0; u < r.length; u++)
      i[u] = r[u] ^ o[u % o.length];
    const s = gn(i);
    return JSON.parse(s);
  } catch {
    return null;
  } finally {
    U(r, o, i);
  }
}
function za(e, t) {
  if (!Array.isArray(e) || e.length < 6)
    throw new Error("V3 derivation requires a complete secret chain.");
  const n = F(Ba), r = F(t), o = [n, z(r), ...e.map((a) => z(a))];
  let i = null;
  try {
    return i = Ce(...o), Ke(i);
  } finally {
    U(n, r, i, ...o);
  }
}
function rr(e) {
  try {
    const t = nr(e);
    if (t.length < J.length + 1) return "legacy";
    for (let r = 0; r < J.length; r++)
      if (t[r] !== J[r]) return "legacy";
    const n = t[J.length];
    return n === yn ? "v3" : n === mn ? "v2" : "legacy";
  } catch {
    return "legacy";
  }
}
function Ua(e, t, n, r) {
  const { encKey: o, macKey: i, pathContext: a } = So(t, n, r);
  try {
    return or(e, { encKey: o, macKey: i, pathContext: a });
  } finally {
    U(o, i, a);
  }
}
function or(e, t) {
  const n = be.enabled, r = n ? an() : null, o = n ? te() : 0, i = JSON.stringify(e), a = n ? te() - o : 0, s = n ? Vn(i) : 0, u = n ? te() : 0, l = F(String(i)), h = n ? te() - u : 0, f = n ? l.length : 0, d = po($n);
  let p = null, m = null, b = null, S = null, g = null;
  try {
    const k = n ? te() : 0;
    p = vo(t.encKey, d, t.pathContext, l.length);
    const M = n ? te() - k : 0, w = n ? te() : 0;
    m = new Uint8Array(l.length);
    for (let I = 0; I < l.length; I++)
      m[I] = l[I] ^ p[I];
    const D = n ? te() - w : 0, R = n ? te() : 0;
    b = Ce(J, new Uint8Array([yn])), S = wo(t.macKey, b, d, t.pathContext, m), g = Fa(d, S, m);
    const O = n ? te() - R : 0;
    if (n && r) {
      const I = p?.length ?? 0, N = m?.length ?? 0, H = Vn(g), _e = Math.max(
        s,
        s + f,
        s + f + I,
        s + f + I + N,
        s + f + I + N + H
      ), De = an(), P = be.window;
      P.encryptCalls += 1, P.totalEncryptJsonMs += a, P.totalEncryptAsciiMs += h, P.totalEncryptKeystreamMs += M, P.totalEncryptXorMs += D, P.totalEncryptEncodeMs += O, P.maxEncryptJsonMs = Math.max(P.maxEncryptJsonMs, a), P.maxEncryptAsciiMs = Math.max(P.maxEncryptAsciiMs, h), P.maxEncryptKeystreamMs = Math.max(P.maxEncryptKeystreamMs, M), P.maxEncryptXorMs = Math.max(P.maxEncryptXorMs, D), P.maxEncryptEncodeMs = Math.max(P.maxEncryptEncodeMs, O), P.maxJsonBytes = Math.max(P.maxJsonBytes, s), P.maxClearBytes = Math.max(P.maxClearBytes, f), P.maxKeystreamBytes = Math.max(P.maxKeystreamBytes, I), P.maxCiphertextBytes = Math.max(P.maxCiphertextBytes, N), P.maxHexBytes = Math.max(P.maxHexBytes, H), P.maxEncryptResidentBytes = Math.max(P.maxEncryptResidentBytes, _e), P.maxEncryptHeapDelta = Math.max(P.maxEncryptHeapDelta, Oe(De.heapUsed, r.heapUsed)), P.maxEncryptExternalDelta = Math.max(P.maxEncryptExternalDelta, Oe(De.external, r.external)), P.maxEncryptArrayBuffersDelta = Math.max(
        P.maxEncryptArrayBuffersDelta,
        Oe(De.arrayBuffers, r.arrayBuffers)
      );
    }
    return g;
  } finally {
    U(l, d, p, m, b, S);
  }
}
function Mo(e, t) {
  const n = be.enabled, r = n ? an() : null, o = ja(e);
  if (!o) return null;
  let i = null, a = null, s = null, u = null;
  try {
    if (i = wo(t.macKey, o.header, o.nonce, t.pathContext, o.ciphertext), !yo(i, o.tag)) return null;
    a = vo(t.encKey, o.nonce, t.pathContext, o.ciphertext.length), s = new Uint8Array(o.ciphertext.length);
    for (let f = 0; f < o.ciphertext.length; f++)
      s[f] = o.ciphertext[f] ^ a[f];
    u = gn(s);
    const h = JSON.parse(u);
    if (n && r) {
      const f = o.header.length + o.nonce.length + o.tag.length + o.ciphertext.length, d = s.length, p = Vn(u), m = Math.max(
        f,
        f + (i?.length ?? 0),
        f + (i?.length ?? 0) + (a?.length ?? 0),
        f + (i?.length ?? 0) + (a?.length ?? 0) + d,
        f + (i?.length ?? 0) + (a?.length ?? 0) + d + p
      ), b = an(), S = be.window;
      S.decryptCalls += 1, S.maxDecodedBytes = Math.max(S.maxDecodedBytes, f), S.maxDecryptClearBytes = Math.max(S.maxDecryptClearBytes, d), S.maxDecryptJsonBytes = Math.max(S.maxDecryptJsonBytes, p), S.maxDecryptResidentBytes = Math.max(S.maxDecryptResidentBytes, m), S.maxDecryptHeapDelta = Math.max(S.maxDecryptHeapDelta, Oe(b.heapUsed, r.heapUsed)), S.maxDecryptExternalDelta = Math.max(S.maxDecryptExternalDelta, Oe(b.external, r.external)), S.maxDecryptArrayBuffersDelta = Math.max(
        S.maxDecryptArrayBuffersDelta,
        Oe(b.arrayBuffers, r.arrayBuffers)
      );
    }
    return h;
  } catch {
    return null;
  } finally {
    U(i, a, s);
  }
}
function ir(e, t, n) {
  return $a(e, t, n);
}
function ar(e, t, n) {
  try {
    const r = Ka(e);
    return r ? La(r, t, n) : Va(e, t, n);
  } catch {
    return null;
  }
}
function Ta(e) {
  if (typeof e != "string") return !1;
  if (e.startsWith("0x")) {
    const t = e.slice(2);
    return t.length < 2 || t.length % 2 !== 0 ? !1 : /^[0-9a-fA-F]+$/.test(t);
  }
  if (e.startsWith(qe)) {
    const t = e.slice(qe.length);
    return t.length > 0 && /^[A-Za-z0-9\-_]+$/.test(t);
  }
  return !1;
}
function Me(e) {
  if (typeof Buffer < "u")
    return Buffer.from(e).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  let t = "";
  for (let n = 0; n < e.length; n++) t += String.fromCharCode(e[n]);
  return btoa(t).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function me(e) {
  const t = String(e || "").replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(String(e || "").length / 4) * 4, "=");
  if (typeof Buffer < "u")
    return new Uint8Array(Buffer.from(t, "base64"));
  const n = atob(t), r = new Uint8Array(n.length);
  for (let o = 0; o < n.length; o++) r[o] = n.charCodeAt(o);
  return r;
}
function sn(e) {
  if (e === null || typeof e != "object")
    return JSON.stringify(e);
  if (Array.isArray(e))
    return `[${e.map((r) => sn(r)).join(",")}]`;
  const t = e;
  return `{${Object.keys(t).sort().map((r) => `${JSON.stringify(r)}:${sn(t[r])}`).join(",")}}`;
}
function ee() {
  const e = globalThis.crypto;
  if (!e?.subtle)
    throw new Error("WebCrypto subtle crypto is required for wrapped secret operations.");
  return e;
}
function Wa(e) {
  if (e.length < 16) throw new Error("AES-GCM payload is too short.");
  return {
    ciphertext: e.slice(0, e.length - 16),
    tag: e.slice(e.length - 16)
  };
}
function q(e) {
  const t = Uint8Array.from(e);
  return t.buffer.slice(t.byteOffset, t.byteOffset + t.byteLength);
}
function Ha(e) {
  return typeof e == "string" ? F(e) : new Uint8Array(e);
}
function Ja(e) {
  const t = String(e || "").trim();
  if (!t) throw new Error("Seed material is required.");
  const n = t.startsWith("0x") ? t.slice(2) : t;
  return n.length > 0 && n.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(n) ? xn(n) : F(t);
}
function qa(e = 32) {
  const t = Number(e);
  if (!Number.isInteger(t) || t <= 0)
    throw new Error("HKDF output length must be a positive integer.");
  return t;
}
function Ga(...e) {
  const t = e.reduce((o, i) => o + i.length, 0), n = new Uint8Array(t);
  let r = 0;
  for (const o of e)
    n.set(o, r), r += o.length;
  return n;
}
async function Xa(e, t, n, r = 32) {
  const o = qa(r), { subtle: i } = ee(), a = await i.importKey("raw", q(new Uint8Array(e)), "HKDF", !1, ["deriveBits"]), s = await i.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: q(F(String(t))),
      info: q(F(String(n || "")))
    },
    a,
    o * 8
  );
  return new Uint8Array(s);
}
async function Ya(e, t) {
  const n = String(t || "").trim();
  if (!n) throw new Error("Active expression is required to derive a branch proof seed.");
  return Xa(
    Ja(e),
    xa,
    n,
    32
  );
}
async function Za(e) {
  if (!(e instanceof Uint8Array) || e.length !== 32)
    throw new Error("Ed25519 signing seed must be exactly 32 bytes.");
  const { subtle: t } = ee(), n = xn("302e020100300506032b657004220420"), r = Ga(n, new Uint8Array(e)), o = await t.importKey(
    "pkcs8",
    q(r),
    { name: "Ed25519" },
    !0,
    ["sign"]
  ), i = await t.exportKey("jwk", o);
  if (i.kty !== "OKP" || i.crv !== "Ed25519" || !i.x)
    throw new Error("Unable to derive Ed25519 public key from signing seed.");
  const a = await t.importKey(
    "raw",
    q(me(i.x)),
    { name: "Ed25519" },
    !0,
    ["verify"]
  );
  return { privateKey: o, publicKey: a };
}
async function Qa(e, t) {
  const { subtle: n } = ee(), r = await n.sign(
    "Ed25519",
    e,
    q(F(String(t || "")))
  );
  return Me(new Uint8Array(r));
}
async function es(e, t, n) {
  try {
    const { subtle: r } = ee(), o = await r.importKey(
      "raw",
      q(me(String(e || ""))),
      { name: "Ed25519" },
      !0,
      ["verify"]
    );
    return await r.verify(
      "Ed25519",
      o,
      q(me(String(n || ""))),
      q(F(String(t || "")))
    );
  } catch {
    return !1;
  }
}
async function ts(e) {
  const { subtle: t } = ee(), n = await t.exportKey("raw", e);
  return Me(new Uint8Array(n));
}
async function ko(e, t) {
  const { subtle: n } = ee(), r = await n.importKey("raw", q(e), "HKDF", !1, ["deriveKey"]);
  return n.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: q(t),
      info: q(F(ga))
    },
    r,
    { name: "AES-GCM", length: 256 },
    !1,
    ["encrypt", "decrypt"]
  );
}
async function Bo(e = !0, t = ["deriveKey", "deriveBits"]) {
  const { subtle: n } = ee();
  return n.generateKey(
    {
      name: "ECDH",
      namedCurve: "P-256"
    },
    e,
    t
  );
}
async function Co(e) {
  const { subtle: t } = ee(), n = await t.exportKey("jwk", e);
  if (n.kty !== "EC" || n.crv !== "P-256" || !n.x || !n.y)
    throw new Error("Public key is not a valid P-256 EC key.");
  return {
    kty: "EC",
    crv: "P-256",
    x: n.x,
    y: n.y
  };
}
async function sr(e) {
  const { subtle: t } = ee();
  return t.importKey(
    "jwk",
    {
      key_ops: [],
      ext: !0,
      kty: e.kty,
      crv: e.crv,
      x: e.x,
      y: e.y
    },
    {
      name: "ECDH",
      namedCurve: "P-256"
    },
    !0,
    []
  );
}
async function ns(e) {
  const t = ee(), { subtle: n } = t, r = e.recipientPublicKey instanceof CryptoKey ? e.recipientPublicKey : await sr(e.recipientPublicKey), o = await Bo(!0, ["deriveBits"]), i = await n.deriveBits(
    {
      name: "ECDH",
      public: r
    },
    o.privateKey,
    256
  ), a = t.getRandomValues(new Uint8Array(32)), s = t.getRandomValues(new Uint8Array(12)), u = new Uint8Array(i), l = await ko(u, a), h = Ha(e.secret);
  let f = null, d = null, p = null;
  try {
    return f = new Uint8Array(
      await n.encrypt(
        {
          name: "AES-GCM",
          iv: q(s)
        },
        l,
        q(h)
      )
    ), { ciphertext: d, tag: p } = Wa(f), {
      version: 1,
      class: e.class,
      kid: String(e.kid || "").trim(),
      publicKey: e.publicKey,
      encryption: {
        kex: "ECDH-ES",
        kdf: "HKDF-SHA-256",
        aead: "AES-256-GCM",
        iv: Me(s),
        salt: Me(a),
        tag: Me(p),
        ciphertext: Me(d),
        ephemeralPK: await Co(o.publicKey)
      },
      policy: e.policy
    };
  } finally {
    U(u, a, s, h, f, d, p);
  }
}
async function Eo(e, t, n = "bytes") {
  const { subtle: r } = ee();
  if (e.version !== 1) throw new Error(`Unsupported wrapped secret version: ${e.version}`);
  if (e.encryption.kex !== "ECDH-ES") throw new Error("Unsupported key exchange algorithm.");
  if (e.encryption.kdf !== "HKDF-SHA-256") throw new Error("Unsupported KDF.");
  if (e.encryption.aead !== "AES-256-GCM") throw new Error("Unsupported AEAD.");
  const o = await sr(e.encryption.ephemeralPK), i = await r.deriveBits(
    {
      name: "ECDH",
      public: o
    },
    t,
    256
  ), a = me(e.encryption.salt), s = me(e.encryption.iv), u = me(e.encryption.ciphertext), l = me(e.encryption.tag), h = new Uint8Array(i), f = await ko(h, a), d = Ce(u, l);
  let p = null;
  try {
    if (p = new Uint8Array(
      await r.decrypt(
        {
          name: "AES-GCM",
          iv: q(s)
        },
        f,
        q(d)
      )
    ), n === "utf8") {
      const m = gn(p);
      return U(p), m;
    }
    return p;
  } finally {
    U(h, a, s, u, l, d);
  }
}
function se(e) {
  let t = 2166136261;
  for (let n = 0; n < e.length; n++)
    t ^= e.charCodeAt(n), t = Math.imul(t, 16777619);
  return ("00000000" + (t >>> 0).toString(16)).slice(-8);
}
function G(e) {
  const t = globalThis.structuredClone;
  return typeof t == "function" ? t(e) : JSON.parse(JSON.stringify(e));
}
function Ao(e, t) {
  let n = 0;
  for (let r = 0; r < e.length; r++) {
    const o = e[r];
    if (o === "[") n++;
    else if (o === "]") n = Math.max(0, n - 1);
    else if (o === t && n === 0) return r;
  }
  return -1;
}
function K(e) {
  const t = [];
  for (const n of e) {
    const r = String(n).trim();
    if (!r) continue;
    const o = r.indexOf("[");
    if (o === -1) {
      t.push(r);
      continue;
    }
    const i = r.slice(0, o).trim(), a = r.slice(o);
    i && t.push(i);
    const s = Array.from(a.matchAll(/\[([^\]]*)\]/g));
    if (s.map((l) => l[0]).join("") !== a) {
      t.push(a);
      continue;
    }
    for (const l of s) {
      let h = (l[1] ?? "").trim();
      (h.startsWith('"') && h.endsWith('"') || h.startsWith("'") && h.endsWith("'")) && (h = h.slice(1, -1)), h && t.push(h);
    }
  }
  return t;
}
function _o(e) {
  return e.some((t) => t.includes("[i]"));
}
function Do(e, t) {
  return e.map((n) => n.split("[i]").join(`[${t}]`));
}
function Po(e, t) {
  return String(e ?? "").split("[i]").join(`[${t}]`);
}
function Io(e) {
  const n = String(e ?? "").trim().match(/^(.+?)\s*(>=|<=|==|!=|>|<)\s*(.+)$/);
  if (!n) return null;
  const r = n[1].trim(), o = n[2], i = n[3].trim();
  return !r || !i ? null : { left: r, op: o, right: i };
}
function Qe(e) {
  const t = String(e ?? "").trim();
  if (!t) return null;
  const n = t.split(/\s*(&&|\|\|)\s*/).filter((i) => i.length > 0);
  if (n.length === 0) return null;
  const r = [], o = [];
  for (let i = 0; i < n.length; i++)
    if (i % 2 === 0) {
      const a = Io(n[i]);
      if (!a) return null;
      r.push(a);
    } else {
      const a = n[i];
      if (a !== "&&" && a !== "||") return null;
      o.push(a);
    }
  return r.length === 0 || o.length !== Math.max(0, r.length - 1) ? null : { clauses: r, ops: o };
}
function Ro(e, t, n) {
  switch (t) {
    case ">":
      return e > n;
    case "<":
      return e < n;
    case ">=":
      return e >= n;
    case "<=":
      return e <= n;
    case "==":
      return e == n;
    case "!=":
      return e != n;
    default:
      return !1;
  }
}
function No(e) {
  const t = e.trim();
  if (t.startsWith('"') && t.endsWith('"') || t.startsWith("'") && t.endsWith("'"))
    return { kind: "literal", value: t.slice(1, -1) };
  if (t === "true") return { kind: "literal", value: !0 };
  if (t === "false") return { kind: "literal", value: !1 };
  if (t === "null") return { kind: "literal", value: null };
  const n = Number(t);
  return Number.isFinite(n) ? { kind: "literal", value: n } : { kind: "path", parts: K(t.split(".").filter(Boolean)) };
}
function Se(e) {
  const t = String(e ?? "").trim(), n = t.indexOf("["), r = t.lastIndexOf("]");
  if (n <= 0 || r <= n || r !== t.length - 1) return null;
  const o = t.slice(0, n).trim(), i = t.slice(n + 1, r).trim();
  return !o || !i ? null : { base: o, selector: i };
}
function Oo(e) {
  const t = e.trim();
  if (t.startsWith("[") && t.endsWith("]")) {
    const r = t.slice(1, -1).trim();
    return r ? r.split(",").map((i) => i.trim()).filter(Boolean).map((i) => i.startsWith('"') && i.endsWith('"') || i.startsWith("'") && i.endsWith("'") ? i.slice(1, -1) : i) : [];
  }
  const n = t.match(/^(-?\d+)\s*\.\.\s*(-?\d+)$/);
  if (n) {
    const r = Number(n[1]), o = Number(n[2]);
    if (!Number.isFinite(r) || !Number.isFinite(o)) return null;
    const i = r <= o ? 1 : -1, a = [];
    if (Math.abs(o - r) > 1e4) return null;
    for (let u = r; i > 0 ? u <= o : u >= o; u += i) a.push(String(u));
    return a;
  }
  return null;
}
function zn(e) {
  const n = e.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=>\s*(.+)$/);
  if (!n) return null;
  const r = n[1].trim(), o = n[2].trim();
  return !r || !o ? null : { varName: r, expr: o };
}
function Ko() {
  return {
    _: { kind: "secret" },
    "~": { kind: "noise" },
    __: { kind: "pointer" },
    "->": { kind: "pointer" },
    "@": { kind: "identity" },
    "=": { kind: "eval" },
    "?": { kind: "query" },
    "-": { kind: "remove" }
  };
}
function bn(e) {
  return e._memories[e._memories.length - 1]?.hash ?? "";
}
function rs(e, t) {
  return e.recomputeMode = t, e;
}
function os(e) {
  return e.recomputeMode;
}
function Fo(e, t, n, r) {
  const i = cr(n).key;
  switch (t) {
    case "read":
      return jo(e, i);
    case "export":
      return $o(e, i);
    case "import":
      if (r === void 0) throw new Error("kernel:import requires a payload.");
      return Lo(e, i, r);
    case "hydrate":
      if (r === void 0) throw new Error("kernel:hydrate requires a payload.");
      return Vo(e, i, r);
    case "replay":
      if (r === void 0) throw new Error("kernel:replay requires a payload.");
      return zo(e, i, r);
    case "rehydrate":
      if (r === void 0) throw new Error("kernel:rehydrate requires a payload.");
      return Uo(e, i, r);
    case "get":
      return To(e, i);
    case "set":
      if (r === void 0) throw new Error("kernel:set requires a payload.");
      return Wo(e, i, r);
    default:
      throw new Error(`Unsupported kernel operation: ${t}`);
  }
}
function jo(e, t) {
  switch (t) {
    case "memory":
    case "memories":
    case "logs":
      return G(e.memories);
    case "snapshot":
      return e.exportSnapshot();
    case "mode":
    case "recompute.mode":
      return e.getRecomputeMode();
    default:
      throw new Error(`Unsupported kernel:read path: ${t || "<root>"}`);
  }
}
function $o(e, t) {
  switch (t) {
    case "memory":
    case "memories":
    case "logs":
      return G(e.memories);
    case "snapshot":
      return e.exportSnapshot();
    default:
      throw new Error(`Unsupported kernel:export path: ${t || "<root>"}`);
  }
}
function Lo(e, t, n) {
  if (t === "snapshot")
    return e.importSnapshot(n ?? {}), e.exportSnapshot();
  throw new Error(`Unsupported kernel:import path: ${t || "<root>"}`);
}
function Vo(e, t, n) {
  if (t === "snapshot")
    return e.hydrate(n ?? {}), e.exportSnapshot();
  throw new Error(`Unsupported kernel:hydrate path: ${t || "<root>"}`);
}
function zo(e, t, n) {
  switch (t) {
    case "memory":
    case "memories":
    case "logs":
      if (!Array.isArray(n)) throw new Error("kernel:replay/memory requires a replayable memory payload.");
      return e.replayMemories(n), G(e.memories);
    default:
      throw new Error(`Unsupported kernel:replay path: ${t || "<root>"}`);
  }
}
function Uo(e, t, n) {
  return Vo(e, t, n);
}
function To(e, t) {
  switch (t) {
    case "mode":
    case "recompute.mode":
      return e.getRecomputeMode();
    default:
      throw new Error(`Unsupported kernel:get path: ${t || "<root>"}`);
  }
}
function Wo(e, t, n) {
  switch (t) {
    case "mode":
    case "recompute.mode":
      if (n !== "eager" && n !== "lazy")
        throw new Error(`kernel:set/${t} only accepts "eager" or "lazy".`);
      return e.setRecomputeMode(n), e.getRecomputeMode();
    default:
      throw new Error(`Unsupported kernel:set path: ${t || "<root>"}`);
  }
}
function Ho(e, t) {
  if (typeof t == "string") return Jo(t);
  if (!t || typeof t != "object")
    throw new Error("execute(...) requires a me target string or AST.");
  const n = String(t.namespace ?? "").trim(), r = String(t.operation ?? "").trim().toLowerCase(), o = String(t.path ?? "").trim();
  if (!n) throw new Error("Executable me target is missing a namespace.");
  if (!r) throw new Error("Executable me target is missing an operation.");
  return {
    scheme: "me",
    namespace: n,
    operation: r,
    path: o,
    raw: t.raw,
    contextRaw: t.contextRaw ?? null
  };
}
function Jo(e) {
  const t = String(e ?? "").trim();
  if (!t) throw new Error("execute(...) received an empty me target.");
  const n = t.startsWith("me://") ? t.slice(5) : t, r = Ao(n, ":");
  if (r < 0)
    throw new Error(`Invalid me target "${t}": expected ":" between namespace and operation.`);
  const o = n.slice(0, r).trim(), i = n.slice(r + 1).trim();
  if (!o) throw new Error(`Invalid me target "${t}": missing namespace.`);
  if (!i) throw new Error(`Invalid me target "${t}": missing operation.`);
  const a = i.indexOf("/"), s = (a >= 0 ? i.slice(0, a) : i).trim().toLowerCase(), u = (a >= 0 ? i.slice(a + 1) : "").trim();
  if (!s) throw new Error(`Invalid me target "${t}": missing operation.`);
  const { namespace: l, contextRaw: h } = qo(o, t);
  return {
    scheme: "me",
    namespace: l,
    operation: s,
    path: u,
    raw: t,
    contextRaw: h
  };
}
function qo(e, t) {
  const n = e.indexOf("[");
  if (n < 0)
    return { namespace: e, contextRaw: null };
  const r = e.lastIndexOf("]");
  if (r < n || r !== e.length - 1)
    throw new Error(`Invalid me target "${t}": malformed context segment.`);
  const o = e.slice(0, n).trim(), i = e.slice(n + 1, r).trim();
  if (!o) throw new Error(`Invalid me target "${t}": missing namespace before context.`);
  return { namespace: o, contextRaw: i || null };
}
function cr(e) {
  const n = String(e ?? "").trim().replace(/^\/+|\/+$/g, "").replace(/\//g, ".").split(".").map((o) => o.trim()).filter(Boolean), r = K(n);
  return {
    key: r.join("."),
    parts: r
  };
}
const Go = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/, Xo = Go, Yo = /^[A-Za-z0-9_-]+$/, is = Yo, as = /^[A-Za-z0-9_-]+$/;
function et(e, t) {
  const n = String(e ?? "").trim();
  if (!n) throw new Error(`${t} is required.`);
  return n;
}
function Ge(e, t, n, r) {
  if (!t.test(e))
    throw new Error(`Invalid ${n}: ${r ?? e}`);
  return e;
}
function Zo(e) {
  const t = String(e ?? "").trim();
  if (!t) return "";
  try {
    if (/^[a-z]+:\/\//i.test(t))
      return new URL(t).hostname.trim().toLowerCase();
  } catch {
  }
  return t.replace(/^[a-z]+:\/\//i, "").replace(/[/?#].*$/g, "").replace(/:\d+$/g, "").replace(/\.+$/g, "").trim().toLowerCase();
}
function Qo(e) {
  if (!e?.length) return [];
  const t = /* @__PURE__ */ new Set();
  for (const n of e)
    t.add(Le(n));
  return Array.from(t).sort((n, r) => {
    const o = r.split(".").length - n.split(".").length;
    return o !== 0 ? o : r.length - n.length;
  });
}
function ss(e) {
  const n = et(e, "Canonical namespace").replace(/^me:\/\//i, "").trim().toLowerCase().split(".").map((i) => i.trim()).filter(Boolean);
  if (n.length < 3)
    throw new Error(`Invalid canonical namespace "${e}": expected handle.space with a dotted space.`);
  const r = Ee(n[0]), o = Le(n.slice(1).join("."));
  return {
    handle: r,
    space: o,
    value: `${r}.${o}`
  };
}
function Un(e) {
  if (e === null) return null;
  const t = String(e).trim();
  if (t === "")
    return {
      kind: "fanout",
      raw: t,
      value: t,
      shorthand: !1
    };
  if (t === "current")
    return {
      kind: "current",
      raw: t,
      value: t,
      shorthand: !1
    };
  if (t.startsWith("claim:")) {
    const o = Ge(t.slice(6), is, "claim selector token", t);
    return {
      kind: "claim",
      raw: t,
      value: `claim:${o}`,
      shorthand: !1
    };
  }
  const n = !t.startsWith("surface:"), r = Ge(
    n ? t : t.slice(8),
    Yo,
    "surface selector",
    t
  );
  return {
    kind: "surface",
    raw: t,
    value: `surface:${r}`,
    shorthand: n
  };
}
function ei(e) {
  const t = String(e ?? "").trim();
  if (!t)
    throw new Error("Canonical me URI path cannot be empty after '/'.");
  if (t.includes("/"))
    throw new Error(`Invalid canonical path "${e}": use "." for descent, not "/".`);
  const n = t.split(".").map((r) => r.trim());
  if (n.some((r) => !r))
    throw new Error(`Invalid canonical path "${e}": empty segments are not allowed.`);
  for (const r of n)
    Ge(r, as, "canonical path segment", e);
  return {
    value: n.join("."),
    segments: n
  };
}
function cs(e) {
  if (!e) return "";
  const t = Un(typeof e == "string" ? e : e.raw);
  return t ? `[${t.value}]` : "";
}
function us(e, t) {
  for (const n of Qo(t))
    if (e === n || e.endsWith(`.${n}`))
      return n;
  return null;
}
function Ee(e) {
  return Ge(et(e, "Handle").toLowerCase(), Go, "canonical handle", String(e));
}
function Le(e) {
  const n = Zo(et(e, "Space")).split(".").map((r) => r.trim()).filter(Boolean);
  if (n.length < 2)
    throw new Error(`Invalid canonical space "${e}": expected at least two labels.`);
  for (const r of n)
    Ge(r, Xo, "space label", String(e));
  return n.join(".");
}
function Sn(e) {
  const t = Ee(e.handle), n = Le(e.space), r = cs(e.selector), o = e.path == null || String(e.path).trim() === "" ? "" : `/${ei(String(e.path)).value}`;
  return `me://${t}.${n}${r}${o}`;
}
function ur(e) {
  const t = et(e, "me:// URI");
  if (!t.toLowerCase().startsWith("me://"))
    throw new Error(`Invalid me URI "${e}": expected "me://" scheme.`);
  const n = t.slice(5);
  if (!n.trim())
    throw new Error(`Invalid me URI "${e}": missing namespace.`);
  const r = n.indexOf("/"), o = (r >= 0 ? n.slice(0, r) : n).trim(), i = r >= 0 ? n.slice(r + 1) : "";
  let a = o, s = null;
  const u = o.indexOf("[");
  if (u >= 0) {
    const p = o.lastIndexOf("]");
    if (p < u || p !== o.length - 1)
      throw new Error(`Invalid me URI "${e}": malformed selector.`);
    a = o.slice(0, u).trim(), s = o.slice(u + 1, p).trim();
  }
  const l = ss(a), h = Un(s), f = r >= 0 ? ei(i) : null, d = Sn({
    handle: l.handle,
    space: l.space,
    selector: h,
    path: f?.value ?? null
  });
  return {
    scheme: "me",
    raw: t,
    href: d,
    namespace: l.value,
    handle: l.handle,
    space: l.space,
    selector: h,
    path: f?.value ?? null,
    segments: f?.segments ?? []
  };
}
function ls(e) {
  try {
    return ur(e);
  } catch {
    return null;
  }
}
function ti(e, t = {}) {
  const n = ur(e), r = Qo(t.knownSpaces);
  if (r.length > 0 && !r.includes(n.space))
    throw new Error(`Unknown canonical space "${n.space}" in "${e}".`);
  return n;
}
function ni(e, t = {}) {
  const n = et(e, "Human identity"), r = n.split("@");
  if (r.length !== 2)
    throw new Error(`Invalid human identity "${e}": expected handle@space.`);
  const o = Ee(r[0]), i = Le(r[1]), a = Sn({ handle: o, space: i });
  return ti(a, t), {
    raw: n,
    alias: `${o}@${i}`,
    handle: o,
    space: i,
    namespace: `${o}.${i}`,
    uri: a
  };
}
function fs(e, t = {}) {
  const n = String(e ?? "").trim();
  if (!n.includes("@")) return null;
  try {
    return ni(n, t).uri;
  } catch {
    return null;
  }
}
function hs(e, t) {
  const n = Zo(e);
  if (!n)
    return {
      ok: !1,
      kind: "invalid",
      rawHost: String(e ?? ""),
      host: "",
      matchedSpace: null,
      prefixLabels: [],
      reason: "INVALID_HOST"
    };
  if (n === "localhost" || n.endsWith(".local"))
    return {
      ok: !1,
      kind: "invalid",
      rawHost: e,
      host: n,
      matchedSpace: null,
      prefixLabels: [],
      reason: "TRANSPORT_ONLY_HOST"
    };
  const r = n.split(".").map((l) => l.trim()).filter(Boolean);
  if (r.length < 2)
    return {
      ok: !1,
      kind: "invalid",
      rawHost: e,
      host: n,
      matchedSpace: null,
      prefixLabels: r,
      reason: "INVALID_HOST"
    };
  for (const l of r)
    if (!Xo.test(l))
      return {
        ok: !1,
        kind: "invalid",
        rawHost: e,
        host: n,
        matchedSpace: null,
        prefixLabels: r,
        reason: "INVALID_HOST"
      };
  const o = us(n, t);
  if (!o)
    return {
      ok: !1,
      kind: "invalid",
      rawHost: e,
      host: n,
      matchedSpace: null,
      prefixLabels: r,
      reason: "UNKNOWN_SPACE"
    };
  const i = n === o ? "" : n.slice(0, -(o.length + 1)), a = i ? i.split(".").filter(Boolean) : [];
  if (a.length === 0)
    return {
      ok: !0,
      kind: "space",
      rawHost: e,
      host: n,
      matchedSpace: o,
      prefixLabels: [],
      space: o
    };
  if (a.length !== 1)
    return {
      ok: !1,
      kind: "invalid",
      rawHost: e,
      host: n,
      matchedSpace: o,
      prefixLabels: a,
      reason: "NOT_CANONICAL_NAMESPACE"
    };
  const s = Ee(a[0]), u = `${s}.${o}`;
  return {
    ok: !0,
    kind: "namespace",
    rawHost: e,
    host: n,
    matchedSpace: o,
    prefixLabels: [s],
    handle: s,
    space: o,
    namespace: u,
    uri: Sn({ handle: s, space: o })
  };
}
const Ur = "+";
function ds(e) {
  return { __ptr: e };
}
function xe(e) {
  return !!e && typeof e == "object" && typeof e.__ptr == "string" && e.__ptr.length > 0;
}
function ps(e) {
  return { __id: e };
}
function Xe(e) {
  return !!e && typeof e == "object" && typeof e.__id == "string" && e.__id.length > 0;
}
function ms(e) {
  return !!e && typeof e == "object" && typeof e.path == "string" && typeof e.hash == "string" && typeof e.timestamp == "number";
}
function ie(e) {
  return e.length === 0 ? { scope: [], leaf: null } : { scope: e.slice(0, -1), leaf: e[e.length - 1] };
}
function vn(e, t) {
  if (t.length > e.length) return !1;
  for (let n = 0; n < t.length; n++)
    if (e[n] !== t[n]) return !1;
  return !0;
}
function Tr(e) {
  const t = e.trim().toLowerCase();
  if (t.length < 3 || t.length > 63)
    throw new Error(`Invalid username length: ${t.length}. Expected 3..63 characters.`);
  if (t.includes("."))
    throw new Error(`Invalid username. "." is reserved as structure. Got: ${e}`);
  return Ee(t), t;
}
function ce(e, t) {
  return e[t]?.kind ?? null;
}
function lr(e, t) {
  if (e.length !== 1 || e[0] !== Ur || !Array.isArray(t) || t.length < 2) return null;
  const r = String(t[0] ?? "").trim(), o = String(t[1] ?? "").trim();
  return !r || !o || r === Ur ? null : { op: r, kind: o };
}
function ri(e, t, n) {
  if (t.length === 0) return null;
  const { scope: r, leaf: o } = ie(t);
  return !o || ce(e, o) !== "secret" || typeof n != "string" ? null : { scopeKey: r.join(".") };
}
function fr(e, t, n) {
  if (t.length === 0) return null;
  const { scope: r, leaf: o } = ie(t);
  return !o || ce(e, o) !== "noise" || typeof n != "string" ? null : { scopeKey: r.join(".") };
}
function oi(e, t, n) {
  if (t.length === 0) return null;
  const { leaf: r } = ie(t);
  if (!r || ce(e, r) !== "pointer" || typeof n != "string") return null;
  const o = n.trim().replace(/^\./, "");
  return o ? { targetPath: o } : null;
}
function ii(e, t, n) {
  if (t.length === 1 && ce(e, t[0]) === "identity")
    return typeof n != "string" ? null : { id: Tr(n), targetPath: [] };
  const { scope: r, leaf: o } = ie(t);
  return !o || ce(e, o) !== "identity" || typeof n != "string" ? null : { id: Tr(n), targetPath: r };
}
function hr(e, t, n) {
  if (t.length === 0) return null;
  const { scope: r, leaf: o } = ie(t);
  if (!o || ce(e, o) !== "eval") return null;
  if (typeof n == "function")
    return { mode: "thunk", targetPath: r, thunk: n };
  if (Array.isArray(n) && n.length >= 2) {
    const i = String(n[0] ?? "").trim(), a = String(n[1] ?? "").trim();
    return !i || !a ? null : { mode: "assign", targetPath: r, name: i, expr: a };
  }
  return null;
}
function dr(e, t, n) {
  if (t.length === 0) return null;
  const { scope: r, leaf: o } = ie(t);
  if (!o || ce(e, o) !== "query") return null;
  let i = null, a;
  if (Array.isArray(n) && n.length > 0)
    Array.isArray(n[0]) && (n.length === 1 || typeof n[1] == "function") ? (i = n[0], a = typeof n[1] == "function" ? n[1] : void 0) : i = n;
  else
    return null;
  if (!Array.isArray(i) || i.length === 0) return null;
  const s = i.map((u) => String(u)).map((u) => u.trim()).filter((u) => u.length > 0);
  return s.length === 0 ? null : { targetPath: r, paths: s, fn: a };
}
function pr(e, t, n) {
  if (t.length === 0) return null;
  const { scope: r, leaf: o } = ie(t);
  if (!o || ce(e, o) !== "remove") return null;
  if (n == null)
    return { targetPath: r };
  if (typeof n == "string") {
    const i = n.split(".").filter(Boolean);
    return { targetPath: [...r, ...i] };
  }
  return null;
}
const ys = 256, gs = 256, xs = 256, bs = "this.me/blob/v3", Ss = "this.me/blob/v3/no-noise";
function je(e, t, n) {
  e.has(t) && e.delete(t), e.set(t, n);
}
function ai(e, t) {
  for (; e.size > t; ) {
    const n = e.keys().next();
    if (n.done) return;
    e.delete(n.value);
  }
}
function vs(e) {
  for (; e.v3KeyCache.size > xs; ) {
    const t = e.v3KeyCache.keys().next();
    if (t.done) return;
    const n = e.v3KeyCache.get(t.value);
    n && (n.encKey.fill(0), n.macKey.fill(0), n.pathContext.fill(0)), e.v3KeyCache.delete(t.value);
  }
}
function ye(e) {
  const t = String(e ?? "");
  if (typeof TextEncoder < "u")
    return new TextEncoder().encode(t);
  if (typeof Buffer < "u")
    return new Uint8Array(Buffer.from(t, "utf8"));
  const n = unescape(encodeURIComponent(t)), r = new Uint8Array(n.length);
  for (let o = 0; o < n.length; o++) r[o] = n.charCodeAt(o);
  return r;
}
function ws(...e) {
  const t = e.reduce((o, i) => o + i.length, 0), n = new Uint8Array(t);
  let r = 0;
  for (const o of e)
    n.set(o, r), r += o.length;
  return n;
}
function Wr(e) {
  return ye(e.join("."));
}
function Ms(e, t) {
  let n = null, r = null;
  e.localNoises[""] !== void 0 && (n = "", r = e.localNoises[""]);
  for (let o = 1; o <= t.length; o++) {
    const i = t.slice(0, o).join(".");
    e.localNoises[i] !== void 0 && (n = i, r = e.localNoises[i]);
  }
  return { key: n, value: r };
}
function ks(e, t) {
  return e === null || e === "" ? !0 : t === e || t.startsWith(e + ".");
}
function Rn(e, t, n) {
  return ws(ye(e), new Uint8Array([0]), ye(t), new Uint8Array([0]), ye(n));
}
function Bs(e, t, n) {
  const r = [];
  n.value !== null ? r.push(Rn("noise", n.key ?? "", n.value)) : e.localSecrets[""] && r.push(Rn("secret", "", e.localSecrets[""]));
  for (let o = 1; o <= t.length; o++) {
    const i = t.slice(0, o).join("."), a = e.localSecrets[i];
    a && ks(n.key, i) && r.push(Rn("secret", i, a));
  }
  return r;
}
function Ve(e) {
  e.secretEpoch++, e.scopeCache.clear(), e.effectiveSecretCache.clear(), e.decryptedBranchCache.clear(), e.writeBranchCache.clear(), e.decryptedValueCache.clear();
  for (const t of e.v3KeyCache.values())
    t.encKey.fill(0), t.macKey.fill(0), t.pathContext.fill(0);
  e.v3KeyCache.clear();
}
function oe(e, t) {
  const n = t.join("."), r = e.effectiveSecretCache.get(n);
  if (r && r.epoch === e.secretEpoch)
    return je(e.effectiveSecretCache, n, r), r.value;
  let o = null, i = null;
  e.localNoises[""] !== void 0 && (o = "", i = e.localNoises[""]);
  for (let u = 1; u <= t.length; u++) {
    const l = t.slice(0, u).join(".");
    e.localNoises[l] !== void 0 && (o = l, i = e.localNoises[l]);
  }
  let a = "root";
  i ? a = se("noise::" + i) : e.localSecrets[""] && (a = se(a + "::" + e.localSecrets[""]));
  for (let u = 1; u <= t.length; u++) {
    const l = t.slice(0, u).join(".");
    if (e.localSecrets[l]) {
      if (o !== null && o !== "") {
        const h = o + ".";
        if (!(l === o || l.startsWith(h))) continue;
      }
      a = se(a + "::" + e.localSecrets[l]);
    }
  }
  const s = a === "root" ? "" : a;
  return je(e.effectiveSecretCache, n, { epoch: e.secretEpoch, value: s }), ai(e.effectiveSecretCache, gs), s;
}
function Ae(e, t) {
  const n = t.join("."), r = e.scopeCache.get(n);
  if (r && r.epoch === e.secretEpoch)
    return je(e.scopeCache, n, r), r.scope ? [...r.scope] : null;
  let o = null;
  e.localSecrets[""] && (o = []);
  for (let i = 1; i <= t.length; i++) {
    const a = t.slice(0, i), s = a.join(".");
    e.localSecrets[s] && (o = a);
  }
  return je(e.scopeCache, n, { epoch: e.secretEpoch, scope: o ? [...o] : null }), ai(e.scopeCache, ys), o;
}
function si(e, t, n) {
  const r = Ae(e, t);
  if (!r)
    throw new Error(`No secret context active for "${t.join(".")}".`);
  if (n === "branch" && r.length === 0)
    throw new Error("Branch v3 derivation does not support the root secret scope.");
  const o = n === "branch" ? r : t, i = Ms(e, o), a = i.key === null ? ye(Ss) : ye(i.key);
  return [
    ye(bs),
    ye(n),
    Wr(r),
    Wr(o),
    a,
    ...Bs(e, o, i)
  ];
}
function wn(e, t, n) {
  const r = `${n}::${t.join(".")}`, o = e.v3KeyCache.get(r);
  if (o && o.epoch === e.secretEpoch)
    return je(e.v3KeyCache, r, o), o;
  const i = si(e, t, n), a = So(i, n, t), s = {
    epoch: e.secretEpoch,
    encKey: Uint8Array.from(a.encKey),
    macKey: Uint8Array.from(a.macKey),
    pathContext: Uint8Array.from(a.pathContext)
  };
  return je(e.v3KeyCache, r, s), vs(e), s;
}
const Cs = 128;
function Es(e) {
  if (!Array.isArray(e) || e.length < Cs) return !1;
  const t = [];
  for (let n = 0; n < e.length && t.length < 8; n++)
    e[n] !== void 0 && t.push(e[n]);
  return t.length === 0 ? !1 : t.every((n) => {
    if (!n || typeof n != "object") return !1;
    const r = n.embedding;
    return mr(r) && r.length >= 128 && Rs(r);
  });
}
function ci(e) {
  if (!e || typeof e != "object") return !1;
  const t = e;
  return t.__columnar !== !0 || !t.payload || typeof t.payload != "object" ? !1 : t.payload.meta?.encoding === "columnar";
}
function As(e) {
  const t = e.length, n = Is(e), r = new Uint32Array(t), o = new Float32Array(t * n), i = new Float64Array(t), a = new Array(t), s = {};
  for (let u = 0; u < t; u++) {
    const l = e[u] ?? {};
    r[u] = Ns(l.id, u), i[u] = Os(l.timestamp), a[u] = typeof l.text == "string" ? l.text : "";
    const h = mr(l.embedding) ? l.embedding : [];
    for (let d = 0; d < n; d++) {
      const p = h[d];
      o[u * n + d] = typeof p == "number" && Number.isFinite(p) ? p : 0;
    }
    const f = {};
    for (const [d, p] of Object.entries(l))
      d === "id" || d === "embedding" || d === "timestamp" || d === "text" || (f[d] = p);
    Object.keys(f).length > 0 && (s[String(u)] = f);
  }
  return {
    __columnar: !0,
    payload: {
      meta: {
        encoding: "columnar",
        version: 1,
        count: t,
        dims: n
      },
      ids: r,
      embeddings: o,
      timestamps: i,
      texts: a,
      metadata: Object.keys(s).length > 0 ? s : void 0
    }
  };
}
function ui(e, t) {
  if (t < 0 || t >= e.meta.count) return;
  const n = {
    id: e.ids?.[t] ?? t,
    timestamp: e.timestamps?.[t] ?? 0,
    text: e.texts?.[t] ?? ""
  };
  if (e.embeddings && e.meta.dims > 0) {
    const o = t * e.meta.dims, i = o + e.meta.dims;
    n.embedding = Array.from(e.embeddings.subarray(o, i));
  } else
    n.embedding = [];
  const r = e.metadata?.[String(t)];
  return r && Object.assign(n, r), n;
}
function _s(e, t, n) {
  const r = Hr(t, 0, e.meta.count), o = Hr(n, r, e.meta.count), i = [];
  for (let a = r; a < o; a++) i.push(ui(e, a));
  return i;
}
function Ds(e) {
  return {
    __columnar: !0,
    payload: {
      meta: e.payload.meta,
      ids: e.payload.ids ? Nn(e.payload.ids, "Uint32Array") : void 0,
      embeddings: e.payload.embeddings ? Nn(e.payload.embeddings, "Float32Array") : void 0,
      timestamps: e.payload.timestamps ? Nn(e.payload.timestamps, "Float64Array") : void 0,
      texts: e.payload.texts,
      metadata: e.payload.metadata
    }
  };
}
function Ps(e) {
  if (!e || typeof e != "object")
    throw new Error("Invalid columnar payload");
  const t = e, n = t.meta;
  if (!n || n.encoding !== "columnar" || n.version !== 1)
    throw new Error("Invalid columnar payload metadata");
  return {
    meta: {
      encoding: "columnar",
      version: 1,
      count: Jr(n.count),
      dims: Jr(n.dims)
    },
    ids: t.ids ? On(t.ids, Uint32Array, "Uint32Array") : void 0,
    embeddings: t.embeddings ? On(t.embeddings, Float32Array, "Float32Array") : void 0,
    timestamps: t.timestamps ? On(t.timestamps, Float64Array, "Float64Array") : void 0,
    texts: Array.isArray(t.texts) ? t.texts.map((r) => typeof r == "string" ? r : "") : void 0,
    metadata: t.metadata && typeof t.metadata == "object" ? t.metadata : void 0
  };
}
function Is(e) {
  for (const t of e)
    if (!(!t || typeof t != "object") && mr(t.embedding) && t.embedding.length > 0)
      return t.embedding.length;
  return 0;
}
function mr(e) {
  return Array.isArray(e) || e instanceof Float32Array || e instanceof Float64Array || e instanceof Uint32Array || e instanceof Int32Array || e instanceof Uint16Array || e instanceof Int16Array || e instanceof Uint8Array || e instanceof Int8Array;
}
function Rs(e) {
  for (let t = 0; t < e.length; t++) {
    const n = e[t];
    if (typeof n != "number" || !Number.isFinite(n)) return !1;
  }
  return !0;
}
function Ns(e, t) {
  const n = typeof e == "number" ? e : t;
  return !Number.isFinite(n) || n < 0 ? t >>> 0 : Math.floor(n) >>> 0;
}
function Os(e) {
  const t = typeof e == "number" ? e : 0;
  return Number.isFinite(t) ? t : 0;
}
function Hr(e, t, n) {
  return Math.min(n, Math.max(t, e));
}
function Jr(e) {
  const t = typeof e == "number" ? e : Number(e);
  return !Number.isFinite(t) || t < 0 ? 0 : Math.floor(t);
}
function Nn(e, t) {
  const n = new Uint8Array(e.buffer, e.byteOffset, e.byteLength);
  return {
    __typedArray: !0,
    kind: t,
    base64: Ks(n)
  };
}
function On(e, t, n) {
  if (!e || e.__typedArray !== !0 || e.kind !== n)
    throw new Error(`Invalid typed array payload for ${n}`);
  const r = Fs(e.base64), o = r.buffer.slice(r.byteOffset, r.byteOffset + r.byteLength);
  return new t(o);
}
function Ks(e) {
  if (typeof Buffer < "u")
    return Buffer.from(e).toString("base64");
  let t = "";
  for (const n of e) t += String.fromCharCode(n);
  return btoa(t);
}
function Fs(e) {
  if (typeof Buffer < "u")
    return new Uint8Array(Buffer.from(e, "base64"));
  const t = atob(e), n = new Uint8Array(t.length);
  for (let r = 0; r < t.length; r++) n[r] = t.charCodeAt(r);
  return n;
}
const li = 64;
function fi() {
  return {
    calls: 0,
    hits: 0,
    misses: 0,
    v2Misses: 0,
    v3Misses: 0,
    totalHitMs: 0,
    totalMissMs: 0,
    totalDecryptMs: 0,
    totalDecodeMs: 0,
    maxHitMs: 0,
    maxMissMs: 0,
    maxDecryptMs: 0,
    maxDecodeMs: 0
  };
}
function fe() {
  return typeof performance < "u" && typeof performance.now == "function" ? performance.now() : Date.now();
}
function js(e, t) {
  const n = e.__decryptedChunkDebug;
  if (!n?.enabled) return;
  const r = n.window ?? (n.window = fi());
  r.calls += 1, r.hits += 1, r.totalHitMs += t, r.maxHitMs = Math.max(r.maxHitMs, t);
}
function qr(e, t, n, r, o) {
  const i = e.__decryptedChunkDebug;
  if (!i?.enabled) return;
  const a = i.window ?? (i.window = fi());
  a.calls += 1, a.misses += 1, t === "v3" ? a.v3Misses += 1 : a.v2Misses += 1, a.totalMissMs += n, a.totalDecryptMs += r, a.totalDecodeMs += o, a.maxMissMs = Math.max(a.maxMissMs, n), a.maxDecryptMs = Math.max(a.maxDecryptMs, r), a.maxDecodeMs = Math.max(a.maxDecodeMs, o);
}
function tt(e) {
  return ci(e);
}
function $s(e, t) {
  if (tt(e)) return ui(e.payload, t);
  if (Array.isArray(e)) return e[t];
}
function hi(e) {
  return tt(e) ? _s(e.payload, 0, e.payload.meta.count) : e;
}
function Tn(e, t, n) {
  e.has(t) && e.delete(t), e.set(t, n);
}
function di(e, t) {
  for (; e.size > t; ) {
    const n = e.keys().next();
    if (n.done) return;
    e.delete(n.value);
  }
}
function Ye(e, t) {
  return `${e}::${t}`;
}
function Ze(e, t) {
  const n = `${t}::`;
  for (const r of Array.from(e.decryptedBranchCache.keys()))
    r.startsWith(n) && e.decryptedBranchCache.delete(r);
  for (const r of Array.from(e.writeBranchCache.keys()))
    r.startsWith(n) && e.writeBranchCache.delete(r);
}
function $e(e) {
  if (typeof e != "string" || e.length === 0) return null;
  const t = Number(e);
  return !Number.isInteger(t) || t < 0 ? null : String(t) === e ? t : null;
}
function cn(e) {
  return $e(e[0]) !== null ? [] : {};
}
function ze(e, t, n) {
  const r = t.slice(n.length);
  if (r.length === 0) return "root";
  const o = $e(r[0]);
  if (o !== null)
    return `idx_${Math.floor(o / e.secretChunkSize)}`;
  const i = r[0] || "root", a = r[1];
  if (a === void 0) return `${i}_root`;
  const s = $e(a);
  if (s !== null)
    return `${i}_${Math.floor(s / e.secretChunkSize)}`;
  const u = parseInt(se(String(a)).slice(-6), 16) % e.secretHashBuckets;
  return `${i}_h${u}`;
}
function Mn(e, t, n) {
  const r = t.slice(n.length);
  if (r.length === 0) return r;
  const o = $e(r[0]);
  return o === null ? r : [String(o % e.secretChunkSize), ...r.slice(1)];
}
function Ls(e, t, n) {
  const r = t.slice(n.length), o = $e(r[0]);
  return o === null ? null : `${o}_root`;
}
function kn(e, t, n) {
  if (t.length === 0) return;
  let r = e;
  for (let o = 0; o < t.length - 1; o++) {
    const i = t[o], a = t[o + 1];
    (!r[i] || typeof r[i] != "object") && (r[i] = $e(a) !== null ? [] : {}), r = r[i];
  }
  r[t[t.length - 1]] = n;
}
function yr(e, t, n) {
  if (xe(e) || Xe(e) || e === null || typeof e != "object" || Array.isArray(e)) {
    n.push({ rel: t, value: e });
    return;
  }
  const r = Object.keys(e);
  if (r.length === 0) {
    n.push({ rel: t, value: e });
    return;
  }
  for (const o of r) yr(e[o], [...t, o], n);
}
function pi(e, t, n, r) {
  const o = t.join("."), i = ar(n, r, t);
  if (!i || typeof i != "object") {
    e.branchStore.setScope(o, { default: n }), Ze(e, o);
    return;
  }
  const a = [];
  yr(i, [], a);
  const s = {};
  for (const l of a) {
    const h = [...t, ...l.rel], f = ze(e, h, t), d = Mn(e, h, t);
    (!s[f] || typeof s[f] != "object") && (s[f] = cn(d)), kn(s[f], d, l.value);
  }
  const u = {};
  for (const [l, h] of Object.entries(s))
    u[l] = ir(h, r, t);
  e.branchStore.setScope(o, u), Ze(e, o);
}
function mi(e, t, n) {
  const r = t.join("."), o = e.branchStore.getScope(r);
  return o ? typeof o == "string" ? (pi(e, t, o, n), e.branchStore.getScope(r) || {}) : o : {};
}
function Bn(e, t, n) {
  const r = t.join(".");
  return e.branchStore.getChunk(r, n);
}
function yi(e, t, n, r, o) {
  const i = t.join(".");
  e.branchStore.getScopeMode(i) === "legacy" && mi(e, t, o), e.branchStore.setChunk(i, n, r), e.decryptedBranchCache.delete(Ye(i, n)), e.writeBranchCache.delete(Ye(i, n));
}
function Vs(e, t, n, r) {
  const o = t.join("."), i = Bn(e, t, n);
  if (!i) return;
  const a = Ye(o, n);
  Tn(e.decryptedBranchCache, a, {
    epoch: e.secretEpoch,
    blob: i,
    data: r
  }), di(e.decryptedBranchCache, li);
}
function ge(e, t, n, r) {
  const o = fe(), i = t.join("."), a = Bn(e, t, r);
  if (!a) return;
  const s = Ye(i, r), u = e.decryptedBranchCache.get(s);
  if (u && u.epoch === e.secretEpoch && u.blob === a)
    return Tn(e.decryptedBranchCache, s, u), js(e, fe() - o), u.data;
  const l = rr(a);
  let h = null;
  const f = fe();
  if (l === "v3")
    try {
      const b = wn(e, t, "branch");
      h = Mo(a, b);
    } catch {
      h = null;
    }
  else
    h = ar(a, n, t);
  const d = fe() - f;
  let p = 0;
  if (!h || typeof h != "object") {
    qr(e, l === "v3" ? "v3" : "v2", fe() - o, d, p);
    return;
  }
  let m;
  if (ci(h)) {
    const b = fe(), S = Ps(h.payload);
    p = fe() - b, m = {
      ...h,
      payload: S
    };
  } else
    m = h;
  return Tn(e.decryptedBranchCache, s, { epoch: e.secretEpoch, blob: a, data: m }), di(e.decryptedBranchCache, li), qr(e, l === "v3" ? "v3" : "v2", fe() - o, d, p), m;
}
function gi(e, t) {
  const n = t.path, r = n.split(".").filter(Boolean);
  if (t.operator === "_") {
    r.length > 0 && xi(e, r);
    return;
  }
  const o = Ae(e, r), i = o && o.length > 0 && vn(r, o);
  if (t.operator === "-") {
    if (n === "") {
      for (const s of Object.keys(e.index)) delete e.index[s];
      return;
    }
    const a = n + ".";
    for (const s of Object.keys(e.index))
      (s === n || s.startsWith(a)) && delete e.index[s];
    return;
  }
  i || (e.index[n] = t.value);
}
function xi(e, t) {
  const n = t.join(".");
  if (!n) return;
  const r = n + ".";
  for (const o of Object.keys(e.index))
    (o === n || o.startsWith(r)) && delete e.index[o];
}
function zs(e) {
  const t = {}, n = e._memories.map((r, o) => ({ t: r, i: o })).sort((r, o) => r.t.timestamp !== o.t.timestamp ? r.t.timestamp - o.t.timestamp : r.t.hash !== o.t.hash ? r.t.hash < o.t.hash ? -1 : 1 : r.i - o.i).map((r) => r.t);
  e.index = t;
  for (const r of n)
    gi(e, r);
}
function un(e, t) {
  return e.index[t.join(".")];
}
function Us(e, t, n) {
  e.index[t.join(".")] = n;
}
function bi(e, t, n = 8) {
  let r = t;
  for (let o = 0; o < n; o++) {
    const i = un(e, r);
    if (xe(i)) {
      r = i.__ptr.split(".").filter(Boolean);
      continue;
    }
    let a = !1;
    for (let s = r.length - 1; s >= 0; s--) {
      const u = r.slice(0, s), l = un(e, u);
      if (!xe(l)) continue;
      const h = l.__ptr.split(".").filter(Boolean), f = r.slice(s);
      r = [...h, ...f], a = !0;
      break;
    }
    if (!a)
      return { path: r, raw: i };
  }
  return { path: r, raw: void 0 };
}
function Ts(e, t, n) {
  const r = String(t || "").trim();
  if (!r) throw new Error("installRecipientKey(...) requires a recipient key id.");
  return e.recipientKeyring[r] = n, e;
}
function Ws(e, t) {
  const n = String(t || "").trim();
  return n && delete e.recipientKeyring[n], e;
}
function Hs(e, t, n, r) {
  const o = String(t || "").trim();
  if (!o) throw new Error("storeWrappedKey(...) requires a key id.");
  if (!n || n.version !== 1)
    throw new Error("storeWrappedKey(...) requires a valid WrappedSecretV1 envelope.");
  return e.keySpaces[o] = G({
    envelope: n,
    recipientKeyId: r?.recipientKeyId
  }), e;
}
function Si(e, t, n, r) {
  switch (t) {
    case "read":
      return n ? gr(e, n) : G(e.keySpaces);
    case "write":
      if (!n) throw new Error("self:write/keys requires a key id.");
      if (r === void 0) throw new Error("self:write/keys requires a payload.");
      return wi(e, n, r);
    case "open":
    case "use":
      if (!n) throw new Error(`self:${t}/keys requires a key id.`);
      return Mi(e, n, r);
    default:
      throw new Error(`Unsupported keys operation: ${t}`);
  }
}
function vi(e) {
  const t = String(e ?? "").trim().replace(/^\/+|\/+$/g, "");
  return t ? t === "keys" ? { isKeySpace: !0, keyId: null } : t.startsWith("keys/") ? { isKeySpace: !0, keyId: t.slice(5).trim() || null } : t.startsWith("keys.") ? { isKeySpace: !0, keyId: t.slice(5).trim() || null } : { isKeySpace: !1, keyId: null } : { isKeySpace: !1, keyId: null };
}
function gr(e, t) {
  const n = e.keySpaces[t];
  if (!n) throw new Error(`Key space "${t}" was not found.`);
  return G(n.envelope);
}
function wi(e, t, n) {
  const r = n && typeof n == "object" && n.envelope ? n.envelope : n, o = n && typeof n == "object" && typeof n.recipientKeyId == "string" ? n.recipientKeyId : void 0;
  return e.storeWrappedKey(t, r, { recipientKeyId: o }), gr(e, t);
}
function Mi(e, t, n) {
  const r = e.keySpaces[t];
  if (!r) throw new Error(`Key space "${t}" was not found.`);
  const o = n?.output === "utf8" ? "utf8" : "bytes", i = n?.recipientPrivateKey, a = n?.recipientKeyId ?? r.recipientKeyId, s = i ?? (a ? e.recipientKeyring[a] : void 0);
  if (!s)
    throw new Error(
      `No recipient private key is available to open "${t}". Install one first or pass it inline.`
    );
  return Eo(r.envelope, s, o);
}
function ki(e, t, n) {
  if (t.startsWith("__ptr.")) {
    const a = e.getIndex(n);
    if (!xe(a)) return { ok: !1 };
    const s = t.slice(6).split(".").filter(Boolean), u = [...a.__ptr.split(".").filter(Boolean), ...s], l = e.readPath(u);
    return l == null ? { ok: !1 } : { ok: !0, value: l };
  }
  const r = t.split(".").filter(Boolean), o = [...n, ...r];
  let i = e.readPath(o);
  return i == null && (i = e.readPath(r)), i == null ? { ok: !1 } : { ok: !0, value: i };
}
function Bi(e) {
  const t = [], n = String.raw`[A-Za-z_][A-Za-z0-9_]*(?:\[(?:"[^"]*"|'[^']*'|[^\]]+)\])*`, r = new RegExp(String.raw`^(?:__ptr(?:\.${n})*|${n}(?:\.${n})*)`), o = {
    true: !0,
    false: !1,
    null: null,
    undefined: void 0,
    NaN: NaN,
    Infinity: 1 / 0
  }, i = /* @__PURE__ */ new Set([">=", "<=", "==", "!=", "&&", "||"]), a = /* @__PURE__ */ new Set(["+", "-", "*", "/", "%", "<", ">", "!"]);
  let s = 0;
  for (; s < e.length; ) {
    const u = e[s];
    if (/\s/.test(u)) {
      s++;
      continue;
    }
    if (u === "(") {
      t.push({ kind: "lparen" }), s++;
      continue;
    }
    if (u === ")") {
      t.push({ kind: "rparen" }), s++;
      continue;
    }
    const l = e.slice(s, s + 2);
    if (i.has(l)) {
      t.push({ kind: "op", value: l }), s += 2;
      continue;
    }
    if (a.has(u)) {
      t.push({ kind: "op", value: u }), s++;
      continue;
    }
    if (/\d/.test(u) || u === "." && /\d/.test(e[s + 1] ?? "")) {
      let f = s;
      for (; f < e.length && /[0-9]/.test(e[f]); ) f++;
      if (e[f] === ".")
        for (f++; f < e.length && /[0-9]/.test(e[f]); ) f++;
      if (e[f] === "e" || e[f] === "E") {
        let p = f + 1;
        (e[p] === "+" || e[p] === "-") && p++;
        let m = !1;
        for (; p < e.length && /[0-9]/.test(e[p]); )
          m = !0, p++;
        if (!m) return null;
        f = p;
      }
      const d = Number(e.slice(s, f));
      if (!Number.isFinite(d)) return null;
      t.push({ kind: "literal", value: d }), s = f;
      continue;
    }
    const h = e.slice(s).match(r);
    if (h && h[0]) {
      const f = h[0];
      Object.prototype.hasOwnProperty.call(o, f) ? t.push({ kind: "literal", value: o[f] }) : t.push({ kind: "identifier", value: f }), s += f.length;
      continue;
    }
    return null;
  }
  return t;
}
function Fe(e, t, n) {
  const r = String(n ?? "").trim();
  if (!r) return { ok: !1 };
  if (!/^[A-Za-z0-9_\s+\-*/%().<>=!&|\[\]"']+$/.test(r)) return { ok: !1 };
  if (e.unsafeEval) return { ok: !1 };
  const o = Bi(r);
  if (!o || o.length === 0) return { ok: !1 };
  const i = {
    "u-": 7,
    "!": 7,
    "*": 6,
    "/": 6,
    "%": 6,
    "+": 5,
    "-": 5,
    "<": 4,
    "<=": 4,
    ">": 4,
    ">=": 4,
    "==": 3,
    "!=": 3,
    "&&": 2,
    "||": 1
  }, a = /* @__PURE__ */ new Set(["u-", "!"]), s = [], u = [];
  let l = "start";
  for (const p of o) {
    if (p.kind === "literal" || p.kind === "identifier") {
      s.push(p), l = "value";
      continue;
    }
    if (p.kind === "lparen") {
      u.push(p), l = "lparen";
      continue;
    }
    if (p.kind === "rparen") {
      let b = !1;
      for (; u.length > 0; ) {
        const S = u.pop();
        if (S.kind === "lparen") {
          b = !0;
          break;
        }
        s.push(S);
      }
      if (!b) return { ok: !1 };
      l = "rparen";
      continue;
    }
    let m = p.value;
    if (m === "-" && (l === "start" || l === "op" || l === "lparen"))
      m = "u-";
    else {
      if (m === "!" && (l === "value" || l === "rparen"))
        return { ok: !1 };
      if (m !== "!" && (l === "start" || l === "op" || l === "lparen"))
        return { ok: !1 };
    }
    for (; u.length > 0; ) {
      const b = u[u.length - 1];
      if (b.kind !== "op") break;
      const S = i[b.value] ?? -1, g = i[m] ?? -1;
      if (g < 0) return { ok: !1 };
      if (!(a.has(m) ? g < S : g <= S)) break;
      s.push(u.pop());
    }
    u.push({ kind: "op", value: m }), l = "op";
  }
  if (l === "op" || l === "lparen" || l === "start") return { ok: !1 };
  for (; u.length > 0; ) {
    const p = u.pop();
    if (p.kind === "lparen") return { ok: !1 };
    s.push(p);
  }
  const h = (p) => {
    if (typeof p == "number" && Number.isFinite(p)) return p;
    if (typeof p == "string") {
      const m = Number(p);
      if (Number.isFinite(m)) return m;
    }
    return null;
  }, f = [];
  for (const p of s) {
    if (p.kind === "literal") {
      f.push(p.value);
      continue;
    }
    if (p.kind === "identifier") {
      const w = ki(e, p.value, t);
      if (!w.ok) return { ok: !1 };
      f.push(w.value);
      continue;
    }
    const m = p.value;
    if (m === "u-" || m === "!") {
      if (f.length < 1) return { ok: !1 };
      const w = f.pop();
      if (m === "u-") {
        const D = h(w);
        if (D === null) return { ok: !1 };
        f.push(-D);
      } else
        f.push(!w);
      continue;
    }
    if (f.length < 2) return { ok: !1 };
    const b = f.pop(), S = f.pop();
    if (m === "&&" || m === "||") {
      f.push(m === "&&" ? !!S && !!b : !!S || !!b);
      continue;
    }
    if (m === "==" || m === "!=") {
      f.push(m === "==" ? S == b : S != b);
      continue;
    }
    if (m === "<" || m === "<=" || m === ">" || m === ">=") {
      const w = h(S), D = h(b);
      if (w === null || D === null) return { ok: !1 };
      m === "<" && f.push(w < D), m === "<=" && f.push(w <= D), m === ">" && f.push(w > D), m === ">=" && f.push(w >= D);
      continue;
    }
    const g = h(S), k = h(b);
    if (g === null || k === null) return { ok: !1 };
    let M;
    if (m === "+") M = g + k;
    else if (m === "-") M = g - k;
    else if (m === "*") M = g * k;
    else if (m === "/") M = g / k;
    else if (m === "%") M = g % k;
    else return { ok: !1 };
    if (!Number.isFinite(M)) return { ok: !1 };
    f.push(M);
  }
  if (f.length !== 1) return { ok: !1 };
  const d = f[0];
  return typeof d == "number" && Number.isFinite(d) ? { ok: !0, value: d } : typeof d == "boolean" ? { ok: !0, value: d } : { ok: !1 };
}
function Js(e) {
  const t = e._currentCallerScope;
  if (t !== void 0)
    return typeof t == "string" && t.length > 0 ? t : null;
}
function Wn(e, t, n = Js(e)) {
  if (n === void 0) return !1;
  for (let r = t.length; r > 0; r--) {
    const o = t.slice(0, r).join("."), i = e.localSecrets[o];
    if (typeof i == "string" && i !== n)
      return !0;
    const a = e.index[o];
    if (a && typeof a == "object" && "meta" in a) {
      const s = a.meta;
      if (s?.origin === "stealth" && s.scopeKey !== n)
        return !0;
    }
  }
  return !1;
}
function ln(e, t) {
  const n = K(t);
  if (n.length === 0) return e.readPath(n);
  if (!Wn(e, n))
    return e.readPath(n);
}
function Ci(e, t) {
  const n = t.findIndex((i) => i.includes("[i]"));
  if (n === -1) return [];
  const r = [];
  for (let i = 0; i <= n; i++) {
    const a = t[i];
    if (i === n) {
      const s = a.split("[i]").join("").trim();
      s && r.push(s);
    } else
      r.push(a);
  }
  const o = /* @__PURE__ */ new Set();
  for (const i of Object.keys(e.index)) {
    const a = i.split(".").filter(Boolean);
    if (a.length <= r.length) continue;
    let s = !0;
    for (let u = 0; u < r.length; u++)
      if (a[u] !== r[u]) {
        s = !1;
        break;
      }
    s && o.add(a[r.length]);
  }
  return Array.from(o).sort((i, a) => {
    const s = Number(i), u = Number(a), l = Number.isFinite(s), h = Number.isFinite(u);
    return l && h ? s - u : l ? -1 : h ? 1 : i.localeCompare(a);
  });
}
function Hn(e, t, n) {
  const r = ln(e, [...t, ...n]);
  return r ?? ln(e, n);
}
function Jn(e, t, n) {
  const r = K(n.left.split(".").filter(Boolean)), o = Hn(e, t, r);
  if (o == null) return !1;
  const i = No(n.right), a = i.kind === "literal" ? i.value : Hn(e, t, i.parts);
  return a == null ? !1 : Ro(o, n.op, a);
}
function xr(e, t, n) {
  const r = Qe(n);
  if (!r) return !1;
  let o = Jn(e, t, r.clauses[0]);
  for (let i = 1; i < r.clauses.length; i++) {
    const a = Jn(e, t, r.clauses[i]);
    o = r.ops[i - 1] === "&&" ? o && a : o || a;
  }
  return o;
}
function Cn(e, t) {
  const n = /* @__PURE__ */ new Set();
  for (const r of Object.keys(e.index)) {
    const o = r.split(".").filter(Boolean);
    if (o.length <= t.length) continue;
    let i = !0;
    for (let a = 0; a < t.length; a++)
      if (o[a] !== t[a]) {
        i = !1;
        break;
      }
    i && n.add(o[t.length]);
  }
  return Array.from(n);
}
function Ei(e, t) {
  const n = t.findIndex((l) => {
    const h = Se(l);
    return h ? zn(h.selector) !== null : !1;
  });
  if (n === -1) return;
  const r = Se(t[n]);
  if (!r) return;
  const o = zn(r.selector);
  if (!o) return;
  const i = [...t.slice(0, n), r.base];
  if (t.slice(n + 1).length > 0) return;
  const s = Cn(e, i), u = {};
  for (const l of s) {
    const h = [...i, l], f = o.expr.replace(
      new RegExp(String.raw`\b${o.varName}\.`, "g"),
      ""
    ), d = Fe(e, h, f);
    d.ok && (u[l] = d.value);
  }
  return u;
}
function Ai(e, t) {
  const n = t.findIndex((u) => Se(u) !== null);
  if (n === -1) return;
  const r = Se(t[n]);
  if (!r) return;
  const o = Oo(r.selector);
  if (o === null) return;
  const i = [...t.slice(0, n), r.base], a = t.slice(n + 1), s = {};
  for (const u of o) {
    const l = [...i, u], h = a.length === 0 ? br(e, l) : ln(e, [...l, ...a]);
    h !== void 0 && (s[u] = h);
  }
  return s;
}
function br(e, t) {
  const r = K(t).join("."), o = {};
  let i = !1;
  for (const [a, s] of Object.entries(e.index)) {
    const u = a.split(".").filter(Boolean);
    if (a === r)
      return Wn(e, u) ? void 0 : s;
    if (!a.startsWith(r + ".") || Wn(e, u)) continue;
    const l = a.slice(r.length + 1).split(".").filter(Boolean);
    let h = o;
    for (let f = 0; f < l.length - 1; f++) {
      const d = l[f];
      (!h[d] || typeof h[d] != "object") && (h[d] = {}), h = h[d];
    }
    h[l[l.length - 1]] = s, i = !0;
  }
  return i ? o : void 0;
}
function _i(e, t) {
  const n = t.findIndex((u) => Qe(u) !== null);
  if (n === -1) return;
  const r = t[n], o = t.slice(0, n), i = t.slice(n + 1);
  if (o.length === 0) return;
  const a = Cn(e, o), s = {};
  for (const u of a) {
    const l = [...o, u];
    xr(e, l, r) && (i.length === 0 ? s[u] = br(e, l) : s[u] = ln(e, [...l, ...i]));
  }
  return s;
}
function Di(e, t) {
  return t.some((n) => {
    const r = Se(n);
    return r ? Qe(r.selector) !== null : !1;
  });
}
function Pi(e, t) {
  const n = t.findIndex((u) => {
    const l = Se(u);
    return l ? Qe(l.selector) !== null : !1;
  });
  if (n === -1) return [];
  const r = Se(t[n]);
  if (!r) return [];
  const o = [...t.slice(0, n), r.base], i = t.slice(n + 1), a = Cn(e, o), s = [];
  for (const u of a) {
    const l = [...o, u];
    xr(e, l, r.selector) && s.push([...l, ...i]);
  }
  return s;
}
function qs(e) {
  const { effectiveSecret: t, ...n } = e;
  return { ...n };
}
function Sr(e) {
  return e.map(qs);
}
function Gs(e) {
  return { ...e };
}
function Ii(e) {
  return e.map(Gs);
}
function Xs(e, t) {
  const n = K(String(t ?? "").split(".").filter(Boolean)), r = n.join(".");
  e.recomputeMode === "lazy" && Br(e, r);
  const o = e.readPath(n), i = e.derivations[r], a = e.lastRecomputeWaveByTarget[r];
  if (!i)
    return {
      path: r,
      value: o,
      expr: null,
      derivation: null,
      meta: {
        dependsOn: [],
        ...a ? {
          k: a.recomputed.size,
          recomputed: [...a.recomputed],
          sourcePath: a.sourcePath,
          recomputedAt: a.at
        } : {}
      }
    };
  const s = i.refs.map((u) => {
    const l = K(u.path.split(".").filter(Boolean)), h = Ae(e, l), f = !!(h && h.length > 0 && vn(l, h)), d = e.readPath(l);
    return {
      label: u.label,
      path: u.path,
      value: f ? "●●●●" : d,
      origin: f ? "stealth" : "public",
      masked: f
    };
  });
  return {
    path: r,
    value: o,
    expr: i.expression,
    derivation: {
      expression: i.expression,
      inputs: s
    },
    meta: {
      dependsOn: i.refs.map((u) => u.path),
      lastComputedAt: i.lastComputedAt,
      ...a ? {
        k: a.recomputed.size,
        recomputed: [...a.recomputed],
        sourcePath: a.sourcePath,
        recomputedAt: a.at
      } : {}
    }
  };
}
function Ri(e, t) {
  return e.activeRecomputeWave ? !1 : (e.activeRecomputeWave = {
    sourcePath: t,
    recomputed: /* @__PURE__ */ new Set(),
    at: Date.now()
  }, !0);
}
function Ys(e, t) {
  const n = e.activeRecomputeWave;
  n && n.recomputed.add(t);
}
function Je(e) {
  const t = e.activeRecomputeWave;
  if (!t || (e.activeRecomputeWave = null, t.recomputed.size === 0)) return;
  const n = {
    sourcePath: t.sourcePath,
    recomputed: new Set(t.recomputed),
    at: Date.now()
  };
  for (const r of n.recomputed)
    e.lastRecomputeWaveByTarget[r] = n;
}
function Ni(e) {
  const t = String(e ?? "").trim();
  if (!t) return [];
  const n = String.raw`[A-Za-z_][A-Za-z0-9_]*(?:\[(?:"[^"]*"|'[^']*'|[^\]]+)\])*`, r = new RegExp(String.raw`__ptr(?:\.${n})*|${n}(?:\.${n})*`, "g"), o = /* @__PURE__ */ new Set(["true", "false", "null", "undefined", "NaN", "Infinity"]), i = /* @__PURE__ */ new Set(), a = t.match(r) || [];
  for (const s of a)
    o.has(s) || i.add(s);
  return Array.from(i);
}
function Oi(e, t, n) {
  if (!t || t.startsWith("__ptr.")) return null;
  const r = K(t.split(".").filter(Boolean));
  if (r.length === 0) return null;
  const o = K([...n, ...r]).join("."), i = K(r).join(".");
  return t.includes(".") ? i : o;
}
function vr(e, t) {
  const n = e.derivations[t];
  if (n) {
    for (const r of n.refs) {
      const o = e.refSubscribers[r.path];
      o && (o.delete(t), o.size === 0 && delete e.refSubscribers[r.path]);
    }
    delete e.derivations[t], delete e.derivationRefVersions[t], delete e.lastRecomputeWaveByTarget[t], e.staleDerivations.delete(t);
  }
}
function En(e, t) {
  return e.refVersions[t] ?? 0;
}
function wr(e, t) {
  e.refVersions[t] = En(e, t) + 1;
}
function Mr(e, t) {
  const n = e.derivations[t];
  if (!n) return;
  const r = {};
  for (const o of n.refs) r[o.path] = En(e, o.path);
  e.derivationRefVersions[t] = r;
}
function rn(e, t, n, r) {
  const o = t.join(".");
  vr(e, o);
  const i = Ni(r), a = [], s = /* @__PURE__ */ new Set();
  for (const u of i) {
    const l = Oi(e, u, n);
    if (!l || s.has(l)) continue;
    s.add(l), a.push({ label: u, path: l }), (e.refSubscribers[l] || (e.refSubscribers[l] = /* @__PURE__ */ new Set())).add(o);
  }
  e.derivations[o] = {
    expression: r,
    evalScope: [...n],
    refs: a,
    lastComputedAt: Date.now()
  }, Mr(e, o), e.staleDerivations.delete(o);
}
function kr(e, t) {
  const n = e.derivations[t];
  if (!n) return !1;
  const r = K(t.split(".").filter(Boolean)), o = Fe(e, n.evalScope, n.expression);
  return Ys(e, t), e.commitValueMapping(r, o.ok ? o.value : n.expression, "="), wr(e, t), n.lastComputedAt = Date.now(), Mr(e, t), e.staleDerivations.delete(t), !0;
}
function Ki(e, t) {
  const n = e.derivations[t];
  if (!n) return !1;
  const r = e.derivationRefVersions[t] || {};
  for (const o of n.refs)
    if ((r[o.path] ?? 0) !== En(e, o.path)) return !0;
  return !1;
}
function Br(e, t, n = /* @__PURE__ */ new Set()) {
  if (e.recomputeMode !== "lazy") return !1;
  const r = Ri(e, t), o = e.derivations[t];
  if (!o || n.has(t))
    return r && Je(e), !1;
  n.add(t);
  for (const s of o.refs)
    e.derivations[s.path] && Br(e, s.path, n);
  const i = e.staleDerivations.has(t) || Ki(e, t);
  let a = !1;
  return i && (a = kr(e, t)), n.delete(t), r && Je(e), a;
}
function fn(e, t) {
  const n = K(t).join(".");
  if (!n) return;
  const r = Ri(e, n);
  if (wr(e, n), e.recomputeMode === "lazy") {
    r && Je(e);
    return;
  }
  const o = [n], i = /* @__PURE__ */ new Set();
  for (; o.length > 0; ) {
    const a = o.shift(), s = e.refSubscribers[a] || /* @__PURE__ */ new Set();
    for (const u of s) {
      if (i.has(u)) continue;
      i.add(u), kr(e, u) && o.push(u);
    }
  }
  r && Je(e);
}
function Fi(e, t) {
  const n = t.join(".");
  for (const r of Object.keys(e.derivations))
    (n === "" || r === n || r.startsWith(n + ".")) && vr(e, r);
}
function Zs(e, t, n = {}) {
  const { path: r, expression: o } = t, i = lr(r, o);
  if (i)
    return {
      kind: "return",
      value: {
        define: i
      }
    };
  const a = ri(e, r, o);
  if (a)
    return {
      kind: "commit",
      instructions: [{ path: a.scopeKey ? a.scopeKey.split(".").filter(Boolean) : [], op: "secret", value: o }]
    };
  const s = fr(e, r, o);
  if (s)
    return {
      kind: "commit",
      instructions: [{ path: s.scopeKey ? s.scopeKey.split(".").filter(Boolean) : [], op: "noise", value: o }]
    };
  const u = oi(e, r, o);
  if (u) {
    const { scope: p } = ie(r);
    return {
      kind: "commit",
      instructions: [{ path: p, op: "ptr", value: ds(u.targetPath) }]
    };
  }
  const l = ii(e, r, o);
  if (l)
    return {
      kind: "commit",
      instructions: [{ path: l.targetPath, op: "id", value: ps(l.id) }]
    };
  const h = pr(e, r, o);
  if (h)
    return {
      kind: "commit",
      instructions: [{ path: h.targetPath, op: "remove", value: "-" }]
    };
  const f = hr(e, r, o);
  if (f) {
    if (f.mode === "assign")
      return {
        kind: "commit",
        instructions: [
          {
            path: [...f.targetPath, f.name],
            op: "derive",
            value: {
              kind: "expr",
              source: f.expr
            }
          }
        ]
      };
    if (!n.evaluateThunk)
      throw new Error('Non-serializable derivation: "=" thunk requires `evaluateThunk` or serializable DNA.');
    const p = n.evaluateThunk(f.thunk);
    return f.targetPath.length === 0 ? { kind: "return", value: p } : {
      kind: "commit",
      instructions: [{ path: f.targetPath, op: "derive", value: p }]
    };
  }
  const d = dr(e, r, o);
  if (d) {
    if (!n.readPath)
      return {
        kind: "commit",
        instructions: [
          {
            path: d.targetPath,
            op: "query",
            value: { paths: d.paths }
          }
        ]
      };
    const p = d.paths.map((b) => n.readPath(b.split(".").filter(Boolean))), m = d.fn ? d.fn(...p) : p;
    return d.targetPath.length === 0 ? { kind: "return", value: m } : {
      kind: "commit",
      instructions: [{ path: d.targetPath, op: "query", value: m }]
    };
  }
  return {
    kind: "commit",
    instructions: [{ path: r, op: "set", value: o }]
  };
}
const Qs = /* @__PURE__ */ Symbol.for("nodejs.util.inspect.custom"), Gr = /* @__PURE__ */ Symbol.for("me.seed"), qn = /* @__PURE__ */ Symbol.for("me.expression"), hn = /* @__PURE__ */ Symbol.for("me.identity"), Cr = /* @__PURE__ */ Symbol.for("me.internal.setActiveExpression"), Gn = /* @__PURE__ */ Symbol.for("me.internal.reseed");
function Er() {
  return {
    writes: 0,
    columnarWrites: 0,
    maxBranchBytes: 0,
    maxCacheSeedBytes: 0,
    maxEncryptableBytes: 0,
    maxBlobBytes: 0,
    totalLoadChunkMs: 0,
    totalMaterializeMs: 0,
    totalCloneMs: 0,
    totalColumnarMaterializeMs: 0,
    totalPrepareColumnarMs: 0,
    totalKeyDeriveMs: 0,
    totalEncryptMs: 0,
    totalSetBlobMs: 0,
    maxLoadChunkMs: 0,
    maxMaterializeMs: 0,
    maxCloneMs: 0,
    maxColumnarMaterializeMs: 0,
    maxPrepareColumnarMs: 0,
    maxKeyDeriveMs: 0,
    maxEncryptMs: 0,
    maxSetBlobMs: 0,
    writeCacheHits: 0,
    writeCacheMisses: 0,
    totalWriteCacheHitMs: 0,
    maxWriteCacheHitMs: 0
  };
}
function V() {
  return typeof performance < "u" && typeof performance.now == "function" ? performance.now() : Date.now();
}
function Ne(e, t = /* @__PURE__ */ new WeakSet()) {
  if (e == null) return 0;
  const n = typeof e;
  if (n === "string") return e.length * 2;
  if (n === "number") return 8;
  if (n === "boolean") return 4;
  if (n === "bigint") return 8;
  if (n === "symbol" || n === "function" || n === "undefined") return 0;
  if (typeof Buffer < "u" && Buffer.isBuffer(e) || e instanceof ArrayBuffer || ArrayBuffer.isView(e)) return e.byteLength;
  if (e instanceof Date) return 8;
  if (typeof e == "object") {
    if (t.has(e)) return 0;
    if (t.add(e), Array.isArray(e)) {
      let o = 24;
      for (const i of e) o += Ne(i, t);
      return o;
    }
    let r = 32;
    for (const [o, i] of Object.entries(e))
      r += o.length * 2, r += Ne(i, t);
    return r;
  }
  return 0;
}
function ec(e, t, n, r, o, i, a, s, u, l, h) {
  const f = e.__persistSecretBranchDebug;
  if (!f?.enabled) return;
  const d = f.window ?? (f.window = Er()), p = Ne(t), m = Ne(n), b = Ne(r), S = Ne(o);
  d.writes += 1, i && (d.columnarWrites += 1), d.maxBranchBytes = Math.max(d.maxBranchBytes, p), d.maxCacheSeedBytes = Math.max(d.maxCacheSeedBytes, m), d.maxEncryptableBytes = Math.max(d.maxEncryptableBytes, b), d.maxBlobBytes = Math.max(d.maxBlobBytes, S), d.totalColumnarMaterializeMs += l, d.totalPrepareColumnarMs += h, d.totalKeyDeriveMs += a, d.totalEncryptMs += s, d.totalSetBlobMs += u, d.maxColumnarMaterializeMs = Math.max(d.maxColumnarMaterializeMs, l), d.maxPrepareColumnarMs = Math.max(d.maxPrepareColumnarMs, h), d.maxKeyDeriveMs = Math.max(d.maxKeyDeriveMs, a), d.maxEncryptMs = Math.max(d.maxEncryptMs, s), d.maxSetBlobMs = Math.max(d.maxSetBlobMs, u);
}
function Xr(e, t, n, r) {
  const o = e.__persistSecretBranchDebug;
  if (!o?.enabled) return;
  const i = o.window ?? (o.window = Er());
  i.totalLoadChunkMs += t, i.totalMaterializeMs += n, i.totalCloneMs += r, i.maxLoadChunkMs = Math.max(i.maxLoadChunkMs, t), i.maxMaterializeMs = Math.max(i.maxMaterializeMs, n), i.maxCloneMs = Math.max(i.maxCloneMs, r);
}
function ji(e, t, n) {
  e.has(t) && e.delete(t), e.set(t, n);
}
function tc(e, t) {
  for (; e.size > t; ) {
    const n = e.keys().next();
    if (n.done) return;
    e.delete(n.value);
  }
}
function nc(e) {
  const t = Number(e.__writeBranchCacheConfig?.limit);
  return Number.isFinite(t) && t > 0 ? Math.floor(t) : 8;
}
function $i(e) {
  return e.__writeBranchCacheConfig?.enabled === !0;
}
function Yr(e, t, n) {
  const r = e.__persistSecretBranchDebug;
  if (!r?.enabled) return;
  const o = r.window ?? (r.window = Er());
  t ? (o.writeCacheHits += 1, o.totalWriteCacheHitMs += n, o.maxWriteCacheHitMs = Math.max(o.maxWriteCacheHitMs, n)) : o.writeCacheMisses += 1;
}
function rc(e, t, n, r) {
  if (!$i(e)) return;
  const o = V(), i = `${t.join(".")}::${n}`, a = e.writeBranchCache.get(i);
  if (a && a.epoch === e.secretEpoch && a.blob === r)
    return ji(e.writeBranchCache, i, a), Yr(e, !0, V() - o), a.data;
  Yr(e, !1, 0);
}
function oc(e, t, n, r, o) {
  if (!$i(e)) return;
  const i = `${t.join(".")}::${n}`;
  ji(e.writeBranchCache, i, {
    epoch: e.secretEpoch,
    blob: r,
    data: o
  }), tc(e.writeBranchCache, nc(e));
}
function ic(e, t, n) {
  const o = K(t).join(".");
  e.localSecrets[o] = n, e._ownerScope = n;
}
function ac(e, t) {
  const n = G(t ?? {}), r = String(n.path || "").split(".").filter(Boolean);
  if (n.operator === "_") {
    e.postulate([...r, "_"], typeof n.expression == "string" ? n.expression : "***");
    return;
  }
  if (n.operator === "~") {
    e.postulate([...r, "~"], typeof n.expression == "string" ? n.expression : "***");
    return;
  }
  if (n.operator === "@") {
    const o = n.expression && n.expression.__id || n.value && n.value.__id || n.value;
    typeof o == "string" && o.length > 0 && e.postulate([...r, "@"], o);
    return;
  }
  if (n.operator === "__" || n.operator === "->") {
    const o = n.expression && n.expression.__ptr || n.value && n.value.__ptr || n.value;
    typeof o == "string" && o.length > 0 && e.postulate([...r, "__"], o);
    return;
  }
  if (n.operator === "-") {
    e.removeSubtree(r);
    return;
  }
  if (n.operator === "=" || n.operator === "?") {
    e.postulate(r, n.value, n.operator);
    return;
  }
  e.postulate(r, n.expression, n.operator ?? null);
}
function sc(e, t) {
  e.localSecrets = {}, e.localNoises = {}, e.branchStore.clear(), e.keySpaces = {}, e._ownerScope = null, e._currentCallerScope = void 0, Ve(e), e.index = {}, e._memories = [], e.derivations = {}, e.refSubscribers = {}, e.refVersions = {}, e.derivationRefVersions = {}, e.staleDerivations.clear(), e.lastRecomputeWaveByTarget = {}, e.activeRecomputeWave = null;
  for (const n of Ii(t || [])) {
    const r = String(n.path || "").split(".").filter(Boolean);
    if (n.operator === "_") {
      e.postulate([...r, "_"], typeof n.expression == "string" ? n.expression : "***");
      continue;
    }
    if (n.operator === "~") {
      e.postulate([...r, "~"], typeof n.expression == "string" ? n.expression : "***");
      continue;
    }
    if (n.operator === "@") {
      const o = n.expression && n.expression.__id || n.value && n.value.__id || n.value;
      typeof o == "string" && o.length > 0 && e.postulate([...r, "@"], o);
      continue;
    }
    if (n.operator === "__" || n.operator === "->") {
      const o = n.expression && n.expression.__ptr || n.value && n.value.__ptr || n.value;
      typeof o == "string" && o.length > 0 && e.postulate([...r, "__"], o);
      continue;
    }
    if (n.operator === "-") {
      e.removeSubtree(r);
      continue;
    }
    if (n.operator === "=" || n.operator === "?") {
      e.postulate(r, n.value, n.operator);
      continue;
    }
    e.postulate(r, n.expression, n.operator);
  }
  e.rebuildIndex();
}
function An(e, t, n, r, o) {
  const i = t.join("."), a = oe(e, t), s = bn(e), u = JSON.stringify({
    path: i,
    operator: n,
    expression: r,
    value: o,
    effectiveSecret: a,
    prevHash: s
  }), l = se(u), h = Date.now(), f = {
    path: i,
    operator: n,
    expression: r,
    value: o,
    effectiveSecret: a,
    hash: l,
    prevHash: s,
    timestamp: h
  };
  return e._memories.push(f), e.applyMemoryToIndex(f), f;
}
function cc(e) {
  const t = e[0], n = e[e.length - 1], r = e.length > 2 ? e[Math.floor(e.length / 2)] : null;
  return se(JSON.stringify({
    count: e.length,
    firstId: t?.id ?? null,
    lastId: n?.id ?? null,
    middleId: r?.id ?? null
  }));
}
function uc(e, t, n, r, o) {
  const i = "commitIndexedBatch", a = oe(e, t), s = bn(e), u = Date.now(), l = {
    basePath: t.join("."),
    startIndex: n,
    count: r.length,
    batchHash: cc(r),
    firstId: r[0]?.id ?? null,
    lastId: r[r.length - 1]?.id ?? null
  }, h = JSON.stringify({
    path: i,
    operator: o,
    expression: l,
    value: l,
    effectiveSecret: a,
    prevHash: s
  }), f = se(h), d = {
    path: i,
    operator: o,
    expression: l,
    value: l,
    effectiveSecret: a,
    hash: f,
    prevHash: s,
    timestamp: u
  };
  return e._memories.push(d), e.applyMemoryToIndex(d), d;
}
function Li(e, t, n, r) {
  let o = {};
  const i = Bn(e, t, r);
  if (i) {
    const f = rc(e, t, r, i);
    if (f && typeof f == "object") {
      const d = V(), p = G(f), m = V() - d;
      return Xr(e, 0, 0, m), p;
    }
  }
  const a = V(), s = ge(e, t, n, r), u = V() - a;
  let l = 0, h = 0;
  if (s && typeof s == "object") {
    const f = V(), d = hi(s);
    if (l = V() - f, d && typeof d == "object") {
      const p = V();
      o = G(d), h = V() - p;
    }
  }
  return Xr(e, u, l, h), o;
}
function Vi(e) {
  return !!e && typeof e == "object" && !Array.isArray(e) && Object.keys(e).length === 0;
}
function Ar(e, t, n, r, o, i = !0) {
  const a = Array.isArray(o) && Es(o);
  let s = 0, u = 0, l = o, h = o;
  if (a) {
    const g = V();
    l = As(o), s = V() - g;
    const k = V();
    h = Ds(l), u = V() - k;
  }
  let f = 0;
  const d = V(), p = e.secretBlobVersion === "v2" ? ir(h, n, t) : (() => {
    const g = V(), k = wn(e, t, "branch");
    return f = V() - g, or(h, k);
  })(), m = V() - d, b = V();
  yi(e, t, r, p, n);
  const S = V() - b;
  oc(e, t, r, p, o), ec(
    e,
    o,
    l,
    h,
    p,
    a,
    f,
    m,
    S,
    s,
    u
  ), i && Vs(e, t, r, l);
}
function lc(e, t, n, r, o, i = !0) {
  if (!n || o.length === 0) return;
  let a = Li(e, t, n, r);
  Vi(a) && (a = cn(o[0]?.rel ?? []));
  for (const { rel: s, value: u } of o) {
    if (s.length === 0) {
      if (typeof a != "object" || a === null) continue;
      a.expression = u;
      continue;
    }
    kn(a, s, u);
  }
  Ar(e, t, n, r, a, i);
}
function fc(e, t, n, r, o = null) {
  if (!Array.isArray(r) || r.length === 0) return [];
  const i = /* @__PURE__ */ new Map();
  let a = [];
  for (let u = 0; u < r.length; u++) {
    const l = n + u, h = [...t, String(l)], f = Ae(e, h);
    if (!f || f.length === 0) {
      ke(e, h, r[u], o), a.push(h);
      continue;
    }
    const d = oe(e, f);
    if (!d) {
      ke(e, h, r[u], o), a.push(h);
      continue;
    }
    const p = ze(e, h, f), m = Mn(e, h, f), b = `${f.join(".")}::${p}`;
    let S = i.get(b);
    S || (S = { scope: f, scopeSecret: d, chunkId: p, relEntries: [] }, i.set(b, S)), S.relEntries.push({ rel: m, value: r[u] }), a.push(h);
  }
  for (const u of i.values())
    lc(e, u.scope, u.scopeSecret, u.chunkId, u.relEntries, !1);
  for (const u of a)
    fn(e, u);
  return [uc(e, t, n, r, o ?? "batch_set")];
}
function ke(e, t, n, r = null) {
  let o = n;
  const i = t.join("."), a = oe(e, t), s = Ae(e, t);
  if (s && s.length === 0 && e.localSecrets[""] && e.localSecrets[i], s && s.length > 0) {
    const u = oe(e, s), l = Mn(e, t, s), h = ze(e, t, s);
    let f = cn(l);
    u && (f = Li(e, s, u, h), Vi(f) && (f = cn(l))), l.length === 0 ? ((typeof f != "object" || f === null) && (f = {}), f.expression = n) : kn(f, l, n), u && Ar(e, s, u, h, f), o = n;
  } else if (a) {
    const u = r !== "=" && r !== "?";
    xe(n) || Xe(n) || !u ? o = n : o = e.secretBlobVersion === "v2" ? ir(n, a, t) : or(n, wn(e, t, "value"));
  } else
    o = n;
  return An(e, t, r, n, o);
}
function zi(e, t, n = null) {
  switch (t.op) {
    case "set":
      return ke(e, t.path, t.value, n);
    case "ptr":
      return ke(e, t.path, t.value, "__");
    case "id":
      return ke(e, t.path, t.value, "@");
    case "secret": {
      if (typeof t.value != "string") return;
      const r = K(t.path);
      return ic(e, r, t.value), Ve(e), An(e, r, "_", "***", "***");
    }
    default:
      return;
  }
}
function ve(e, t, n, r = null) {
  const o = t, i = lr(o, n);
  if (i) {
    e.operators[i.op] = { kind: i.kind };
    return;
  }
  const { leaf: a } = ie(o), s = a ? e.opKind(a) : null;
  if (s === null || s === "secret" || s === "pointer" || s === "identity") {
    const m = Zs(e.operators, { path: o, expression: n });
    if (m.kind === "commit") {
      const b = /* @__PURE__ */ new Set(["set", "secret", "ptr", "id"]);
      if (m.instructions.every((g) => b.has(g.op))) {
        let g;
        const k = [];
        for (const M of m.instructions) {
          const w = zi(e, M, r);
          if (w) {
            if (M.op === "id" && M.path.length === 0 && Xe(M.value)) {
              const D = e[Cr];
              typeof D == "function" && D(M.value.__id);
            }
            g = w, k.push(w.path.split(".").filter(Boolean));
          }
        }
        if (g) {
          for (const M of k) fn(e, M);
          return g;
        }
      }
    }
  }
  const l = hr(e.operators, o, n);
  if (l) {
    if (l.mode === "thunk") {
      const g = l.thunk();
      return l.targetPath.length === 0 ? g : ve(e, l.targetPath, g, "=");
    }
    if (_o(l.targetPath)) {
      const g = Ci(e, l.targetPath);
      let k;
      for (const M of g) {
        const w = K(Do(l.targetPath, M)), D = K([...w, l.name]), R = Po(l.expr, M);
        rn(e, D, w, R);
        const O = Fe(e, w, R);
        k = ve(e, D, O.ok ? O.value : R, "=");
      }
      return k;
    }
    if (Di(e, l.targetPath)) {
      const g = Pi(e, l.targetPath);
      let k;
      for (const M of g) {
        const w = K(M), D = K([...w, l.name]);
        rn(e, D, w, l.expr);
        const R = Fe(e, w, l.expr);
        k = ve(e, D, R.ok ? R.value : l.expr, "=");
      }
      return k;
    }
    const m = K([...l.targetPath, l.name]), b = K(l.targetPath);
    rn(e, m, b, l.expr);
    const S = Fe(e, b, l.expr);
    return S.ok ? ve(e, m, S.value, "=") : ve(e, m, l.expr, "=");
  }
  const h = dr(e.operators, o, n);
  if (h) {
    const m = h.paths.map((S) => e.readPath(S.split(".").filter(Boolean))), b = h.fn ? h.fn(...m) : m;
    return h.targetPath.length === 0 ? b : ve(e, h.targetPath, b, "?");
  }
  const f = pr(e.operators, o, n);
  if (f) {
    e.removeSubtree(f.targetPath);
    return;
  }
  const d = fr(e.operators, o, n);
  if (d) {
    e.localNoises[d.scopeKey] = n, Ve(e);
    const m = d.scopeKey ? d.scopeKey.split(".").filter(Boolean) : [];
    return An(e, m, "~", "***", "***");
  }
  const p = ke(e, o, n, r);
  return fn(e, o), p;
}
function hc(e, t) {
  Fi(e, t);
  let n = !1;
  const r = t.join(".");
  for (const f of Object.keys(e.localSecrets)) {
    if (r === "") {
      delete e.localSecrets[f], n = !0;
      continue;
    }
    (f === r || f.startsWith(r + ".")) && (delete e.localSecrets[f], n = !0);
  }
  for (const f of Object.keys(e.localNoises)) {
    if (r === "") {
      delete e.localNoises[f], n = !0;
      continue;
    }
    (f === r || f.startsWith(r + ".")) && (delete e.localNoises[f], n = !0);
  }
  n && Ve(e);
  for (const f of e.branchStore.listScopes()) {
    if (r === "") {
      e.branchStore.deleteScope(f), Ze(e, f);
      continue;
    }
    if (f === r || f.startsWith(r + ".")) {
      e.branchStore.deleteScope(f), Ze(e, f);
      continue;
    }
    const d = f.split(".").filter(Boolean);
    if (!vn(t, d) || t.length <= d.length) continue;
    const p = oe(e, d);
    if (!p) continue;
    const m = ze(e, t, d);
    let b = ge(e, d, p, m), S = m;
    if (!b && m !== "default" && (b = ge(e, d, p, "default"), S = "default"), !b || typeof b != "object") continue;
    b = G(hi(b));
    const g = t.slice(d.length);
    let k = b;
    for (let M = 0; M < g.length - 1; M++) {
      const w = g[M];
      if (!k || typeof k != "object" || !(w in k)) {
        k = null;
        break;
      }
      k = k[w];
    }
    k && typeof k == "object" && (delete k[g[g.length - 1]], Ar(e, d, p, S, b));
  }
  const o = t.join("."), i = Date.now(), a = oe(e, t), s = bn(e), u = JSON.stringify({
    path: o,
    operator: "-",
    expression: "-",
    value: "-",
    effectiveSecret: a,
    prevHash: s
  }), l = se(u), h = {
    path: o,
    operator: "-",
    expression: "-",
    value: "-",
    effectiveSecret: a,
    hash: l,
    prevHash: s,
    timestamp: i
  };
  e._memories.push(h), e.applyMemoryToIndex(h);
}
function dc(e) {
  const t = Object.values(e);
  return t.length > 0 ? t[t.length - 1] : null;
}
function pc(e) {
  return G({
    memories: Sr(e._memories),
    localSecrets: e.localSecrets,
    localNoises: e.localNoises,
    encryptedBranches: e.branchStore.exportData(),
    keySpaces: e.keySpaces,
    operators: e.operators
  });
}
function _r(e, t) {
  const n = G(t ?? {});
  e._memories = Array.isArray(n.memories) ? Ii(n.memories) : [], e.localSecrets = n.localSecrets && typeof n.localSecrets == "object" ? n.localSecrets : {}, e.localNoises = n.localNoises && typeof n.localNoises == "object" ? n.localNoises : {}, e._ownerScope = dc(e.localSecrets), e._currentCallerScope = void 0, Ve(e), e.branchStore.importData(
    n.encryptedBranches && typeof n.encryptedBranches == "object" ? n.encryptedBranches : {}
  ), e.keySpaces = n.keySpaces && typeof n.keySpaces == "object" ? n.keySpaces : {}, e.derivations = {}, e.refSubscribers = {}, e.refVersions = {}, e.derivationRefVersions = {}, e.staleDerivations.clear(), e.lastRecomputeWaveByTarget = {}, e.activeRecomputeWave = null;
  const r = Ko();
  e.operators = n.operators && typeof n.operators == "object" ? { ...r, ...n.operators } : r, e.rebuildIndex();
}
function mc(e, t) {
  _r(e, t);
}
function yc(e, t) {
  _r(e, t);
}
const gc = 128;
function Zr(e, t) {
  let n = e;
  for (const r of t) {
    const o = Number(r);
    if (n && typeof n == "object" && n.__columnar === !0 && Number.isInteger(o) && o >= 0 && String(o) === r) {
      n = $s(n, o);
      continue;
    }
    if (!n || typeof n != "object") return;
    n = n[r];
  }
  return n;
}
function Ui(e, t, n) {
  e.has(t) && e.delete(t), e.set(t, n);
}
function xc(e, t) {
  for (; e.size > t; ) {
    const n = e.keys().next();
    if (n.done) return;
    e.delete(n.value);
  }
}
function Xn(e) {
  return e && typeof e == "object" ? G(e) : e;
}
function bc(e, t, n) {
  const r = t.join("."), o = e.decryptedValueCache.get(r);
  if (o && o.epoch === e.secretEpoch && o.blob === n)
    return Ui(e.decryptedValueCache, r, o), Xn(o.data);
}
function Sc(e, t, n, r) {
  const o = t.join("."), i = Xn(r);
  return Ui(e.decryptedValueCache, o, {
    epoch: e.secretEpoch,
    blob: n,
    data: i
  }), xc(e.decryptedValueCache, gc), Xn(i);
}
function vc(e, t) {
  const n = t?.last, r = typeof n == "number" && Number.isFinite(n) && n > 0 ? e._memories.slice(-Math.floor(n)) : e._memories.slice();
  return {
    memories: Sr(r),
    index: { ...e.index },
    encryptedScopes: e.branchStore.listScopes(),
    secretScopes: Object.keys(e.localSecrets),
    noiseScopes: Object.keys(e.localNoises),
    recomputeMode: e.recomputeMode,
    staleDerivations: e.staleDerivations.size
  };
}
function wc(e, t, n) {
  const r = Ho(e, t);
  switch (r.namespace) {
    case "self":
      return Ti(e, r.operation, r.path, n);
    case "kernel":
      return Fo(e, r.operation, r.path, n);
    default:
      throw new Error(
        `External me target "${r.namespace}" must be resolved by cleaker or monad.ai before reaching the local kernel.`
      );
  }
}
function Ti(e, t, n, r) {
  const o = vi(n);
  if (o.isKeySpace)
    return Si(e, t, o.keyId, r);
  const i = cr(n);
  switch (t) {
    case "read":
      return e.readPath(i.parts);
    case "write":
      if (!i.key) throw new Error("self:write requires a semantic path.");
      if (r === void 0) throw new Error("self:write requires a body payload.");
      return e.postulate(i.parts, r);
    case "inspect":
      return Wi(e, i.key);
    case "explain":
      if (!i.key) throw new Error("self:explain requires a semantic path.");
      return e.explain(i.key);
    default:
      throw new Error(`Unsupported self operation: ${t}`);
  }
}
function Wi(e, t) {
  const n = e.inspect();
  if (!t) return n;
  const r = (o) => o === t || o.startsWith(t + ".");
  return {
    path: t,
    value: e.readPath(t.split(".").filter(Boolean)),
    memories: n.memories.filter((o) => r(o.path)),
    index: Object.fromEntries(
      Object.entries(n.index).filter(([o]) => r(o))
    ),
    encryptedScopes: n.encryptedScopes.filter(r),
    secretScopes: n.secretScopes.filter(r),
    noiseScopes: n.noiseScopes.filter(r),
    recomputeMode: n.recomputeMode,
    staleDerivations: n.staleDerivations
  };
}
function Mc(e, t) {
  const n = Ei(e, t);
  if (n !== void 0) return n;
  const r = Ai(e, t);
  if (r !== void 0) return r;
  const o = K(t);
  if (e.recomputeMode === "lazy") {
    const d = o.join(".");
    e.derivations[d] && e.ensureTargetFresh(d);
  }
  const i = _i(e, o);
  if (i !== void 0) return i;
  const a = Ae(e, o);
  if (a && a.length > 0 && vn(o, a)) {
    if (o.length === a.length) return;
    const d = oe(e, a);
    if (!d) return null;
    const p = ze(e, o, a), m = o.slice(a.length), b = Mn(e, o, a), S = Ls(e, o, a);
    let g = ge(e, a, d, p), k = b, M = !1;
    if (!g && S && S !== p && (g = ge(e, a, d, S), k = m, M = !0), !g && p !== "default" && (g = ge(e, a, d, "default")), !g) return;
    let w = Zr(g, k);
    if (w === void 0 && S && S !== p && !M) {
      const D = ge(e, a, d, S);
      D && (w = Zr(D, m));
    }
    return w === void 0 ? void 0 : xe(w) ? e.readPath(w.__ptr.split(".").filter(Boolean)) : Xe(w) || w && typeof w == "object" ? G(w) : w;
  }
  const s = un(e, o);
  if (xe(s)) return s;
  const u = bi(e, o), l = u.raw;
  if (l === void 0)
    return u.path.length === o.length && u.path.every((p, m) => p === o[m]) ? void 0 : e.readPath(u.path);
  if (xe(l)) return e.readPath(l.__ptr.split(".").filter(Boolean));
  if (Xe(l) || !Ta(l)) return l;
  if (rr(l) === "v3")
    try {
      const d = bc(e, o, l);
      if (d !== void 0) return d;
      const p = wn(e, o, "value"), m = Mo(l, p);
      return m == null ? m : Sc(e, o, l, m);
    } catch {
      return null;
    }
  const f = oe(e, o);
  return f ? ar(l, f, o) : null;
}
function Dr() {
  return {
    appendCalls: 0,
    readCalls: 0,
    flushCalls: 0,
    totalRecordStringifyMs: 0,
    totalAppendMs: 0,
    totalReadMs: 0,
    totalFlushMs: 0,
    maxRecordStringifyMs: 0,
    maxAppendMs: 0,
    maxReadMs: 0,
    maxFlushMs: 0,
    maxBlobBytes: 0,
    maxRecordBytes: 0,
    maxAppendResidentBytes: 0,
    maxReadBufferBytes: 0,
    maxReadResidentBytes: 0,
    maxFlushIndexBytes: 0,
    maxAppendHeapDelta: 0,
    maxAppendExternalDelta: 0,
    maxAppendArrayBuffersDelta: 0,
    maxReadHeapDelta: 0,
    maxReadExternalDelta: 0,
    maxReadArrayBuffersDelta: 0,
    maxFlushHeapDelta: 0,
    maxFlushExternalDelta: 0,
    maxFlushArrayBuffersDelta: 0
  };
}
function he() {
  return typeof performance < "u" && typeof performance.now == "function" ? performance.now() : Date.now();
}
const re = {
  enabled: !1,
  window: Dr()
};
function Ie() {
  const e = typeof process < "u" ? process : null, t = e?.memoryUsage;
  if (typeof t != "function")
    return {
      heapUsed: 0,
      external: 0,
      arrayBuffers: 0
    };
  const n = t.call(e);
  return {
    heapUsed: n.heapUsed ?? 0,
    external: n.external ?? 0,
    arrayBuffers: n.arrayBuffers ?? 0
  };
}
function Re(e) {
  const t = String(e ?? "");
  return typeof Buffer < "u" ? Math.max(t.length * 2, Buffer.byteLength(t, "utf8")) : t.length * 2;
}
function ae(e, t) {
  return Math.max(0, e - t);
}
function kc(e = !0) {
  re.enabled = e, re.window = Dr();
}
function Bc() {
  const e = { ...re.window };
  return re.window = Dr(), e;
}
function Qr(e) {
  const n = (typeof process < "u" ? process : null)?.getBuiltinModule;
  if (typeof n == "function")
    return n(e);
}
function Hi(e) {
  return typeof e == "string" ? e : { ...e };
}
function eo(e) {
  const t = {};
  for (const [n, r] of Object.entries(e || {}))
    t[n] = Hi(r);
  return t;
}
function Cc(e) {
  return Math.max(64, e.length * 2);
}
class Ec {
  constructor(t) {
    this.maxBytes = t, this.entries = /* @__PURE__ */ new Map(), this.usedBytes = 0;
  }
  get(t) {
    const n = this.entries.get(t);
    if (n)
      return this.entries.delete(t), this.entries.set(t, n), n.blob;
  }
  set(t, n) {
    const r = Cc(n), o = this.entries.get(t);
    o && (this.usedBytes -= o.bytes, this.entries.delete(t)), !(r > this.maxBytes) && (this.trimFor(r), this.entries.set(t, { blob: n, bytes: r }), this.usedBytes += r);
  }
  delete(t) {
    const n = this.entries.get(t);
    n && (this.usedBytes -= n.bytes, this.entries.delete(t));
  }
  deleteByPrefix(t) {
    for (const n of Array.from(this.entries.keys()))
      n.startsWith(t) && this.delete(n);
  }
  clear() {
    this.entries.clear(), this.usedBytes = 0;
  }
  getStats() {
    return {
      entries: this.entries.size,
      usedBytes: this.usedBytes,
      maxBytes: this.maxBytes
    };
  }
  trimFor(t) {
    for (; this.usedBytes + t > this.maxBytes && this.entries.size > 0; ) {
      const n = this.entries.keys().next();
      if (n.done) return;
      this.delete(n.value);
    }
  }
}
class Ji {
  constructor() {
    this.kind = "memory", this.data = {};
  }
  getScope(t) {
    return this.data[t];
  }
  getScopeMode(t) {
    const n = this.data[t];
    return n ? typeof n == "string" ? "legacy" : "chunks" : "none";
  }
  getAuxiliaryPath(t) {
    return null;
  }
  setScope(t, n) {
    this.data[t] = Hi(n);
  }
  deleteScope(t) {
    delete this.data[t];
  }
  listScopes() {
    return Object.keys(this.data);
  }
  getChunk(t, n) {
    const r = this.data[t];
    if (r)
      return typeof r == "string" ? n === "default" ? r : void 0 : r[n];
  }
  setChunk(t, n, r) {
    const o = this.data[t];
    if (!o) {
      this.data[t] = { [n]: r };
      return;
    }
    if (typeof o == "string") {
      const i = { default: o };
      i[n] = r, this.data[t] = i;
      return;
    }
    o[n] = r;
  }
  listChunks(t) {
    const n = this.data[t];
    return n ? typeof n == "string" ? ["default"] : Object.keys(n) : [];
  }
  deleteChunk(t, n) {
    const r = this.data[t];
    if (r) {
      if (typeof r == "string") {
        n === "default" && delete this.data[t];
        return;
      }
      delete r[n], Object.keys(r).length === 0 && delete this.data[t];
    }
  }
  clear() {
    this.data = {};
  }
  exportData() {
    return eo(this.data);
  }
  importData(t) {
    this.data = eo(t);
  }
  view() {
    return this.data;
  }
  close() {
  }
}
class Ac {
  constructor(t, n = 4e8) {
    this.kind = "disk", this.index = {}, this.writesSinceFlush = 0;
    const r = typeof t == "string" ? { baseDir: t, maxHotBytes: n } : t, o = Qr("node:fs"), i = Qr("node:path");
    if (!o || !i)
      throw new Error("DiskStore requires a Node.js runtime.");
    this.fs = o, this.path = i, this.baseDir = r.baseDir, this.logPath = i.join(r.baseDir, "branch-store.log"), this.indexPath = i.join(r.baseDir, "branch-store.index.json"), this.flushEvery = Math.max(1, Math.floor(r.flushEvery ?? 32)), this.hot = new Ec(Math.max(1, Math.floor(r.maxHotBytes ?? 4e8))), o.mkdirSync(this.baseDir, { recursive: !0 }), this.logFd = o.openSync(this.logPath, "a+"), this.logSize = o.fstatSync(this.logFd).size, this.index = this.loadIndex();
  }
  getScope(t) {
    const n = this.index[t];
    if (!n) return;
    if (n.legacy) return this.readBlob(t, "default", n.legacy, "legacy");
    const r = Object.keys(n.chunks);
    if (r.length === 0) return;
    const o = {};
    for (const i of r) {
      const a = n.chunks[i], s = this.readBlob(t, i, a, "chunk");
      s !== void 0 && (o[i] = s);
    }
    return o;
  }
  getScopeMode(t) {
    const n = this.index[t];
    return n ? n.legacy ? "legacy" : "chunks" : "none";
  }
  getAuxiliaryPath(t) {
    return this.path.join(this.baseDir, t);
  }
  setScope(t, n) {
    if (typeof n == "string") {
      this.hot.deleteByPrefix(this.cacheKeyPrefix(t));
      const o = this.appendRecord({ op: "scope:set", scopeKey: t, value: n });
      this.index[t] = { legacy: o, chunks: {} }, this.hot.set(this.cacheKey(t, "default", "legacy"), n), this.maybeFlushIndex();
      return;
    }
    delete this.index[t], this.hot.deleteByPrefix(this.cacheKeyPrefix(t));
    const r = { legacy: null, chunks: {} };
    this.index[t] = r;
    for (const [o, i] of Object.entries(n)) {
      const a = this.appendRecord({ op: "chunk:set", scopeKey: t, chunkId: o, blob: i });
      r.chunks[o] = a, this.hot.set(this.cacheKey(t, o, "chunk"), i);
    }
    this.maybeFlushIndex();
  }
  deleteScope(t) {
    this.index[t] && (this.appendRecord({ op: "scope:delete", scopeKey: t }), delete this.index[t], this.hot.deleteByPrefix(this.cacheKeyPrefix(t)), this.maybeFlushIndex());
  }
  listScopes() {
    return Object.keys(this.index);
  }
  getChunk(t, n) {
    const r = this.index[t];
    if (!r) return;
    if (r.legacy)
      return n !== "default" ? void 0 : this.readBlob(t, n, r.legacy, "legacy");
    const o = r.chunks[n];
    if (o)
      return this.readBlob(t, n, o, "chunk");
  }
  setChunk(t, n, r) {
    let o = this.index[t];
    o || (o = { legacy: null, chunks: {} }, this.index[t] = o), o.legacy && (o.chunks.default = o.legacy, o.legacy = null);
    const i = this.appendRecord({ op: "chunk:set", scopeKey: t, chunkId: n, blob: r });
    o.chunks[n] = i, this.hot.set(this.cacheKey(t, n, "chunk"), r), this.maybeFlushIndex();
  }
  listChunks(t) {
    const n = this.index[t];
    return n ? n.legacy ? ["default"] : Object.keys(n.chunks) : [];
  }
  deleteChunk(t, n) {
    const r = this.index[t];
    if (!r) return;
    const o = r.legacy && n === "default" ? "legacy" : "chunk";
    this.appendRecord({ op: "chunk:delete", scopeKey: t, chunkId: n }), r.legacy && n === "default" ? r.legacy = null : delete r.chunks[n], !r.legacy && Object.keys(r.chunks).length === 0 && delete this.index[t], this.hot.delete(this.cacheKey(t, n, o)), this.maybeFlushIndex();
  }
  clear() {
    this.index = {}, this.hot.clear(), this.writesSinceFlush = 0, this.fs.closeSync(this.logFd), this.fs.writeFileSync(this.logPath, "", "utf8"), this.fs.writeFileSync(this.indexPath, "{}", "utf8"), this.logFd = this.fs.openSync(this.logPath, "a+"), this.logSize = 0;
  }
  exportData() {
    const t = {};
    for (const n of this.listScopes()) {
      const r = this.getScope(n);
      r !== void 0 && (t[n] = r);
    }
    return t;
  }
  importData(t) {
    this.clear();
    for (const [n, r] of Object.entries(t || {}))
      this.setScope(n, r);
    this.flushIndex();
  }
  view() {
    return this.exportData();
  }
  close() {
    this.flushIndex(), this.fs.closeSync(this.logFd);
  }
  getHotStats() {
    return this.hot.getStats();
  }
  getIndexStats() {
    const t = Object.keys(this.index);
    let n = 0, r = 0;
    for (const o of t) {
      const i = this.index[o];
      if (!i) continue;
      i.legacy && (r += 1);
      const a = Object.keys(i.chunks || {});
      n += a.length, r += a.length;
    }
    return {
      scopes: t.length,
      chunks: n,
      pointers: r
    };
  }
  loadIndex() {
    if (!this.fs.existsSync(this.indexPath)) return this.rebuildIndexFromLog();
    try {
      const t = JSON.parse(this.fs.readFileSync(this.indexPath, "utf8"));
      return t && typeof t == "object" ? t : {};
    } catch {
      return this.rebuildIndexFromLog();
    }
  }
  rebuildIndexFromLog() {
    if (!this.fs.existsSync(this.logPath)) return {};
    const t = this.fs.readFileSync(this.logPath, "utf8"), n = {};
    let r = 0;
    for (const o of t.split(`
`)) {
      const i = Buffer.byteLength(o + `
`), a = o.trim();
      if (!a) {
        r += i;
        continue;
      }
      try {
        const s = JSON.parse(a), u = { offset: r, length: i };
        this.applyRecord(n, s, u);
      } catch {
      }
      r += i;
    }
    return n;
  }
  appendRecord(t) {
    const n = re.enabled, r = n ? Ie() : null, o = n ? he() : 0, i = t.op === "scope:set" ? Re(t.value) : t.op === "chunk:set" ? Re(t.blob) : 0, a = n ? he() : 0, s = `${JSON.stringify(t)}
`, u = n ? he() - a : 0, l = Buffer.byteLength(s), h = {
      offset: this.logSize,
      length: l
    };
    if (this.fs.writeSync(this.logFd, s), this.logSize += l, n && r) {
      const f = Ie(), d = he() - o, p = Re(s), m = re.window;
      m.appendCalls += 1, m.totalRecordStringifyMs += u, m.totalAppendMs += d, m.maxRecordStringifyMs = Math.max(m.maxRecordStringifyMs, u), m.maxAppendMs = Math.max(m.maxAppendMs, d), m.maxBlobBytes = Math.max(m.maxBlobBytes, i), m.maxRecordBytes = Math.max(m.maxRecordBytes, p), m.maxAppendResidentBytes = Math.max(m.maxAppendResidentBytes, i + p), m.maxAppendHeapDelta = Math.max(m.maxAppendHeapDelta, ae(f.heapUsed, r.heapUsed)), m.maxAppendExternalDelta = Math.max(m.maxAppendExternalDelta, ae(f.external, r.external)), m.maxAppendArrayBuffersDelta = Math.max(
        m.maxAppendArrayBuffersDelta,
        ae(f.arrayBuffers, r.arrayBuffers)
      );
    }
    return h;
  }
  applyRecord(t, n, r) {
    switch (n.op) {
      case "scope:set":
        t[n.scopeKey] = { legacy: r, chunks: {} };
        return;
      case "scope:delete":
        delete t[n.scopeKey];
        return;
      case "chunk:set": {
        const o = t[n.scopeKey] || { legacy: null, chunks: {} };
        o.legacy && (o.chunks.default = o.legacy, o.legacy = null), o.chunks[n.chunkId] = r, t[n.scopeKey] = o;
        return;
      }
      case "chunk:delete": {
        const o = t[n.scopeKey];
        if (!o) return;
        o.legacy && n.chunkId === "default" ? o.legacy = null : delete o.chunks[n.chunkId], !o.legacy && Object.keys(o.chunks).length === 0 && delete t[n.scopeKey];
      }
    }
  }
  flushIndex() {
    const t = re.enabled, n = t ? Ie() : null, r = t ? he() : 0, o = JSON.stringify(this.index);
    if (this.fs.writeFileSync(this.indexPath, o, "utf8"), t && n) {
      const i = Ie(), a = he() - r, s = re.window;
      s.flushCalls += 1, s.totalFlushMs += a, s.maxFlushMs = Math.max(s.maxFlushMs, a), s.maxFlushIndexBytes = Math.max(s.maxFlushIndexBytes, Re(o)), s.maxFlushHeapDelta = Math.max(s.maxFlushHeapDelta, ae(i.heapUsed, n.heapUsed)), s.maxFlushExternalDelta = Math.max(s.maxFlushExternalDelta, ae(i.external, n.external)), s.maxFlushArrayBuffersDelta = Math.max(
        s.maxFlushArrayBuffersDelta,
        ae(i.arrayBuffers, n.arrayBuffers)
      );
    }
    this.writesSinceFlush = 0;
  }
  maybeFlushIndex() {
    this.writesSinceFlush += 1, this.writesSinceFlush >= this.flushEvery && this.flushIndex();
  }
  readBlob(t, n, r, o) {
    const i = this.cacheKey(t, n, o), a = this.hot.get(i);
    if (a !== void 0) return a;
    const s = re.enabled, u = s ? Ie() : null, l = s ? he() : 0, h = Buffer.alloc(r.length);
    this.fs.readSync(this.logFd, h, 0, r.length, r.offset);
    const f = h.toString("utf8").trim();
    if (!f) return;
    const d = JSON.parse(f), p = d.op === "scope:set" ? d.value : d.op === "chunk:set" ? d.blob : void 0;
    if (p !== void 0) {
      if (this.hot.set(i, p), s && u) {
        const m = Ie(), b = he() - l, S = Re(p), g = re.window;
        g.readCalls += 1, g.totalReadMs += b, g.maxReadMs = Math.max(g.maxReadMs, b), g.maxBlobBytes = Math.max(g.maxBlobBytes, S), g.maxReadBufferBytes = Math.max(g.maxReadBufferBytes, r.length), g.maxReadResidentBytes = Math.max(
          g.maxReadResidentBytes,
          r.length + Re(f) + S
        ), g.maxReadHeapDelta = Math.max(g.maxReadHeapDelta, ae(m.heapUsed, u.heapUsed)), g.maxReadExternalDelta = Math.max(g.maxReadExternalDelta, ae(m.external, u.external)), g.maxReadArrayBuffersDelta = Math.max(
          g.maxReadArrayBuffersDelta,
          ae(m.arrayBuffers, u.arrayBuffers)
        );
      }
      return p;
    }
  }
  cacheKey(t, n, r) {
    return `${t}::${r}::${n}`;
  }
  cacheKeyPrefix(t) {
    return `${t}::`;
  }
}
function _c(e = {}) {
  return {
    memory: {
      index: {},
      _memories: []
    },
    secrets: {
      localSecrets: {},
      localNoises: {},
      branchStore: e.store ?? new Ji(),
      secretBlobVersion: "v3",
      keySpaces: {},
      recipientKeyring: {},
      secretEpoch: 0,
      scopeCache: /* @__PURE__ */ new Map(),
      effectiveSecretCache: /* @__PURE__ */ new Map(),
      decryptedBranchCache: /* @__PURE__ */ new Map(),
      writeBranchCache: /* @__PURE__ */ new Map(),
      decryptedValueCache: /* @__PURE__ */ new Map(),
      v3KeyCache: /* @__PURE__ */ new Map(),
      vectorIndexes: /* @__PURE__ */ new Map(),
      secretChunkSize: 256,
      secretHashBuckets: 16
    },
    derivation: {
      derivations: {},
      refSubscribers: {},
      recomputeMode: "eager",
      refVersions: {},
      derivationRefVersions: {},
      staleDerivations: /* @__PURE__ */ new Set(),
      lastRecomputeWaveByTarget: {},
      activeRecomputeWave: null
    },
    config: {
      unsafeEval: !1,
      operators: Ko()
    }
  };
}
function Dc(e = {}) {
  const t = _c(e);
  return {
    ...t.memory,
    ...t.secrets,
    ...t.derivation,
    ...t.config
  };
}
function Pc(e) {
  const t = [];
  let n = "", r = 0, o = null;
  for (let a = 0; a < e.length; a++) {
    const s = e[a];
    if (o) {
      n += s, s === o && (o = null);
      continue;
    }
    if (s === '"' || s === "'") {
      o = s, n += s;
      continue;
    }
    if (s === "[") {
      r++, n += s;
      continue;
    }
    if (s === "]") {
      r = Math.max(0, r - 1), n += s;
      continue;
    }
    if (s === "." && r === 0) {
      const u = n.trim();
      u && t.push(u), n = "";
      continue;
    }
    n += s;
  }
  const i = n.trim();
  return i && t.push(i), t;
}
function Ic(e, t, n) {
  if (t.length === 0) {
    if (n.length === 1 && typeof n[0] == "string") {
      const h = n[0].trim(), f = h.startsWith("_") || h.startsWith("~") || h.startsWith("@"), d = h.includes("."), p = /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(h);
      if (d || f || p)
        return e.readPath(Pc(h));
    }
    if (n.length === 2 && typeof n[0] == "string" && typeof n[1] == "string") {
      const h = n[0].trim(), f = n[1].trim();
      if (/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(h) && h && f)
        return e.reseedIdentity?.(h, f), e.createProxy([]);
    }
    if (n.length === 0)
      return e.createProxy([]);
    const u = e.normalizeArgs(n), l = e.postulate([], u);
    return l !== void 0 ? l : e.createProxy([]);
  }
  const r = e.normalizeArgs(n), o = e.postulate(t, r), { scope: i, leaf: a } = e.splitPath(t), s = a ? e.opKind(a) : null;
  if (e.isMemory(o)) {
    const u = s ? i : t;
    return e.createProxy(u);
  }
  return o !== void 0 ? o : e.createProxy(t);
}
const Pr = "!";
function Yn(e, t, n) {
  const r = e._currentCallerScope;
  e._currentCallerScope = t;
  try {
    return n();
  } finally {
    e._currentCallerScope = r;
  }
}
function qi(e) {
  return e._currentCallerScope;
}
function Rc(e) {
  if (e.length !== 0)
    return e.length === 1 ? e[0] : e;
}
function X(e, t, n, r, o) {
  return {
    kind: "method",
    path: t,
    docs: r,
    signature: o,
    call: n
  };
}
function Gi(e) {
  return {
    docs: {
      kind: "runtime-surface",
      description: "Reflective runtime plane for .me. Use me['!'] to access inspection, replay, snapshots, identity, and kernel controls.",
      namespaces: ["inspect", "explain", "identity", "currentExpression", "prove", "memories", "snapshot", "runtime", "methods"]
    },
    inspect: X(
      e,
      "inspect",
      (t) => e.inspect(t),
      "Return a debug snapshot of memories, index, scopes, and recompute state.",
      "inspect(opts?: { last?: number }): { memories, index, encryptedScopes, secretScopes, noiseScopes, recomputeMode, staleDerivations }"
    ),
    explain: X(
      e,
      "explain",
      (t) => e.explain(t),
      "Explain how a derived value was computed, including dependency inputs and masking for stealth sources.",
      "explain(path: string): { path, value, expr, derivation, meta }"
    ),
    identity: X(
      e,
      "identity",
      () => e[hn],
      "Return the deterministic seed-derived identity hash together with the current active expression.",
      "identity(): { hash: string, expression: string | null }"
    ),
    currentExpression: X(
      e,
      "currentExpression",
      () => e[qn],
      "Return the current active expression selected by the root identity operator.",
      "currentExpression(): string | null"
    ),
    prove: X(
      e,
      "prove",
      (t) => e.prove(t),
      "Derive a branch-scoped Ed25519 proof for the current active expression and root namespace.",
      "prove(input: { rootNamespace: string, challenge?: string | null }): Promise<{ identityHash, expression, namespace, rootNamespace, publicKey, message, signature, timestamp }>"
    ),
    memories: {
      docs: "Memory log helpers and replay controls.",
      list: X(
        e,
        "memories.list",
        () => e.memories,
        "Return the current memory log.",
        "memories.list(): Memory[]"
      ),
      replay: X(
        e,
        "memories.replay",
        (t) => e.replayMemories(t),
        "Reset kernel state and replay a public or legacy memory log into the current kernel.",
        "memories.replay(memories: ReplayMemoryInput[]): void"
      )
    },
    snapshot: {
      docs: "Snapshot import/export helpers for full kernel state. Prefer hydrate() to restore a saved kernel.",
      export: X(
        e,
        "snapshot.export",
        () => e.exportSnapshot(),
        "Export the current kernel snapshot with public memories plus secrets, noises, encrypted branches, key spaces, and operators.",
        "snapshot.export(): Snapshot"
      ),
      hydrate: X(
        e,
        "snapshot.hydrate",
        (t) => e.hydrate(t),
        "Primary restore API. Bring a saved kernel snapshot back to life in the current runtime.",
        "snapshot.hydrate(snapshot: Snapshot): void"
      ),
      import: X(
        e,
        "snapshot.import",
        (t) => e.importSnapshot(t),
        "Compatibility alias for snapshot.hydrate() that preserves the older import-oriented naming.",
        "snapshot.import(snapshot: Snapshot): void"
      ),
      rehydrate: X(
        e,
        "snapshot.rehydrate",
        (t) => e.rehydrate(t),
        "Backward-compatible alias for snapshot.hydrate() with the older rehydrate naming.",
        "snapshot.rehydrate(snapshot: Snapshot): void"
      )
    },
    runtime: {
      docs: "Kernel execution and recomputation controls.",
      getRecomputeMode: X(
        e,
        "runtime.getRecomputeMode",
        () => e.getRecomputeMode(),
        "Return the current recomputation mode.",
        "runtime.getRecomputeMode(): 'eager' | 'lazy'"
      ),
      setRecomputeMode: X(
        e,
        "runtime.setRecomputeMode",
        (t) => e.setRecomputeMode(t),
        "Set recomputation mode for derivations.",
        "runtime.setRecomputeMode(mode: 'eager' | 'lazy'): this"
      )
    },
    methods: {
      docs: "Self-described method registry for the runtime surface.",
      inspect: null,
      explain: null,
      identity: null,
      currentExpression: null,
      prove: null,
      exportSnapshot: null,
      hydrate: null,
      importSnapshot: null,
      rehydrate: null,
      replayMemories: null,
      getRecomputeMode: null,
      setRecomputeMode: null
    }
  };
}
function Xi() {
  return {
    kind: "runtime-surface",
    escape: Pr,
    description: "Use me['!'] to enter the reflective runtime plane. This plane exposes snapshots, replay, explainability, and kernel controls.",
    namespaces: ["inspect", "explain", "identity", "currentExpression", "prove", "memories", "snapshot", "runtime", "methods"]
  };
}
function Zn(e, t) {
  const n = Gi(e);
  if (n.methods.inspect = n.inspect, n.methods.explain = n.explain, n.methods.identity = n.identity, n.methods.currentExpression = n.currentExpression, n.methods.prove = n.prove, n.methods.exportSnapshot = n.snapshot.export, n.methods.hydrate = n.snapshot.hydrate, n.methods.importSnapshot = n.snapshot.import, n.methods.rehydrate = n.snapshot.rehydrate, n.methods.replayMemories = n.memories.replay, n.methods.getRecomputeMode = n.runtime.getRecomputeMode, n.methods.setRecomputeMode = n.runtime.setRecomputeMode, t.length === 0) return n;
  let r = n;
  for (const o of t) {
    if (r == null) return;
    r = r[o];
  }
  return r;
}
function dn(e, t, n = qi(e)) {
  const r = (...o) => Yn(e, n, () => {
    const i = Zn(e, t);
    return typeof i == "function" ? i(...o) : i && typeof i == "object" && typeof i.call == "function" ? i.call(...o) : t.length === 0 && o.length === 0 ? e[hn] : t.length === 0 ? Xi() : i;
  });
  return new Proxy(r, {
    get(o, i) {
      if (typeof i == "symbol") return o[i];
      const a = String(i), s = [...t, a], u = Zn(e, s);
      if (u !== void 0)
        return u === null ? null : Array.isArray(u) ? u : typeof u == "function" || typeof u == "object" ? dn(e, s, n) : u;
    },
    apply(o, i, a) {
      return Reflect.apply(o, void 0, a);
    }
  });
}
function Qn(e, t, n = qi(e)) {
  const r = (...o) => Yn(
    e,
    n,
    () => Ic(
      {
        createProxy: (i) => Qn(e, i, n),
        normalizeArgs: (i) => e.normalizeArgs(i),
        readPath: (i) => e.readPath(i),
        postulate: (i, a) => e.postulate(i, a),
        opKind: (i) => e.opKind(i),
        splitPath: ie,
        isMemory: ms,
        reseedIdentity: (i, a) => e[Gn]?.(i, a),
        setActiveExpression: (i) => e[Cr]?.(i)
      },
      t,
      o
    )
  );
  return new Proxy(r, {
    get(o, i) {
      if (typeof i == "symbol") return o[i];
      if (i === Pr)
        return dn(e, [], n);
      if (i in e) {
        const s = e[i];
        return typeof s == "function" ? (...u) => Yn(e, n, () => s.apply(e, u)) : s;
      }
      const a = [...t, String(i)];
      return Qn(e, a, n);
    },
    apply(o, i, a) {
      return Reflect.apply(o, void 0, a);
    }
  });
}
function _n(e) {
  let t = 0;
  for (let n = 0; n < e.length; n++) t += e[n] * e[n];
  return Math.sqrt(t);
}
function Yi(e, t) {
  const n = Math.min(e.length, t.length);
  let r = 0, o = 0, i = 0;
  for (let a = 0; a < n; a++) {
    const s = e[a], u = t[a];
    r += s * u, o += s * s, i += u * u;
  }
  return o <= 0 || i <= 0 ? 0 : r / (Math.sqrt(o) * Math.sqrt(i));
}
function Zi(e, t, n, r, o = _n(e)) {
  let i = 0, a = 0;
  for (let s = 0; s < r; s++) {
    const u = e[s], l = t[n + s];
    i += u * l, a += l * l;
  }
  return o <= 0 || a <= 0 ? 0 : i / (o * Math.sqrt(a));
}
function Ir(e) {
  const t = _n(e);
  if (t <= 0) return Float32Array.from(e);
  const n = new Float32Array(e.length);
  for (let r = 0; r < e.length; r++) n[r] = e[r] / t;
  return n;
}
function pn(e, t, n) {
  if (n <= 0) return;
  let r = e.length;
  for (; r > 0 && Nc(t, e[r - 1]) < 0; )
    r--;
  r >= n || (e.splice(r, 0, t), e.length > n && (e.length = n));
}
function Nc(e, t) {
  return e.score !== t.score ? t.score - e.score : e.index !== t.index ? e.index - t.index : e.path.localeCompare(t.path);
}
function Qi(e) {
  const n = (typeof process < "u" ? process : null)?.getBuiltinModule;
  if (typeof n == "function")
    return n(e);
}
function ea() {
  return Qi("node:fs");
}
function Oc() {
  return Qi("node:path");
}
function Kc(e) {
  return `${e.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "root"}.${se(e)}`;
}
function Fc(e) {
  if (typeof Buffer < "u")
    return Buffer.from(e.buffer, e.byteOffset, e.byteLength).toString("base64");
  let t = "";
  const n = new Uint8Array(e.buffer, e.byteOffset, e.byteLength);
  for (let o = 0; o < n.length; o++) t += String.fromCharCode(n[o]);
  const r = globalThis.btoa;
  if (typeof r != "function")
    throw new Error("Base64 encoding is not available in this runtime.");
  return r(t);
}
function jc(e) {
  let t;
  if (typeof Buffer < "u") {
    const r = Buffer.from(e, "base64");
    t = new Uint8Array(r.buffer, r.byteOffset, r.byteLength);
  } else {
    const r = globalThis.atob;
    if (typeof r != "function")
      throw new Error("Base64 decoding is not available in this runtime.");
    const o = r(e);
    t = new Uint8Array(o.length);
    for (let i = 0; i < o.length; i++) t[i] = o.charCodeAt(i);
  }
  const n = t.byteOffset === 0 && t.byteLength === t.buffer.byteLength ? t.buffer : t.buffer.slice(t.byteOffset, t.byteOffset + t.byteLength);
  return new Float32Array(n);
}
function Rr(e) {
  return e.join(".");
}
function ta(e, t) {
  const n = e.branchStore.getAuxiliaryPath(`vector-indexes/${Kc(Rr(t))}.json`);
  return typeof n == "string" && n.length > 0 ? n : null;
}
function na(e, t, n) {
  e.vectorIndexes.set(Rr(t), n);
}
function $c(e, t) {
  return e.vectorIndexes.get(Rr(t)) ?? null;
}
function Lc(e, t, n) {
  const r = ta(e, t);
  if (!r) return { persisted: !1, path: null };
  const o = ea(), i = Oc();
  if (!o || !i) return { persisted: !1, path: null };
  const a = {
    meta: n.meta,
    centroids: Fc(n.centroids),
    postingLists: n.postingLists
  };
  return o.mkdirSync(i.dirname(r), { recursive: !0 }), o.writeFileSync(r, JSON.stringify(a), "utf8"), { persisted: !0, path: r };
}
function Vc(e, t) {
  const n = $c(e, t);
  if (n) return n;
  const r = ta(e, t);
  if (!r) return null;
  const o = ea();
  if (!o || !o.existsSync(r)) return null;
  try {
    const i = JSON.parse(o.readFileSync(r, "utf8"));
    if (!i || typeof i != "object" || !i.meta || typeof i.centroids != "string" || !Array.isArray(i.postingLists))
      return null;
    const a = {
      meta: i.meta,
      centroids: jc(i.centroids),
      postingLists: i.postingLists.map(
        (s) => Array.isArray(s) ? s.filter((u) => u && typeof u == "object").map((u) => ({
          chunkId: String(u.chunkId ?? ""),
          count: Math.max(0, Math.floor(Number(u.count ?? 0) || 0))
        })).filter((u) => u.chunkId.length > 0 && u.count > 0) : []
      )
    };
    return na(e, t, a), a;
  } catch {
    return null;
  }
}
function de() {
  return typeof performance < "u" && typeof performance.now == "function" ? performance.now() : Date.now();
}
function zc(e, t) {
  const n = Array.isArray(t) ? t : String(t || "").split(".").filter(Boolean);
  return e.normalizeSelectorPath(n);
}
function Uc(e) {
  if (e instanceof Float32Array) return e;
  const t = new Float32Array(e.length);
  for (let n = 0; n < e.length; n++) t[n] = Number(e[n]) || 0;
  return t;
}
function ra(e, t) {
  if (e instanceof Float32Array)
    return e.length === t ? e : null;
  if (Array.isArray(e))
    return e.length !== t ? null : Float32Array.from(e.map((n) => Number(n) || 0));
  if (e && typeof e == "object") {
    const n = new Float32Array(t);
    let r = !1;
    const o = e;
    for (let i = 0; i < t; i++) {
      const a = o[String(i)];
      a !== void 0 && (r = !0), n[i] = Number(a) || 0;
    }
    return r ? n : null;
  }
  return null;
}
function oa(e) {
  return [...e].sort((t, n) => to(t) - to(n) || t.localeCompare(n));
}
function to(e) {
  const t = /^idx_(\d+)$/.exec(e);
  if (t) return Number(t[1]);
  const n = /^(\d+)_root$/.exec(e);
  return n ? Number(n[1]) : Number.MAX_SAFE_INTEGER;
}
function no(e, t, n, r, o) {
  const i = /^idx_(\d+)$/.exec(t);
  if (i) {
    const s = Number(i[1]) * o + n;
    return {
      path: [...e, String(s)].join("."),
      index: s
    };
  }
  const a = /^(\d+)_root$/.exec(t);
  if (a) {
    const s = Number(a[1]);
    return {
      path: [...e, String(s)].join("."),
      index: s
    };
  }
  return {
    path: [...e, String(r)].join("."),
    index: r
  };
}
function ia(e, t) {
  const n = zc(e, t), r = e.resolveBranchScope(n);
  if (!r || r.length === 0 || r.join(".") !== n.join("."))
    throw new Error(
      `Vector search requires a collection-scoped secret branch. Expected a secret declared exactly at "${n.join(".")}".`
    );
  const o = e.computeEffectiveSecret(n);
  if (!o)
    throw new Error(`Vector search could not resolve an effective secret for "${n.join(".")}".`);
  return { scope: n, scopeSecret: o };
}
function ro(e, t) {
  return t ? Ir(e) : Float32Array.from(e);
}
function Nr(e, t, n, r, o) {
  const i = n * r;
  if (o) {
    let l = 0;
    for (let h = 0; h < r; h++) l += e[h] * t[i + h];
    return l;
  }
  let a = 0, s = 0, u = 0;
  for (let l = 0; l < r; l++) {
    const h = e[l], f = t[i + l];
    a += h * f, s += h * h, u += f * f;
  }
  return s <= 0 || u <= 0 ? 0 : a / (Math.sqrt(s) * Math.sqrt(u));
}
function aa(e, t, n, r, o) {
  let i = 0, a = -1 / 0;
  for (let s = 0; s < n; s++) {
    const u = Nr(e, t, s, r, o);
    u > a && (a = u, i = s);
  }
  return i;
}
function oo(e, t, n, r) {
  const o = t * r;
  for (let i = 0; i < r; i++) e[o + i] = n[i];
}
function Tc(e, t, n, r, o, i) {
  const a = t * o;
  if (r <= 0) return;
  const s = new Float32Array(o);
  for (let l = 0; l < o; l++) s[l] = n[l] / r;
  const u = i ? Ir(s) : s;
  for (let l = 0; l < o; l++) e[a + l] = u[l];
}
function Wc(e, t, n, r) {
  const o = new Float32Array(t * n);
  oo(o, 0, e[0], n);
  for (let i = 1; i < t; i++) {
    let a = 0, s = -1 / 0;
    for (let u = 0; u < e.length; u++) {
      const l = e[u];
      let h = -1 / 0;
      for (let d = 0; d < i; d++)
        h = Math.max(h, Nr(l, o, d, n, r));
      const f = 1 - h;
      f > s && (s = f, a = u);
    }
    oo(o, i, e[a], n);
  }
  return o;
}
function Hc(e, t, n, r, o) {
  const i = Wc(e, t, n, o);
  for (let a = 0; a < r; a++) {
    const s = Array.from({ length: t }, () => new Float32Array(n)), u = new Uint32Array(t);
    for (const l of e) {
      const h = aa(l, i, t, n, o);
      u[h] += 1;
      const f = s[h];
      for (let d = 0; d < n; d++) f[d] += l[d];
    }
    for (let l = 0; l < t; l++)
      u[l] <= 0 || Tc(i, l, s[l], u[l], n, o);
  }
  return i;
}
function io(e, t) {
  if (e <= 0 || t <= 0) return [];
  if (t >= e) return Array.from({ length: e }, (r, o) => o);
  const n = /* @__PURE__ */ new Set();
  for (let r = 0; r < t; r++) {
    const o = Math.min(e - 1, Math.floor((r + 0.5) * e / t));
    n.add(o);
  }
  if (n.size >= t) return [...n].sort((r, o) => r - o);
  for (let r = 0; r < e && n.size < t; r++)
    n.add(r);
  return [...n].sort((r, o) => r - o);
}
function ao(e, t) {
  return e <= 0 || t <= 0 ? 1 : Math.max(1, Math.round(e / t));
}
function Jc(e, t, n, r, o, i) {
  const a = [];
  let s = 0, u = 0;
  for (const l of r) {
    const h = e.getDecryptedChunk(t, n, l);
    if (!h) continue;
    if (tt(h)) {
      const b = h.payload, S = b.embeddings, g = b.meta.dims, k = b.meta.count;
      if (!(S instanceof Float32Array) || g <= 0 || k <= 0 || (s === 0 && (s = g), g !== s)) continue;
      u += k;
      const M = io(k, i), w = ao(k, M.length), D = M.map((R) => {
        const O = R * g, I = O + g;
        return {
          vector: ro(S.subarray(O, I), o),
          weight: w
        };
      });
      D.length > 0 && a.push({
        chunkId: l,
        vectorCount: k,
        representatives: D
      });
      continue;
    }
    if (!Array.isArray(h)) continue;
    const f = [];
    for (let b = 0; b < h.length; b++) {
      const S = h[b];
      if (!S || typeof S != "object") continue;
      const g = ra(S.embedding, s || Number.MAX_SAFE_INTEGER);
      g && (s === 0 && (s = g.length), g.length === s && f.push(ro(g, o)));
    }
    if (f.length <= 0) continue;
    u += f.length;
    const d = io(f.length, i), p = ao(f.length, d.length), m = d.map((b) => ({
      vector: f[b],
      weight: p
    }));
    a.push({
      chunkId: l,
      vectorCount: f.length,
      representatives: m
    });
  }
  return { chunks: a, dims: s, totalVectors: u };
}
function qc(e, t, n, r, o, i) {
  const a = [];
  for (let s = 0; s < n; s++) {
    const u = Nr(e, t, s, r, o);
    a.push({ centroidId: s, score: u });
  }
  return a.sort((s, u) => u.score - s.score || s.centroidId - u.centroidId), a.slice(0, i);
}
function Gc(e, t, n, r, o, i) {
  const a = [], s = _n(r);
  let u = 0, l = 0, h = 0;
  for (const f of o) {
    const d = e.getDecryptedChunk(t, n, f);
    if (d) {
      if (l++, tt(d)) {
        const p = d.payload, m = p.embeddings;
        if (!(m instanceof Float32Array) || p.meta.dims <= 0 || p.meta.count <= 0) continue;
        if (r.length !== p.meta.dims)
          throw new Error(
            `searchVector dims mismatch for "${t.join(".")}": query=${r.length}, payload=${p.meta.dims}`
          );
        u = p.meta.dims;
        for (let b = 0; b < p.meta.count; b++) {
          const S = b * p.meta.dims, g = Zi(r, m, S, p.meta.dims, s);
          if (h++, g < i.minScore) continue;
          const k = p.ids?.[b] ?? b, { path: M, index: w } = no(t, f, b, k, e.secretChunkSize);
          pn(a, {
            path: M,
            score: g,
            index: w,
            id: k,
            chunkId: f,
            chunkOffset: b
          }, i.k);
        }
        continue;
      }
      if (Array.isArray(d))
        for (let p = 0; p < d.length; p++) {
          const m = d[p];
          if (!m || typeof m != "object") continue;
          const b = ra(m.embedding, r.length);
          if (!b) continue;
          const S = Yi(r, b);
          if (h++, S < i.minScore) continue;
          const g = m.id, k = typeof g == "number" && Number.isFinite(g) ? Math.floor(g) : p, { path: M, index: w } = no(t, f, p, k, e.secretChunkSize);
          pn(a, {
            path: M,
            score: S,
            index: w,
            id: k,
            chunkId: f,
            chunkOffset: p
          }, i.k);
        }
    }
  }
  return {
    dims: u,
    scannedVectors: h,
    decryptedChunks: l,
    hits: a
  };
}
function Xc(e, t, n = {}) {
  const r = de(), { scope: o, scopeSecret: i } = ia(e, t), a = oa(e.branchStore.listChunks(o.join("."))), s = Math.max(1, Math.floor(n.chunkRepresentativesPerChunk ?? 4)), u = Math.max(256, Math.floor(n.maxTrainingVectors ?? 4096)), l = n.normalize !== !1, h = Jc(
    e,
    o,
    i,
    a,
    l,
    s
  ), f = h.dims, d = h.totalVectors, p = h.chunks.flatMap((I) => I.representatives.map((N) => N.vector)), m = Math.max(1, Math.floor(p.length / u)), b = [];
  for (let I = 0; I < p.length && b.length < u; I += m)
    b.push(p[I]);
  if (f <= 0 || d <= 0 || b.length === 0)
    throw new Error(`buildVectorIndex could not find any vectors under "${o.join(".")}".`);
  const S = Math.max(1, Math.min(d, Math.min(b.length, Math.floor(n.k ?? Math.round(Math.sqrt(d)))))), g = Math.max(1, Math.min(S, Math.floor(n.nprobe ?? 3))), k = Math.max(1, Math.floor(n.iterations ?? 6)), M = Hc(b, S, f, k, l), w = Array.from({ length: S }, () => /* @__PURE__ */ new Map());
  for (const I of h.chunks)
    for (const N of I.representatives) {
      if (N.vector.length !== f) continue;
      const H = aa(N.vector, M, S, f, l);
      w[H].set(
        I.chunkId,
        (w[H].get(I.chunkId) ?? 0) + N.weight
      );
    }
  const D = w.map(
    (I) => [...I.entries()].map(([N, H]) => ({ chunkId: N, count: H })).sort((N, H) => H.count - N.count || N.chunkId.localeCompare(H.chunkId))
  ), R = {
    meta: {
      version: 1,
      scopePath: o.join("."),
      dims: f,
      k: S,
      nprobe: g,
      totalVectors: d,
      totalChunks: a.length,
      trainingVectors: b.length,
      normalize: l,
      builtAt: Date.now()
    },
    centroids: M,
    postingLists: D
  };
  na(e, o, R);
  const O = Lc(e, o, R);
  return {
    scopePath: o.join("."),
    tookMs: de() - r,
    dims: f,
    k: S,
    nprobe: g,
    totalVectors: d,
    totalChunks: a.length,
    trainingVectors: b.length,
    persisted: O.persisted,
    indexPath: O.path
  };
}
function Yc(e, t, n, r = {}) {
  const o = de(), { scope: i, scopeSecret: a } = ia(e, t), s = Vc(e, i);
  if (!s)
    throw new Error(`searchVector could not find an IVF sidecar for "${i.join(".")}". Build it first with buildVectorIndex().`);
  const u = Math.max(1, Math.floor(r.k ?? 10)), l = Math.max(1, Math.min(s.meta.k, Math.floor(r.nprobe ?? s.meta.nprobe))), h = Number.isFinite(r.minScore) ? Number(r.minScore) : -1 / 0, f = Math.max(1, Math.floor(r.maxCandidateChunks ?? Math.max(u, l * 4))), d = Uc(n);
  if (d.length !== s.meta.dims)
    throw new Error(
      `searchVector dims mismatch for "${i.join(".")}": query=${d.length}, index=${s.meta.dims}`
    );
  const p = s.meta.normalize ? Ir(d) : d, m = de(), b = qc(p, s.centroids, s.meta.k, s.meta.dims, s.meta.normalize, l), S = /* @__PURE__ */ new Map();
  for (const { centroidId: R, score: O } of b) {
    const I = s.postingLists[R] ?? [];
    for (const N of I)
      S.set(N.chunkId, (S.get(N.chunkId) ?? 0) + O * N.count);
  }
  const g = [...S.entries()].sort((R, O) => O[1] - R[1] || R[0].localeCompare(O[0])).slice(0, f).map(([R]) => R), k = de() - m, M = de(), w = Gc(e, i, a, d, oa(g), { k: u, minScore: h }), D = de() - M;
  return {
    scopePath: i.join("."),
    tookMs: de() - o,
    coarseMs: k,
    exactMs: D,
    dims: w.dims,
    k: u,
    nprobe: l,
    candidateChunks: g.length,
    decryptedChunks: w.decryptedChunks,
    scannedVectors: w.scannedVectors,
    hits: w.hits
  };
}
function so() {
  return typeof performance < "u" && typeof performance.now == "function" ? performance.now() : Date.now();
}
function Zc(e, t) {
  const n = Array.isArray(t) ? t : String(t || "").split(".").filter(Boolean);
  return e.normalizeSelectorPath(n);
}
function Qc(e) {
  if (e instanceof Float32Array) return e;
  const t = new Float32Array(e.length);
  for (let n = 0; n < e.length; n++) t[n] = Number(e[n]) || 0;
  return t;
}
function eu(e, t) {
  if (e instanceof Float32Array)
    return e.length === t ? e : null;
  if (Array.isArray(e))
    return e.length !== t ? null : Float32Array.from(e.map((n) => Number(n) || 0));
  if (e && typeof e == "object") {
    const n = new Float32Array(t);
    let r = !1;
    const o = e;
    for (let i = 0; i < t; i++) {
      const a = o[String(i)];
      a !== void 0 && (r = !0), n[i] = Number(a) || 0;
    }
    return r ? n : null;
  }
  return null;
}
function tu(e) {
  return [...e].sort((t, n) => co(t) - co(n) || t.localeCompare(n));
}
function co(e) {
  const t = /^idx_(\d+)$/.exec(e);
  if (t) return Number(t[1]);
  const n = /^(\d+)_root$/.exec(e);
  return n ? Number(n[1]) : Number.MAX_SAFE_INTEGER;
}
function uo(e, t, n, r, o) {
  const i = /^idx_(\d+)$/.exec(t);
  if (i) {
    const s = Number(i[1]) * o + n;
    return {
      path: [...e, String(s)].join("."),
      index: s
    };
  }
  const a = /^(\d+)_root$/.exec(t);
  if (a) {
    const s = Number(a[1]);
    return {
      path: [...e, String(s)].join("."),
      index: s
    };
  }
  return {
    path: [...e, String(r)].join("."),
    index: r
  };
}
function nu(e, t, n, r = {}) {
  const o = so(), i = Zc(e, t), a = e.resolveBranchScope(i);
  if (!a || a.length === 0 || a.join(".") !== i.join("."))
    throw new Error(
      `searchExact requires a collection-scoped secret branch. Expected a secret declared exactly at "${i.join(".")}".`
    );
  const s = e.computeEffectiveSecret(i);
  if (!s)
    throw new Error(`searchExact could not resolve an effective secret for "${i.join(".")}".`);
  const u = Math.max(1, Math.floor(r.k ?? 10)), l = Number.isFinite(r.minScore) ? Number(r.minScore) : -1 / 0, h = Qc(n), f = _n(h), d = tu(e.branchStore.listChunks(i.join("."))), p = [];
  let m = 0, b = 0, S = 0;
  for (const g of d) {
    const k = e.getDecryptedChunk(i, s, g);
    if (k) {
      if (b++, tt(k)) {
        const M = k.payload, w = M.embeddings;
        if (!(w instanceof Float32Array) || M.meta.dims <= 0 || M.meta.count <= 0) continue;
        if (h.length !== M.meta.dims)
          throw new Error(
            `searchExact dims mismatch for "${i.join(".")}": query=${h.length}, payload=${M.meta.dims}`
          );
        m = M.meta.dims;
        for (let D = 0; D < M.meta.count; D++) {
          const R = D * M.meta.dims, O = Zi(h, w, R, M.meta.dims, f);
          if (S++, O < l) continue;
          const I = M.ids?.[D] ?? D, { path: N, index: H } = uo(i, g, D, I, e.secretChunkSize);
          pn(p, {
            path: N,
            score: O,
            index: H,
            id: I,
            chunkId: g,
            chunkOffset: D
          }, u);
        }
        continue;
      }
      if (Array.isArray(k))
        for (let M = 0; M < k.length; M++) {
          const w = k[M];
          if (!w || typeof w != "object") continue;
          const D = w.embedding, R = eu(D, h.length);
          if (!R) continue;
          const O = Yi(h, R);
          if (S++, O < l) continue;
          const I = w.id, N = typeof I == "number" && Number.isFinite(I) ? Math.floor(I) : M, { path: H, index: _e } = uo(i, g, M, N, e.secretChunkSize);
          pn(p, {
            path: H,
            score: O,
            index: _e,
            id: N,
            chunkId: g,
            chunkOffset: M
          }, u);
        }
    }
  }
  return {
    scopePath: i.join("."),
    tookMs: so() - o,
    scannedChunks: b,
    scannedVectors: S,
    dims: m,
    hits: p
  };
}
const sa = "this.me.seed:v1", ru = "this.me/identity:v1::", { keccak256: er } = lo;
let on = null;
function ou(e) {
  let t = "";
  for (const n of e) t += n.toString(16).padStart(2, "0");
  return t;
}
function iu() {
  const e = globalThis.crypto;
  if (!e?.getRandomValues)
    throw new Error("Secure random values are required to initialize .me.");
  const t = new Uint8Array(32);
  return e.getRandomValues(t), ou(t);
}
function au(e) {
  if (e != null)
    return typeof e == "string" ? e : String(e);
}
function Kn(e) {
  return er(ru + e);
}
function su(e) {
  return String(e || "").trim().replace(/^https?:\/\//i, "").replace(/\/+$/g, "").replace(/^\.+/, "").replace(/\.+$/g, "");
}
function cu() {
  if (on !== null) return on;
  try {
    const e = globalThis.localStorage?.getItem(sa);
    if (e !== null)
      return on = e, e;
  } catch {
  }
}
function uu(e) {
  on = e;
  try {
    globalThis.localStorage?.setItem(sa, e);
  } catch {
  }
}
function lu(e) {
  const n = au(e) ?? cu() ?? iu();
  return uu(n), n;
}
var Z, ne, Y;
const we = class we {
  constructor(t, n = {}) {
    nn(this, Z);
    nn(this, ne);
    nn(this, Y);
    Q(this, Y, null), this._ownerScope = null, this._currentCallerScope = void 0, Object.assign(this, Dc(n)), Q(this, Z, lu(t)), Q(this, ne, Kn(W(this, Z))), Q(this, Y, null), this.bumpSecretEpoch(), this.rebuildIndex(), Object.defineProperty(this, Gr, {
      configurable: !0,
      enumerable: !1,
      get: () => W(this, Z)
    }), Object.defineProperty(this, qn, {
      configurable: !0,
      enumerable: !1,
      get: () => W(this, Y)
    }), Object.defineProperty(this, hn, {
      configurable: !0,
      enumerable: !1,
      get: () => ({
        hash: W(this, ne),
        expression: W(this, Y)
      })
    }), Object.defineProperty(this, Cr, {
      configurable: !0,
      enumerable: !1,
      value: (o) => {
        Q(this, Y, o);
      }
    }), Object.defineProperty(this, Gn, {
      configurable: !0,
      enumerable: !1,
      value: (o, i) => {
        Q(this, Z, er("me.seed/compound:v1::" + o + "::" + i)), Q(this, ne, Kn(W(this, Z))), Q(this, Y, o), this.bumpSecretEpoch(), this.rebuildIndex();
      }
    });
    const r = this.createProxy([]);
    return Object.setPrototypeOf(r, we.prototype), Object.assign(r, this), Object.defineProperty(r, Qs, {
      configurable: !0,
      enumerable: !1,
      value: () => ({
        seed: W(this, Z),
        expression: W(this, Y)
      })
    }), Object.defineProperty(r, Gr, {
      configurable: !0,
      enumerable: !1,
      get: () => W(this, Z)
    }), Object.defineProperty(r, qn, {
      configurable: !0,
      enumerable: !1,
      get: () => W(this, Y)
    }), Object.defineProperty(r, hn, {
      configurable: !0,
      enumerable: !1,
      get: () => ({
        hash: W(this, ne),
        expression: W(this, Y)
      })
    }), Object.defineProperty(r, Gn, {
      configurable: !0,
      enumerable: !1,
      value: (o, i) => {
        Q(this, Z, er("me.seed/compound:v1::" + o + "::" + i)), Q(this, ne, Kn(W(this, Z))), Q(this, Y, o), this.bumpSecretEpoch(), this.rebuildIndex();
      }
    }), r;
  }
  /** @internal Low-level crypto helper kept out of the main public docs surface. */
  static wrapSecretV1(t) {
    return ns(t);
  }
  /** @internal Low-level crypto helper kept out of the main public docs surface. */
  static unwrapSecretV1(t, n, r = "bytes") {
    return Eo(t, n, r);
  }
  /**
   * Public redacted memory log.
   * This never exposes internal forensic fields such as `effectiveSecret`.
   */
  get memories() {
    return Sr(this._memories);
  }
  get encryptedBranches() {
    return this.branchStore.view();
  }
  set encryptedBranches(t) {
    this.branchStore.importData(t && typeof t == "object" ? t : {});
  }
  /**
   * Inspect the current runtime state.
   * Returned memories are always public/redacted.
   */
  inspect(t) {
    return vc(this, t);
  }
  /**
   * Explain how a semantic path is derived.
   * Useful for debugging pointers, operators, and derived values.
   */
  explain(t) {
    return Xs(this, t);
  }
  /**
   * Execute a raw target string or parsed target AST without going through proxy property access.
   * Useful for tooling, explicit runtime dispatch, and tests.
   */
  execute(t, n) {
    return wc(this, t, n);
  }
  /**
   * Exact vector search over a collection-scoped secret branch backed by chunked columnar storage.
   * This is the correctness baseline used before approximate indexes such as IVF.
   */
  searchExact(t, n, r = {}) {
    return nu(this, t, n, r);
  }
  /**
   * Build an approximate IVF sidecar for a collection-scoped secret vector corpus.
   * The sidecar lives outside the kernel log and is intended to reduce chunk decrypts during search.
   */
  buildVectorIndex(t, n = {}) {
    return Xc(this, t, n);
  }
  /**
   * Approximate vector search backed by the IVF sidecar.
   * Uses centroids for coarse routing and exact scan only on the selected candidate chunks.
   */
  searchVector(t, n, r = {}) {
    return Yc(this, t, n, r);
  }
  cloneValue(t) {
    return G(t);
  }
  handleSelfTarget(t, n, r) {
    return Ti(this, t, n, r);
  }
  handleKernelTarget(t, n, r) {
    return Fo(this, t, n, r);
  }
  handleKernelRead(t) {
    return jo(this, t);
  }
  handleKernelExport(t) {
    return $o(this, t);
  }
  handleKernelImport(t, n) {
    return Lo(this, t, n);
  }
  handleKernelReplay(t, n) {
    return zo(this, t, n);
  }
  handleKernelRehydrate(t, n) {
    return Uo(this, t, n);
  }
  handleKernelGet(t) {
    return To(this, t);
  }
  handleKernelSet(t, n) {
    return Wo(this, t, n);
  }
  handleKeySpaceTarget(t, n, r) {
    return Si(this, t, n, r);
  }
  inspectAtPath(t) {
    return Wi(this, t);
  }
  parseKeySpacePath(t) {
    return vi(t);
  }
  readWrappedKey(t) {
    return gr(this, t);
  }
  writeWrappedKey(t, n) {
    return wi(this, t, n);
  }
  openWrappedKey(t, n) {
    return Mi(this, t, n);
  }
  normalizeExecutableTarget(t) {
    return Ho(this, t);
  }
  parseExecutableTarget(t) {
    return Jo(t);
  }
  splitTargetNamespace(t, n) {
    return qo(t, n);
  }
  normalizeExecutablePath(t) {
    return cr(t);
  }
  findTopLevelIndex(t, n) {
    return Ao(t, n);
  }
  /**
   * Export a portable public snapshot.
   * Snapshot memories are redacted and omit internal forensic fields.
   */
  exportSnapshot() {
    return pc(this);
  }
  /**
   * Hydrate the runtime from a snapshot payload.
   * This is the primary restore API for bringing a saved kernel back to life in memory.
   */
  hydrate(t) {
    return _r(this, t);
  }
  /**
   * Import a snapshot into the current runtime.
   * Accepts both redacted public snapshots and legacy/internal payloads.
   * Prefer `hydrate()` in user-facing code.
   */
  importSnapshot(t) {
    return mc(this, t);
  }
  /**
   * Rehydrate the runtime from a snapshot payload.
   * Backward-compatible alias for `hydrate()`.
   */
  rehydrate(t) {
    return yc(this, t);
  }
  /**
   * Replay a memory log into the current runtime.
   * Accepts both public `Memory[]` and legacy/internal memory payloads.
   */
  replayMemories(t) {
    return sc(this, t);
  }
  /**
   * Ingest a single memory-like payload into the runtime.
   * Useful for tools that already operate at the memory-log layer.
   */
  learn(t) {
    return ac(this, t);
  }
  /**
   * Derive a branch-scoped proof for the current active expression.
   * This signs a canonical payload with an Ed25519 key deterministically derived
   * from the root seed and active branch expression.
   */
  async prove(t) {
    const n = String(W(this, Y) || "").trim();
    if (!n) throw new Error("ACTIVE_EXPRESSION_REQUIRED");
    const r = su(t.rootNamespace);
    if (!r) throw new Error("ROOT_NAMESPACE_REQUIRED");
    const o = Date.now(), i = t.challenge == null ? null : String(t.challenge), a = `${n}.${r}`, s = await Ya(W(this, Z), n), { privateKey: u, publicKey: l } = await Za(s), h = {
      identityHash: W(this, ne),
      expression: n,
      namespace: a,
      rootNamespace: r,
      challenge: i,
      timestamp: o
    }, f = sn(h), d = await Qa(u, f), p = await ts(l);
    return {
      identityHash: W(this, ne),
      expression: n,
      namespace: a,
      rootNamespace: r,
      publicKey: p,
      message: f,
      signature: d,
      timestamp: o
    };
  }
  /**
   * Control whether derivations recompute eagerly or lazily.
   */
  setRecomputeMode(t) {
    return rs(this, t);
  }
  /**
   * Read the current derivation recompute mode.
   */
  getRecomputeMode() {
    return os(this);
  }
  /** @internal Low-level keyring helper kept out of the main public docs surface. */
  installRecipientKey(t, n) {
    return Ts(this, t, n);
  }
  /** @internal Low-level keyring helper kept out of the main public docs surface. */
  uninstallRecipientKey(t) {
    return Ws(this, t);
  }
  /** @internal Low-level keyring helper kept out of the main public docs surface. */
  storeWrappedKey(t, n, r) {
    return Hs(this, t, n, r);
  }
  /**
   * Re-encrypt existing secret branch chunks into blob v3.
   * This remains useful after v3 became the default write path because older snapshots
   * and mixed runtimes may still carry branch blobs in v2 or legacy layouts.
   * It only touches `encryptedBranches`; it never rewrites historical memories.
   *
   * @internal Maintenance helper for secret-blob upgrades.
   */
  migrateEncryptedBranchesToV3() {
    const t = {
      migratedScopes: 0,
      migratedChunks: 0,
      skipped: 0,
      errors: 0
    };
    for (const n of this.branchStore.listScopes()) {
      const r = n.split(".").filter(Boolean), o = this.computeEffectiveSecret(r);
      if (!o) {
        t.skipped++;
        continue;
      }
      let i = 0;
      try {
        const a = this.ensureScopeChunks(r, o), s = si(this, r, "branch");
        for (const [u, l] of Object.entries(a)) {
          if (rr(l) === "v3") {
            t.skipped++;
            continue;
          }
          const h = this.getDecryptedChunk(r, o, u);
          if (!h || typeof h != "object") {
            t.errors++;
            continue;
          }
          this.setChunkBlob(r, u, Ua(h, s, "branch", r), o), i++, t.migratedChunks++;
        }
      } catch {
        t.errors++;
      } finally {
        this.clearScopeChunkCache(n);
      }
      i > 0 && t.migratedScopes++;
    }
    return t;
  }
  bumpSecretEpoch() {
    return Ve(this);
  }
  normalizeArgs(t) {
    return Rc(t);
  }
  /**
   * Internal escape hatch for tests and controlled rollback verification.
   * Not part of the public runtime surface.
   */
  setSecretBlobVersionForTesting(t) {
    this.secretBlobVersion = t;
  }
  opKind(t) {
    return ce(this.operators, t);
  }
  isSecretScopeCall(t, n) {
    return ri(this.operators, t, n);
  }
  isNoiseScopeCall(t, n) {
    return fr(this.operators, t, n);
  }
  isPointerCall(t, n) {
    return oi(this.operators, t, n);
  }
  isIdentityCall(t, n) {
    return ii(this.operators, t, n);
  }
  isEvalCall(t, n) {
    return hr(this.operators, t, n);
  }
  isQueryCall(t, n) {
    return dr(this.operators, t, n);
  }
  isDefineOpCall(t, n) {
    return lr(t, n);
  }
  getPrevMemoryHash() {
    return bn(this);
  }
  extractExpressionRefs(t) {
    return Ni(t);
  }
  resolveRefPath(t, n) {
    return Oi(this, t, n);
  }
  unregisterDerivation(t) {
    return vr(this, t);
  }
  getRefVersion(t) {
    return En(this, t);
  }
  bumpRefVersion(t) {
    return wr(this, t);
  }
  snapshotDerivationRefVersions(t) {
    return Mr(this, t);
  }
  registerDerivation(t, n, r) {
    return rn(this, t, n, r);
  }
  recomputeTarget(t) {
    return kr(this, t);
  }
  isDerivationVersionStale(t) {
    return Ki(this, t);
  }
  ensureTargetFresh(t, n = /* @__PURE__ */ new Set()) {
    return Br(this, t, n);
  }
  invalidateFromPath(t) {
    return fn(this, t);
  }
  clearDerivationsByPrefix(t) {
    return Fi(this, t);
  }
  commitMemoryOnly(t, n, r, o) {
    return An(this, t, n, r, o);
  }
  commitValueMapping(t, n, r = null) {
    return ke(this, t, n, r);
  }
  /**
   * @internal Escape hatch for controlled benchmarks that need the real batch writer
   * without going through the semantic proxy surface.
   */
  _commitIndexedBatch(t, n, r, o = null) {
    return fc(this, t, n, r, o);
  }
  /**
   * @internal Benchmark hook: enable per-persist sizing metrics without routing
   * through the semantic proxy plane.
   */
  _enablePersistSecretBranchDebug(t = !0) {
    return this.__persistSecretBranchDebug = {
      enabled: t,
      window: {
        writes: 0,
        columnarWrites: 0,
        maxBranchBytes: 0,
        maxCacheSeedBytes: 0,
        maxEncryptableBytes: 0,
        maxBlobBytes: 0,
        totalLoadChunkMs: 0,
        totalMaterializeMs: 0,
        totalCloneMs: 0,
        totalColumnarMaterializeMs: 0,
        totalPrepareColumnarMs: 0,
        totalKeyDeriveMs: 0,
        totalEncryptMs: 0,
        totalSetBlobMs: 0,
        maxLoadChunkMs: 0,
        maxMaterializeMs: 0,
        maxCloneMs: 0,
        maxColumnarMaterializeMs: 0,
        maxPrepareColumnarMs: 0,
        maxKeyDeriveMs: 0,
        maxEncryptMs: 0,
        maxSetBlobMs: 0,
        writeCacheHits: 0,
        writeCacheMisses: 0,
        totalWriteCacheHitMs: 0,
        maxWriteCacheHitMs: 0
      }
    }, this;
  }
  /**
   * @internal Benchmark hook: drain the current persistSecretBranch window.
   */
  _takePersistSecretBranchDebugWindow() {
    const t = {
      writes: 0,
      columnarWrites: 0,
      maxBranchBytes: 0,
      maxCacheSeedBytes: 0,
      maxEncryptableBytes: 0,
      maxBlobBytes: 0,
      totalLoadChunkMs: 0,
      totalMaterializeMs: 0,
      totalCloneMs: 0,
      totalColumnarMaterializeMs: 0,
      totalPrepareColumnarMs: 0,
      totalKeyDeriveMs: 0,
      totalEncryptMs: 0,
      totalSetBlobMs: 0,
      maxLoadChunkMs: 0,
      maxMaterializeMs: 0,
      maxCloneMs: 0,
      maxColumnarMaterializeMs: 0,
      maxPrepareColumnarMs: 0,
      maxKeyDeriveMs: 0,
      maxEncryptMs: 0,
      maxSetBlobMs: 0,
      writeCacheHits: 0,
      writeCacheMisses: 0,
      totalWriteCacheHitMs: 0,
      maxWriteCacheHitMs: 0
    }, n = this.__persistSecretBranchDebug, r = n?.window ? { ...n.window } : t;
    return n && (n.window = { ...t }), r;
  }
  /**
   * @internal Benchmark hook: configure the write-path chunk cache used only by
   * mutation flows. Disabled by default.
   */
  _configureWriteBranchCache(t = !0, n = 8) {
    return this.__writeBranchCacheConfig = {
      enabled: t,
      limit: Math.max(1, Math.floor(n || 1))
    }, t || this.writeBranchCache.clear(), this;
  }
  /**
   * @internal Benchmark hook: enable blob crypto allocation telemetry.
   */
  _enableBlobCryptoDebug(t = !0) {
    return Da(t), this;
  }
  /**
   * @internal Benchmark hook: drain the current blob crypto telemetry window.
   */
  _takeBlobCryptoDebugWindow() {
    return Pa();
  }
  /**
   * @internal Benchmark hook: enable DiskStore serialization/allocation telemetry.
   */
  _enableDiskStoreDebug(t = !0) {
    return kc(t), this;
  }
  /**
   * @internal Benchmark hook: drain the current DiskStore telemetry window.
   */
  _takeDiskStoreDebugWindow() {
    return Bc();
  }
  /**
   * @internal Benchmark hook: enable getDecryptedChunk cache/decrypt metrics.
   */
  _enableDecryptedChunkDebug(t = !0) {
    return this.__decryptedChunkDebug = {
      enabled: t,
      window: {
        calls: 0,
        hits: 0,
        misses: 0,
        v2Misses: 0,
        v3Misses: 0,
        totalHitMs: 0,
        totalMissMs: 0,
        totalDecryptMs: 0,
        totalDecodeMs: 0,
        maxHitMs: 0,
        maxMissMs: 0,
        maxDecryptMs: 0,
        maxDecodeMs: 0
      }
    }, this;
  }
  /**
   * @internal Benchmark hook: drain the current getDecryptedChunk window.
   */
  _takeDecryptedChunkDebugWindow() {
    const t = {
      calls: 0,
      hits: 0,
      misses: 0,
      v2Misses: 0,
      v3Misses: 0,
      totalHitMs: 0,
      totalMissMs: 0,
      totalDecryptMs: 0,
      totalDecodeMs: 0,
      maxHitMs: 0,
      maxMissMs: 0,
      maxDecryptMs: 0,
      maxDecodeMs: 0
    }, n = this.__decryptedChunkDebug, r = n?.window ? { ...n.window } : t;
    return n && (n.window = { ...t }), r;
  }
  commitMapping(t, n = null) {
    return zi(this, t, n);
  }
  tryResolveEvalTokenValue(t, n) {
    return ki(this, t, n);
  }
  tokenizeEvalExpression(t) {
    return Bi(t);
  }
  tryEvaluateAssignExpression(t, n) {
    return Fe(this, t, n);
  }
  postulate(t, n, r = null) {
    return ve(this, t, n, r);
  }
  removeSubtree(t) {
    return hc(this, t);
  }
  computeEffectiveSecret(t) {
    return oe(this, t);
  }
  applyMemoryToIndex(t) {
    return gi(this, t);
  }
  removeIndexPrefix(t) {
    return xi(this, t);
  }
  rebuildIndex() {
    return zs(this);
  }
  getIndex(t) {
    return un(this, t);
  }
  setIndex(t, n) {
    return Us(this, t, n);
  }
  resolveIndexPointerPath(t, n = 8) {
    return bi(this, t, n);
  }
  chunkCacheKey(t, n) {
    return Ye(t, n);
  }
  clearScopeChunkCache(t) {
    return Ze(this, t);
  }
  getChunkId(t, n) {
    return ze(this, t, n);
  }
  setAtPath(t, n, r) {
    return kn(t, n, r);
  }
  flattenLeaves(t, n, r) {
    return yr(t, n, r);
  }
  migrateLegacyScopeToChunks(t, n, r) {
    return pi(this, t, n, r);
  }
  ensureScopeChunks(t, n) {
    return mi(this, t, n);
  }
  getChunkBlob(t, n) {
    return Bn(this, t, n);
  }
  setChunkBlob(t, n, r, o) {
    return yi(this, t, n, r, o);
  }
  getDecryptedChunk(t, n, r) {
    return ge(this, t, n, r);
  }
  resolveBranchScope(t) {
    return Ae(this, t);
  }
  normalizeSelectorPath(t) {
    return K(t);
  }
  pathContainsIterator(t) {
    return _o(t);
  }
  substituteIteratorInPath(t, n) {
    return Do(t, n);
  }
  substituteIteratorInExpression(t, n) {
    return Po(t, n);
  }
  collectIteratorIndices(t) {
    return Ci(this, t);
  }
  parseFilterExpression(t) {
    return Io(t);
  }
  parseLogicalFilterExpression(t) {
    return Qe(t);
  }
  compareValues(t, n, r) {
    return Ro(t, n, r);
  }
  parseLiteralOrPath(t) {
    return No(t);
  }
  resolveRelativeFirst(t, n) {
    return Hn(this, t, n);
  }
  evaluateFilterClauseForScope(t, n) {
    return Jn(this, t, n);
  }
  evaluateLogicalFilterForScope(t, n) {
    return xr(this, t, n);
  }
  collectChildrenForPrefix(t) {
    return Cn(this, t);
  }
  parseSelectorSegment(t) {
    return Se(t);
  }
  parseSelectorKeys(t) {
    return Oo(t);
  }
  parseTransformSelector(t) {
    return zn(t);
  }
  evaluateTransformPath(t) {
    return Ei(this, t);
  }
  evaluateSelectionPath(t) {
    return Ai(this, t);
  }
  buildPublicSubtree(t) {
    return br(this, t);
  }
  evaluateFilterPath(t) {
    return _i(this, t);
  }
  pathContainsFilterSelector(t) {
    return Di(this, t);
  }
  collectFilteredScopes(t) {
    return Pi(this, t);
  }
  isStealthBlocked(t, n) {
    if (n === void 0) return !1;
    const r = K(t);
    for (let o = r.length; o > 0; o--) {
      const i = r.slice(0, o).join("."), a = this.localSecrets[i];
      if (a !== void 0 && a !== n)
        return !0;
    }
    return !1;
  }
  readPath(t) {
    const n = this._currentCallerScope, r = K(t);
    if (!this.isStealthBlocked(r, n))
      return Mc(this, t);
  }
  as(t) {
    const n = this._currentCallerScope;
    this._currentCallerScope = t;
    try {
      return this.createProxy([]);
    } finally {
      this._currentCallerScope = n;
    }
  }
  withScope(t, n) {
    const r = this._currentCallerScope;
    this._currentCallerScope = t;
    try {
      return n();
    } finally {
      this._currentCallerScope = r;
    }
  }
  isRemoveCall(t, n) {
    return pr(this.operators, t, n);
  }
  createProxy(t) {
    return Qn(this, t);
  }
  describeRuntimeMethod(t, n, r, o) {
    return X(this, t, n, r, o);
  }
  buildRuntimeSurface() {
    return Gi(this);
  }
  createRuntimeProxy(t) {
    return dn(this, t);
  }
  describeRuntimeSurface() {
    return Xi();
  }
  resolveRuntimeValue(t) {
    return Zn(this, t);
  }
};
Z = new WeakMap(), ne = new WeakMap(), Y = new WeakMap(), we.RUNTIME_ESCAPE_TOKEN = Pr, we.generateP256KeyPair = Bo, we.exportP256PublicKey = Co, we.importP256PublicKey = sr;
let Be = we;
function Or(e, t) {
  return e[t] || /* @__PURE__ */ new Set();
}
function fu(e, t, n) {
  (e[t] || (e[t] = /* @__PURE__ */ new Set())).add(n);
}
function hu(e, t, n) {
  const r = e[t];
  r && (r.delete(n), r.size === 0 && delete e[t]);
}
function du() {
  return {
    data: /* @__PURE__ */ new Map(),
    deps: {},
    dependents: {},
    listeners: /* @__PURE__ */ new Map(),
    dirty: /* @__PURE__ */ new Set(),
    scheduled: !1
  };
}
function pu(e, t, n) {
  e.data.get(t) !== n && (e.data.set(t, n), ca(e, t));
}
function ca(e, t) {
  if (e.dirty.has(t)) return;
  e.dirty.add(t);
  const n = Or(e.dependents, t);
  for (const r of n)
    ca(e, r);
  mu(e);
}
function mu(e) {
  e.scheduled || (e.scheduled = !0, queueMicrotask(() => yu(e)));
}
function yu(e) {
  if (e.scheduled = !1, e.dirty.size === 0) return;
  const t = gu(e.dirty, e.deps);
  for (let n = 0; n < t.length; n++) {
    const r = t[n], o = e.data.get(r), i = e.listeners.get(r);
    if (i)
      for (const a of i) a(o);
  }
  e.dirty.clear();
}
function gu(e, t) {
  const n = [], r = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set();
  function i(a) {
    if (r.has(a) || o.has(a)) return;
    o.add(a);
    const s = Or(t, a);
    for (const u of s)
      e.has(u) && i(u);
    o.delete(a), r.add(a), n.push(a);
  }
  for (const a of e) i(a);
  return n;
}
function xu(e, t, n) {
  const r = new Set(n), o = Or(e.deps, t);
  for (const i of o)
    hu(e.dependents, i, t);
  e.deps[t] = r;
  for (const i of r)
    fu(e.dependents, i, t);
}
function bu(e, t, n) {
  e.listeners.has(t) || e.listeners.set(t, /* @__PURE__ */ new Set());
  const r = e.listeners.get(t);
  return r.add(n), () => {
    r.delete(n), r.size === 0 && e.listeners.delete(t);
  };
}
function Su(e) {
  return !!e && typeof e == "object" && !Array.isArray(e);
}
function vu(e) {
  return Su(e);
}
function wu(e) {
  return String(e || "").trim() ? Le(e) : "";
}
function Mu(e, t) {
  const n = String(t.name || "").trim();
  if (!n) return e;
  const r = Ee(n), o = String(t.displayName || n).trim() || n, i = wu(String(t.space || t.namespace || ""));
  return e["@"](r), e.profile.name(o), e.profile.username(r), i && (e.profile.rootNamespace(i), e.profile.namespace(`${r}.${i}`)), e;
}
function ua(e, t) {
  if (!vu(e))
    return new Be(e, t);
  const n = new Be(e.seed, e.options ?? t);
  return Mu(n, e);
}
function Kr(e, t) {
  return ua(e, t);
}
Object.setPrototypeOf(Kr, Be);
Kr.prototype = Be.prototype;
const T = Kr;
T.ME = Be;
T.createThisMe = ua;
T.parseMeUri = ur;
T.tryParseMeUri = ls;
T.parseCanonicalMeUri = ti;
T.formatCanonicalMeUri = Sn;
T.canonicalizeLegacyAtOperator = fs;
T.canonicalizeHumanIdentity = ni;
T.projectDnsHostToNamespace = hs;
T.normalizeCanonicalHandle = Ee;
T.normalizeCanonicalSpace = Le;
T.DiskStore = Ac;
T.MemoryStore = Ji;
T.createMe = du;
T.write = pu;
T.define = xu;
T.subscribe = bu;
T.normalizeProofMessage = sn;
T.verifyEd25519Signature = es;
export {
  Be as ME,
  ni as canonicalizeHumanIdentity,
  fs as canonicalizeLegacyAtOperator,
  ua as createThisMe,
  T as default,
  Sn as formatCanonicalMeUri,
  Ee as normalizeCanonicalHandle,
  Le as normalizeCanonicalSpace,
  sn as normalizeProofMessage,
  ti as parseCanonicalMeUri,
  ur as parseMeUri,
  hs as projectDnsHostToNamespace,
  ls as tryParseMeUri,
  es as verifyEd25519Signature
};

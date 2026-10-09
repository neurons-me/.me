var Jo = (e) => {
  throw TypeError(e);
};
var Yo = (e, t, n) => t.has(e) || Jo("Cannot " + n);
var H = (e, t, n) => (Yo(e, t, "read from private field"), n ? n.call(e) : t.get(e)), bn = (e, t, n) => t.has(e) ? Jo("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(e) : t.set(e, n), te = (e, t, n, r) => (Yo(e, t, "write to private field"), r ? r.call(e, n) : t.set(e, n), n);
var mc = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {};
function gc(e) {
  return e && e.__esModule && Object.prototype.hasOwnProperty.call(e, "default") ? e.default : e;
}
var ir = { exports: {} };
var Xo;
function bc() {
  return Xo || (Xo = 1, (function(e) {
    (function() {
      var t = "input is invalid type", n = "finalize already called", r = typeof window == "object", o = r ? window : {};
      o.JS_SHA3_NO_WINDOW && (r = !1);
      var i = !r && typeof self == "object", a = !o.JS_SHA3_NO_NODE_JS && typeof process == "object" && process.versions && process.versions.node;
      a ? o = mc : i && (o = self);
      for (var s = !o.JS_SHA3_NO_COMMON_JS && !0 && e.exports, c = !o.JS_SHA3_NO_ARRAY_BUFFER && typeof ArrayBuffer < "u", u = "0123456789abcdef".split(""), f = [31, 7936, 2031616, 520093696], p = [4, 1024, 262144, 67108864], d = [1, 256, 65536, 16777216], h = [6, 1536, 393216, 100663296], y = [0, 8, 16, 24], g = [
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
      ], v = [224, 256, 384, 512], x = [128, 256], M = ["hex", "buffer", "arrayBuffer", "array", "digest"], m = {
        128: 168,
        256: 136
      }, b = o.JS_SHA3_NO_NODE_JS || !Array.isArray ? function(l) {
        return Object.prototype.toString.call(l) === "[object Array]";
      } : Array.isArray, k = c && (o.JS_SHA3_NO_ARRAY_BUFFER_IS_VIEW || !ArrayBuffer.isView) ? function(l) {
        return typeof l == "object" && l.buffer && l.buffer.constructor === ArrayBuffer;
      } : ArrayBuffer.isView, B = function(l) {
        var S = typeof l;
        if (S === "string")
          return [l, !0];
        if (S !== "object" || l === null)
          throw new Error(t);
        if (c && l.constructor === ArrayBuffer)
          return [new Uint8Array(l), !1];
        if (!b(l) && !k(l))
          throw new Error(t);
        return [l, !1];
      }, D = function(l) {
        return B(l)[0].length === 0;
      }, R = function(l) {
        for (var S = [], w = 0; w < l.length; ++w)
          S[w] = l[w];
        return S;
      }, V = function(l, S, w) {
        return function(E) {
          return new L(l, S, l).update(E)[w]();
        };
      }, q = function(l, S, w) {
        return function(E, C) {
          return new L(l, S, C).update(E)[w]();
        };
      }, Ke = function(l, S, w) {
        return function(E, C, A, I) {
          return ge["cshake" + l].update(E, C, A, I)[w]();
        };
      }, Ve = function(l, S, w) {
        return function(E, C, A, I) {
          return ge["kmac" + l].update(E, C, A, I)[w]();
        };
      }, O = function(l, S, w, E) {
        for (var C = 0; C < M.length; ++C) {
          var A = M[C];
          l[A] = S(w, E, A);
        }
        return l;
      }, Ho = function(l, S) {
        var w = V(l, S, "hex");
        return w.create = function() {
          return new L(l, S, l);
        }, w.update = function(E) {
          return w.create().update(E);
        }, O(w, V, l, S);
      }, hc = function(l, S) {
        var w = q(l, S, "hex");
        return w.create = function(E) {
          return new L(l, S, E);
        }, w.update = function(E, C) {
          return w.create(C).update(E);
        }, O(w, q, l, S);
      }, pc = function(l, S) {
        var w = m[l], E = Ke(l, S, "hex");
        return E.create = function(C, A, I) {
          return D(A) && D(I) ? ge["shake" + l].create(C) : new L(l, S, C).bytepad([A, I], w);
        }, E.update = function(C, A, I, _) {
          return E.create(A, I, _).update(C);
        }, O(E, Ke, l, S);
      }, yc = function(l, S) {
        var w = m[l], E = Ve(l, S, "hex");
        return E.create = function(C, A, I) {
          return new or(l, S, A).bytepad(["KMAC", I], w).bytepad([C], w);
        }, E.update = function(C, A, I, _) {
          return E.create(C, I, _).update(A);
        }, O(E, Ve, l, S);
      }, qo = [
        { name: "keccak", padding: d, bits: v, createMethod: Ho },
        { name: "sha3", padding: h, bits: v, createMethod: Ho },
        { name: "shake", padding: f, bits: x, createMethod: hc },
        { name: "cshake", padding: p, bits: x, createMethod: pc },
        { name: "kmac", padding: p, bits: x, createMethod: yc }
      ], ge = {}, Qe = [], be = 0; be < qo.length; ++be)
        for (var Fe = qo[be], gt = Fe.bits, et = 0; et < gt.length; ++et) {
          var rr = Fe.name + "_" + gt[et];
          if (Qe.push(rr), ge[rr] = Fe.createMethod(gt[et], Fe.padding), Fe.name !== "sha3") {
            var Go = Fe.name + gt[et];
            Qe.push(Go), ge[Go] = ge[rr];
          }
        }
      function L(l, S, w) {
        this.blocks = [], this.s = [], this.padding = S, this.outputBits = w, this.reset = !0, this.finalized = !1, this.block = 0, this.start = 0, this.blockCount = 1600 - (l << 1) >> 5, this.byteCount = this.blockCount << 2, this.outputBlocks = w >> 5, this.extraBytes = (w & 31) >> 3;
        for (var E = 0; E < 50; ++E)
          this.s[E] = 0;
      }
      L.prototype.update = function(l) {
        if (this.finalized)
          throw new Error(n);
        var S = B(l);
        l = S[0];
        for (var w = S[1], E = this.blocks, C = this.byteCount, A = l.length, I = this.blockCount, _ = 0, z = this.s, P, T; _ < A; ) {
          if (this.reset)
            for (this.reset = !1, E[0] = this.block, P = 1; P < I + 1; ++P)
              E[P] = 0;
          if (w)
            for (P = this.start; _ < A && P < C; ++_)
              T = l.charCodeAt(_), T < 128 ? E[P >> 2] |= T << y[P++ & 3] : T < 2048 ? (E[P >> 2] |= (192 | T >> 6) << y[P++ & 3], E[P >> 2] |= (128 | T & 63) << y[P++ & 3]) : T < 55296 || T >= 57344 ? (E[P >> 2] |= (224 | T >> 12) << y[P++ & 3], E[P >> 2] |= (128 | T >> 6 & 63) << y[P++ & 3], E[P >> 2] |= (128 | T & 63) << y[P++ & 3]) : (T = 65536 + ((T & 1023) << 10 | l.charCodeAt(++_) & 1023), E[P >> 2] |= (240 | T >> 18) << y[P++ & 3], E[P >> 2] |= (128 | T >> 12 & 63) << y[P++ & 3], E[P >> 2] |= (128 | T >> 6 & 63) << y[P++ & 3], E[P >> 2] |= (128 | T & 63) << y[P++ & 3]);
          else
            for (P = this.start; _ < A && P < C; ++_)
              E[P >> 2] |= l[_] << y[P++ & 3];
          if (this.lastByteIndex = P, P >= C) {
            for (this.start = P - C, this.block = E[I], P = 0; P < I; ++P)
              z[P] ^= E[P];
            tt(z), this.reset = !0;
          } else
            this.start = P;
        }
        return this;
      }, L.prototype.encode = function(l, S) {
        var w = l & 255, E = 1, C = [w];
        for (l = l >> 8, w = l & 255; w > 0; )
          C.unshift(w), l = l >> 8, w = l & 255, ++E;
        return S ? C.push(E) : C.unshift(E), this.update(C), C.length;
      }, L.prototype.encodeString = function(l) {
        var S = B(l);
        l = S[0];
        var w = S[1], E = 0, C = l.length;
        if (w)
          for (var A = 0; A < l.length; ++A) {
            var I = l.charCodeAt(A);
            I < 128 ? E += 1 : I < 2048 ? E += 2 : I < 55296 || I >= 57344 ? E += 3 : (I = 65536 + ((I & 1023) << 10 | l.charCodeAt(++A) & 1023), E += 4);
          }
        else
          E = C;
        return E += this.encode(E * 8), this.update(l), E;
      }, L.prototype.bytepad = function(l, S) {
        for (var w = this.encode(S), E = 0; E < l.length; ++E)
          w += this.encodeString(l[E]);
        var C = (S - w % S) % S, A = [];
        return A.length = C, this.update(A), this;
      }, L.prototype.finalize = function() {
        if (!this.finalized) {
          this.finalized = !0;
          var l = this.blocks, S = this.lastByteIndex, w = this.blockCount, E = this.s;
          if (l[S >> 2] |= this.padding[S & 3], this.lastByteIndex === this.byteCount)
            for (l[0] = l[w], S = 1; S < w + 1; ++S)
              l[S] = 0;
          for (l[w - 1] |= 2147483648, S = 0; S < w; ++S)
            E[S] ^= l[S];
          tt(E);
        }
      }, L.prototype.toString = L.prototype.hex = function() {
        this.finalize();
        for (var l = this.blockCount, S = this.s, w = this.outputBlocks, E = this.extraBytes, C = 0, A = 0, I = "", _; A < w; ) {
          for (C = 0; C < l && A < w; ++C, ++A)
            _ = S[C], I += u[_ >> 4 & 15] + u[_ & 15] + u[_ >> 12 & 15] + u[_ >> 8 & 15] + u[_ >> 20 & 15] + u[_ >> 16 & 15] + u[_ >> 28 & 15] + u[_ >> 24 & 15];
          A % l === 0 && (S = R(S), tt(S), C = 0);
        }
        return E && (_ = S[C], I += u[_ >> 4 & 15] + u[_ & 15], E > 1 && (I += u[_ >> 12 & 15] + u[_ >> 8 & 15]), E > 2 && (I += u[_ >> 20 & 15] + u[_ >> 16 & 15])), I;
      }, L.prototype.arrayBuffer = function() {
        this.finalize();
        var l = this.blockCount, S = this.s, w = this.outputBlocks, E = this.extraBytes, C = 0, A = 0, I = this.outputBits >> 3, _;
        E ? _ = new ArrayBuffer(w + 1 << 2) : _ = new ArrayBuffer(I);
        for (var z = new Uint32Array(_); A < w; ) {
          for (C = 0; C < l && A < w; ++C, ++A)
            z[A] = S[C];
          A % l === 0 && (S = R(S), tt(S));
        }
        return E && (z[A] = S[C], _ = _.slice(0, I)), _;
      }, L.prototype.buffer = L.prototype.arrayBuffer, L.prototype.digest = L.prototype.array = function() {
        this.finalize();
        for (var l = this.blockCount, S = this.s, w = this.outputBlocks, E = this.extraBytes, C = 0, A = 0, I = [], _, z; A < w; ) {
          for (C = 0; C < l && A < w; ++C, ++A)
            _ = A << 2, z = S[C], I[_] = z & 255, I[_ + 1] = z >> 8 & 255, I[_ + 2] = z >> 16 & 255, I[_ + 3] = z >> 24 & 255;
          A % l === 0 && (S = R(S), tt(S));
        }
        return E && (_ = A << 2, z = S[C], I[_] = z & 255, E > 1 && (I[_ + 1] = z >> 8 & 255), E > 2 && (I[_ + 2] = z >> 16 & 255)), I;
      };
      function or(l, S, w) {
        L.call(this, l, S, w);
      }
      or.prototype = new L(), or.prototype.finalize = function() {
        return this.encode(this.outputBits, !0), L.prototype.finalize.call(this);
      };
      var tt = function(l) {
        var S, w, E, C, A, I, _, z, P, T, bt, xt, vt, St, wt, kt, Et, Mt, Bt, Ct, At, _t, Rt, It, Pt, Dt, Ot, Nt, jt, Kt, Vt, Ft, Ut, Tt, $t, Lt, zt, Wt, Ht, qt, Gt, Jt, Yt, Xt, Zt, Qt, en, tn, nn, rn, on, an, sn, cn, un, ln, fn, dn, hn, pn, yn, mn, gn;
        for (E = 0; E < 48; E += 2)
          C = l[0] ^ l[10] ^ l[20] ^ l[30] ^ l[40], A = l[1] ^ l[11] ^ l[21] ^ l[31] ^ l[41], I = l[2] ^ l[12] ^ l[22] ^ l[32] ^ l[42], _ = l[3] ^ l[13] ^ l[23] ^ l[33] ^ l[43], z = l[4] ^ l[14] ^ l[24] ^ l[34] ^ l[44], P = l[5] ^ l[15] ^ l[25] ^ l[35] ^ l[45], T = l[6] ^ l[16] ^ l[26] ^ l[36] ^ l[46], bt = l[7] ^ l[17] ^ l[27] ^ l[37] ^ l[47], xt = l[8] ^ l[18] ^ l[28] ^ l[38] ^ l[48], vt = l[9] ^ l[19] ^ l[29] ^ l[39] ^ l[49], S = xt ^ (I << 1 | _ >>> 31), w = vt ^ (_ << 1 | I >>> 31), l[0] ^= S, l[1] ^= w, l[10] ^= S, l[11] ^= w, l[20] ^= S, l[21] ^= w, l[30] ^= S, l[31] ^= w, l[40] ^= S, l[41] ^= w, S = C ^ (z << 1 | P >>> 31), w = A ^ (P << 1 | z >>> 31), l[2] ^= S, l[3] ^= w, l[12] ^= S, l[13] ^= w, l[22] ^= S, l[23] ^= w, l[32] ^= S, l[33] ^= w, l[42] ^= S, l[43] ^= w, S = I ^ (T << 1 | bt >>> 31), w = _ ^ (bt << 1 | T >>> 31), l[4] ^= S, l[5] ^= w, l[14] ^= S, l[15] ^= w, l[24] ^= S, l[25] ^= w, l[34] ^= S, l[35] ^= w, l[44] ^= S, l[45] ^= w, S = z ^ (xt << 1 | vt >>> 31), w = P ^ (vt << 1 | xt >>> 31), l[6] ^= S, l[7] ^= w, l[16] ^= S, l[17] ^= w, l[26] ^= S, l[27] ^= w, l[36] ^= S, l[37] ^= w, l[46] ^= S, l[47] ^= w, S = T ^ (C << 1 | A >>> 31), w = bt ^ (A << 1 | C >>> 31), l[8] ^= S, l[9] ^= w, l[18] ^= S, l[19] ^= w, l[28] ^= S, l[29] ^= w, l[38] ^= S, l[39] ^= w, l[48] ^= S, l[49] ^= w, St = l[0], wt = l[1], Qt = l[11] << 4 | l[10] >>> 28, en = l[10] << 4 | l[11] >>> 28, Nt = l[20] << 3 | l[21] >>> 29, jt = l[21] << 3 | l[20] >>> 29, pn = l[31] << 9 | l[30] >>> 23, yn = l[30] << 9 | l[31] >>> 23, Jt = l[40] << 18 | l[41] >>> 14, Yt = l[41] << 18 | l[40] >>> 14, Tt = l[2] << 1 | l[3] >>> 31, $t = l[3] << 1 | l[2] >>> 31, kt = l[13] << 12 | l[12] >>> 20, Et = l[12] << 12 | l[13] >>> 20, tn = l[22] << 10 | l[23] >>> 22, nn = l[23] << 10 | l[22] >>> 22, Kt = l[33] << 13 | l[32] >>> 19, Vt = l[32] << 13 | l[33] >>> 19, mn = l[42] << 2 | l[43] >>> 30, gn = l[43] << 2 | l[42] >>> 30, cn = l[5] << 30 | l[4] >>> 2, un = l[4] << 30 | l[5] >>> 2, Lt = l[14] << 6 | l[15] >>> 26, zt = l[15] << 6 | l[14] >>> 26, Mt = l[25] << 11 | l[24] >>> 21, Bt = l[24] << 11 | l[25] >>> 21, rn = l[34] << 15 | l[35] >>> 17, on = l[35] << 15 | l[34] >>> 17, Ft = l[45] << 29 | l[44] >>> 3, Ut = l[44] << 29 | l[45] >>> 3, It = l[6] << 28 | l[7] >>> 4, Pt = l[7] << 28 | l[6] >>> 4, ln = l[17] << 23 | l[16] >>> 9, fn = l[16] << 23 | l[17] >>> 9, Wt = l[26] << 25 | l[27] >>> 7, Ht = l[27] << 25 | l[26] >>> 7, Ct = l[36] << 21 | l[37] >>> 11, At = l[37] << 21 | l[36] >>> 11, an = l[47] << 24 | l[46] >>> 8, sn = l[46] << 24 | l[47] >>> 8, Xt = l[8] << 27 | l[9] >>> 5, Zt = l[9] << 27 | l[8] >>> 5, Dt = l[18] << 20 | l[19] >>> 12, Ot = l[19] << 20 | l[18] >>> 12, dn = l[29] << 7 | l[28] >>> 25, hn = l[28] << 7 | l[29] >>> 25, qt = l[38] << 8 | l[39] >>> 24, Gt = l[39] << 8 | l[38] >>> 24, _t = l[48] << 14 | l[49] >>> 18, Rt = l[49] << 14 | l[48] >>> 18, l[0] = St ^ ~kt & Mt, l[1] = wt ^ ~Et & Bt, l[10] = It ^ ~Dt & Nt, l[11] = Pt ^ ~Ot & jt, l[20] = Tt ^ ~Lt & Wt, l[21] = $t ^ ~zt & Ht, l[30] = Xt ^ ~Qt & tn, l[31] = Zt ^ ~en & nn, l[40] = cn ^ ~ln & dn, l[41] = un ^ ~fn & hn, l[2] = kt ^ ~Mt & Ct, l[3] = Et ^ ~Bt & At, l[12] = Dt ^ ~Nt & Kt, l[13] = Ot ^ ~jt & Vt, l[22] = Lt ^ ~Wt & qt, l[23] = zt ^ ~Ht & Gt, l[32] = Qt ^ ~tn & rn, l[33] = en ^ ~nn & on, l[42] = ln ^ ~dn & pn, l[43] = fn ^ ~hn & yn, l[4] = Mt ^ ~Ct & _t, l[5] = Bt ^ ~At & Rt, l[14] = Nt ^ ~Kt & Ft, l[15] = jt ^ ~Vt & Ut, l[24] = Wt ^ ~qt & Jt, l[25] = Ht ^ ~Gt & Yt, l[34] = tn ^ ~rn & an, l[35] = nn ^ ~on & sn, l[44] = dn ^ ~pn & mn, l[45] = hn ^ ~yn & gn, l[6] = Ct ^ ~_t & St, l[7] = At ^ ~Rt & wt, l[16] = Kt ^ ~Ft & It, l[17] = Vt ^ ~Ut & Pt, l[26] = qt ^ ~Jt & Tt, l[27] = Gt ^ ~Yt & $t, l[36] = rn ^ ~an & Xt, l[37] = on ^ ~sn & Zt, l[46] = pn ^ ~mn & cn, l[47] = yn ^ ~gn & un, l[8] = _t ^ ~St & kt, l[9] = Rt ^ ~wt & Et, l[18] = Ft ^ ~It & Dt, l[19] = Ut ^ ~Pt & Ot, l[28] = Jt ^ ~Tt & Lt, l[29] = Yt ^ ~$t & zt, l[38] = an ^ ~Xt & Qt, l[39] = sn ^ ~Zt & en, l[48] = mn ^ ~cn & ln, l[49] = gn ^ ~un & fn, l[0] ^= g[E], l[1] ^= g[E + 1];
      };
      if (s)
        e.exports = ge;
      else
        for (be = 0; be < Qe.length; ++be)
          o[Qe[be]] = ge[Qe[be]];
    })();
  })(ir)), ir.exports;
}
var xc = bc();
const Oi = /* @__PURE__ */ gc(xc), Ni = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/, ji = Ni, Ki = /^[A-Za-z0-9_-]+$/, vc = Ki, Sc = /^[A-Za-z0-9_-]+$/;
function ft(e, t) {
  const n = String(e ?? "").trim();
  if (!n) throw new Error(`${t} is required.`);
  return n;
}
function it(e, t, n, r) {
  if (!t.test(e))
    throw new Error(`Invalid ${n}: ${r ?? e}`);
  return e;
}
function Vi(e) {
  const t = String(e ?? "").trim();
  if (!t) return "";
  try {
    if (/^[a-z]+:\/\//i.test(t))
      return new URL(t).hostname.trim().toLowerCase();
  } catch {
  }
  return t.replace(/^[a-z]+:\/\//i, "").replace(/[/?#].*$/g, "").replace(/:\d+$/g, "").replace(/\.+$/g, "").trim().toLowerCase();
}
function Fi(e) {
  if (!e?.length) return [];
  const t = /* @__PURE__ */ new Set();
  for (const n of e)
    t.add(Ye(n));
  return Array.from(t).sort((n, r) => {
    const o = r.split(".").length - n.split(".").length;
    return o !== 0 ? o : r.length - n.length;
  });
}
function wc(e) {
  const n = ft(e, "Canonical namespace").replace(/^me:\/\//i, "").trim().toLowerCase().split(".").map((i) => i.trim()).filter(Boolean);
  if (n.length < 3)
    throw new Error(`Invalid canonical namespace "${e}": expected handle.space with a dotted space.`);
  const r = je(n[0]), o = Ye(n.slice(1).join("."));
  return {
    handle: r,
    space: o,
    value: `${r}.${o}`
  };
}
function gr(e) {
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
    const o = it(t.slice(6), vc, "claim selector token", t);
    return {
      kind: "claim",
      raw: t,
      value: `claim:${o}`,
      shorthand: !1
    };
  }
  const n = !t.startsWith("surface:"), r = it(
    n ? t : t.slice(8),
    Ki,
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
function Ui(e) {
  const t = String(e ?? "").trim();
  if (!t)
    throw new Error("Canonical me URI path cannot be empty after '/'.");
  if (t.includes("/"))
    throw new Error(`Invalid canonical path "${e}": use "." for descent, not "/".`);
  const n = t.split(".").map((r) => r.trim());
  if (n.some((r) => !r))
    throw new Error(`Invalid canonical path "${e}": empty segments are not allowed.`);
  for (const r of n)
    it(r, Sc, "canonical path segment", e);
  return {
    value: n.join("."),
    segments: n
  };
}
function kc(e) {
  if (!e) return "";
  const t = gr(typeof e == "string" ? e : e.raw);
  return t ? `[${t.value}]` : "";
}
function Ec(e, t) {
  for (const n of Fi(t))
    if (e === n || e.endsWith(`.${n}`))
      return n;
  return null;
}
function je(e) {
  return it(ft(e, "Handle").toLowerCase(), Ni, "canonical handle", String(e));
}
function Ye(e) {
  const n = Vi(ft(e, "Space")).split(".").map((r) => r.trim()).filter(Boolean);
  if (n.length < 2)
    throw new Error(`Invalid canonical space "${e}": expected at least two labels.`);
  for (const r of n)
    it(r, ji, "space label", String(e));
  return n.join(".");
}
function Un(e) {
  const t = je(e.handle), n = Ye(e.space), r = kc(e.selector), o = e.path == null || String(e.path).trim() === "" ? "" : `/${Ui(String(e.path)).value}`;
  return `me://${t}.${n}${r}${o}`;
}
function Wr(e) {
  const t = ft(e, "me:// URI");
  if (!t.toLowerCase().startsWith("me://"))
    throw new Error(`Invalid me URI "${e}": expected "me://" scheme.`);
  const n = t.slice(5);
  if (!n.trim())
    throw new Error(`Invalid me URI "${e}": missing namespace.`);
  const r = n.indexOf("/"), o = (r >= 0 ? n.slice(0, r) : n).trim(), i = r >= 0 ? n.slice(r + 1) : "";
  let a = o, s = null;
  const c = o.indexOf("[");
  if (c >= 0) {
    const h = o.lastIndexOf("]");
    if (h < c || h !== o.length - 1)
      throw new Error(`Invalid me URI "${e}": malformed selector.`);
    a = o.slice(0, c).trim(), s = o.slice(c + 1, h).trim();
  }
  const u = wc(a), f = gr(s), p = r >= 0 ? Ui(i) : null, d = Un({
    handle: u.handle,
    space: u.space,
    selector: f,
    path: p?.value ?? null
  });
  return {
    scheme: "me",
    raw: t,
    href: d,
    namespace: u.value,
    handle: u.handle,
    space: u.space,
    selector: f,
    path: p?.value ?? null,
    segments: p?.segments ?? []
  };
}
function Mc(e) {
  try {
    return Wr(e);
  } catch {
    return null;
  }
}
function Ti(e, t = {}) {
  const n = Wr(e), r = Fi(t.knownSpaces);
  if (r.length > 0 && !r.includes(n.space))
    throw new Error(`Unknown canonical space "${n.space}" in "${e}".`);
  return n;
}
function $i(e, t = {}) {
  const n = ft(e, "Human identity"), r = n.split("@");
  if (r.length !== 2)
    throw new Error(`Invalid human identity "${e}": expected handle@space.`);
  const o = je(r[0]), i = Ye(r[1]), a = Un({ handle: o, space: i });
  return Ti(a, t), {
    raw: n,
    alias: `${o}@${i}`,
    handle: o,
    space: i,
    namespace: `${o}.${i}`,
    uri: a
  };
}
function Bc(e, t = {}) {
  const n = String(e ?? "").trim();
  if (!n.includes("@")) return null;
  try {
    return $i(n, t).uri;
  } catch {
    return null;
  }
}
function Cc(e, t) {
  const n = Vi(e);
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
  const r = n.split(".").map((u) => u.trim()).filter(Boolean);
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
  for (const u of r)
    if (!ji.test(u))
      return {
        ok: !1,
        kind: "invalid",
        rawHost: e,
        host: n,
        matchedSpace: null,
        prefixLabels: r,
        reason: "INVALID_HOST"
      };
  const o = Ec(n, t);
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
  const s = je(a[0]), c = `${s}.${o}`;
  return {
    ok: !0,
    kind: "namespace",
    rawHost: e,
    host: n,
    matchedSpace: o,
    prefixLabels: [s],
    handle: s,
    space: o,
    namespace: c,
    uri: Un({ handle: s, space: o })
  };
}
const Zo = "+";
function Ac(e) {
  return { __ptr: e };
}
function Z(e) {
  return !!e && typeof e == "object" && typeof e.__ptr == "string" && e.__ptr.length > 0;
}
function _c(e) {
  return { __id: e };
}
function at(e) {
  return !!e && typeof e == "object" && typeof e.__id == "string" && e.__id.length > 0;
}
function Rc(e) {
  return !!e && typeof e == "object" && typeof e.path == "string" && typeof e.hash == "string" && typeof e.timestamp == "number";
}
function le(e) {
  return e.length === 0 ? { scope: [], leaf: null } : { scope: e.slice(0, -1), leaf: e[e.length - 1] };
}
function Ne(e, t) {
  if (t.length > e.length) return !1;
  for (let n = 0; n < t.length; n++)
    if (e[n] !== t[n]) return !1;
  return !0;
}
function Qo(e) {
  const t = e.trim().toLowerCase();
  if (t.length < 3 || t.length > 63)
    throw new Error(`Invalid username length: ${t.length}. Expected 3..63 characters.`);
  if (t.includes("."))
    throw new Error(`Invalid username. "." is reserved as structure. Got: ${e}`);
  return je(t), t;
}
function ye(e, t) {
  return e[t]?.kind ?? null;
}
function Hr(e, t) {
  if (e.length !== 1 || e[0] !== Zo || !Array.isArray(t) || t.length < 2) return null;
  const r = String(t[0] ?? "").trim(), o = String(t[1] ?? "").trim();
  return !r || !o || r === Zo ? null : { op: r, kind: o };
}
function Li(e, t, n) {
  if (t.length === 0) return null;
  const { scope: r, leaf: o } = le(t);
  return !o || ye(e, o) !== "secret" || typeof n != "string" ? null : { scopeKey: r.join(".") };
}
function qr(e, t, n) {
  if (t.length === 0) return null;
  const { scope: r, leaf: o } = le(t);
  return !o || ye(e, o) !== "noise" || typeof n != "string" ? null : { scopeKey: r.join(".") };
}
function zi(e, t, n) {
  if (t.length === 0) return null;
  const { leaf: r } = le(t);
  if (!r || ye(e, r) !== "pointer" || typeof n != "string") return null;
  const o = n.trim().replace(/^\./, "");
  return o ? { targetPath: o } : null;
}
function Wi(e, t, n) {
  if (t.length === 1 && ye(e, t[0]) === "identity")
    return typeof n != "string" ? null : { id: Qo(n), targetPath: [] };
  const { scope: r, leaf: o } = le(t);
  return !o || ye(e, o) !== "identity" || typeof n != "string" ? null : { id: Qo(n), targetPath: r };
}
function Gr(e, t, n) {
  if (t.length === 0) return null;
  const { scope: r, leaf: o } = le(t);
  if (!o || ye(e, o) !== "eval") return null;
  if (typeof n == "function")
    return { mode: "thunk", targetPath: r, thunk: n };
  if (Array.isArray(n) && n.length >= 2) {
    const i = String(n[0] ?? "").trim(), a = String(n[1] ?? "").trim();
    return !i || !a ? null : { mode: "assign", targetPath: r, name: i, expr: a };
  }
  return null;
}
function Jr(e, t, n) {
  if (t.length === 0) return null;
  const { scope: r, leaf: o } = le(t);
  if (!o || ye(e, o) !== "query") return null;
  let i = null, a;
  if (Array.isArray(n) && n.length > 0)
    Array.isArray(n[0]) && (n.length === 1 || typeof n[1] == "function") ? (i = n[0], a = typeof n[1] == "function" ? n[1] : void 0) : i = n;
  else
    return null;
  if (!Array.isArray(i) || i.length === 0) return null;
  const s = i.map((c) => String(c)).map((c) => c.trim()).filter((c) => c.length > 0);
  return s.length === 0 ? null : { targetPath: r, paths: s, fn: a };
}
function Yr(e, t, n) {
  if (t.length === 0) return null;
  const { scope: r, leaf: o } = le(t);
  if (!o || ye(e, o) !== "remove") return null;
  if (n == null)
    return { targetPath: r };
  if (typeof n == "string") {
    const i = n.split(".").filter(Boolean);
    return { targetPath: [...r, ...i] };
  }
  return null;
}
const { keccak256: Hi } = Oi, Ic = "this.me/wrapped-secret/v1", Pc = "me.prove.v1", Dc = ":", $ = new Uint8Array([254, 109, 101]), Tn = 2, br = 16, xr = 16, $n = 3, vr = 16, Sr = 16, Ln = 4, wr = 16, kr = 16, nt = 136, Oc = "this.me/blob/v2/salt", Nc = "this.me/blob/v2/enc", jc = "this.me/blob/v2/mac", Kc = "this.me/blob/v2/stream", Vc = "this.me/blob/v2/tag", Fc = "this.me/blob/v3/kdf", Uc = "this.me/blob/v3/enc", Tc = "this.me/blob/v3/mac", $c = "this.me/blob/v3/stream", Lc = "this.me/blob/v3/tag", zc = "this.me/blob/v4/kdf", Wc = "this.me/blob/v4/enc", Hc = "this.me/blob/v4/mac", qc = "this.me/blob/v4/stream", Gc = "this.me/blob/v4/tag", st = "b64u:";
function Xr() {
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
const Ce = {
  enabled: !1,
  window: Xr()
};
function vn() {
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
function Er(e) {
  const t = String(e ?? "");
  return typeof Buffer < "u" ? Math.max(t.length * 2, Buffer.byteLength(t, "utf8")) : t.length * 2;
}
function se() {
  return typeof performance < "u" && typeof performance.now == "function" ? performance.now() : Date.now();
}
function Le(e, t) {
  return Math.max(0, e - t);
}
function Jc(e = !0) {
  Ce.enabled = e, Ce.window = Xr();
}
function Yc() {
  const e = { ...Ce.window };
  return Ce.window = Xr(), e;
}
function N(e) {
  const t = String(e ?? "");
  if (typeof TextEncoder < "u")
    return new TextEncoder().encode(t);
  if (typeof Buffer < "u")
    return new Uint8Array(Buffer.from(t, "utf8"));
  const n = unescape(encodeURIComponent(t)), r = new Uint8Array(n.length);
  for (let o = 0; o < n.length; o++) r[o] = n.charCodeAt(o);
  return r;
}
function dt(e) {
  if (typeof TextDecoder < "u")
    return new TextDecoder().decode(e);
  if (typeof Buffer < "u")
    return Buffer.from(e).toString("utf8");
  let t = "";
  for (let n = 0; n < e.length; n++) t += String.fromCharCode(e[n]);
  return decodeURIComponent(escape(t));
}
function zn(e) {
  const t = e.startsWith("0x") ? e.slice(2) : e, n = new Uint8Array(t.length / 2);
  for (let r = 0; r < n.length; r++)
    n[r] = parseInt(t.substring(r * 2, r * 2 + 2), 16);
  return n;
}
function Xc(e) {
  let t = "";
  for (let n = 0; n < e.length; n++)
    t += e[n].toString(16).padStart(2, "0");
  return "0x" + t;
}
function qi(e) {
  return `${st}${De(e)}`;
}
function Wn(e) {
  return e.startsWith(st) ? ke(e.slice(st.length)) : zn(e);
}
function Zc(e) {
  const t = new Uint8Array(4);
  return new DataView(t.buffer).setUint32(0, e >>> 0, !1), t;
}
function Zr(e) {
  const t = new Uint8Array(8), n = new DataView(t.buffer), r = Math.floor(e / 4294967296), o = e >>> 0;
  return n.setUint32(0, r >>> 0, !1), n.setUint32(4, o, !1), t;
}
function fe(...e) {
  const t = e.reduce((o, i) => o + i.length, 0), n = new Uint8Array(t);
  let r = 0;
  for (const o of e)
    n.set(o, r), r += o.length;
  return n;
}
function K(...e) {
  for (const t of e)
    t && t.fill(0);
}
function Qr(e) {
  const t = globalThis.crypto;
  if (!t?.getRandomValues)
    throw new Error("Secure random values are required for encrypted branch writes.");
  const n = new Uint8Array(e);
  return t.getRandomValues(n), n;
}
function Oe(...e) {
  const t = Hi.create();
  for (const n of e) t.update(n);
  return new Uint8Array(t.arrayBuffer());
}
function eo(e) {
  return N(e.join("."));
}
function j(e) {
  return fe(Zc(e.length), e);
}
function to(e, t) {
  if (e.length !== t.length) return !1;
  let n = 0;
  for (let r = 0; r < e.length; r++) n |= e[r] ^ t[r];
  return n === 0;
}
function ne(e, ...t) {
  const n = e.length > nt ? Oe(e) : Uint8Array.from(e), r = new Uint8Array(nt);
  r.set(n);
  const o = new Uint8Array(nt), i = new Uint8Array(nt);
  try {
    for (let s = 0; s < nt; s++)
      o[s] = r[s] ^ 54, i[s] = r[s] ^ 92;
    const a = Oe(o, ...t);
    try {
      return Oe(i, a);
    } finally {
      K(a);
    }
  } finally {
    K(n, r, o, i);
  }
}
function Gi(e, t) {
  const n = N(String(e ?? "")), r = eo(t), o = N(Oc), i = N(Nc), a = N(jc);
  let s = null, c = null;
  try {
    s = ne(o, j(r)), c = ne(s, j(n));
    const u = ne(c, i, j(r)), f = ne(c, a, j(r));
    return { encKey: u, macKey: f, pathContext: r };
  } finally {
    K(n, o, i, a, s, c);
  }
}
function Ji(e, t, n, r) {
  const o = new Uint8Array(r);
  let i = 0, a = 0;
  const s = N(Kc), c = j(e), u = j(t), f = j(n), p = new Uint8Array(4), d = new DataView(p.buffer);
  try {
    for (; i < r; ) {
      d.setUint32(0, a >>> 0, !1);
      const h = Oe(
        s,
        c,
        u,
        p,
        f
      );
      try {
        const y = Math.min(h.length, r - i);
        o.set(h.subarray(0, y), i), i += y, a++;
      } finally {
        K(h);
      }
    }
    return o;
  } finally {
    K(s, c, u, f, p);
  }
}
function Yi(e, t, n, r, o) {
  const i = N(Vc), a = Zr(o.length);
  let s = null;
  try {
    return s = ne(
      e,
      i,
      j(t),
      j(n),
      j(r),
      a,
      o
    ), Uint8Array.from(s.subarray(0, xr));
  } finally {
    K(i, a, s);
  }
}
function Qc(e, t, n) {
  return Xc(
    fe($, new Uint8Array([Tn]), e, t, n)
  );
}
function eu(e) {
  const t = Wn(e), n = $.length + 1, r = n + br + xr + 1;
  if (t.length < r) return null;
  for (let c = 0; c < $.length; c++)
    if (t[c] !== $[c]) return null;
  if (t[$.length] !== Tn) return null;
  const o = t.subarray(0, n), i = n, a = i + br, s = a + xr;
  return {
    header: o,
    nonce: t.subarray(i, a),
    tag: t.subarray(a, s),
    ciphertext: t.subarray(s)
  };
}
function tu(e, t, n) {
  return qi(
    fe($, new Uint8Array([$n]), e, t, n)
  );
}
function nu(e) {
  const t = Wn(e), n = $.length + 1, r = n + vr + Sr + 1;
  if (t.length < r) return null;
  for (let c = 0; c < $.length; c++)
    if (t[c] !== $[c]) return null;
  if (t[$.length] !== $n) return null;
  const o = t.subarray(0, n), i = n, a = i + vr, s = a + Sr;
  return {
    header: o,
    nonce: t.subarray(i, a),
    tag: t.subarray(a, s),
    ciphertext: t.subarray(s)
  };
}
function Xi(e, t, n) {
  const o = au(e, t === "branch" ? "this.me/blob/v3/branch" : "this.me/blob/v3/value"), i = eo(n), a = N(Uc), s = N(Tc);
  try {
    const c = ne(o, a, j(i)), u = ne(o, s, j(i));
    return { encKey: c, macKey: u, pathContext: i };
  } finally {
    K(o, a, s);
  }
}
function Zi(e, t, n, r) {
  const o = new Uint8Array(r);
  let i = 0, a = 0;
  const s = N($c), c = j(e), u = j(t), f = j(n), p = new Uint8Array(4), d = new DataView(p.buffer);
  try {
    for (; i < r; ) {
      d.setUint32(0, a >>> 0, !1);
      const h = Oe(
        s,
        c,
        u,
        p,
        f
      );
      try {
        const y = Math.min(h.length, r - i);
        o.set(h.subarray(0, y), i), i += y, a++;
      } finally {
        K(h);
      }
    }
    return o;
  } finally {
    K(s, c, u, f, p);
  }
}
function Qi(e, t, n, r, o) {
  const i = N(Lc), a = Zr(o.length);
  let s = null;
  try {
    return s = ne(
      e,
      i,
      j(t),
      j(n),
      j(r),
      a,
      o
    ), Uint8Array.from(s.subarray(0, Sr));
  } finally {
    K(i, a, s);
  }
}
function ru(e, t, n) {
  const r = JSON.stringify(e), o = N(String(r)), i = Qr(br), { encKey: a, macKey: s, pathContext: c } = Gi(t, n);
  let u = null, f = null, p = null, d = null;
  try {
    u = Ji(a, i, c, o.length), f = new Uint8Array(o.length);
    for (let h = 0; h < o.length; h++)
      f[h] = o[h] ^ u[h];
    return p = fe($, new Uint8Array([Tn])), d = Yi(s, p, i, c, f), Qc(i, d, f);
  } finally {
    K(o, i, a, s, c, u, f, p, d);
  }
}
function ou(e, t, n) {
  const { encKey: r, macKey: o, pathContext: i } = Gi(t, n);
  let a = null, s = null, c = null;
  try {
    if (a = Yi(o, e.header, e.nonce, i, e.ciphertext), !to(a, e.tag)) return null;
    s = Ji(r, e.nonce, i, e.ciphertext.length), c = new Uint8Array(e.ciphertext.length);
    for (let f = 0; f < e.ciphertext.length; f++)
      c[f] = e.ciphertext[f] ^ s[f];
    const u = dt(c);
    return JSON.parse(u);
  } catch {
    return null;
  } finally {
    K(r, o, i, a, s, c);
  }
}
function iu(e, t, n) {
  let r = null, o = null, i = null;
  try {
    r = zn(e);
    const a = Hi(t + Dc + n.join("."));
    o = N(a), i = new Uint8Array(r.length);
    for (let c = 0; c < r.length; c++)
      i[c] = r[c] ^ o[c % o.length];
    const s = dt(i);
    return JSON.parse(s);
  } catch {
    return null;
  } finally {
    K(r, o, i);
  }
}
function au(e, t) {
  if (!Array.isArray(e) || e.length < 6)
    throw new Error("V3 derivation requires a complete secret chain.");
  const n = N(Fc), r = N(t), o = [n, j(r), ...e.map((a) => j(a))];
  let i = null;
  try {
    return i = fe(...o), Oe(i);
  } finally {
    K(n, r, i, ...o);
  }
}
function ht(e) {
  try {
    const t = Wn(e);
    if (t.length < $.length + 1) return "legacy";
    for (let r = 0; r < $.length; r++)
      if (t[r] !== $[r]) return "legacy";
    const n = t[$.length];
    return n === Ln ? "v4" : n === $n ? "v3" : n === Tn ? "v2" : "legacy";
  } catch {
    return "legacy";
  }
}
function su(e, t, n) {
  if (!(n instanceof Uint8Array) || n.length === 0)
    throw new Error("V4 derivation requires an unlocked identity root.");
  if (!Array.isArray(e) || e.length < 5)
    throw new Error("V4 derivation requires a complete secret chain.");
  const r = N(zc), o = N(t), i = [r, j(o), ...e.map((s) => j(s))];
  let a = null;
  try {
    return a = fe(...i), ne(n, a);
  } finally {
    K(r, o, a, ...i);
  }
}
function no(e, t, n, r) {
  const i = su(e, t === "branch" ? "this.me/blob/v4/branch" : "this.me/blob/v4/value", r), a = eo(n), s = N(Wc), c = N(Hc);
  try {
    const u = ne(i, s, j(a)), f = ne(i, c, j(a));
    return { encKey: u, macKey: f, pathContext: a };
  } finally {
    K(i, s, c);
  }
}
function ea(e, t, n, r) {
  const o = new Uint8Array(r);
  let i = 0, a = 0;
  const s = N(qc), c = j(e), u = j(t), f = j(n), p = new Uint8Array(4), d = new DataView(p.buffer);
  try {
    for (; i < r; ) {
      d.setUint32(0, a >>> 0, !1);
      const h = Oe(
        s,
        c,
        u,
        p,
        f
      );
      try {
        const y = Math.min(h.length, r - i);
        o.set(h.subarray(0, y), i), i += y, a++;
      } finally {
        K(h);
      }
    }
    return o;
  } finally {
    K(s, c, u, f, p);
  }
}
function ta(e, t, n, r, o) {
  const i = N(Gc), a = Zr(o.length);
  let s = null;
  try {
    return s = ne(
      e,
      i,
      j(t),
      j(n),
      j(r),
      a,
      o
    ), Uint8Array.from(s.subarray(0, kr));
  } finally {
    K(i, a, s);
  }
}
function cu(e, t, n) {
  return qi(
    fe($, new Uint8Array([Ln]), e, t, n)
  );
}
function uu(e) {
  const t = Wn(e), n = $.length + 1, r = n + wr + kr + 1;
  if (t.length < r) return null;
  for (let c = 0; c < $.length; c++)
    if (t[c] !== $[c]) return null;
  if (t[$.length] !== Ln) return null;
  const o = t.subarray(0, n), i = n, a = i + wr, s = a + kr;
  return {
    header: o,
    nonce: t.subarray(i, a),
    tag: t.subarray(a, s),
    ciphertext: t.subarray(s)
  };
}
function lu(e, t, n, r, o) {
  const i = no(t, n, r, o);
  try {
    return na(e, i);
  } finally {
    K(i.encKey, i.macKey, i.pathContext);
  }
}
function na(e, t) {
  const n = JSON.stringify(e), r = N(String(n)), o = Qr(wr);
  let i = null, a = null, s = null, c = null;
  try {
    i = ea(t.encKey, o, t.pathContext, r.length), a = new Uint8Array(r.length);
    for (let u = 0; u < r.length; u++)
      a[u] = r[u] ^ i[u];
    return s = fe($, new Uint8Array([Ln])), c = ta(t.macKey, s, o, t.pathContext, a), cu(o, c, a);
  } finally {
    K(r, o, i, a, s, c);
  }
}
function fu(e, t, n, r, o) {
  const i = no(t, n, r, o);
  try {
    return ro(e, i);
  } finally {
    K(i.encKey, i.macKey, i.pathContext);
  }
}
function ro(e, t) {
  const n = uu(e);
  if (!n) return null;
  let r = null, o = null, i = null;
  try {
    if (r = ta(t.macKey, n.header, n.nonce, t.pathContext, n.ciphertext), !to(r, n.tag)) return null;
    o = ea(t.encKey, n.nonce, t.pathContext, n.ciphertext.length), i = new Uint8Array(n.ciphertext.length);
    for (let s = 0; s < n.ciphertext.length; s++)
      i[s] = n.ciphertext[s] ^ o[s];
    const a = dt(i);
    return JSON.parse(a);
  } catch {
    return null;
  } finally {
    K(r, o, i);
  }
}
function du(e, t, n, r) {
  const { encKey: o, macKey: i, pathContext: a } = Xi(t, n, r);
  try {
    return ra(e, { encKey: o, macKey: i, pathContext: a });
  } finally {
    K(o, i, a);
  }
}
function ra(e, t) {
  const n = Ce.enabled, r = n ? vn() : null, o = n ? se() : 0, i = JSON.stringify(e), a = n ? se() - o : 0, s = n ? Er(i) : 0, c = n ? se() : 0, u = N(String(i)), f = n ? se() - c : 0, p = n ? u.length : 0, d = Qr(vr);
  let h = null, y = null, g = null, v = null, x = null;
  try {
    const M = n ? se() : 0;
    h = Zi(t.encKey, d, t.pathContext, u.length);
    const m = n ? se() - M : 0, b = n ? se() : 0;
    y = new Uint8Array(u.length);
    for (let R = 0; R < u.length; R++)
      y[R] = u[R] ^ h[R];
    const k = n ? se() - b : 0, B = n ? se() : 0;
    g = fe($, new Uint8Array([$n])), v = Qi(t.macKey, g, d, t.pathContext, y), x = tu(d, v, y);
    const D = n ? se() - B : 0;
    if (n && r) {
      const R = h?.length ?? 0, V = y?.length ?? 0, q = Er(x), Ke = Math.max(
        s,
        s + p,
        s + p + R,
        s + p + R + V,
        s + p + R + V + q
      ), Ve = vn(), O = Ce.window;
      O.encryptCalls += 1, O.totalEncryptJsonMs += a, O.totalEncryptAsciiMs += f, O.totalEncryptKeystreamMs += m, O.totalEncryptXorMs += k, O.totalEncryptEncodeMs += D, O.maxEncryptJsonMs = Math.max(O.maxEncryptJsonMs, a), O.maxEncryptAsciiMs = Math.max(O.maxEncryptAsciiMs, f), O.maxEncryptKeystreamMs = Math.max(O.maxEncryptKeystreamMs, m), O.maxEncryptXorMs = Math.max(O.maxEncryptXorMs, k), O.maxEncryptEncodeMs = Math.max(O.maxEncryptEncodeMs, D), O.maxJsonBytes = Math.max(O.maxJsonBytes, s), O.maxClearBytes = Math.max(O.maxClearBytes, p), O.maxKeystreamBytes = Math.max(O.maxKeystreamBytes, R), O.maxCiphertextBytes = Math.max(O.maxCiphertextBytes, V), O.maxHexBytes = Math.max(O.maxHexBytes, q), O.maxEncryptResidentBytes = Math.max(O.maxEncryptResidentBytes, Ke), O.maxEncryptHeapDelta = Math.max(O.maxEncryptHeapDelta, Le(Ve.heapUsed, r.heapUsed)), O.maxEncryptExternalDelta = Math.max(O.maxEncryptExternalDelta, Le(Ve.external, r.external)), O.maxEncryptArrayBuffersDelta = Math.max(
        O.maxEncryptArrayBuffersDelta,
        Le(Ve.arrayBuffers, r.arrayBuffers)
      );
    }
    return x;
  } finally {
    K(u, d, h, y, g, v);
  }
}
function oo(e, t) {
  const n = Ce.enabled, r = n ? vn() : null, o = nu(e);
  if (!o) return null;
  let i = null, a = null, s = null, c = null;
  try {
    if (i = Qi(t.macKey, o.header, o.nonce, t.pathContext, o.ciphertext), !to(i, o.tag)) return null;
    a = Zi(t.encKey, o.nonce, t.pathContext, o.ciphertext.length), s = new Uint8Array(o.ciphertext.length);
    for (let p = 0; p < o.ciphertext.length; p++)
      s[p] = o.ciphertext[p] ^ a[p];
    c = dt(s);
    const f = JSON.parse(c);
    if (n && r) {
      const p = o.header.length + o.nonce.length + o.tag.length + o.ciphertext.length, d = s.length, h = Er(c), y = Math.max(
        p,
        p + (i?.length ?? 0),
        p + (i?.length ?? 0) + (a?.length ?? 0),
        p + (i?.length ?? 0) + (a?.length ?? 0) + d,
        p + (i?.length ?? 0) + (a?.length ?? 0) + d + h
      ), g = vn(), v = Ce.window;
      v.decryptCalls += 1, v.maxDecodedBytes = Math.max(v.maxDecodedBytes, p), v.maxDecryptClearBytes = Math.max(v.maxDecryptClearBytes, d), v.maxDecryptJsonBytes = Math.max(v.maxDecryptJsonBytes, h), v.maxDecryptResidentBytes = Math.max(v.maxDecryptResidentBytes, y), v.maxDecryptHeapDelta = Math.max(v.maxDecryptHeapDelta, Le(g.heapUsed, r.heapUsed)), v.maxDecryptExternalDelta = Math.max(v.maxDecryptExternalDelta, Le(g.external, r.external)), v.maxDecryptArrayBuffersDelta = Math.max(
        v.maxDecryptArrayBuffersDelta,
        Le(g.arrayBuffers, r.arrayBuffers)
      );
    }
    return f;
  } catch {
    return null;
  } finally {
    K(i, a, s);
  }
}
function oa(e, t, n) {
  return ru(e, t, n);
}
function io(e, t, n) {
  try {
    const r = eu(e);
    return r ? ou(r, t, n) : iu(e, t, n);
  } catch {
    return null;
  }
}
function ao(e) {
  if (typeof e != "string") return !1;
  if (e.startsWith("0x")) {
    const t = e.slice(2);
    return t.length < 2 || t.length % 2 !== 0 ? !1 : /^[0-9a-fA-F]+$/.test(t);
  }
  if (e.startsWith(st)) {
    const t = e.slice(st.length);
    return t.length > 0 && /^[A-Za-z0-9\-_]+$/.test(t);
  }
  return !1;
}
function De(e) {
  if (typeof Buffer < "u")
    return Buffer.from(e).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  let t = "";
  for (let n = 0; n < e.length; n++) t += String.fromCharCode(e[n]);
  return btoa(t).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function ke(e) {
  const t = String(e || "").replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(String(e || "").length / 4) * 4, "=");
  if (typeof Buffer < "u")
    return new Uint8Array(Buffer.from(t, "base64"));
  const n = atob(t), r = new Uint8Array(n.length);
  for (let o = 0; o < n.length; o++) r[o] = n.charCodeAt(o);
  return r;
}
function Sn(e) {
  if (e === null || typeof e != "object")
    return JSON.stringify(e);
  if (Array.isArray(e))
    return `[${e.map((r) => Sn(r)).join(",")}]`;
  const t = e;
  return `{${Object.keys(t).sort().map((r) => `${JSON.stringify(r)}:${Sn(t[r])}`).join(",")}}`;
}
function ie() {
  const e = globalThis.crypto;
  if (!e?.subtle)
    throw new Error("WebCrypto subtle crypto is required for wrapped secret operations.");
  return e;
}
function hu(e) {
  if (e.length < 16) throw new Error("AES-GCM payload is too short.");
  return {
    ciphertext: e.slice(0, e.length - 16),
    tag: e.slice(e.length - 16)
  };
}
function J(e) {
  const t = Uint8Array.from(e);
  return t.buffer.slice(t.byteOffset, t.byteOffset + t.byteLength);
}
function pu(e) {
  return typeof e == "string" ? N(e) : new Uint8Array(e);
}
function yu(e) {
  const t = String(e || "").trim();
  if (!t) throw new Error("Seed material is required.");
  const n = t.startsWith("0x") ? t.slice(2) : t;
  return n.length > 0 && n.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(n) ? zn(n) : N(t);
}
function mu(e = 32) {
  const t = Number(e);
  if (!Number.isInteger(t) || t <= 0)
    throw new Error("HKDF output length must be a positive integer.");
  return t;
}
function gu(...e) {
  const t = e.reduce((o, i) => o + i.length, 0), n = new Uint8Array(t);
  let r = 0;
  for (const o of e)
    n.set(o, r), r += o.length;
  return n;
}
async function ia(e, t, n, r = 32) {
  const o = mu(r), { subtle: i } = ie(), a = await i.importKey("raw", J(new Uint8Array(e)), "HKDF", !1, ["deriveBits"]), s = await i.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: J(N(String(t || ""))),
      info: J(N(String(n || "")))
    },
    a,
    o * 8
  );
  return new Uint8Array(s);
}
async function bu(e, t) {
  const n = String(t || "").trim();
  if (!n) throw new Error("Active expression is required to derive a branch proof seed.");
  return ia(
    yu(e),
    Pc,
    n,
    32
  );
}
async function xu(e) {
  if (!(e instanceof Uint8Array) || e.length !== 32)
    throw new Error("Ed25519 signing seed must be exactly 32 bytes.");
  const { subtle: t } = ie(), n = zn("302e020100300506032b657004220420"), r = gu(n, new Uint8Array(e)), o = await t.importKey(
    "pkcs8",
    J(r),
    { name: "Ed25519" },
    !0,
    ["sign"]
  ), i = await t.exportKey("jwk", o);
  if (i.kty !== "OKP" || i.crv !== "Ed25519" || !i.x)
    throw new Error("Unable to derive Ed25519 public key from signing seed.");
  const a = await t.importKey(
    "raw",
    J(ke(i.x)),
    { name: "Ed25519" },
    !0,
    ["verify"]
  );
  return { privateKey: o, publicKey: a };
}
async function vu(e, t) {
  const { subtle: n } = ie(), r = await n.sign(
    "Ed25519",
    e,
    J(N(String(t || "")))
  );
  return De(new Uint8Array(r));
}
async function Su(e, t, n) {
  try {
    const { subtle: r } = ie(), o = await r.importKey(
      "raw",
      J(ke(String(e || ""))),
      { name: "Ed25519" },
      !0,
      ["verify"]
    );
    return await r.verify(
      "Ed25519",
      o,
      J(ke(String(n || ""))),
      J(N(String(t || "")))
    );
  } catch {
    return !1;
  }
}
async function wu(e) {
  const { subtle: t } = ie(), n = await t.exportKey("raw", e);
  return De(new Uint8Array(n));
}
async function aa(e, t) {
  const { subtle: n } = ie(), r = await n.importKey("raw", J(e), "HKDF", !1, ["deriveKey"]);
  return n.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: J(t),
      info: J(N(Ic))
    },
    r,
    { name: "AES-GCM", length: 256 },
    !1,
    ["encrypt", "decrypt"]
  );
}
async function sa(e = !0, t = ["deriveKey", "deriveBits"]) {
  const { subtle: n } = ie();
  return n.generateKey(
    {
      name: "ECDH",
      namedCurve: "P-256"
    },
    e,
    t
  );
}
async function ca(e) {
  const { subtle: t } = ie(), n = await t.exportKey("jwk", e);
  if (n.kty !== "EC" || n.crv !== "P-256" || !n.x || !n.y)
    throw new Error("Public key is not a valid P-256 EC key.");
  return {
    kty: "EC",
    crv: "P-256",
    x: n.x,
    y: n.y
  };
}
async function so(e) {
  const { subtle: t } = ie();
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
async function ku(e) {
  const t = ie(), { subtle: n } = t, r = e.recipientPublicKey instanceof CryptoKey ? e.recipientPublicKey : await so(e.recipientPublicKey), o = await sa(!0, ["deriveBits"]), i = await n.deriveBits(
    {
      name: "ECDH",
      public: r
    },
    o.privateKey,
    256
  ), a = t.getRandomValues(new Uint8Array(32)), s = t.getRandomValues(new Uint8Array(12)), c = new Uint8Array(i), u = await aa(c, a), f = pu(e.secret);
  let p = null, d = null, h = null;
  try {
    return p = new Uint8Array(
      await n.encrypt(
        {
          name: "AES-GCM",
          iv: J(s)
        },
        u,
        J(f)
      )
    ), { ciphertext: d, tag: h } = hu(p), {
      version: 1,
      class: e.class,
      kid: String(e.kid || "").trim(),
      publicKey: e.publicKey,
      encryption: {
        kex: "ECDH-ES",
        kdf: "HKDF-SHA-256",
        aead: "AES-256-GCM",
        iv: De(s),
        salt: De(a),
        tag: De(h),
        ciphertext: De(d),
        ephemeralPK: await ca(o.publicKey)
      },
      policy: e.policy
    };
  } finally {
    K(c, a, s, f, p, d, h);
  }
}
async function ua(e, t, n = "bytes") {
  const { subtle: r } = ie();
  if (e.version !== 1) throw new Error(`Unsupported wrapped secret version: ${e.version}`);
  if (e.encryption.kex !== "ECDH-ES") throw new Error("Unsupported key exchange algorithm.");
  if (e.encryption.kdf !== "HKDF-SHA-256") throw new Error("Unsupported KDF.");
  if (e.encryption.aead !== "AES-256-GCM") throw new Error("Unsupported AEAD.");
  const o = await so(e.encryption.ephemeralPK), i = await r.deriveBits(
    {
      name: "ECDH",
      public: o
    },
    t,
    256
  ), a = ke(e.encryption.salt), s = ke(e.encryption.iv), c = ke(e.encryption.ciphertext), u = ke(e.encryption.tag), f = new Uint8Array(i), p = await aa(f, a), d = fe(c, u);
  let h = null;
  try {
    if (h = new Uint8Array(
      await r.decrypt(
        {
          name: "AES-GCM",
          iv: J(s)
        },
        p,
        J(d)
      )
    ), n === "utf8") {
      const y = dt(h);
      return K(h), y;
    }
    return h;
  } finally {
    K(f, a, s, c, u, d);
  }
}
function pe(e) {
  let t = 2166136261;
  for (let n = 0; n < e.length; n++)
    t ^= e.charCodeAt(n), t = Math.imul(t, 16777619);
  return ("00000000" + (t >>> 0).toString(16)).slice(-8);
}
function Y(e) {
  const t = globalThis.structuredClone;
  return typeof t == "function" ? t(e) : JSON.parse(JSON.stringify(e));
}
function la(e, t) {
  let n = 0;
  for (let r = 0; r < e.length; r++) {
    const o = e[r];
    if (o === "[") n++;
    else if (o === "]") n = Math.max(0, n - 1);
    else if (o === t && n === 0) return r;
  }
  return -1;
}
function F(e) {
  const t = [];
  for (const n of e) {
    const r = String(n).trim();
    if (!r) continue;
    const o = r.indexOf("[");
    if (o === -1) {
      t.push(r);
      continue;
    }
    const i = r.slice(0, o).trim(), a = r.slice(o), s = [];
    let c = !0, u = 0;
    for (; u < a.length; ) {
      if (a[u] !== "[") {
        c = !1;
        break;
      }
      const f = a[u + 1];
      if (f === '"' || f === "'") {
        const g = a.indexOf(f, u + 2);
        if (g !== -1 && a[g + 1] === "]") {
          s.push({ text: a.slice(u + 2, g), quoted: !0 }), u = g + 2;
          continue;
        }
      }
      const p = a.indexOf("]", u + 1);
      if (p === -1) {
        c = !1;
        break;
      }
      let h = a.slice(u + 1, p).trim(), y = !1;
      h.length >= 2 && (h.startsWith('"') && h.endsWith('"') || h.startsWith("'") && h.endsWith("'")) && (h = h.slice(1, -1), y = !0), s.push({ text: h, quoted: y }), u = p + 1;
    }
    if (!c) {
      i && t.push(i), t.push(a);
      continue;
    }
    if (s.some((f) => !f.quoted && f.text === "")) {
      t.push(r);
      continue;
    }
    i && t.push(i);
    for (const f of s)
      f.text && t.push(f.text);
  }
  return t;
}
function fa(e) {
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
    if (s.map((u) => u[0]).join("") !== a) {
      t.push(a);
      continue;
    }
    for (const u of s) {
      let f = (u[1] ?? "").trim();
      (f.startsWith('"') && f.endsWith('"') || f.startsWith("'") && f.endsWith("'")) && (f = f.slice(1, -1)), f && t.push(f);
    }
  }
  return t;
}
function da(e) {
  return e.some((t) => t.includes("[i]"));
}
function co(e, t) {
  return e.map((n) => n.split("[i]").join(`[${t}]`));
}
function ha(e, t) {
  return String(e ?? "").split("[i]").join(`[${t}]`);
}
function pa(e) {
  const n = String(e ?? "").trim().match(/^(.+?)\s*(>=|<=|==|!=|>|<)\s*(.+)$/);
  if (!n) return null;
  const r = n[1].trim(), o = n[2], i = n[3].trim();
  return !r || !i ? null : { left: r, op: o, right: i };
}
function Xe(e) {
  const t = String(e ?? "").trim();
  if (!t) return null;
  const n = t.split(/\s*(&&|\|\|)\s*/).filter((i) => i.length > 0);
  if (n.length === 0) return null;
  const r = [], o = [];
  for (let i = 0; i < n.length; i++)
    if (i % 2 === 0) {
      const a = pa(n[i]);
      if (!a) return null;
      r.push(a);
    } else {
      const a = n[i];
      if (a !== "&&" && a !== "||") return null;
      o.push(a);
    }
  return r.length === 0 || o.length !== Math.max(0, r.length - 1) ? null : { clauses: r, ops: o };
}
function ya(e, t, n) {
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
function ma(e) {
  const t = e.trim();
  if (t.startsWith('"') && t.endsWith('"') || t.startsWith("'") && t.endsWith("'"))
    return { kind: "literal", value: t.slice(1, -1) };
  if (t === "true") return { kind: "literal", value: !0 };
  if (t === "false") return { kind: "literal", value: !1 };
  if (t === "null") return { kind: "literal", value: null };
  const n = Number(t);
  return Number.isFinite(n) ? { kind: "literal", value: n } : { kind: "path", parts: F(t.split(".").filter(Boolean)) };
}
function Ae(e) {
  const t = String(e ?? "").trim(), n = t.indexOf("["), r = t.lastIndexOf("]");
  if (n <= 0 || r <= n || r !== t.length - 1) return null;
  const o = t.slice(0, n).trim(), i = t.slice(n + 1, r).trim();
  return !o || !i ? null : { base: o, selector: i };
}
function uo(e) {
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
    for (let c = r; i > 0 ? c <= o : c >= o; c += i) a.push(String(c));
    return a;
  }
  return null;
}
function wn(e) {
  const n = e.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=>\s*(.+)$/);
  if (!n) return null;
  const r = n[1].trim(), o = n[2].trim();
  return !r || !o ? null : { varName: r, expr: o };
}
function ga() {
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
function Hn(e) {
  return e._memories[e._memories.length - 1]?.hash ?? "";
}
function ba(e) {
  const t = [];
  let n = 0;
  for (; n < e.length; ) {
    const r = e[n];
    if (r === "]") return null;
    if (r !== "[") {
      n++;
      continue;
    }
    const o = n, i = e[n + 1];
    if (i === '"' || i === "'") {
      const u = e.indexOf(i, n + 2);
      if (u !== -1 && e[u + 1] === "]") {
        const f = e.slice(n + 2, u);
        t.push({ start: o, end: u + 2, content: e.slice(n + 1, u + 1), quoted: !0, literal: f }), n = u + 2;
        continue;
      }
    }
    let a = 0, s = null, c = n;
    for (; c < e.length; c++) {
      const u = e[c];
      if (s) {
        u === s && (s = null);
        continue;
      }
      if (u === '"' || u === "'") {
        s = u;
        continue;
      }
      if (u === "[") a++;
      else if (u === "]" && (a--, a === 0))
        break;
    }
    if (c >= e.length) return null;
    t.push({ start: o, end: c + 1, content: e.slice(n + 1, c), quoted: !1 }), n = c + 1;
  }
  return t;
}
const xa = String.raw`[^.\[\]"'\s+*/%()<>=!&|,]+`, Eu = new RegExp(String.raw`^(?:\.${xa})+$`);
function Mu(e, t = !1) {
  if (t) return !0;
  const n = String(e ?? "").trim();
  return !(!n || wn(n) || uo(n) !== null || Xe(n));
}
function Bu(e) {
  return Mu(e.content, e.quoted);
}
function Cu(e, t) {
  let n = "", r = 0;
  for (const i of t)
    n += e.slice(r, i.start) + "\0", r = i.end;
  return n += e.slice(r), n.split(".").every((i, a) => {
    if (i === "") return !1;
    const s = i.replace(/\u0000/g, "");
    return s === "" ? a === 0 && i.startsWith("\0") : new RegExp(`^${xa}$`).test(s) ? !/\u0000[^\u0000]/.test(i) : !1;
  });
}
const ar = Object.freeze({ kind: "plain" });
function pt(e) {
  const t = String(e ?? "").trim();
  if (!t.includes("[")) return ar;
  const n = ba(t);
  if (!n) return ar;
  const r = n.filter((h) => !h.quoted && h.content === ""), o = n.filter((h) => !h.quoted && h.content !== "" && h.content.trim() === ""), i = n.filter((h) => h.quoted);
  if (i.some((h) => h.start > 0 && t[h.start - 1] === "." && /[\[\]]/.test(h.literal ?? "")))
    return { kind: "rejected", reason: "dotted-literal-selector" };
  const a = i.some((h) => (h.literal ?? "").includes("."));
  if (r.length === 0 && o.length === 0)
    return i.length === 0 || a ? ar : { kind: "literal", segments: F(ei(t)) };
  if (o.length > 0) return { kind: "rejected", reason: "whitespace-selector" };
  if (a) return { kind: "rejected", reason: "invalid-collection-path" };
  if (r.length > 1) return { kind: "rejected", reason: "nested-aggregate" };
  const s = r[0], c = t.slice(0, s.start), u = t.slice(s.end);
  if (!c) return { kind: "rejected", reason: "empty-collection-path" };
  if (c.endsWith(".")) return { kind: "rejected", reason: "operator-as-segment" };
  if (u !== "" && !Eu.test(u)) return { kind: "rejected", reason: "invalid-field" };
  const f = n.filter((h) => h.end <= s.start);
  if (c.startsWith("[") && !(f[0] && f[0].start === 0 && f[0].quoted))
    return { kind: "rejected", reason: "invalid-collection-path" };
  if (!Cu(c, f)) return { kind: "rejected", reason: "invalid-collection-path" };
  if (!f.every(Bu)) return { kind: "rejected", reason: "selector-on-collection" };
  const p = F(ei(c));
  if (p.length === 0) return { kind: "rejected", reason: "empty-collection-path" };
  const d = u ? u.slice(1).split(".") : null;
  return { kind: "aggregate", ref: { text: t, collection: p, field: d, op: d ? "sum" : "count" } };
}
function ei(e) {
  const t = [];
  let n = "", r = 0, o = null;
  for (const i of String(e ?? "")) {
    if (o) {
      n += i, i === o && (o = null);
      continue;
    }
    if (i === '"' || i === "'") {
      o = i, n += i;
      continue;
    }
    if (i === "[" ? r++ : i === "]" && (r = Math.max(0, r - 1)), i === "." && r === 0) {
      n.trim() && t.push(n.trim()), n = "";
      continue;
    }
    n += i;
  }
  return n.trim() && t.push(n.trim()), t;
}
function va(e) {
  return !/[\[\]"']/.test(e);
}
function We(e) {
  let t = "";
  for (const n of e)
    va(n) ? t += (t ? "." : "") + n : t += n.includes('"') ? `['${n}']` : `["${n}"]`;
  return t;
}
function ze(e) {
  return va(e) ? e : We(String(e).split(".").filter(Boolean));
}
function Sa(e) {
  return We(e.collection) + "[]" + (e.field ? "." + e.field.join(".") : "");
}
const lo = (e) => String.raw`${e}(?:\.${e})*\[\](?:\.[A-Za-z_][A-Za-z0-9_]*)*`;
function Au(e) {
  const t = ba(e);
  return !!t && t.some((n) => !n.quoted && n.content !== "" && n.content.trim() === "");
}
const _u = 20, sr = new DataView(new ArrayBuffer(8));
function Ru(e) {
  sr.setFloat64(0, e);
  const t = sr.getUint32(0), n = sr.getUint32(4), r = t >>> 31 === 1, o = t >>> 20 & 2047;
  let i = BigInt(t & 1048575) << 32n | BigInt(n), a;
  o === 0 ? a = 0 : (i |= 1n << 52n, a = o - 1);
  const s = i << BigInt(a);
  return r ? -s : s;
}
function Iu(e) {
  return e === 0n ? 0 : e.toString(2).length;
}
function Pu(e) {
  const t = Iu(e);
  if (t <= 53) return Number(e) * 2 ** -1074;
  let n = t - 53, r = e >> BigInt(n);
  const o = e - (r << BigInt(n)), i = 1n << BigInt(n - 1);
  (o > i || o === i && (r & 1n) === 1n) && (r += 1n), r === 1n << 53n && (r >>= 1n, n += 1);
  const a = n - 1074;
  return a > 971 ? 1 / 0 : Number(r) * 2 ** a;
}
function Du(e) {
  let t = 0n;
  for (const r of e) t += Ru(r);
  if (t === 0n) return 0;
  const n = Pu(t < 0n ? -t : t);
  return t < 0n ? -n : n;
}
function wa(e, t) {
  const n = t.split(".");
  for (let r = n.length; r >= 0; r--) {
    const o = n.slice(0, r).join(".");
    if (typeof e.localSecrets[o] == "string") return !0;
    const i = e.index[o];
    if (i && typeof i == "object" && "meta" in i && i.meta?.origin === "stealth") return !0;
  }
  return !1;
}
function Ou(e, t) {
  return !wa(e, t);
}
function ti(e, t) {
  return !Object.prototype.hasOwnProperty.call(e.index, t) || ao(e.index[t]) ? !1 : !wa(e, t);
}
function ka(e, t, n, r) {
  if (e.recomputeMode !== "lazy") return;
  const o = t + ".";
  for (const i of Object.keys(e.derivations))
    i === n || !i.startsWith(o) || !Ou(e, i) || (r ? r(i) : e.ensureTargetFresh(i));
}
const cr = (e, t) => e < t ? -1 : e > t ? 1 : 0;
function Ea(e, t, n, r) {
  const o = { members: null, terms: null, domain: null };
  if (n === "authorized")
    return { value: void 0, status: "unsupported", reason: "authorized-context-unsupported", ...o };
  const i = t.collection.join(".");
  if (r !== void 0 && (r === i || r.startsWith(i + ".")))
    return { value: void 0, status: "cycle", ...o };
  for (let m = 1; m <= t.collection.length; m++)
    if (Z(e.index[t.collection.slice(0, m).join(".")]))
      return { value: void 0, status: "deferred", reason: "pointer", ...o };
  ka(e, i, r);
  const a = i + ".", s = /* @__PURE__ */ new Map();
  for (const m of Object.keys(e.index)) {
    if (!m.startsWith(a)) continue;
    const b = m.slice(a.length), k = b.indexOf("."), B = k === -1 ? b : b.slice(0, k);
    if (!ti(e, m)) continue;
    const D = s.get(B);
    D ? D.push(m) : s.set(B, [m]);
  }
  const c = [...s.keys()].sort(cr), u = c.length;
  if (u === 0) return { value: void 0, status: "absent", ...o };
  for (const m of c) {
    const b = a + m;
    if (Z(e.index[b])) return { value: void 0, status: "deferred", reason: "pointer", members: u, terms: null, domain: null };
  }
  if (t.op === "count") return { value: u, status: "resolved", members: u, terms: null, domain: null };
  const f = t.field, p = [];
  let d = 0;
  const h = [], y = [];
  for (const m of c) {
    const b = [...t.collection, m, ...f];
    for (let R = t.collection.length + 2; R < b.length; R++)
      if (Z(e.index[b.slice(0, R).join(".")]))
        return { value: void 0, status: "deferred", reason: "pointer", members: u, terms: null, domain: null };
    const k = b.join(".");
    if (Z(e.index[k])) return { value: void 0, status: "deferred", reason: "pointer", members: u, terms: null, domain: null };
    const B = We(b);
    let D;
    ti(e, k) ? D = e.index[k] : s.get(m).some((R) => R.startsWith(k + ".")) && (D = {}), D === void 0 ? y.push({ path: B, kind: "missing" }) : D === null ? y.push({ path: B, kind: "null" }) : typeof D == "boolean" ? (d++, h.push(B), p.push(D ? 1 : 0)) : typeof D == "number" ? Number.isFinite(D) ? p.push(D) : y.push({ path: B, kind: "non-finite" }) : y.push({ path: B, kind: "non-numeric" });
  }
  const g = p.length - d;
  if (d > 0 && g > 0) for (const m of h) y.push({ path: m, kind: "mixed-domain" });
  const v = p.length === 0 ? null : d > 0 && g === 0 ? "boolean" : "number", x = d > 0 && g > 0 ? g : p.length;
  if (y.length > 0)
    return y.sort((m, b) => cr(m.path, b.path) || cr(m.kind, b.kind)), {
      value: void 0,
      status: "incomplete",
      members: u,
      terms: x,
      domain: v,
      problems: { count: y.length, sample: y.slice(0, _u) }
    };
  const M = Du(p);
  return Number.isFinite(M) ? { value: M, status: "resolved", members: u, terms: x, domain: v } : { value: void 0, status: "non-finite", reason: "overflow", members: u, terms: x, domain: v };
}
function Nu(e, t) {
  return e.recomputeMode = t, e;
}
function ju(e) {
  return e.recomputeMode;
}
function Ma(e, t, n, r) {
  const i = fo(n).key;
  switch (t) {
    case "read":
      return Ba(e, i);
    case "export":
      return Ca(e, i);
    case "import":
      if (r === void 0) throw new Error("kernel:import requires a payload.");
      return Aa(e, i, r);
    case "hydrate":
      if (r === void 0) throw new Error("kernel:hydrate requires a payload.");
      return _a(e, i, r);
    case "replay":
      if (r === void 0) throw new Error("kernel:replay requires a payload.");
      return Ra(e, i, r);
    case "rehydrate":
      if (r === void 0) throw new Error("kernel:rehydrate requires a payload.");
      return Ia(e, i, r);
    case "get":
      return Pa(e, i);
    case "set":
      if (r === void 0) throw new Error("kernel:set requires a payload.");
      return Da(e, i, r);
    default:
      throw new Error(`Unsupported kernel operation: ${t}`);
  }
}
function Ba(e, t) {
  switch (t) {
    case "memory":
    case "memories":
    case "logs":
      return Y(e.memories);
    case "snapshot":
      return e.exportSnapshot();
    case "mode":
    case "recompute.mode":
      return e.getRecomputeMode();
    default:
      throw new Error(`Unsupported kernel:read path: ${t || "<root>"}`);
  }
}
function Ca(e, t) {
  switch (t) {
    case "memory":
    case "memories":
    case "logs":
      return Y(e.memories);
    case "snapshot":
      return e.exportSnapshot();
    default:
      throw new Error(`Unsupported kernel:export path: ${t || "<root>"}`);
  }
}
function Aa(e, t, n) {
  if (t === "snapshot")
    return e.importSnapshot(n ?? {}), e.exportSnapshot();
  throw new Error(`Unsupported kernel:import path: ${t || "<root>"}`);
}
function _a(e, t, n) {
  if (t === "snapshot")
    return e.hydrate(n ?? {}), e.exportSnapshot();
  throw new Error(`Unsupported kernel:hydrate path: ${t || "<root>"}`);
}
function Ra(e, t, n) {
  switch (t) {
    case "memory":
    case "memories":
    case "logs":
      if (!Array.isArray(n)) throw new Error("kernel:replay/memory requires a replayable memory payload.");
      return e.replayMemories(n), Y(e.memories);
    default:
      throw new Error(`Unsupported kernel:replay path: ${t || "<root>"}`);
  }
}
function Ia(e, t, n) {
  return _a(e, t, n);
}
function Pa(e, t) {
  switch (t) {
    case "mode":
    case "recompute.mode":
      return e.getRecomputeMode();
    default:
      throw new Error(`Unsupported kernel:get path: ${t || "<root>"}`);
  }
}
function Da(e, t, n) {
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
function Oa(e, t) {
  if (typeof t == "string") return Na(t);
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
function Na(e) {
  const t = String(e ?? "").trim();
  if (!t) throw new Error("execute(...) received an empty me target.");
  const n = t.startsWith("me://") ? t.slice(5) : t, r = la(n, ":");
  if (r < 0)
    throw new Error(`Invalid me target "${t}": expected ":" between namespace and operation.`);
  const o = n.slice(0, r).trim(), i = n.slice(r + 1).trim();
  if (!o) throw new Error(`Invalid me target "${t}": missing namespace.`);
  if (!i) throw new Error(`Invalid me target "${t}": missing operation.`);
  const a = i.indexOf("/"), s = (a >= 0 ? i.slice(0, a) : i).trim().toLowerCase(), c = (a >= 0 ? i.slice(a + 1) : "").trim();
  if (!s) throw new Error(`Invalid me target "${t}": missing operation.`);
  const { namespace: u, contextRaw: f } = ja(o, t);
  return {
    scheme: "me",
    namespace: u,
    operation: s,
    path: c,
    raw: t,
    contextRaw: f
  };
}
function ja(e, t) {
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
function fo(e) {
  const n = String(e ?? "").trim().replace(/^\/+|\/+$/g, "").replace(/\//g, ".").split(".").map((o) => o.trim()).filter(Boolean), r = F(n);
  return {
    key: r.join("."),
    parts: r
  };
}
const Ku = 256, Vu = 256, Fu = 256, Uu = 256, Tu = "this.me/blob/v3", $u = "this.me/blob/v3/no-noise", Lu = "this.me/blob/v4", zu = "this.me/blob/v4/no-noise";
class Wu extends Error {
  constructor(t = "Identity root is locked; unlock it before deriving v4 keys.") {
    super(t), this.code = "IDENTITY_LOCKED", this.name = "IdentityLockedError";
  }
}
function _e(e, t, n) {
  e.has(t) && e.delete(t), e.set(t, n);
}
function Ka(e, t) {
  for (; e.size > t; ) {
    const n = e.keys().next();
    if (n.done) return;
    e.delete(n.value);
  }
}
function Hu(e) {
  for (; e.v3KeyCache.size > Fu; ) {
    const t = e.v3KeyCache.keys().next();
    if (t.done) return;
    const n = e.v3KeyCache.get(t.value);
    n && (n.encKey.fill(0), n.macKey.fill(0), n.pathContext.fill(0)), e.v3KeyCache.delete(t.value);
  }
}
function qu(e) {
  for (; e.v4KeyCache.size > Uu; ) {
    const t = e.v4KeyCache.keys().next();
    if (t.done) return;
    const n = e.v4KeyCache.get(t.value);
    n && (n.encKey.fill(0), n.macKey.fill(0), n.pathContext.fill(0)), e.v4KeyCache.delete(t.value);
  }
}
function re(e) {
  const t = String(e ?? "");
  if (typeof TextEncoder < "u")
    return new TextEncoder().encode(t);
  if (typeof Buffer < "u")
    return new Uint8Array(Buffer.from(t, "utf8"));
  const n = unescape(encodeURIComponent(t)), r = new Uint8Array(n.length);
  for (let o = 0; o < n.length; o++) r[o] = n.charCodeAt(o);
  return r;
}
function Gu(...e) {
  const t = e.reduce((o, i) => o + i.length, 0), n = new Uint8Array(t);
  let r = 0;
  for (const o of e)
    n.set(o, r), r += o.length;
  return n;
}
function kn(e) {
  return re(e.join("."));
}
function Va(e, t) {
  let n = null, r = null;
  e.localNoises[""] !== void 0 && (n = "", r = e.localNoises[""]);
  for (let o = 1; o <= t.length; o++) {
    const i = t.slice(0, o).join(".");
    e.localNoises[i] !== void 0 && (n = i, r = e.localNoises[i]);
  }
  return { key: n, value: r };
}
function Ju(e, t) {
  return e === null || e === "" ? !0 : t === e || t.startsWith(e + ".");
}
function ur(e, t, n) {
  return Gu(re(e), new Uint8Array([0]), re(t), new Uint8Array([0]), re(n));
}
function Fa(e, t, n) {
  const r = [];
  n.value !== null ? r.push(ur("noise", n.key ?? "", n.value)) : e.localSecrets[""] && r.push(ur("secret", "", e.localSecrets[""]));
  for (let o = 1; o <= t.length; o++) {
    const i = t.slice(0, o).join("."), a = e.localSecrets[i];
    a && Ju(n.key, i) && r.push(ur("secret", i, a));
  }
  return r;
}
function ae(e) {
  e.secretEpoch++, e.scopeCache.clear(), e.effectiveSecretCache.clear(), e.decryptedBranchCache.clear(), e.writeBranchCache.clear(), e.decryptedValueCache.clear();
  for (const t of e.v3KeyCache.values())
    t.encKey.fill(0), t.macKey.fill(0), t.pathContext.fill(0);
  e.v3KeyCache.clear();
  for (const t of e.v4KeyCache.values())
    t.encKey.fill(0), t.macKey.fill(0), t.pathContext.fill(0);
  e.v4KeyCache.clear();
}
function oe(e, t) {
  const n = t.join("."), r = e.effectiveSecretCache.get(n);
  if (r && r.epoch === e.secretEpoch)
    return _e(e.effectiveSecretCache, n, r), r.value;
  let o = null, i = null;
  e.localNoises[""] !== void 0 && (o = "", i = e.localNoises[""]);
  for (let c = 1; c <= t.length; c++) {
    const u = t.slice(0, c).join(".");
    e.localNoises[u] !== void 0 && (o = u, i = e.localNoises[u]);
  }
  let a = "root";
  i ? a = pe("noise::" + i) : e.localSecrets[""] && (a = pe(a + "::" + e.localSecrets[""]));
  for (let c = 1; c <= t.length; c++) {
    const u = t.slice(0, c).join(".");
    if (e.localSecrets[u]) {
      if (o !== null && o !== "") {
        const f = o + ".";
        if (!(u === o || u.startsWith(f))) continue;
      }
      a = pe(a + "::" + e.localSecrets[u]);
    }
  }
  const s = a === "root" ? "" : a;
  return _e(e.effectiveSecretCache, n, { epoch: e.secretEpoch, value: s }), Ka(e.effectiveSecretCache, Vu), s;
}
function me(e, t) {
  const n = t.join("."), r = e.scopeCache.get(n);
  if (r && r.epoch === e.secretEpoch)
    return _e(e.scopeCache, n, r), r.scope ? [...r.scope] : null;
  let o = null;
  e.localSecrets[""] && (o = []);
  for (let i = 1; i <= t.length; i++) {
    const a = t.slice(0, i), s = a.join(".");
    e.localSecrets[s] && (o = a);
  }
  return _e(e.scopeCache, n, { epoch: e.secretEpoch, scope: o ? [...o] : null }), Ka(e.scopeCache, Ku), o;
}
function Ua(e, t, n) {
  const r = me(e, t);
  if (!r)
    throw new Error(`No secret context active for "${t.join(".")}".`);
  if (n === "branch" && r.length === 0)
    throw new Error("Branch v3 derivation does not support the root secret scope.");
  const o = n === "branch" ? r : t, i = Va(e, o), a = i.key === null ? re($u) : re(i.key);
  return [
    re(Tu),
    re(n),
    kn(r),
    kn(o),
    a,
    ...Fa(e, o, i)
  ];
}
function qn(e, t, n) {
  const r = `${n}::${t.join(".")}`, o = e.v3KeyCache.get(r);
  if (o && o.epoch === e.secretEpoch)
    return _e(e.v3KeyCache, r, o), o;
  const i = Ua(e, t, n), a = Xi(i, n, t), s = {
    epoch: e.secretEpoch,
    encKey: Uint8Array.from(a.encKey),
    macKey: Uint8Array.from(a.macKey),
    pathContext: Uint8Array.from(a.pathContext)
  };
  return _e(e.v3KeyCache, r, s), Hu(e), s;
}
function Ta(e, t, n) {
  const r = me(e, t);
  if (!r)
    throw new Error(`No secret context active for "${t.join(".")}".`);
  if (n === "branch" && r.length === 0)
    throw new Error("Branch v4 derivation does not support the root secret scope.");
  const o = n === "branch" ? r : t, i = Va(e, o), a = i.key === null ? re(zu) : re(i.key);
  return [
    re(Lu),
    re(n),
    kn(r),
    kn(o),
    a,
    ...Fa(e, o, i)
  ];
}
function ho(e, t, n) {
  const r = e.identityRootUnwrapped;
  if (!r || r.length === 0)
    throw new Wu();
  const o = `${n}::${t.join(".")}::${e.identityRootId ?? ""}`, i = e.v4KeyCache.get(o);
  if (i && i.epoch === e.secretEpoch)
    return _e(e.v4KeyCache, o, i), i;
  const a = Ta(e, t, n), s = no(a, n, t, r), c = {
    epoch: e.secretEpoch,
    encKey: Uint8Array.from(s.encKey),
    macKey: Uint8Array.from(s.macKey),
    pathContext: Uint8Array.from(s.pathContext)
  };
  return _e(e.v4KeyCache, o, c), qu(e), c;
}
const Yu = 128;
function Xu(e) {
  if (!Array.isArray(e) || e.length < Yu) return !1;
  const t = [];
  for (let n = 0; n < e.length && t.length < 8; n++)
    e[n] !== void 0 && t.push(e[n]);
  return t.length === 0 ? !1 : t.every((n) => {
    if (!n || typeof n != "object") return !1;
    const r = n.embedding;
    return po(r) && r.length >= 128 && rl(r);
  });
}
function $a(e) {
  if (!e || typeof e != "object") return !1;
  const t = e;
  return t.__columnar !== !0 || !t.payload || typeof t.payload != "object" ? !1 : t.payload.meta?.encoding === "columnar";
}
function Zu(e) {
  const t = e.length, n = nl(e), r = new Uint32Array(t), o = new Float32Array(t * n), i = new Float64Array(t), a = new Array(t), s = {};
  for (let c = 0; c < t; c++) {
    const u = e[c] ?? {};
    r[c] = ol(u.id, c), i[c] = il(u.timestamp), a[c] = typeof u.text == "string" ? u.text : "";
    const f = po(u.embedding) ? u.embedding : [];
    for (let d = 0; d < n; d++) {
      const h = f[d];
      o[c * n + d] = typeof h == "number" && Number.isFinite(h) ? h : 0;
    }
    const p = {};
    for (const [d, h] of Object.entries(u))
      d === "id" || d === "embedding" || d === "timestamp" || d === "text" || (p[d] = h);
    Object.keys(p).length > 0 && (s[String(c)] = p);
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
function La(e, t) {
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
function Qu(e, t, n) {
  const r = ni(t, 0, e.meta.count), o = ni(n, r, e.meta.count), i = [];
  for (let a = r; a < o; a++) i.push(La(e, a));
  return i;
}
function el(e) {
  return {
    __columnar: !0,
    payload: {
      meta: e.payload.meta,
      ids: e.payload.ids ? lr(e.payload.ids, "Uint32Array") : void 0,
      embeddings: e.payload.embeddings ? lr(e.payload.embeddings, "Float32Array") : void 0,
      timestamps: e.payload.timestamps ? lr(e.payload.timestamps, "Float64Array") : void 0,
      texts: e.payload.texts,
      metadata: e.payload.metadata
    }
  };
}
function tl(e) {
  if (!e || typeof e != "object")
    throw new Error("Invalid columnar payload");
  const t = e, n = t.meta;
  if (!n || n.encoding !== "columnar" || n.version !== 1)
    throw new Error("Invalid columnar payload metadata");
  return {
    meta: {
      encoding: "columnar",
      version: 1,
      count: ri(n.count),
      dims: ri(n.dims)
    },
    ids: t.ids ? fr(t.ids, Uint32Array, "Uint32Array") : void 0,
    embeddings: t.embeddings ? fr(t.embeddings, Float32Array, "Float32Array") : void 0,
    timestamps: t.timestamps ? fr(t.timestamps, Float64Array, "Float64Array") : void 0,
    texts: Array.isArray(t.texts) ? t.texts.map((r) => typeof r == "string" ? r : "") : void 0,
    metadata: t.metadata && typeof t.metadata == "object" ? t.metadata : void 0
  };
}
function nl(e) {
  for (const t of e)
    if (!(!t || typeof t != "object") && po(t.embedding) && t.embedding.length > 0)
      return t.embedding.length;
  return 0;
}
function po(e) {
  return Array.isArray(e) || e instanceof Float32Array || e instanceof Float64Array || e instanceof Uint32Array || e instanceof Int32Array || e instanceof Uint16Array || e instanceof Int16Array || e instanceof Uint8Array || e instanceof Int8Array;
}
function rl(e) {
  for (let t = 0; t < e.length; t++) {
    const n = e[t];
    if (typeof n != "number" || !Number.isFinite(n)) return !1;
  }
  return !0;
}
function ol(e, t) {
  const n = typeof e == "number" ? e : t;
  return !Number.isFinite(n) || n < 0 ? t >>> 0 : Math.floor(n) >>> 0;
}
function il(e) {
  const t = typeof e == "number" ? e : 0;
  return Number.isFinite(t) ? t : 0;
}
function ni(e, t, n) {
  return Math.min(n, Math.max(t, e));
}
function ri(e) {
  const t = typeof e == "number" ? e : Number(e);
  return !Number.isFinite(t) || t < 0 ? 0 : Math.floor(t);
}
function lr(e, t) {
  const n = new Uint8Array(e.buffer, e.byteOffset, e.byteLength);
  return {
    __typedArray: !0,
    kind: t,
    base64: al(n)
  };
}
function fr(e, t, n) {
  if (!e || e.__typedArray !== !0 || e.kind !== n)
    throw new Error(`Invalid typed array payload for ${n}`);
  const r = sl(e.base64), o = r.buffer.slice(r.byteOffset, r.byteOffset + r.byteLength);
  return new t(o);
}
function al(e) {
  if (typeof Buffer < "u")
    return Buffer.from(e).toString("base64");
  let t = "";
  for (const n of e) t += String.fromCharCode(n);
  return btoa(t);
}
function sl(e) {
  if (typeof Buffer < "u")
    return new Uint8Array(Buffer.from(e, "base64"));
  const t = atob(e), n = new Uint8Array(t.length);
  for (let r = 0; r < t.length; r++) n[r] = t.charCodeAt(r);
  return n;
}
const za = 64;
function Wa() {
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
function xe() {
  return typeof performance < "u" && typeof performance.now == "function" ? performance.now() : Date.now();
}
function cl(e, t) {
  const n = e.__decryptedChunkDebug;
  if (!n?.enabled) return;
  const r = n.window ?? (n.window = Wa());
  r.calls += 1, r.hits += 1, r.totalHitMs += t, r.maxHitMs = Math.max(r.maxHitMs, t);
}
function oi(e, t, n, r, o) {
  const i = e.__decryptedChunkDebug;
  if (!i?.enabled) return;
  const a = i.window ?? (i.window = Wa());
  a.calls += 1, a.misses += 1, t === "v3" ? a.v3Misses += 1 : a.v2Misses += 1, a.totalMissMs += n, a.totalDecryptMs += r, a.totalDecodeMs += o, a.maxMissMs = Math.max(a.maxMissMs, n), a.maxDecryptMs = Math.max(a.maxDecryptMs, r), a.maxDecodeMs = Math.max(a.maxDecodeMs, o);
}
function yt(e) {
  return $a(e);
}
function ul(e, t) {
  if (yt(e)) return La(e.payload, t);
  if (Array.isArray(e)) return e[t];
}
function Ha(e) {
  return yt(e) ? Qu(e.payload, 0, e.payload.meta.count) : e;
}
function Mr(e, t, n) {
  e.has(t) && e.delete(t), e.set(t, n);
}
function qa(e, t) {
  for (; e.size > t; ) {
    const n = e.keys().next();
    if (n.done) return;
    e.delete(n.value);
  }
}
function ct(e, t) {
  return `${e}::${t}`;
}
function He(e, t) {
  const n = `${t}::`;
  for (const r of Array.from(e.decryptedBranchCache.keys()))
    r.startsWith(n) && e.decryptedBranchCache.delete(r);
  for (const r of Array.from(e.writeBranchCache.keys()))
    r.startsWith(n) && e.writeBranchCache.delete(r);
}
function qe(e) {
  if (typeof e != "string" || e.length === 0) return null;
  const t = Number(e);
  return !Number.isInteger(t) || t < 0 ? null : String(t) === e ? t : null;
}
function En(e) {
  return qe(e[0]) !== null ? [] : {};
}
function Ze(e, t, n) {
  const r = t.slice(n.length);
  if (r.length === 0) return "root";
  const o = qe(r[0]);
  if (o !== null)
    return `idx_${Math.floor(o / e.secretChunkSize)}`;
  const i = r[0] || "root", a = r[1];
  if (a === void 0) return `${i}_root`;
  const s = qe(a);
  if (s !== null)
    return `${i}_${Math.floor(s / e.secretChunkSize)}`;
  const c = parseInt(pe(String(a)).slice(-6), 16) % e.secretHashBuckets;
  return `${i}_h${c}`;
}
function Gn(e, t, n) {
  const r = t.slice(n.length);
  if (r.length === 0) return r;
  const o = qe(r[0]);
  return o === null ? r : [String(o % e.secretChunkSize), ...r.slice(1)];
}
function ll(e, t, n) {
  const r = t.slice(n.length), o = qe(r[0]);
  return o === null ? null : `${o}_root`;
}
function Jn(e, t, n) {
  if (t.length === 0) return;
  let r = e;
  for (let o = 0; o < t.length - 1; o++) {
    const i = t[o], a = t[o + 1];
    (!r[i] || typeof r[i] != "object") && (r[i] = qe(a) !== null ? [] : {}), r = r[i];
  }
  r[t[t.length - 1]] = n;
}
function yo(e, t, n) {
  if (Z(e) || at(e) || e === null || typeof e != "object" || Array.isArray(e)) {
    n.push({ rel: t, value: e });
    return;
  }
  const r = Object.keys(e);
  if (r.length === 0) {
    n.push({ rel: t, value: e });
    return;
  }
  for (const o of r) yo(e[o], [...t, o], n);
}
function Ga(e, t, n, r) {
  const o = t.join("."), i = io(n, r, t);
  if (!i || typeof i != "object") {
    e.branchStore.setScope(o, { default: n }), He(e, o);
    return;
  }
  const a = [];
  yo(i, [], a);
  const s = {};
  for (const u of a) {
    const f = [...t, ...u.rel], p = Ze(e, f, t), d = Gn(e, f, t);
    (!s[p] || typeof s[p] != "object") && (s[p] = En(d)), Jn(s[p], d, u.value);
  }
  const c = {};
  for (const [u, f] of Object.entries(s))
    c[u] = oa(f, r, t);
  e.branchStore.setScope(o, c), He(e, o);
}
function mo(e, t, n) {
  const r = t.join("."), o = e.branchStore.getScope(r);
  return o ? typeof o == "string" ? (Ga(e, t, o, n), e.branchStore.getScope(r) || {}) : o : {};
}
function Yn(e, t, n) {
  const r = t.join(".");
  return e.branchStore.getChunk(r, n);
}
function go(e, t, n, r, o) {
  const i = t.join(".");
  e.branchStore.getScopeMode(i) === "legacy" && mo(e, t, o), e.branchStore.setChunk(i, n, r), e.decryptedBranchCache.delete(ct(i, n)), e.writeBranchCache.delete(ct(i, n));
}
function fl(e, t, n, r) {
  const o = t.join("."), i = Yn(e, t, n);
  if (!i) return;
  const a = ct(o, n);
  Mr(e.decryptedBranchCache, a, {
    epoch: e.secretEpoch,
    blob: i,
    data: r
  }), qa(e.decryptedBranchCache, za);
}
function he(e, t, n, r) {
  const o = xe(), i = t.join("."), a = Yn(e, t, r);
  if (!a) return;
  const s = ct(i, r), c = e.decryptedBranchCache.get(s);
  if (c && c.epoch === e.secretEpoch && c.blob === a)
    return Mr(e.decryptedBranchCache, s, c), cl(e, xe() - o), c.data;
  const u = ht(a);
  let f = null;
  const p = xe();
  if (u === "v4")
    try {
      const g = ho(e, t, "branch");
      f = ro(a, g);
    } catch {
      f = null;
    }
  else if (u === "v3")
    try {
      const g = qn(e, t, "branch");
      f = oo(a, g);
    } catch {
      f = null;
    }
  else
    f = io(a, n, t);
  const d = xe() - p;
  let h = 0;
  if (!f || typeof f != "object") {
    oi(e, u === "v3" ? "v3" : "v2", xe() - o, d, h);
    return;
  }
  let y;
  if ($a(f)) {
    const g = xe(), v = tl(f.payload);
    h = xe() - g, y = {
      ...f,
      payload: v
    };
  } else
    y = f;
  return Mr(e.decryptedBranchCache, s, { epoch: e.secretEpoch, blob: a, data: y }), qa(e.decryptedBranchCache, za), oi(e, u === "v3" ? "v3" : "v2", xe() - o, d, h), y;
}
function Ja(e, t, n) {
  if (t.startsWith("__ptr.")) {
    const a = e.getIndex(n);
    if (!Z(a)) return { ok: !1 };
    const s = t.slice(6).split(".").filter(Boolean), c = [...a.__ptr.split(".").filter(Boolean), ...s], u = e.readPath(c);
    return u == null ? { ok: !1 } : { ok: !0, value: u };
  }
  const r = t.split(".").filter(Boolean), o = [...n, ...r];
  let i = e.readPath(o);
  return i == null && (i = e.readPath(r)), i == null ? { ok: !1 } : { ok: !0, value: i };
}
function bo(e) {
  const t = [], n = String.raw`[A-Za-z_][A-Za-z0-9_]*(?:\[(?:"[^"]*"|'[^']*'|[^\]]+)\])*`, r = new RegExp(String.raw`^(?:__ptr(?:\.${n})*|${n}(?:\.${n})*)`), o = new RegExp(String.raw`^(?:${lo(n)})`), i = {
    true: !0,
    false: !1,
    null: null,
    undefined: void 0,
    NaN: NaN,
    Infinity: 1 / 0
  }, a = /* @__PURE__ */ new Set([">=", "<=", "==", "!=", "&&", "||"]), s = /* @__PURE__ */ new Set(["+", "-", "*", "/", "%", "<", ">", "!"]);
  let c = 0;
  for (; c < e.length; ) {
    const u = e[c];
    if (/\s/.test(u)) {
      c++;
      continue;
    }
    if (u === "(") {
      t.push({ kind: "lparen" }), c++;
      continue;
    }
    if (u === ")") {
      t.push({ kind: "rparen" }), c++;
      continue;
    }
    const f = e.slice(c, c + 2);
    if (a.has(f)) {
      t.push({ kind: "op", value: f }), c += 2;
      continue;
    }
    if (s.has(u)) {
      t.push({ kind: "op", value: u }), c++;
      continue;
    }
    if (/\d/.test(u) || u === "." && /\d/.test(e[c + 1] ?? "")) {
      let h = c;
      for (; h < e.length && /[0-9]/.test(e[h]); ) h++;
      if (e[h] === ".")
        for (h++; h < e.length && /[0-9]/.test(e[h]); ) h++;
      if (e[h] === "e" || e[h] === "E") {
        let g = h + 1;
        (e[g] === "+" || e[g] === "-") && g++;
        let v = !1;
        for (; g < e.length && /[0-9]/.test(e[g]); )
          v = !0, g++;
        if (!v) return null;
        h = g;
      }
      const y = Number(e.slice(c, h));
      if (!Number.isFinite(y)) return null;
      t.push({ kind: "literal", value: y }), c = h;
      continue;
    }
    const p = e.slice(c).match(o);
    if (p && p[0]) {
      const h = pt(p[0]);
      if (h.kind !== "aggregate") return null;
      t.push({ kind: "aggregate", value: p[0], ref: h.ref }), c += p[0].length;
      continue;
    }
    const d = e.slice(c).match(r);
    if (d && d[0]) {
      if (Au(d[0])) return null;
      const h = d[0];
      Object.prototype.hasOwnProperty.call(i, h) ? t.push({ kind: "literal", value: i[h] }) : t.push({ kind: "identifier", value: h }), c += h.length;
      continue;
    }
    return null;
  }
  return t;
}
function dl(e) {
  const t = String(e ?? "").trim();
  if (!t || !/^[A-Za-z0-9_\s+\-*/%().<>=!&|\[\]"']+$/.test(t)) return !1;
  const n = bo(t);
  if (!n || n.length === 0) return !1;
  let r = "start", o = 0;
  for (const i of n) {
    const a = r === "value" || r === "rparen";
    if (i.kind === "literal" || i.kind === "identifier" || i.kind === "aggregate") {
      if (a) return !1;
      r = "value";
    } else if (i.kind === "lparen") {
      if (a) return !1;
      o++, r = "lparen";
    } else if (i.kind === "rparen") {
      if (!a || o === 0) return !1;
      o--, r = "rparen";
    } else {
      const s = i.value;
      if (s === "!" ? a : !a && s !== "-") return !1;
      r = "op";
    }
  }
  return o === 0 && (r === "value" || r === "rparen");
}
function xo(e, t, n, r) {
  const o = String(n ?? "").trim();
  if (!o) return { ok: !1 };
  if (!/^[A-Za-z0-9_\s+\-*/%().<>=!&|\[\]"']+$/.test(o)) return { ok: !1 };
  if (e.unsafeEval) return { ok: !1 };
  const i = bo(o);
  if (!i || i.length === 0) return { ok: !1 };
  const a = {
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
  }, s = /* @__PURE__ */ new Set(["u-", "!"]), c = [], u = [];
  let f = "start";
  for (const y of i) {
    if (y.kind === "literal" || y.kind === "identifier" || y.kind === "aggregate") {
      c.push(y), f = "value";
      continue;
    }
    if (y.kind === "lparen") {
      u.push(y), f = "lparen";
      continue;
    }
    if (y.kind === "rparen") {
      let v = !1;
      for (; u.length > 0; ) {
        const x = u.pop();
        if (x.kind === "lparen") {
          v = !0;
          break;
        }
        c.push(x);
      }
      if (!v) return { ok: !1 };
      f = "rparen";
      continue;
    }
    let g = y.value;
    if (g === "-" && (f === "start" || f === "op" || f === "lparen"))
      g = "u-";
    else {
      if (g === "!" && (f === "value" || f === "rparen"))
        return { ok: !1 };
      if (g !== "!" && (f === "start" || f === "op" || f === "lparen"))
        return { ok: !1 };
    }
    for (; u.length > 0; ) {
      const v = u[u.length - 1];
      if (v.kind !== "op") break;
      const x = a[v.value] ?? -1, M = a[g] ?? -1;
      if (M < 0) return { ok: !1 };
      if (!(s.has(g) ? M < x : M <= x)) break;
      c.push(u.pop());
    }
    u.push({ kind: "op", value: g }), f = "op";
  }
  if (f === "op" || f === "lparen" || f === "start") return { ok: !1 };
  for (; u.length > 0; ) {
    const y = u.pop();
    if (y.kind === "lparen") return { ok: !1 };
    c.push(y);
  }
  const p = (y) => {
    if (typeof y == "number" && Number.isFinite(y)) return y;
    if (typeof y == "string") {
      const g = Number(y);
      if (Number.isFinite(g)) return g;
    }
    return null;
  }, d = [];
  for (const y of c) {
    if (y.kind === "literal") {
      d.push(y.value);
      continue;
    }
    if (y.kind === "aggregate") {
      const k = r?.get(y.ref.text);
      if (k === void 0) return { ok: !1 };
      d.push(k);
      continue;
    }
    if (y.kind === "identifier") {
      const k = Ja(e, y.value, t);
      if (!k.ok) return { ok: !1 };
      d.push(k.value);
      continue;
    }
    const g = y.value;
    if (g === "u-" || g === "!") {
      if (d.length < 1) return { ok: !1 };
      const k = d.pop();
      if (g === "u-") {
        const B = p(k);
        if (B === null) return { ok: !1 };
        d.push(-B);
      } else
        d.push(!k);
      continue;
    }
    if (d.length < 2) return { ok: !1 };
    const v = d.pop(), x = d.pop();
    if (g === "&&" || g === "||") {
      d.push(g === "&&" ? !!x && !!v : !!x || !!v);
      continue;
    }
    if (g === "==" || g === "!=") {
      d.push(g === "==" ? x == v : x != v);
      continue;
    }
    if (g === "<" || g === "<=" || g === ">" || g === ">=") {
      const k = p(x), B = p(v);
      if (k === null || B === null) return { ok: !1 };
      g === "<" && d.push(k < B), g === "<=" && d.push(k <= B), g === ">" && d.push(k > B), g === ">=" && d.push(k >= B);
      continue;
    }
    const M = p(x), m = p(v);
    if (M === null || m === null) return { ok: !1 };
    let b;
    if (g === "+") b = M + m;
    else if (g === "-") b = M - m;
    else if (g === "*") b = M * m;
    else if (g === "/") b = M / m;
    else if (g === "%") b = M % m;
    else return { ok: !1 };
    if (!Number.isFinite(b)) return { ok: !1 };
    d.push(b);
  }
  if (d.length !== 1) return { ok: !1 };
  const h = d[0];
  return typeof h == "number" && Number.isFinite(h) ? { ok: !0, value: h } : typeof h == "boolean" ? { ok: !0, value: h } : { ok: !1 };
}
const Ya = "\0[]";
function Xn(e) {
  return `${e}.${Ya}`;
}
function mt(e) {
  return e.endsWith(`.${Ya}`);
}
const Ge = /* @__PURE__ */ new WeakMap(), Mn = /* @__PURE__ */ new WeakMap(), Br = /* @__PURE__ */ new WeakMap();
function vo(e) {
  const t = e.refSubscribers;
  let n = Br.get(t);
  if (n === void 0) {
    n = 0;
    for (const r of Object.keys(t)) mt(r) && n++;
    Br.set(t, n);
  }
  return n;
}
function Xa(e, t) {
  const n = e.refSubscribers;
  Br.set(n, vo(e) + t);
}
function Bn(e, t) {
  if (vo(e) === 0) return;
  let n = Ge.get(e);
  n || Ge.set(e, n = { keys: /* @__PURE__ */ new Set(), all: !1 }), n.all || n.keys.add(t);
}
function Za(e) {
  if (vo(e) === 0) return;
  let t = Ge.get(e);
  t || Ge.set(e, t = { keys: /* @__PURE__ */ new Set(), all: !0 }), t.all = !0, t.keys.clear();
}
function Qa(e) {
  const t = Ge.get(e);
  if (!t || !t.all && t.keys.size === 0) return [];
  Ge.delete(e);
  const n = e.refSubscribers, r = /* @__PURE__ */ new Set();
  if (t.all)
    for (const i of Object.keys(n)) mt(i) && r.add(i);
  else
    for (const i of t.keys) {
      let a = i.indexOf(".");
      for (; a !== -1; ) {
        const s = Xn(i.slice(0, a));
        n[s] && r.add(s), a = i.indexOf(".", a + 1);
      }
    }
  const o = [...r];
  for (const i of o) e.refVersions[i] = (e.refVersions[i] ?? 0) + 1;
  if (o.length > 0) {
    const i = Mn.get(e);
    Mn.set(e, i ? i.concat(o) : o);
  }
  return o;
}
function ii(e) {
  const t = Mn.get(e);
  return t ? (Mn.delete(e), t) : [];
}
function Cr(e, t, n, r) {
  return Ea(e, t, n, r);
}
function ai(e, t, n) {
  return {
    label: e.text,
    path: Sa(e),
    kind: "aggregate",
    value: n.value,
    origin: "public",
    masked: !1,
    status: n.status,
    aggregate: {
      collection: We(e.collection),
      field: e.field ? e.field.join(".") : null,
      op: e.op,
      context: t,
      coverage: t,
      status: n.status,
      ...n.reason ? { reason: n.reason } : {},
      members: n.members,
      terms: n.terms,
      domain: n.domain,
      ...n.problems ? { problems: n.problems } : {}
    }
  };
}
const hl = (e, t) => e.path < t.path ? -1 : e.path > t.path ? 1 : 0;
function Ar(e, t, n) {
  const r = [
    ...t.map((c) => ({ path: c, status: "missing" })),
    ...n.filter((c) => c.status !== "resolved").map((c) => ({ path: c.path, status: c.status }))
  ].sort(hl), o = (c) => [...new Set(c)].sort();
  if (n.some((c) => c.status === "cycle")) return { reason: "cycle", cycle: [e ?? ""] };
  const i = n.filter((c) => c.status === "absent").map((c) => c.path);
  if (t.length > 0 || i.length > 0)
    return { reason: "missing-input", inputs: o([...t, ...i]), causes: r };
  const a = n.filter((c) => c.status === "incomplete").map((c) => c.path);
  if (a.length > 0) return { reason: "incomplete", inputs: o(a), causes: r };
  const s = n.filter((c) => c.status !== "resolved").map((c) => c.path);
  return { reason: "evaluation-failed", inputs: o(s), causes: r };
}
function pl(e, t) {
  const n = e._currentCallerScope;
  if (n === void 0) return !1;
  const r = typeof n == "string" && n.length > 0 ? n : null;
  return !!e.isStealthBlocked?.(t, r);
}
function si(e) {
  return {
    k: e.recomputed.size,
    recomputed: [...e.recomputed].map((t) => ze(t)),
    changed: [...e.changed].map((t) => ze(t)),
    sourcePath: ze(e.sourcePath),
    recomputedAt: e.at
  };
}
function yl(e, t) {
  const n = String(t ?? "").trim(), r = pt(n);
  if (r.kind === "aggregate") {
    const m = Cr(e, r.ref, "public-view"), b = ai(r.ref, "public-view", m), k = m.status === "resolved" ? void 0 : Ar(void 0, [], [{ path: b.path, status: m.status }]);
    return {
      path: b.path,
      value: m.value,
      expr: r.ref.text,
      derivation: { expression: r.ref.text, inputs: [b] },
      meta: {
        dependsOn: [b.path],
        ...k ? { unresolved: k } : {}
      }
    };
  }
  if (r.kind === "rejected")
    return {
      path: n,
      value: void 0,
      expr: null,
      derivation: null,
      meta: { dependsOn: [], unresolved: { reason: "evaluation-failed", detail: r.reason } }
    };
  const o = String(t ?? "").split(".").filter(Boolean), i = F(o), a = i.join(".");
  if (e.derivations[a]?.aggregates?.length && pl(e, i))
    return { path: r.kind === "literal" ? We(i) : a, value: void 0, expr: null, derivation: null, meta: { dependsOn: [] } };
  e.recomputeMode === "lazy" && Rn(e, a);
  const s = r.kind === "literal" ? e.readPath(o) : e.readPath(i), c = r.kind === "literal" ? We(i) : a, u = e.derivations[a], f = e.lastRecomputeWaveByTarget[a];
  if (!u)
    return {
      path: c,
      value: s,
      expr: null,
      derivation: null,
      meta: {
        dependsOn: [],
        ...f ? si(f) : {}
      }
    };
  const p = u.refs.map((m) => ({
    label: m.label,
    path: os(e, m.label, u.evalScope) ?? m.candidates[0]
  })), d = p.map((m) => {
    const b = F(m.path.split(".").filter(Boolean)), k = me(e, b), B = !!(k && k.length > 0 && Ne(b, k)), D = e.readPath(b);
    return {
      label: m.label,
      path: ze(m.path),
      value: B ? "●●●●" : D,
      origin: B ? "stealth" : "public",
      masked: B,
      status: B ? "masked" : D == null ? "missing" : "resolved"
    };
  }), h = ds(e, a), y = (u.aggregates ?? []).map((m) => ai(m, h, Cr(e, m, h, a)));
  d.push(...y);
  const g = new Set(y.map((m) => m.path)), v = (m) => g.has(m) ? m : ze(m), x = u.unresolved, M = x ? x.reason === "cycle" ? { ...x, cycle: x.cycle.map(v) } : {
    ...x,
    ..."inputs" in x && x.inputs ? { inputs: x.inputs.map(v) } : {},
    ..."causes" in x && x.causes ? { causes: x.causes.map((m) => ({ ...m, path: v(m.path) })) } : {}
  } : void 0;
  return {
    path: c,
    value: s,
    expr: u.expression,
    derivation: {
      expression: u.expression,
      inputs: d
    },
    meta: {
      dependsOn: [.../* @__PURE__ */ new Set([...p.map((m) => ze(m.path)), ...y.map((m) => m.path)])],
      lastComputedAt: u.lastComputedAt,
      ...M ? { unresolved: M } : {},
      ...f ? si(f) : {}
    }
  };
}
function es(e, t) {
  return e.activeRecomputeWave ? !1 : (e.activeRecomputeWave = {
    sourcePath: t,
    recomputed: /* @__PURE__ */ new Set(),
    changed: /* @__PURE__ */ new Set(),
    at: Date.now()
  }, !0);
}
function ml(e, t, n) {
  const r = e.activeRecomputeWave;
  r && (r.recomputed.add(t), n && r.changed.add(t));
}
function rt(e) {
  const t = e.activeRecomputeWave;
  if (!t || (e.activeRecomputeWave = null, t.recomputed.size === 0)) return;
  const n = {
    sourcePath: t.sourcePath,
    recomputed: new Set(t.recomputed),
    changed: new Set(t.changed),
    at: Date.now()
  };
  for (const r of n.recomputed)
    e.lastRecomputeWaveByTarget[r] = n;
}
function ts(e) {
  const t = String(e ?? "").trim();
  if (!t) return [];
  const n = /* @__PURE__ */ new Set();
  for (const r of ns(t))
    r.aggregate || gl.has(r.text) || n.add(r.text);
  return Array.from(n);
}
const ot = String.raw`[A-Za-z_][A-Za-z0-9_]*(?:\[(?:"[^"]*"|'[^']*'|[^\]]+)\])*`, gl = /* @__PURE__ */ new Set(["true", "false", "null", "undefined", "NaN", "Infinity"]);
function ns(e) {
  const t = new RegExp(
    String.raw`(${lo(ot)})|__ptr(?:\.${ot})*|${ot}(?:\.${ot})*`,
    "g"
  ), n = [];
  for (const r of e.matchAll(t)) n.push({ text: r[0], aggregate: r[1] !== void 0 });
  return n;
}
function bl(e) {
  const t = String(e ?? "");
  if (!t.includes("[")) return !1;
  if (/\.\[\s*(["'])[^"']*[\[\]][^"']*\1\s*\]/.test(t) || /\[\s+\]/.test(t.replace(/"[^"]*"|'[^']*'/g, '""'))) return !0;
  const n = [], r = new RegExp(String.raw`${lo(ot)}`, "g");
  for (const i of t.matchAll(r)) {
    if (pt(i[0]).kind !== "aggregate") return !0;
    n.push([i.index, i.index + i[0].length]);
  }
  let o = null;
  for (let i = 0; i < t.length - 1; i++) {
    const a = t[i];
    if (o) {
      a === o && (o = null);
      continue;
    }
    if (a === '"' || a === "'") {
      o = a;
      continue;
    }
    if (a === "[" && t[i + 1] === "]" && !n.some(([s, c]) => i >= s && i < c)) return !0;
  }
  return !1;
}
function xl(e) {
  const t = String(e ?? "").trim();
  if (!t || !t.includes("[]")) return [];
  const n = [], r = /* @__PURE__ */ new Set();
  for (const o of ns(t)) {
    if (!o.aggregate || r.has(o.text)) continue;
    r.add(o.text);
    const i = pt(o.text);
    i.kind === "aggregate" && n.push(i.ref);
  }
  return n;
}
function rs(e, t) {
  if (!e || e.startsWith("__ptr.")) return [];
  const n = F(e.split(".").filter(Boolean));
  if (n.length === 0) return [];
  const r = F([...t, ...n]).join("."), o = F(n).join(".");
  return r === o ? [r] : [r, o];
}
function os(e, t, n) {
  const r = rs(t, n);
  if (r.length === 0) return null;
  const [o, i] = r;
  if (!i) return o;
  const a = e.readPath(o.split(".").filter(Boolean));
  return a == null ? i : o;
}
function is(e, t) {
  const n = e.readPath(t.split(".").filter(Boolean));
  return n != null;
}
function vl(e, t, n) {
  const [r, o] = t.candidates;
  return n === r || t.via && t.via[0]?.includes(n) ? !0 : o !== void 0 && (n === o || t.via && t.via[1]?.includes(n)) ? !is(e, r) : !1;
}
function as(e, t, n) {
  return mt(n) ? !!t.aggregates?.some((r) => Xn(r.collection.join(".")) === n) : t.refs.some((r) => vl(e, r, n));
}
function Re(e) {
  if (e.refPaths) return e.refPaths;
  const t = /* @__PURE__ */ new Set();
  for (const n of e.refs) {
    for (const r of n.candidates) t.add(r);
    if (n.via) {
      for (const r of n.via) if (r) for (const o of r) t.add(o);
    }
  }
  for (const n of e.aggregates ?? []) t.add(Xn(n.collection.join(".")));
  return e.refPaths = [...t];
}
function Sl(e, t) {
  const n = [];
  let r = t.indexOf(".");
  for (; r !== -1; ) {
    const o = e.refSubscribers[Xn(t.slice(0, r))];
    if (o) for (const i of o) n.push(i);
    r = t.indexOf(".", r + 1);
  }
  return n;
}
const Cn = /* @__PURE__ */ new WeakMap();
function An(e) {
  const t = e.lastIndexOf(".");
  return t < 0 ? null : e.slice(0, t);
}
function ss(e, t) {
  let n = t, r = An(n);
  for (; r !== null; ) {
    let o = e.get(r);
    if (!o) e.set(r, o = /* @__PURE__ */ new Set());
    else if (o.has(n)) return;
    o.add(n), n = r, r = An(n);
  }
}
function wl(e, t, n) {
  let r = n, o = An(r);
  for (; o !== null; ) {
    if (e.refSubscribers[r] || t.get(r)?.size) return;
    const i = t.get(o);
    if (!i || (i.delete(r), i.size > 0)) return;
    t.delete(o), r = o, o = An(r);
  }
}
function kl(e) {
  let t = Cn.get(e.refSubscribers);
  if (t) return t;
  t = /* @__PURE__ */ new Map();
  for (const n of Object.keys(e.refSubscribers)) ss(t, n);
  return Cn.set(e.refSubscribers, t), t;
}
function cs(e, t, n) {
  let r = e.refSubscribers[t];
  if (!r) {
    mt(t) && Xa(e, 1), r = e.refSubscribers[t] = /* @__PURE__ */ new Set();
    const o = Cn.get(e.refSubscribers);
    o && ss(o, t);
  }
  r.add(n);
}
function us(e, t, n) {
  const r = e.refSubscribers[t];
  if (!r || (r.delete(n), r.size > 0)) return;
  mt(t) && Xa(e, -1), delete e.refSubscribers[t];
  const o = Cn.get(e.refSubscribers);
  o && wl(e, o, t);
}
function El(e, t) {
  const n = kl(e), r = [], o = [...n.get(t) || []];
  for (; o.length > 0; ) {
    const i = o.pop();
    e.refSubscribers[i] && r.push(i);
    const a = n.get(i);
    if (a) for (const s of a) o.push(s);
  }
  return r;
}
function ls(e, t) {
  let n;
  for (let r = 0; r < t.candidates.length; r++) {
    const o = t.candidates[r];
    if (!Ds(e, o)) continue;
    const i = tf(e, o.split(".").filter(Boolean)), a = [...new Set(i)].filter((s) => s !== o);
    a.length > 0 && ((n ||= [])[r] = a);
  }
  n ? t.via = n : t.via && delete t.via;
}
function Ml(e, t, n) {
  n.viaStale = !1;
  const r = Re(n);
  for (const a of n.refs) ls(e, a);
  n.refPaths = void 0;
  const o = Re(n), i = new Set(o);
  for (const a of r) i.has(a) || us(e, a, t);
  for (const a of o) cs(e, a, t);
}
function So(e, t) {
  const n = e.derivations[t];
  if (n) {
    for (const r of Re(n)) us(e, r, t);
    delete e.derivations[t], delete e.derivationRefVersions[t], delete e.lastRecomputeWaveByTarget[t], e.staleDerivations.delete(t);
  }
}
function Zn(e, t) {
  return e.refVersions[t] ?? 0;
}
function _n(e, t) {
  e.refVersions[t] = Zn(e, t) + 1;
}
function wo(e, t) {
  const n = e.derivations[t];
  if (!n) return;
  const r = {};
  for (const o of Re(n)) r[o] = Zn(e, o);
  e.derivationRefVersions[t] = r;
}
function fs(e, t, n, r) {
  const o = t.join(".");
  So(e, o);
  const i = ts(r), a = [];
  for (const u of i) {
    const f = rs(u, n);
    if (f.length === 0) continue;
    const p = { label: u, candidates: f };
    ls(e, p), a.push(p);
  }
  const s = xl(r), c = e.derivations[o] = {
    expression: r,
    evalScope: [...n],
    refs: a,
    lastComputedAt: Date.now(),
    ...s.length > 0 ? { aggregates: s } : {},
    ...bl(r) ? { rejectedPathForm: !0 } : {}
  };
  for (const u of Re(c)) cs(e, u, o);
  wo(e, o), e.staleDerivations.delete(o);
}
function ko(e, t, n) {
  if (t.rejectedPathForm) return { value: void 0, unresolved: { reason: "evaluation-failed", detail: "rejected-path-form" } };
  const r = () => {
    const s = [];
    for (const c of t.refs)
      c.candidates.some((u) => is(e, u)) || s.push(c.candidates[0]);
    return s;
  };
  let o;
  if (t.aggregates && t.aggregates.length > 0 && !dl(t.expression))
    return { value: void 0, unresolved: { reason: "evaluation-failed" } };
  if (t.aggregates && t.aggregates.length > 0) {
    const s = ds(e, n), c = t.aggregates.map((u) => ({ ref: u, path: Sa(u), r: Cr(e, u, s, n) }));
    if (c.some((u) => u.r.status !== "resolved"))
      return {
        value: void 0,
        unresolved: Ar(n, r(), c.map((u) => ({ path: u.path, status: u.r.status })))
      };
    o = new Map(c.map((u) => [u.ref.text, u.r.value]));
  }
  const i = xo(e, t.evalScope, t.expression, o);
  if (i.ok) return { value: i.value };
  const a = r();
  return o ? a.length > 0 ? { value: void 0, unresolved: Ar(n, a, []) } : { value: void 0, unresolved: { reason: "evaluation-failed" } } : a.length > 0 ? { value: void 0, unresolved: { reason: "missing-input", inputs: a } } : { value: void 0, unresolved: { reason: "evaluation-failed" } };
}
function ds(e, t) {
  if (t === void 0) return "public-view";
  const n = t.split(".").filter(Boolean);
  for (let r = n.length; r >= 0; r--)
    if (Object.prototype.hasOwnProperty.call(e.localSecrets, n.slice(0, r).join("."))) return "authorized";
  return "public-view";
}
function Bl(e, t) {
  return Object.is(e, t) ? e === null || typeof e != "object" : !1;
}
function Eo(e, t, n, r) {
  const o = e.derivations[t];
  if (!o) return !1;
  o.unresolved = r, o.lastComputedAt = Date.now();
  const i = F(t.split(".").filter(Boolean)), a = "lastValue" in o ? o.lastValue : Cl(e, t, i), s = !Bl(a, n);
  return ml(e, t, s), s && (e.commitValueMapping(i, n, "="), _n(e, t), Qa(e)), o.lastValue = n, (o.viaStale || o.refs.some((c) => c.via)) && Ml(e, t, o), wo(e, t), e.staleDerivations.delete(t), s;
}
function _r(e, t) {
  const n = e.derivations[t];
  if (!n) return !1;
  const { value: r, unresolved: o } = ko(e, n, t);
  return Eo(e, t, r, o);
}
function Rr(e, t) {
  const n = [...t].sort(), r = /* @__PURE__ */ new Set();
  for (const o of n)
    Eo(e, o, void 0, { reason: "cycle", cycle: n }) && r.add(o);
  return r;
}
function hs(e, t) {
  const n = e.derivations[t];
  if (!n) return !1;
  const r = e.derivationRefVersions[t] || {};
  for (const o of Re(n))
    if ((r[o] ?? 0) !== Zn(e, o) && as(e, n, o)) return !0;
  return !1;
}
const Ir = /* @__PURE__ */ new WeakMap(), ci = /* @__PURE__ */ new WeakMap();
function Cl(e, t, n) {
  let r = Ir.get(e);
  r || Ir.set(e, r = /* @__PURE__ */ new Set()), r.add(t);
  try {
    return e.readPath(n);
  } finally {
    r.delete(t);
  }
}
function Rn(e, t, n = { stack: [], resolvedAsCycle: /* @__PURE__ */ new Set() }) {
  if (e.recomputeMode !== "lazy") return !1;
  const r = e.derivations[t];
  if (!r) return !1;
  const o = n.stack.indexOf(t);
  if (o >= 0) {
    const f = n.stack.slice(o);
    Rr(e, f);
    for (const p of f) n.resolvedAsCycle.add(p);
    return !1;
  }
  if (n.resolvedAsCycle.has(t) || Ir.get(e)?.has(t)) return !1;
  let i = ci.get(e);
  i || ci.set(e, i = /* @__PURE__ */ new Map());
  const a = i.get(t);
  if (a)
    return a.reentered = !0, !1;
  const s = { reentered: !1 };
  i.set(t, s);
  const c = es(e, t);
  let u = !1;
  try {
    n.stack.push(t);
    for (const p of Re(r))
      e.derivations[p] && Rn(e, p, n);
    for (const p of r.aggregates ?? [])
      ka(e, p.collection.join("."), t, (d) => Rn(e, d, n));
    if (n.stack.pop(), !n.resolvedAsCycle.has(t) && (e.staleDerivations.has(t) || hs(e, t))) {
      const { value: p, unresolved: d } = ko(e, r, t);
      u = s.reentered ? Rr(e, [t]).size > 0 : Eo(e, t, p, d);
    }
  } finally {
    i.delete(t), c && rt(e);
  }
  return u;
}
function In(e, t) {
  ps(e, [F(t).join(".")]);
}
function ps(e, t, n) {
  const r = t.filter(Boolean), o = Qa(e);
  if (ii(e), r.length === 0 && o.length === 0) return;
  const i = es(e, r[0] ?? n ?? o[0]);
  for (const m of r) {
    _n(e, m);
    const b = e.derivations[m];
    b && delete b.lastValue;
  }
  for (const m of o) r.includes(m) || r.push(m);
  let a = null;
  const s = r.length;
  for (let m = 0; m < s; m++) {
    const b = r[m];
    if (Z(e.index[b])) {
      a ||= new Set(r);
      for (const k of [b, ...El(e, b)]) {
        for (const B of e.refSubscribers[k] || []) {
          const D = e.derivations[B];
          D && (D.viaStale = !0);
        }
        a.has(k) || (a.add(k), r.push(k), _n(e, k));
      }
    }
  }
  if (e.recomputeMode === "lazy") {
    i && rt(e);
    return;
  }
  const c = /* @__PURE__ */ new Set(), u = /* @__PURE__ */ new Map(), f = [...r], p = (m, b) => {
    const k = u.get(m);
    k ? k.push(b) : u.set(m, [b]), !c.has(b) && (c.add(b), f.push(b));
  };
  for (; f.length > 0; ) {
    const m = f.pop();
    for (const b of e.refSubscribers[m] || []) {
      const k = e.derivations[b];
      !k || !as(e, k, m) || p(m, b);
    }
    if (e.derivations[m])
      for (const b of Sl(e, m)) e.derivations[b] && p(m, b);
  }
  if (c.size === 0) {
    i && rt(e);
    return;
  }
  let d = !1;
  for (const m of u.keys())
    if (c.has(m)) {
      d = !0;
      break;
    }
  if (!d) {
    for (const m of c) _r(e, m);
    i && rt(e);
    return;
  }
  const h = /* @__PURE__ */ new Map();
  for (const m of c) h.set(m, 0);
  for (const [m, b] of u)
    if (c.has(m))
      for (const k of b) h.set(k, h.get(k) + 1);
  const y = new Set(r), g = /* @__PURE__ */ new Set(), v = [];
  for (const [m, b] of h) b === 0 && v.push(m);
  const x = (m) => {
    for (const b of u.get(m) || []) {
      if (g.has(b) || !c.has(b)) continue;
      const k = h.get(b) - 1;
      h.set(b, k), k === 0 && v.push(b);
    }
  };
  let M = 0;
  for (; g.size < c.size; ) {
    for (; M < v.length; ) {
      const k = v[M++];
      if (g.has(k)) continue;
      g.add(k);
      const B = e.derivations[k];
      B && Re(B).some((R) => y.has(R)) && _r(e, k) && y.add(k);
      for (const R of ii(e)) y.add(R);
      x(k);
    }
    if (g.size >= c.size) break;
    const m = [...c].filter((k) => !g.has(k)), b = Al(m, u);
    if (b.length === 0) break;
    for (const k of b) {
      for (const B of Rr(e, k)) y.add(B);
      for (const B of k) g.add(B);
      for (const B of k) x(B);
    }
  }
  i && rt(e);
}
function Al(e, t) {
  const n = new Set(e), r = /* @__PURE__ */ new Map(), o = /* @__PURE__ */ new Map(), i = /* @__PURE__ */ new Set(), a = [], s = [];
  let c = 0;
  for (const u of e) {
    if (r.has(u)) continue;
    const f = [{ node: u, i: 0 }];
    for (r.set(u, c), o.set(u, c++), a.push(u), i.add(u); f.length > 0; ) {
      const p = f[f.length - 1], d = (t.get(p.node) || []).filter((h) => n.has(h));
      if (p.i < d.length) {
        const h = d[p.i++];
        r.has(h) ? i.has(h) && o.set(p.node, Math.min(o.get(p.node), r.get(h))) : (r.set(h, c), o.set(h, c++), a.push(h), i.add(h), f.push({ node: h, i: 0 }));
        continue;
      }
      if (f.pop(), f.length > 0) {
        const h = f[f.length - 1].node;
        o.set(h, Math.min(o.get(h), o.get(p.node)));
      }
      if (o.get(p.node) === r.get(p.node)) {
        const h = [];
        let y;
        do
          y = a.pop(), i.delete(y), h.push(y);
        while (y !== p.node);
        const g = (t.get(p.node) || []).includes(p.node);
        (h.length > 1 || g) && s.push(h);
      }
    }
  }
  return s;
}
const Pn = /* @__PURE__ */ new WeakMap();
function _l(e) {
  const t = Pn.get(e.iteratorRules);
  if (t) return t;
  const n = { byPrefix: /* @__PURE__ */ new Map(), ancestors: /* @__PURE__ */ new Set() };
  for (const r of Object.values(e.iteratorRules)) {
    const o = r.prefix.join("."), i = n.byPrefix.get(o);
    i ? i.push(r) : n.byPrefix.set(o, [r]);
    for (let a = 0; a <= r.prefix.length; a++) n.ancestors.add(r.prefix.slice(0, a).join("."));
  }
  return Pn.set(e.iteratorRules, n), n;
}
function Rl(e, t, n) {
  e.iteratorRules[t] = n, Pn.delete(e.iteratorRules);
}
function ys(e, t) {
  const n = t.join(".");
  for (const [r, o] of Object.entries(e.iteratorRules)) {
    const i = o.prefix.join(".");
    (n === "" || i === n || i.startsWith(n + ".")) && (delete e.iteratorRules[r], Pn.delete(e.iteratorRules));
  }
  for (const r of Object.keys(e.derivations))
    (n === "" || r === n || r.startsWith(n + ".")) && So(e, r);
}
function Il(e, t, n = {}) {
  const { path: r, expression: o } = t, i = Hr(r, o);
  if (i)
    return {
      kind: "return",
      value: {
        define: i
      }
    };
  const a = Li(e, r, o);
  if (a)
    return {
      kind: "commit",
      instructions: [{ path: a.scopeKey ? a.scopeKey.split(".").filter(Boolean) : [], op: "secret", value: o }]
    };
  const s = qr(e, r, o);
  if (s)
    return {
      kind: "commit",
      instructions: [{ path: s.scopeKey ? s.scopeKey.split(".").filter(Boolean) : [], op: "noise", value: o }]
    };
  const c = zi(e, r, o);
  if (c) {
    const { scope: h } = le(r);
    return {
      kind: "commit",
      instructions: [{ path: h, op: "ptr", value: Ac(c.targetPath) }]
    };
  }
  const u = Wi(e, r, o);
  if (u)
    return {
      kind: "commit",
      instructions: [{ path: u.targetPath, op: "id", value: _c(u.id) }]
    };
  const f = Yr(e, r, o);
  if (f)
    return {
      kind: "commit",
      instructions: [{ path: f.targetPath, op: "remove", value: "-" }]
    };
  const p = Gr(e, r, o);
  if (p) {
    if (p.mode === "assign")
      return {
        kind: "commit",
        instructions: [
          {
            path: [...p.targetPath, p.name],
            op: "derive",
            value: {
              kind: "expr",
              source: p.expr
            }
          }
        ]
      };
    if (!n.evaluateThunk)
      throw new Error('Non-serializable derivation: "=" thunk requires `evaluateThunk` or serializable DNA.');
    const h = n.evaluateThunk(p.thunk);
    return p.targetPath.length === 0 ? { kind: "return", value: h } : {
      kind: "commit",
      instructions: [{ path: p.targetPath, op: "derive", value: h }]
    };
  }
  const d = Jr(e, r, o);
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
    const h = d.paths.map((g) => n.readPath(g.split(".").filter(Boolean))), y = d.fn ? d.fn(...h) : h;
    return d.targetPath.length === 0 ? { kind: "return", value: y } : {
      kind: "commit",
      instructions: [{ path: d.targetPath, op: "query", value: y }]
    };
  }
  return {
    kind: "commit",
    instructions: [{ path: r, op: "set", value: o }]
  };
}
const Pl = /* @__PURE__ */ Symbol.for("nodejs.util.inspect.custom"), ui = /* @__PURE__ */ Symbol.for("me.seed"), Pr = /* @__PURE__ */ Symbol.for("me.expression"), Dn = /* @__PURE__ */ Symbol.for("me.identity"), Mo = /* @__PURE__ */ Symbol.for("me.internal.setActiveExpression"), Dr = /* @__PURE__ */ Symbol.for("me.internal.reseed");
function Dl(e) {
  const { effectiveSecret: t, ...n } = e;
  return { ...n };
}
function Bo(e) {
  return e.map(Dl);
}
function Ol(e) {
  return { ...e };
}
function ms(e) {
  return e.map(Ol);
}
function Nl(e) {
  const t = e._currentCallerScope;
  if (t !== void 0)
    return typeof t == "string" && t.length > 0 ? t : null;
}
function Or(e, t, n = Nl(e)) {
  if (n === void 0) return !1;
  for (let r = t.length; r >= 0; r--) {
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
function On(e, t) {
  const n = F(t);
  if (n.length === 0) return e.readPath(n);
  if (!Or(e, n))
    return e.readPath(n);
}
function Co(e, t) {
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
    for (let c = 0; c < r.length; c++)
      if (a[c] !== r[c]) {
        s = !1;
        break;
      }
    s && o.add(a[r.length]);
  }
  return Array.from(o).sort((i, a) => {
    const s = Number(i), c = Number(a), u = Number.isFinite(s), f = Number.isFinite(c);
    return u && f ? s - c : u ? -1 : f ? 1 : i.localeCompare(a);
  });
}
function Nr(e, t, n) {
  const r = On(e, [...t, ...n]);
  return r ?? On(e, n);
}
function jr(e, t, n) {
  const r = F(n.left.split(".").filter(Boolean)), o = Nr(e, t, r);
  if (o == null) return !1;
  const i = ma(n.right), a = i.kind === "literal" ? i.value : Nr(e, t, i.parts);
  return a == null ? !1 : ya(o, n.op, a);
}
function Ao(e, t, n) {
  const r = Xe(n);
  if (!r) return !1;
  let o = jr(e, t, r.clauses[0]);
  for (let i = 1; i < r.clauses.length; i++) {
    const a = jr(e, t, r.clauses[i]);
    o = r.ops[i - 1] === "&&" ? o && a : o || a;
  }
  return o;
}
function Qn(e, t) {
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
function gs(e, t) {
  const n = t.findIndex((u) => {
    const f = Ae(u);
    return f ? wn(f.selector) !== null : !1;
  });
  if (n === -1) return;
  const r = Ae(t[n]);
  if (!r) return;
  const o = wn(r.selector);
  if (!o) return;
  const i = [...t.slice(0, n), r.base];
  if (t.slice(n + 1).length > 0) return;
  const s = Qn(e, i), c = {};
  for (const u of s) {
    const f = [...i, u], p = o.expr.replace(
      new RegExp(String.raw`\b${o.varName}\.`, "g"),
      ""
    ), d = xo(e, f, p);
    d.ok && (c[u] = d.value);
  }
  return c;
}
function bs(e, t) {
  const n = t.findIndex((c) => Ae(c) !== null);
  if (n === -1) return;
  const r = Ae(t[n]);
  if (!r) return;
  const o = uo(r.selector);
  if (o === null) return;
  const i = [...t.slice(0, n), r.base], a = t.slice(n + 1), s = {};
  for (const c of o) {
    const u = [...i, c], f = a.length === 0 ? _o(e, u) : On(e, [...u, ...a]);
    f !== void 0 && (s[c] = f);
  }
  return s;
}
function _o(e, t) {
  const r = F(t).join("."), o = {};
  let i = !1;
  for (const [a, s] of Object.entries(e.index)) {
    const c = a.split(".").filter(Boolean);
    if (a === r)
      return Or(e, c) ? void 0 : s;
    if (!a.startsWith(r + ".") || Or(e, c)) continue;
    const u = a.slice(r.length + 1).split(".").filter(Boolean);
    let f = o;
    for (let p = 0; p < u.length - 1; p++) {
      const d = u[p];
      (!f[d] || typeof f[d] != "object") && (f[d] = {}), f = f[d];
    }
    f[u[u.length - 1]] = s, i = !0;
  }
  return i ? o : void 0;
}
function xs(e, t) {
  const n = t.findIndex((c) => Xe(c) !== null);
  if (n === -1) return;
  const r = t[n], o = t.slice(0, n), i = t.slice(n + 1);
  if (o.length === 0) return;
  const a = Qn(e, o), s = {};
  for (const c of a) {
    const u = [...o, c];
    Ao(e, u, r) && (i.length === 0 ? s[c] = _o(e, u) : s[c] = On(e, [...u, ...i]));
  }
  return s;
}
function vs(e, t) {
  return t.some((n) => {
    const r = Ae(n);
    return r ? Xe(r.selector) !== null : !1;
  });
}
function Ss(e, t) {
  const n = t.findIndex((c) => {
    const u = Ae(c);
    return u ? Xe(u.selector) !== null : !1;
  });
  if (n === -1) return [];
  const r = Ae(t[n]);
  if (!r) return [];
  const o = [...t.slice(0, n), r.base], i = t.slice(n + 1), a = Qn(e, o), s = [];
  for (const c of a) {
    const u = [...o, c];
    Ao(e, u, r.selector) && s.push([...u, ...i]);
  }
  return s;
}
function Ro() {
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
function W() {
  return typeof performance < "u" && typeof performance.now == "function" ? performance.now() : Date.now();
}
function $e(e, t = /* @__PURE__ */ new WeakSet()) {
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
      for (const i of e) o += $e(i, t);
      return o;
    }
    let r = 32;
    for (const [o, i] of Object.entries(e))
      r += o.length * 2, r += $e(i, t);
    return r;
  }
  return 0;
}
function jl(e, t, n, r, o, i, a, s, c, u, f) {
  const p = e.__persistSecretBranchDebug;
  if (!p?.enabled) return;
  const d = p.window ?? (p.window = Ro()), h = $e(t), y = $e(n), g = $e(r), v = $e(o);
  d.writes += 1, i && (d.columnarWrites += 1), d.maxBranchBytes = Math.max(d.maxBranchBytes, h), d.maxCacheSeedBytes = Math.max(d.maxCacheSeedBytes, y), d.maxEncryptableBytes = Math.max(d.maxEncryptableBytes, g), d.maxBlobBytes = Math.max(d.maxBlobBytes, v), d.totalColumnarMaterializeMs += u, d.totalPrepareColumnarMs += f, d.totalKeyDeriveMs += a, d.totalEncryptMs += s, d.totalSetBlobMs += c, d.maxColumnarMaterializeMs = Math.max(d.maxColumnarMaterializeMs, u), d.maxPrepareColumnarMs = Math.max(d.maxPrepareColumnarMs, f), d.maxKeyDeriveMs = Math.max(d.maxKeyDeriveMs, a), d.maxEncryptMs = Math.max(d.maxEncryptMs, s), d.maxSetBlobMs = Math.max(d.maxSetBlobMs, c);
}
function li(e, t, n, r) {
  const o = e.__persistSecretBranchDebug;
  if (!o?.enabled) return;
  const i = o.window ?? (o.window = Ro());
  i.totalLoadChunkMs += t, i.totalMaterializeMs += n, i.totalCloneMs += r, i.maxLoadChunkMs = Math.max(i.maxLoadChunkMs, t), i.maxMaterializeMs = Math.max(i.maxMaterializeMs, n), i.maxCloneMs = Math.max(i.maxCloneMs, r);
}
function ws(e, t, n) {
  e.has(t) && e.delete(t), e.set(t, n);
}
function Kl(e, t) {
  for (; e.size > t; ) {
    const n = e.keys().next();
    if (n.done) return;
    e.delete(n.value);
  }
}
function Vl(e) {
  const t = Number(e.__writeBranchCacheConfig?.limit);
  return Number.isFinite(t) && t > 0 ? Math.floor(t) : 8;
}
function ks(e) {
  return e.__writeBranchCacheConfig?.enabled === !0;
}
function fi(e, t, n) {
  const r = e.__persistSecretBranchDebug;
  if (!r?.enabled) return;
  const o = r.window ?? (r.window = Ro());
  t ? (o.writeCacheHits += 1, o.totalWriteCacheHitMs += n, o.maxWriteCacheHitMs = Math.max(o.maxWriteCacheHitMs, n)) : o.writeCacheMisses += 1;
}
function Fl(e, t, n, r) {
  if (!ks(e)) return;
  const o = W(), i = `${t.join(".")}::${n}`, a = e.writeBranchCache.get(i);
  if (a && a.epoch === e.secretEpoch && a.blob === r)
    return ws(e.writeBranchCache, i, a), fi(e, !0, W() - o), a.data;
  fi(e, !1, 0);
}
function Ul(e, t, n, r, o) {
  if (!ks(e)) return;
  const i = `${t.join(".")}::${n}`;
  ws(e.writeBranchCache, i, {
    epoch: e.secretEpoch,
    blob: r,
    data: o
  }), Kl(e.writeBranchCache, Vl(e));
}
function Tl(e, t, n) {
  const o = fa(t).join(".");
  e.localSecrets[o] = n, e.protectedScopeKeys.add(o), e._ownerScope = n;
}
function $l(e, t) {
  const n = Y(t ?? {}), r = String(n.path || "").split(".").filter(Boolean);
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
  Es(e, r, n.expression, n.operator ?? null, n.value);
}
function Ll(e, t) {
  e.localSecrets = {}, e.localNoises = {}, e.protectedScopeKeys.clear(), e.branchStore.clear(), e.keySpaces = {}, e._ownerScope = null, e._currentCallerScope = void 0, ae(e), e.index = {}, e.indexWinner = {}, e.seqCounter = 0, e._memories = [], e.derivations = {}, e.iteratorRules = {}, e.refSubscribers = {}, e.refVersions = {}, e.derivationRefVersions = {}, e.staleDerivations.clear(), e.lastRecomputeWaveByTarget = {}, e.activeRecomputeWave = null;
  for (const n of ms(t || [])) {
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
    Es(e, r, n.expression, n.operator, n.value);
  }
  e.rebuildIndex();
}
function Es(e, t, n, r, o) {
  if (n === we) {
    Je(e, t, r, n, o);
    return;
  }
  e.postulate(t, n, r);
}
function Je(e, t, n, r, o) {
  const i = t.join("."), a = oe(e, t), s = Hn(e), c = JSON.stringify({
    path: i,
    operator: n,
    expression: r,
    value: o,
    effectiveSecret: a,
    prevHash: s
  }), u = pe(c), f = Date.now(), p = e.seqCounter++, d = {
    path: i,
    operator: n,
    expression: r,
    value: o,
    effectiveSecret: a,
    hash: u,
    prevHash: s,
    timestamp: f,
    seq: p
  };
  return e._memories.push(d), e.applyMemoryToIndex(d), d;
}
function zl(e) {
  const t = e[0], n = e[e.length - 1], r = e.length > 2 ? e[Math.floor(e.length / 2)] : null;
  return pe(JSON.stringify({
    count: e.length,
    firstId: t?.id ?? null,
    lastId: n?.id ?? null,
    middleId: r?.id ?? null
  }));
}
function Wl(e, t, n, r, o) {
  const i = "commitIndexedBatch", a = oe(e, t), s = Hn(e), c = Date.now(), u = {
    basePath: t.join("."),
    startIndex: n,
    count: r.length,
    batchHash: zl(r),
    firstId: r[0]?.id ?? null,
    lastId: r[r.length - 1]?.id ?? null
  }, f = JSON.stringify({
    path: i,
    operator: o,
    expression: u,
    value: u,
    effectiveSecret: a,
    prevHash: s
  }), p = pe(f), d = e.seqCounter++, h = {
    path: i,
    operator: o,
    expression: u,
    value: u,
    effectiveSecret: a,
    hash: p,
    prevHash: s,
    timestamp: c,
    seq: d
  };
  return e._memories.push(h), e.applyMemoryToIndex(h), h;
}
function Ms(e, t, n, r) {
  let o = {};
  const i = Yn(e, t, r);
  if (i) {
    const p = Fl(e, t, r, i);
    if (p && typeof p == "object") {
      const d = W(), h = Y(p), y = W() - d;
      return li(e, 0, 0, y), h;
    }
  }
  const a = W(), s = he(e, t, n, r), c = W() - a;
  let u = 0, f = 0;
  if (s && typeof s == "object") {
    const p = W(), d = Ha(s);
    if (u = W() - p, d && typeof d == "object") {
      const h = W();
      o = Y(d), f = W() - h;
    }
  }
  return li(e, c, u, f), o;
}
function Bs(e) {
  return !!e && typeof e == "object" && !Array.isArray(e) && Object.keys(e).length === 0;
}
function Cs(e, t, n, r, o) {
  if (e.secretBlobVersion === "v2")
    return oa(r, o, t);
  if (e.identityRootUnwrapped) {
    const a = ho(e, t, n);
    return na(r, a);
  }
  const i = qn(e, t, n);
  return ra(r, i);
}
function Io(e, t, n, r, o, i = !0) {
  const a = Array.isArray(o) && Xu(o);
  let s = 0, c = 0, u = o, f = o;
  if (a) {
    const M = W();
    u = Zu(o), s = W() - M;
    const m = W();
    f = el(u), c = W() - m;
  }
  let p = 0;
  const d = W(), h = W(), y = Cs(e, t, "branch", f, n);
  p = e.secretBlobVersion === "v2" ? 0 : W() - h;
  const g = W() - d, v = W();
  go(e, t, r, y, n);
  const x = W() - v;
  Ul(e, t, r, y, o), jl(
    e,
    o,
    u,
    f,
    y,
    a,
    p,
    g,
    x,
    s,
    c
  ), i && fl(e, t, r, u);
}
function Hl(e, t, n, r, o, i = !0) {
  if (!n || o.length === 0) return;
  let a = Ms(e, t, n, r);
  Bs(a) && (a = En(o[0]?.rel ?? []));
  for (const { rel: s, value: c } of o) {
    if (s.length === 0) {
      if (typeof a != "object" || a === null) continue;
      a.expression = c;
      continue;
    }
    Jn(a, s, c);
  }
  Io(e, t, n, r, a, i);
}
function ql(e, t, n, r, o = null) {
  if (!Array.isArray(r) || r.length === 0) return [];
  const i = /* @__PURE__ */ new Map();
  let a = [];
  for (let c = 0; c < r.length; c++) {
    const u = n + c, f = [...t, String(u)], p = me(e, f);
    if (!p || p.length === 0) {
      Ee(e, f, r[c], o), a.push(f);
      continue;
    }
    const d = oe(e, p);
    if (!d) {
      Ee(e, f, r[c], o), a.push(f);
      continue;
    }
    const h = Ze(e, f, p), y = Gn(e, f, p), g = `${p.join(".")}::${h}`;
    let v = i.get(g);
    v || (v = { scope: p, scopeSecret: d, chunkId: h, relEntries: [] }, i.set(g, v)), v.relEntries.push({ rel: y, value: r[c] }), a.push(f);
  }
  for (const c of i.values())
    Hl(e, c.scope, c.scopeSecret, c.chunkId, c.relEntries, !1);
  for (const c of a)
    In(e, c), Vr(e, c);
  return [Wl(e, t, n, r, o ?? "batch_set")];
}
const we = "***";
function Gl(e, t) {
  for (const n of e.protectedScopeKeys) {
    const r = n.split(".").filter(Boolean);
    if (Ne(t, r)) return !0;
  }
  for (const n of e.branchStore.listScopes()) {
    const r = n.split(".").filter(Boolean);
    if (r.length !== 0 && Ne(t, r))
      return !0;
  }
  return !1;
}
function Ee(e, t, n, r = null) {
  let o = n, i = n;
  const a = t.join("."), s = oe(e, t), c = me(e, t);
  if (c && c.length === 0 && e.localSecrets[""] && e.localSecrets[a], c && c.length > 0) {
    const u = oe(e, c), f = Gn(e, t, c), p = Ze(e, t, c);
    let d = En(f);
    u && (d = Ms(e, c, u, p), Bs(d) && (d = En(f))), f.length === 0 ? ((typeof d != "object" || d === null) && (d = {}), d.expression = n) : Jn(d, f, n), u && Io(e, c, u, p, d), o = we, i = we;
  } else if (s) {
    const u = r !== "=" && r !== "?";
    Z(n) || at(n) || !u ? o = n : (o = Cs(e, t, "value", n, s), i = we);
  } else if (Gl(e, t)) {
    const u = Object.prototype.hasOwnProperty.call(e.index, a), f = e.index[a];
    o = we, i = we;
    const p = Je(e, t, r, i, o);
    return u ? e.index[a] = f : delete e.index[a], p;
  } else
    o = n;
  return Je(e, t, r, i, o);
}
function As(e, t, n = null) {
  switch (t.op) {
    case "set":
      return Ee(e, t.path, t.value, n);
    case "ptr":
      return Ee(e, t.path, t.value, "__");
    case "id":
      return Ee(e, t.path, t.value, "@");
    case "secret": {
      if (typeof t.value != "string") return;
      const r = fa(t.path);
      return Tl(e, r, t.value), ae(e), Je(e, r, "_", "***", "***");
    }
    default:
      return;
  }
}
function Nn(e, t, n, r = null) {
  const o = t, i = Hr(o, n);
  if (i) {
    e.operators[i.op] = { kind: i.kind };
    return;
  }
  const { leaf: a } = le(o), s = a ? e.opKind(a) : null;
  if (s === null || s === "secret" || s === "pointer" || s === "identity") {
    const y = Il(e.operators, { path: o, expression: n });
    if (y.kind === "commit") {
      const g = /* @__PURE__ */ new Set(["set", "secret", "ptr", "id"]);
      if (y.instructions.every((x) => g.has(x.op))) {
        let x;
        const M = [];
        for (const m of y.instructions) {
          const b = As(e, m, r);
          if (b) {
            if (m.op === "id" && m.path.length === 0 && at(m.value)) {
              const k = e[Mo];
              typeof k == "function" && k(m.value.__id);
            }
            x = b, M.push(b.path.split(".").filter(Boolean));
          }
        }
        if (x) {
          for (const m of M) In(e, m);
          for (const m of M) Vr(e, m);
          return x;
        }
      }
    }
  }
  const u = Gr(e.operators, o, n);
  if (u) {
    if (u.mode === "thunk") {
      const v = u.thunk();
      return u.targetPath.length === 0 ? v : Nn(e, u.targetPath, v, "=");
    }
    if (da(u.targetPath)) {
      const v = {
        targetPath: [...u.targetPath],
        prefix: Jl(u.targetPath),
        name: u.name,
        expr: u.expr
      };
      Rl(e, Yl(v), v);
      let x;
      for (const M of Co(e, u.targetPath))
        x = _s(e, v, M);
      return x;
    }
    if (vs(e, u.targetPath)) {
      const v = Ss(e, u.targetPath);
      let x;
      for (const M of v) {
        const m = F(M), b = F([...m, u.name]);
        x = Kr(e, b, m, u.expr);
      }
      return x;
    }
    const y = F([...u.targetPath, u.name]), g = F(u.targetPath);
    return Kr(e, y, g, u.expr);
  }
  const f = Jr(e.operators, o, n);
  if (f) {
    const y = f.paths.map((v) => e.readPath(v.split(".").filter(Boolean))), g = f.fn ? f.fn(...y) : y;
    return f.targetPath.length === 0 ? g : Nn(e, f.targetPath, g, "?");
  }
  const p = Yr(e.operators, o, n);
  if (p) {
    e.removeSubtree(p.targetPath);
    return;
  }
  const d = qr(e.operators, o, n);
  if (d) {
    e.localNoises[d.scopeKey] = n, ae(e);
    const y = d.scopeKey ? d.scopeKey.split(".").filter(Boolean) : [];
    return Je(e, y, "~", "***", "***");
  }
  const h = Ee(e, o, n, r);
  return In(e, o), Vr(e, o), h;
}
function Jl(e) {
  const t = e.findIndex((o) => o.includes("[i]")), n = e.slice(0, t), r = e[t].split("[i]").join("").trim();
  return r && n.push(r), n;
}
function Yl(e) {
  return `${e.targetPath.join(".")}\0${e.name}`;
}
function _s(e, t, n) {
  const r = F(co(t.targetPath, n)), o = F([...r, t.name]), i = ha(t.expr, n);
  return Kr(e, o, r, i);
}
function Kr(e, t, n, r) {
  fs(e, t, n, r);
  const o = e.derivations[t.join(".")], { value: i, unresolved: a } = ko(e, o, t.join("."));
  o.unresolved = a;
  const s = Nn(e, t, i, "=");
  return o.lastValue = i, s;
}
function di(e, t, n) {
  const r = F(co(t.targetPath, n)), o = F([...r, t.name]).join(".");
  e.derivations[o] || _s(e, t, n);
}
function Vr(e, t) {
  const { byPrefix: n, ancestors: r } = _l(e);
  if (n.size === 0) return;
  let o = "";
  for (let i = 0; i < t.length; i++) {
    const a = n.get(o);
    if (a) for (const s of a) di(e, s, t[i]);
    o = o ? `${o}.${t[i]}` : t[i];
  }
  if (r.has(o)) {
    for (const [i, a] of n)
      if (!(o !== "" && i !== o && !i.startsWith(o + ".")))
        for (const s of a)
          for (const c of Co(e, s.targetPath)) di(e, s, c);
  }
}
function Xl(e, t) {
  ys(e, t);
  let n = !1;
  const r = t.join(".");
  for (const h of Object.keys(e.localSecrets)) {
    if (r === "") {
      delete e.localSecrets[h], n = !0;
      continue;
    }
    (h === r || h.startsWith(r + ".")) && (delete e.localSecrets[h], n = !0);
  }
  for (const h of Object.keys(e.localNoises)) {
    if (r === "") {
      delete e.localNoises[h], n = !0;
      continue;
    }
    (h === r || h.startsWith(r + ".")) && (delete e.localNoises[h], n = !0);
  }
  n && ae(e);
  for (const h of e.branchStore.listScopes()) {
    if (r === "") {
      e.branchStore.deleteScope(h), He(e, h);
      continue;
    }
    if (h === r || h.startsWith(r + ".")) {
      e.branchStore.deleteScope(h), He(e, h);
      continue;
    }
    const y = h.split(".").filter(Boolean);
    if (!Ne(t, y) || t.length <= y.length) continue;
    const g = oe(e, y);
    if (!g) continue;
    const v = Ze(e, t, y);
    let x = he(e, y, g, v), M = v;
    if (!x && v !== "default" && (x = he(e, y, g, "default"), M = "default"), !x || typeof x != "object") continue;
    x = Y(Ha(x));
    const m = t.slice(y.length);
    let b = x;
    for (let k = 0; k < m.length - 1; k++) {
      const B = m[k];
      if (!b || typeof b != "object" || !(B in b)) {
        b = null;
        break;
      }
      b = b[B];
    }
    b && typeof b == "object" && (delete b[m[m.length - 1]], Io(e, y, g, M, x));
  }
  const o = t.join("."), i = Date.now(), a = oe(e, t), s = Hn(e), c = JSON.stringify({
    path: o,
    operator: "-",
    expression: "-",
    value: "-",
    effectiveSecret: a,
    prevHash: s
  }), u = pe(c), f = e.seqCounter++, p = {
    path: o,
    operator: "-",
    expression: "-",
    value: "-",
    effectiveSecret: a,
    hash: u,
    prevHash: s,
    timestamp: i,
    seq: f
  };
  e._memories.push(p), e.applyMemoryToIndex(p);
  const d = Object.keys(e.refSubscribers).filter(
    (h) => o === "" || h === o || h.startsWith(o + ".")
  );
  ps(e, d, o);
}
function Rs(e, t) {
  const n = typeof e.seq == "number" ? e.seq : null, r = typeof t.seq == "number" ? t.seq : null;
  return n !== null && r !== null ? n !== r ? n - r : e.hash !== t.hash ? e.hash < t.hash ? -1 : 1 : 0 : n === null && r === null ? e.timestamp !== t.timestamp ? e.timestamp - t.timestamp : e.hash !== t.hash ? e.hash < t.hash ? -1 : 1 : 0 : n !== null ? 1 : -1;
}
function Fr(e, t) {
  if (t === "") {
    for (const r of Object.keys(e.indexWinner)) delete e.indexWinner[r];
    return;
  }
  const n = t + ".";
  for (const r of Object.keys(e.indexWinner))
    (r === t || r.startsWith(n)) && delete e.indexWinner[r];
}
function Is(e, t) {
  const n = t.path, r = n.split(".").filter(Boolean);
  if (t.operator === "_") {
    r.length > 0 && Ps(e, r);
    return;
  }
  const o = me(e, r), i = o && o.length > 0 && Ne(r, o);
  if (t.operator === "-") {
    if (n === "") {
      for (const u of Object.keys(e.index)) delete e.index[u];
      Fr(e, ""), Za(e);
      return;
    }
    const c = n + ".";
    for (const u of Object.keys(e.index))
      (u === n || u.startsWith(c)) && (delete e.index[u], Bn(e, u));
    Fr(e, n);
    return;
  }
  if (i || t.value === we && t.expression === we) return;
  const a = { timestamp: t.timestamp, seq: t.seq, hash: t.hash }, s = e.indexWinner[n];
  s && Rs(a, s) < 0 || (e.index[n] = t.value, e.indexWinner[n] = a, Bn(e, n));
}
function Ps(e, t) {
  const n = t.join(".");
  if (!n) return;
  const r = n + ".";
  for (const o of Object.keys(e.index))
    (o === n || o.startsWith(r)) && (delete e.index[o], Bn(e, o));
  Fr(e, n);
}
function Zl(e) {
  const t = {}, n = e._memories.map((o, i) => ({ t: o, i })).sort((o, i) => {
    const a = Rs(o.t, i.t);
    return a !== 0 ? a : o.i - i.i;
  }).map((o) => o.t);
  e.index = t, e.indexWinner = {}, Za(e);
  let r = -1;
  for (const o of e._memories)
    typeof o.seq == "number" && o.seq > r && (r = o.seq);
  e.seqCounter = r + 1;
  for (const o of n)
    Is(e, o);
}
function ut(e, t) {
  return e.index[t.join(".")];
}
function Ql(e, t, n) {
  e.index[t.join(".")] = n, Bn(e, t.join("."));
}
function Po(e, t, n = 8, r) {
  let o = t;
  const i = /* @__PURE__ */ new Set();
  for (let a = 0; a < n; a++) {
    const s = ut(e, o);
    if (Z(s)) {
      const u = o.join(".");
      if (i.has(u)) return { path: o, raw: void 0 };
      i.add(u), o = s.__ptr.split(".").filter(Boolean), r && r.push(u, o.join("."));
      continue;
    }
    let c = !1;
    for (let u = o.length - 1; u >= 0; u--) {
      const f = o.slice(0, u), p = ut(e, f);
      if (!Z(p)) continue;
      const d = f.join(".");
      if (i.has(d)) return { path: o, raw: void 0 };
      i.add(d);
      const h = p.__ptr.split(".").filter(Boolean), y = o.slice(u);
      o = [...h, ...y], r && r.push(d, o.join(".")), c = !0;
      break;
    }
    if (!c)
      return { path: o, raw: s };
  }
  return { path: o, raw: void 0 };
}
const ef = 32;
function Ds(e, t) {
  for (; ; ) {
    if (Z(e.index[t])) return !0;
    if (t === "") return !1;
    const n = t.lastIndexOf(".");
    t = n < 0 ? "" : t.slice(0, n);
  }
}
function tf(e, t) {
  if (!Ds(e, t.join("."))) return [];
  const n = [];
  let r = t;
  for (let o = 0; o < ef; o++) {
    const i = me(e, r);
    if (i && i.length > 0 && Ne(r, i) || Z(ut(e, r))) break;
    const a = Po(e, r, 8, n);
    if (a.raw !== void 0 || a.path.length === r.length && a.path.every((c, u) => c === r[u])) break;
    r = a.path;
  }
  return n;
}
function nf(e, t, n) {
  const r = String(t || "").trim();
  if (!r) throw new Error("installRecipientKey(...) requires a recipient key id.");
  return e.recipientKeyring[r] = n, e;
}
function rf(e, t) {
  const n = String(t || "").trim();
  return n && delete e.recipientKeyring[n], e;
}
function of(e, t, n, r) {
  const o = String(t || "").trim();
  if (!o) throw new Error("storeWrappedKey(...) requires a key id.");
  if (!n || n.version !== 1)
    throw new Error("storeWrappedKey(...) requires a valid WrappedSecretV1 envelope.");
  return e.keySpaces[o] = Y({
    envelope: n,
    recipientKeyId: r?.recipientKeyId
  }), e;
}
function Os(e, t, n, r) {
  switch (t) {
    case "read":
      return n ? Do(e, n) : Y(e.keySpaces);
    case "write":
      if (!n) throw new Error("self:write/keys requires a key id.");
      if (r === void 0) throw new Error("self:write/keys requires a payload.");
      return js(e, n, r);
    case "open":
    case "use":
      if (!n) throw new Error(`self:${t}/keys requires a key id.`);
      return Ks(e, n, r);
    default:
      throw new Error(`Unsupported keys operation: ${t}`);
  }
}
function Ns(e) {
  const t = String(e ?? "").trim().replace(/^\/+|\/+$/g, "");
  return t ? t === "keys" ? { isKeySpace: !0, keyId: null } : t.startsWith("keys/") ? { isKeySpace: !0, keyId: t.slice(5).trim() || null } : t.startsWith("keys.") ? { isKeySpace: !0, keyId: t.slice(5).trim() || null } : { isKeySpace: !1, keyId: null } : { isKeySpace: !1, keyId: null };
}
function Do(e, t) {
  const n = e.keySpaces[t];
  if (!n) throw new Error(`Key space "${t}" was not found.`);
  return Y(n.envelope);
}
function js(e, t, n) {
  const r = n && typeof n == "object" && n.envelope ? n.envelope : n, o = n && typeof n == "object" && typeof n.recipientKeyId == "string" ? n.recipientKeyId : void 0;
  return e.storeWrappedKey(t, r, { recipientKeyId: o }), Do(e, t);
}
function Ks(e, t, n) {
  const r = e.keySpaces[t];
  if (!r) throw new Error(`Key space "${t}" was not found.`);
  const o = n?.output === "utf8" ? "utf8" : "bytes", i = n?.recipientPrivateKey, a = n?.recipientKeyId ?? r.recipientKeyId, s = i ?? (a ? e.recipientKeyring[a] : void 0);
  if (!s)
    throw new Error(
      `No recipient private key is available to open "${t}". Install one first or pass it inline.`
    );
  return ua(r.envelope, s, o);
}
const af = 2, sf = "***";
function cf(e) {
  const t = Object.values(e);
  return t.length > 0 ? t[t.length - 1] : null;
}
function hi(e) {
  const t = {};
  for (const n of Object.keys(e)) t[n] = sf;
  return t;
}
function uf(e) {
  return Y({
    formatVersion: af,
    memories: Bo(e._memories),
    localSecrets: hi(e.localSecrets),
    localNoises: hi(e.localNoises),
    encryptedBranches: e.branchStore.exportData(),
    keySpaces: e.keySpaces,
    operators: e.operators,
    identityRoot: e.identityRootEnvelope ? e.identityRootEnvelope : null,
    migrationV4: e.migrationV4 ?? {},
    migrationV4Values: e.migrationV4Values ?? {}
  });
}
function Oo(e, t) {
  const n = Y(t ?? {});
  e._memories = Array.isArray(n.memories) ? ms(n.memories) : [], e.localSecrets = n.localSecrets && typeof n.localSecrets == "object" ? n.localSecrets : {}, e.localNoises = n.localNoises && typeof n.localNoises == "object" ? n.localNoises : {}, e._ownerScope = cf(e.localSecrets), e._currentCallerScope = void 0, e.identityRootEnvelope = n.identityRoot && typeof n.identityRoot == "object" ? n.identityRoot : null, e.identityRootId = e.identityRootEnvelope ? e.identityRootEnvelope.rootId : null, e.identityRootUnwrapped && e.identityRootUnwrapped.fill(0), e.identityRootUnwrapped = null, e.migrationV4 = n.migrationV4 && typeof n.migrationV4 == "object" ? n.migrationV4 : {}, e.migrationV4Values = n.migrationV4Values && typeof n.migrationV4Values == "object" ? n.migrationV4Values : {}, ae(e), e.branchStore.importData(
    n.encryptedBranches && typeof n.encryptedBranches == "object" ? n.encryptedBranches : {}
  ), e.keySpaces = n.keySpaces && typeof n.keySpaces == "object" ? n.keySpaces : {}, e.derivations = {}, e.iteratorRules = {}, e.refSubscribers = {}, e.refVersions = {}, e.derivationRefVersions = {}, e.staleDerivations.clear(), e.lastRecomputeWaveByTarget = {}, e.activeRecomputeWave = null;
  const r = ga();
  e.operators = n.operators && typeof n.operators == "object" ? { ...r, ...n.operators } : r, e.rebuildIndex();
}
function lf(e, t) {
  Oo(e, t);
}
function ff(e, t) {
  Oo(e, t);
}
const df = 128;
function pi(e, t) {
  let n = e;
  for (const r of t) {
    const o = Number(r);
    if (n && typeof n == "object" && n.__columnar === !0 && Number.isInteger(o) && o >= 0 && String(o) === r) {
      n = ul(n, o);
      continue;
    }
    if (!n || typeof n != "object") return;
    n = n[r];
  }
  return n;
}
function Vs(e, t, n) {
  e.has(t) && e.delete(t), e.set(t, n);
}
function hf(e, t) {
  for (; e.size > t; ) {
    const n = e.keys().next();
    if (n.done) return;
    e.delete(n.value);
  }
}
function Ur(e) {
  return e && typeof e == "object" ? Y(e) : e;
}
function yi(e, t, n) {
  const r = t.join("."), o = e.decryptedValueCache.get(r);
  if (o && o.epoch === e.secretEpoch && o.blob === n)
    return Vs(e.decryptedValueCache, r, o), Ur(o.data);
}
function mi(e, t, n, r) {
  const o = t.join("."), i = Ur(r);
  return Vs(e.decryptedValueCache, o, {
    epoch: e.secretEpoch,
    blob: n,
    data: i
  }), hf(e.decryptedValueCache, df), Ur(i);
}
function pf(e, t) {
  const n = t?.last, r = typeof n == "number" && Number.isFinite(n) && n > 0 ? e._memories.slice(-Math.floor(n)) : e._memories.slice();
  return {
    memories: Bo(r),
    index: { ...e.index },
    encryptedScopes: e.branchStore.listScopes(),
    secretScopes: Object.keys(e.localSecrets),
    noiseScopes: Object.keys(e.localNoises),
    recomputeMode: e.recomputeMode,
    staleDerivations: e.staleDerivations.size
  };
}
function yf(e, t, n, r) {
  const o = Oa(e, t);
  switch (o.namespace) {
    case "self":
      return Fs(e, o.operation, o.path, n, r);
    case "kernel":
      return Ma(e, o.operation, o.path, n);
    default:
      throw new Error(
        `External me target "${o.namespace}" must be resolved by cleaker or monad.ai before reaching the local kernel.`
      );
  }
}
function Fs(e, t, n, r, o) {
  const i = Ns(n);
  if (i.isKeySpace)
    return Os(e, t, i.keyId, r);
  const a = fo(n);
  switch (t) {
    case "read":
      return e.readPath(a.parts);
    case "write":
      if (!a.key) throw new Error("self:write requires a semantic path.");
      if (r === void 0) throw new Error("self:write requires a body payload.");
      return e.postulate(a.parts, r, o ?? null);
    case "inspect":
      return Us(e, a.key);
    case "explain":
      if (!a.key) throw new Error("self:explain requires a semantic path.");
      return e.explain(a.key);
    default:
      throw new Error(`Unsupported self operation: ${t}`);
  }
}
function Us(e, t) {
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
function mf(e, t) {
  const n = gs(e, t);
  if (n !== void 0) return n;
  const r = bs(e, t);
  if (r !== void 0) return r;
  const o = F(t);
  if (e.recomputeMode === "lazy") {
    const d = o.join(".");
    e.derivations[d] && e.ensureTargetFresh(d);
  }
  const i = xs(e, o);
  if (i !== void 0) return i;
  const a = me(e, o);
  if (a && a.length > 0 && Ne(o, a)) {
    if (o.length === a.length) return;
    const d = oe(e, a);
    if (!d) return null;
    const h = Ze(e, o, a), y = o.slice(a.length), g = Gn(e, o, a), v = ll(e, o, a);
    let x = he(e, a, d, h), M = g, m = !1;
    if (!x && v && v !== h && (x = he(e, a, d, v), M = y, m = !0), !x && h !== "default" && (x = he(e, a, d, "default")), !x) return;
    let b = pi(x, M);
    if (b === void 0 && v && v !== h && !m) {
      const k = he(e, a, d, v);
      k && (b = pi(k, y));
    }
    return b === void 0 ? void 0 : Z(b) ? e.readPath(b.__ptr.split(".").filter(Boolean)) : at(b) || b && typeof b == "object" ? Y(b) : b;
  }
  const s = ut(e, o);
  if (Z(s)) return s;
  const c = Po(e, o), u = c.raw;
  if (u === void 0)
    return c.path.length === o.length && c.path.every((h, y) => h === o[y]) ? void 0 : e.readPath(c.path);
  if (Z(u)) return e.readPath(u.__ptr.split(".").filter(Boolean));
  if (at(u) || !ao(u)) return u;
  const f = ht(u);
  if (f === "v4")
    try {
      const d = yi(e, o, u);
      if (d !== void 0) return d;
      const h = ho(e, o, "value"), y = ro(u, h);
      return y == null ? y : mi(e, o, u, y);
    } catch {
      return null;
    }
  if (f === "v3")
    try {
      const d = yi(e, o, u);
      if (d !== void 0) return d;
      const h = qn(e, o, "value"), y = oo(u, h);
      return y == null ? y : mi(e, o, u, y);
    } catch {
      return null;
    }
  const p = oe(e, o);
  return p ? io(u, p, o) : null;
}
function No() {
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
function ve() {
  return typeof performance < "u" && typeof performance.now == "function" ? performance.now() : Date.now();
}
const ue = {
  enabled: !1,
  window: No()
};
function Ue() {
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
function Te(e) {
  const t = String(e ?? "");
  return typeof Buffer < "u" ? Math.max(t.length * 2, Buffer.byteLength(t, "utf8")) : t.length * 2;
}
function de(e, t) {
  return Math.max(0, e - t);
}
function gf(e = !0) {
  ue.enabled = e, ue.window = No();
}
function bf() {
  const e = { ...ue.window };
  return ue.window = No(), e;
}
function gi(e) {
  const n = (typeof process < "u" ? process : null)?.getBuiltinModule;
  if (typeof n == "function")
    return n(e);
}
function Ts(e) {
  return typeof e == "string" ? e : { ...e };
}
function bi(e) {
  const t = {};
  for (const [n, r] of Object.entries(e || {}))
    t[n] = Ts(r);
  return t;
}
function xf(e) {
  return Math.max(64, e.length * 2);
}
class vf {
  constructor(t) {
    this.maxBytes = t, this.entries = /* @__PURE__ */ new Map(), this.usedBytes = 0;
  }
  get(t) {
    const n = this.entries.get(t);
    if (n)
      return this.entries.delete(t), this.entries.set(t, n), n.blob;
  }
  set(t, n) {
    const r = xf(n), o = this.entries.get(t);
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
class $s {
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
    this.data[t] = Ts(n);
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
    return bi(this.data);
  }
  importData(t) {
    this.data = bi(t);
  }
  view() {
    return this.data;
  }
  close() {
  }
}
class Sf {
  constructor(t, n = 4e8) {
    this.kind = "disk", this.index = {}, this.writesSinceFlush = 0;
    const r = typeof t == "string" ? { baseDir: t, maxHotBytes: n } : t, o = gi("node:fs"), i = gi("node:path");
    if (!o || !i)
      throw new Error("DiskStore requires a Node.js runtime.");
    this.fs = o, this.path = i, this.baseDir = r.baseDir, this.logPath = i.join(r.baseDir, "branch-store.log"), this.indexPath = i.join(r.baseDir, "branch-store.index.json"), this.flushEvery = Math.max(1, Math.floor(r.flushEvery ?? 32)), this.hot = new vf(Math.max(1, Math.floor(r.maxHotBytes ?? 4e8))), o.mkdirSync(this.baseDir, { recursive: !0 }), this.logFd = o.openSync(this.logPath, "a+"), this.logSize = o.fstatSync(this.logFd).size, this.index = this.loadIndex();
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
        const s = JSON.parse(a), c = { offset: r, length: i };
        this.applyRecord(n, s, c);
      } catch {
      }
      r += i;
    }
    return n;
  }
  appendRecord(t) {
    const n = ue.enabled, r = n ? Ue() : null, o = n ? ve() : 0, i = t.op === "scope:set" ? Te(t.value) : t.op === "chunk:set" ? Te(t.blob) : 0, a = n ? ve() : 0, s = `${JSON.stringify(t)}
`, c = n ? ve() - a : 0, u = Buffer.byteLength(s), f = {
      offset: this.logSize,
      length: u
    };
    if (this.fs.writeSync(this.logFd, s), this.logSize += u, n && r) {
      const p = Ue(), d = ve() - o, h = Te(s), y = ue.window;
      y.appendCalls += 1, y.totalRecordStringifyMs += c, y.totalAppendMs += d, y.maxRecordStringifyMs = Math.max(y.maxRecordStringifyMs, c), y.maxAppendMs = Math.max(y.maxAppendMs, d), y.maxBlobBytes = Math.max(y.maxBlobBytes, i), y.maxRecordBytes = Math.max(y.maxRecordBytes, h), y.maxAppendResidentBytes = Math.max(y.maxAppendResidentBytes, i + h), y.maxAppendHeapDelta = Math.max(y.maxAppendHeapDelta, de(p.heapUsed, r.heapUsed)), y.maxAppendExternalDelta = Math.max(y.maxAppendExternalDelta, de(p.external, r.external)), y.maxAppendArrayBuffersDelta = Math.max(
        y.maxAppendArrayBuffersDelta,
        de(p.arrayBuffers, r.arrayBuffers)
      );
    }
    return f;
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
    const t = ue.enabled, n = t ? Ue() : null, r = t ? ve() : 0, o = JSON.stringify(this.index);
    if (this.fs.writeFileSync(this.indexPath, o, "utf8"), t && n) {
      const i = Ue(), a = ve() - r, s = ue.window;
      s.flushCalls += 1, s.totalFlushMs += a, s.maxFlushMs = Math.max(s.maxFlushMs, a), s.maxFlushIndexBytes = Math.max(s.maxFlushIndexBytes, Te(o)), s.maxFlushHeapDelta = Math.max(s.maxFlushHeapDelta, de(i.heapUsed, n.heapUsed)), s.maxFlushExternalDelta = Math.max(s.maxFlushExternalDelta, de(i.external, n.external)), s.maxFlushArrayBuffersDelta = Math.max(
        s.maxFlushArrayBuffersDelta,
        de(i.arrayBuffers, n.arrayBuffers)
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
    const s = ue.enabled, c = s ? Ue() : null, u = s ? ve() : 0, f = Buffer.alloc(r.length);
    this.fs.readSync(this.logFd, f, 0, r.length, r.offset);
    const p = f.toString("utf8").trim();
    if (!p) return;
    const d = JSON.parse(p), h = d.op === "scope:set" ? d.value : d.op === "chunk:set" ? d.blob : void 0;
    if (h !== void 0) {
      if (this.hot.set(i, h), s && c) {
        const y = Ue(), g = ve() - u, v = Te(h), x = ue.window;
        x.readCalls += 1, x.totalReadMs += g, x.maxReadMs = Math.max(x.maxReadMs, g), x.maxBlobBytes = Math.max(x.maxBlobBytes, v), x.maxReadBufferBytes = Math.max(x.maxReadBufferBytes, r.length), x.maxReadResidentBytes = Math.max(
          x.maxReadResidentBytes,
          r.length + Te(p) + v
        ), x.maxReadHeapDelta = Math.max(x.maxReadHeapDelta, de(y.heapUsed, c.heapUsed)), x.maxReadExternalDelta = Math.max(x.maxReadExternalDelta, de(y.external, c.external)), x.maxReadArrayBuffersDelta = Math.max(
          x.maxReadArrayBuffersDelta,
          de(y.arrayBuffers, c.arrayBuffers)
        );
      }
      return h;
    }
  }
  cacheKey(t, n, r) {
    return `${t}::${r}::${n}`;
  }
  cacheKeyPrefix(t) {
    return `${t}::`;
  }
}
function wf(e = {}) {
  return {
    memory: {
      index: {},
      indexWinner: {},
      seqCounter: 0,
      _memories: []
    },
    secrets: {
      localSecrets: {},
      localNoises: {},
      protectedScopeKeys: /* @__PURE__ */ new Set(),
      branchStore: e.store ?? new $s(),
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
      v4KeyCache: /* @__PURE__ */ new Map(),
      vectorIndexes: /* @__PURE__ */ new Map(),
      secretChunkSize: 256,
      secretHashBuckets: 16,
      identityRootEnvelope: null,
      identityRootUnwrapped: null,
      identityRootId: null,
      migrationV4: {},
      migrationV4Values: {}
    },
    derivation: {
      derivations: {},
      iteratorRules: {},
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
      operators: ga()
    }
  };
}
function kf(e = {}) {
  const t = wf(e);
  return {
    ...t.memory,
    ...t.secrets,
    ...t.derivation,
    ...t.config
  };
}
function Ef(e) {
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
      const c = n.trim();
      c && t.push(c), n = "";
      continue;
    }
    n += s;
  }
  const i = n.trim();
  return i && t.push(i), t;
}
function Mf(e, t, n) {
  if (t.length === 0) {
    if (n.length === 1 && typeof n[0] == "string") {
      const f = n[0].trim(), p = pt(f);
      if ((p.kind === "aggregate" || p.kind === "rejected") && e.readPathExpression)
        return e.readPathExpression(p, f);
      const d = f.startsWith("_") || f.startsWith("~") || f.startsWith("@"), h = f.includes("."), y = /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(f);
      if (h || d || y)
        return e.readPath(Ef(f));
    }
    if (n.length === 2 && typeof n[0] == "string" && typeof n[1] == "string") {
      const f = n[0].trim(), p = n[1].trim();
      if (/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(f) && f && p)
        return e.reseedIdentity?.(f, p), e.createProxy([]);
    }
    if (n.length === 0)
      return e.createProxy([]);
    const c = e.normalizeArgs(n), u = e.postulate([], c);
    return u !== void 0 ? u : e.createProxy([]);
  }
  const r = e.normalizeArgs(n), o = e.postulate(t, r), { scope: i, leaf: a } = e.splitPath(t), s = a ? e.opKind(a) : null;
  if (e.isMemory(o)) {
    const c = s ? i : t;
    return e.createProxy(c);
  }
  return o !== void 0 ? o : e.createProxy(t);
}
const jo = "!";
function Tr(e, t, n) {
  const r = e._currentCallerScope;
  e._currentCallerScope = t;
  try {
    return n();
  } finally {
    e._currentCallerScope = r;
  }
}
function Ls(e) {
  return e._currentCallerScope;
}
function Bf(e) {
  if (e.length !== 0)
    return e.length === 1 ? e[0] : e;
}
function Q(e, t, n, r, o) {
  return {
    kind: "method",
    path: t,
    docs: r,
    signature: o,
    call: n
  };
}
function zs(e) {
  return {
    docs: {
      kind: "runtime-surface",
      description: "Reflective runtime plane for .me. Use me['!'] to access inspection, replay, snapshots, identity, and kernel controls.",
      namespaces: ["inspect", "explain", "identity", "currentExpression", "prove", "memories", "snapshot", "runtime", "methods"]
    },
    inspect: Q(
      e,
      "inspect",
      (t) => e.inspect(t),
      "Return a debug snapshot of memories, index, scopes, and recompute state.",
      "inspect(opts?: { last?: number }): { memories, index, encryptedScopes, secretScopes, noiseScopes, recomputeMode, staleDerivations }"
    ),
    explain: Q(
      e,
      "explain",
      (t) => e.explain(t),
      "Explain how a derived value was computed, including dependency inputs and masking for stealth sources.",
      "explain(path: string): { path, value, expr, derivation, meta }"
    ),
    identity: Q(
      e,
      "identity",
      () => e[Dn],
      "Return the deterministic seed-derived identity hash together with the current active expression.",
      "identity(): { hash: string, expression: string | null }"
    ),
    currentExpression: Q(
      e,
      "currentExpression",
      () => e[Pr],
      "Return the current active expression selected by the root identity operator.",
      "currentExpression(): string | null"
    ),
    prove: Q(
      e,
      "prove",
      (t) => e.prove(t),
      "Derive a branch-scoped Ed25519 proof for the current active expression and root namespace.",
      "prove(input: { rootNamespace: string, challenge?: string | null }): Promise<{ identityHash, expression, namespace, rootNamespace, publicKey, message, signature, timestamp }>"
    ),
    memories: {
      docs: "Memory log helpers and replay controls.",
      list: Q(
        e,
        "memories.list",
        () => e.memories,
        "Return the current memory log.",
        "memories.list(): Memory[]"
      ),
      replay: Q(
        e,
        "memories.replay",
        (t) => e.replayMemories(t),
        "Reset kernel state and replay a public or legacy memory log into the current kernel.",
        "memories.replay(memories: ReplayMemoryInput[]): void"
      )
    },
    snapshot: {
      docs: "Snapshot import/export helpers for full kernel state. Prefer hydrate() to restore a saved kernel.",
      export: Q(
        e,
        "snapshot.export",
        () => e.exportSnapshot(),
        "Export the current kernel snapshot with public memories plus secrets, noises, encrypted branches, key spaces, and operators.",
        "snapshot.export(): Snapshot"
      ),
      hydrate: Q(
        e,
        "snapshot.hydrate",
        (t) => e.hydrate(t),
        "Primary restore API. Bring a saved kernel snapshot back to life in the current runtime.",
        "snapshot.hydrate(snapshot: Snapshot): void"
      ),
      import: Q(
        e,
        "snapshot.import",
        (t) => e.importSnapshot(t),
        "Compatibility alias for snapshot.hydrate() that preserves the older import-oriented naming.",
        "snapshot.import(snapshot: Snapshot): void"
      ),
      rehydrate: Q(
        e,
        "snapshot.rehydrate",
        (t) => e.rehydrate(t),
        "Backward-compatible alias for snapshot.hydrate() with the older rehydrate naming.",
        "snapshot.rehydrate(snapshot: Snapshot): void"
      )
    },
    runtime: {
      docs: "Kernel execution and recomputation controls.",
      getRecomputeMode: Q(
        e,
        "runtime.getRecomputeMode",
        () => e.getRecomputeMode(),
        "Return the current recomputation mode.",
        "runtime.getRecomputeMode(): 'eager' | 'lazy'"
      ),
      setRecomputeMode: Q(
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
function Ws() {
  return {
    kind: "runtime-surface",
    escape: jo,
    description: "Use me['!'] to enter the reflective runtime plane. This plane exposes snapshots, replay, explainability, and kernel controls.",
    namespaces: ["inspect", "explain", "identity", "currentExpression", "prove", "memories", "snapshot", "runtime", "methods"]
  };
}
function $r(e, t) {
  const n = zs(e);
  if (n.methods.inspect = n.inspect, n.methods.explain = n.explain, n.methods.identity = n.identity, n.methods.currentExpression = n.currentExpression, n.methods.prove = n.prove, n.methods.exportSnapshot = n.snapshot.export, n.methods.hydrate = n.snapshot.hydrate, n.methods.importSnapshot = n.snapshot.import, n.methods.rehydrate = n.snapshot.rehydrate, n.methods.replayMemories = n.memories.replay, n.methods.getRecomputeMode = n.runtime.getRecomputeMode, n.methods.setRecomputeMode = n.runtime.setRecomputeMode, t.length === 0) return n;
  let r = n;
  for (const o of t) {
    if (r == null) return;
    r = r[o];
  }
  return r;
}
function jn(e, t, n = Ls(e)) {
  const r = (...o) => Tr(e, n, () => {
    const i = $r(e, t);
    return typeof i == "function" ? i(...o) : i && typeof i == "object" && typeof i.call == "function" ? i.call(...o) : t.length === 0 && o.length === 0 ? e[Dn] : t.length === 0 ? Ws() : i;
  });
  return new Proxy(r, {
    get(o, i) {
      if (typeof i == "symbol") return o[i];
      const a = String(i), s = [...t, a], c = $r(e, s);
      if (c !== void 0)
        return c === null ? null : Array.isArray(c) ? c : typeof c == "function" || typeof c == "object" ? jn(e, s, n) : c;
    },
    apply(o, i, a) {
      return Reflect.apply(o, void 0, a);
    }
  });
}
function Lr(e, t, n = Ls(e)) {
  const r = (...o) => Tr(
    e,
    n,
    () => Mf(
      {
        createProxy: (i) => Lr(e, i, n),
        normalizeArgs: (i) => e.normalizeArgs(i),
        readPath: (i) => e.readPath(i),
        readPathExpression: (i, a) => e.readPathExpression(i, a),
        postulate: (i, a) => e.postulate(i, a),
        opKind: (i) => e.opKind(i),
        splitPath: le,
        isMemory: Rc,
        reseedIdentity: (i, a) => e[Dr]?.(i, a),
        setActiveExpression: (i) => e[Mo]?.(i)
      },
      t,
      o
    )
  );
  return new Proxy(r, {
    get(o, i) {
      if (typeof i == "symbol") return o[i];
      if (i === jo)
        return jn(e, [], n);
      if (i in e) {
        const s = e[i];
        return typeof s == "function" ? (...c) => Tr(e, n, () => s.apply(e, c)) : s;
      }
      const a = [...t, String(i)];
      return Lr(e, a, n);
    },
    apply(o, i, a) {
      return Reflect.apply(o, void 0, a);
    }
  });
}
function Ko() {
  const e = globalThis.crypto;
  if (!e?.subtle)
    throw new Error("WebCrypto subtle crypto is required for identity root operations.");
  return e;
}
function Kn(e) {
  const t = globalThis.crypto;
  if (!t?.getRandomValues)
    throw new Error("Secure random values are required for identity root operations.");
  const n = new Uint8Array(e);
  return t.getRandomValues(n), n;
}
function Hs(e) {
  const t = String(e ?? "");
  if (typeof TextEncoder < "u") return new TextEncoder().encode(t);
  if (typeof Buffer < "u") return new Uint8Array(Buffer.from(t, "utf8"));
  const n = unescape(encodeURIComponent(t)), r = new Uint8Array(n.length);
  for (let o = 0; o < n.length; o++) r[o] = n.charCodeAt(o);
  return r;
}
function Cf(e) {
  let t = "";
  for (let n = 0; n < e.length; n++) t += e[n].toString(16).padStart(2, "0");
  return t;
}
function dr(e) {
  if (typeof Buffer < "u")
    return Buffer.from(e).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  let t = "";
  for (let n = 0; n < e.length; n++) t += String.fromCharCode(e[n]);
  return btoa(t).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function hr(e) {
  const t = String(e || "").replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(String(e || "").length / 4) * 4, "=");
  if (typeof Buffer < "u") return new Uint8Array(Buffer.from(t, "base64"));
  const n = atob(t), r = new Uint8Array(n.length);
  for (let o = 0; o < n.length; o++) r[o] = n.charCodeAt(o);
  return r;
}
function Me(e) {
  const t = Uint8Array.from(e);
  return t.buffer.slice(t.byteOffset, t.byteOffset + t.byteLength);
}
function lt(...e) {
  for (const t of e)
    t && t.fill(0);
}
const Vo = 1, Vn = 32, Af = 16, _f = 16, Rf = 12, qs = 6e5, zr = 21e4, xi = 5e6, If = "this.me/identity-root/v1", vi = 8, Si = 1024;
class pr extends Error {
  constructor(t = "Unable to unlock identity root: wrong password or corrupted envelope.") {
    super(t), this.name = "IdentityRootAuthError";
  }
}
class G extends Error {
  constructor(t) {
    super(t), this.name = "IdentityRootFormatError";
  }
}
function Gs(e) {
  if (typeof e != "string")
    throw new G("Password must be a string.");
  if (e.length < vi)
    throw new G(`Password must be at least ${vi} characters.`);
  if (e.length > Si)
    throw new G(`Password must be at most ${Si} characters.`);
}
function Pf(e) {
  if (!Number.isInteger(e) || e < zr || e > xi)
    throw new G(
      `PBKDF2 iterations must be an integer between ${zr} and ${xi}.`
    );
}
function Fo() {
  return {
    rootId: Cf(Kn(Af)),
    root: Kn(Vn)
  };
}
async function Js(e, t, n) {
  const { subtle: r } = Ko(), o = Hs(e);
  try {
    const i = await r.importKey("raw", Me(o), "PBKDF2", !1, ["deriveKey"]);
    return await r.deriveKey(
      { name: "PBKDF2", hash: "SHA-256", salt: Me(t), iterations: n },
      i,
      { name: "AES-GCM", length: 256 },
      !1,
      ["encrypt", "decrypt"]
    );
  } finally {
    lt(o);
  }
}
function Ys(e) {
  return Hs(`${If}::${Vo}::${e}`);
}
async function er(e, t, n, r = qs) {
  if (!(e instanceof Uint8Array) || e.length !== Vn)
    throw new G(`Identity root must be exactly ${Vn} bytes.`);
  if (typeof t != "string" || t.length === 0)
    throw new G("rootId is required.");
  Gs(n), Pf(r);
  const { subtle: o } = Ko(), i = Kn(_f), a = Kn(Rf), s = await Js(n, i, r), c = new Uint8Array(
    await o.encrypt(
      { name: "AES-GCM", iv: Me(a), additionalData: Me(Ys(t)) },
      s,
      Me(e)
    )
  ), u = Date.now(), f = {
    v: Vo,
    rootId: t,
    kdf: { name: "PBKDF2", hash: "SHA-256", iterations: r, salt: dr(i) },
    aead: { name: "AES-256-GCM", iv: dr(a), ciphertext: dr(c) },
    createdAt: u,
    updatedAt: u
  };
  return lt(i, a, c), f;
}
function Uo(e) {
  if (!e || typeof e != "object")
    throw new G("Identity root envelope must be an object.");
  const t = e;
  if (t.v !== Vo)
    throw new G(`Unsupported identity root envelope version: ${String(t.v)}.`);
  if (typeof t.rootId != "string" || t.rootId.length === 0)
    throw new G("Identity root envelope is missing rootId.");
  if (!t.kdf || t.kdf.name !== "PBKDF2" || t.kdf.hash !== "SHA-256")
    throw new G("Unsupported or missing identity root KDF.");
  if (!Number.isInteger(t.kdf.iterations) || t.kdf.iterations < zr)
    throw new G("Identity root KDF iteration count is below the safety floor.");
  if (typeof t.kdf.salt != "string" || !t.kdf.salt)
    throw new G("Identity root envelope is missing a KDF salt.");
  if (!t.aead || t.aead.name !== "AES-256-GCM")
    throw new G("Unsupported or missing identity root AEAD.");
  if (typeof t.aead.iv != "string" || !t.aead.iv)
    throw new G("Identity root envelope is missing an AEAD nonce.");
  if (typeof t.aead.ciphertext != "string" || !t.aead.ciphertext)
    throw new G("Identity root envelope is missing ciphertext.");
}
async function tr(e, t) {
  Uo(e), Gs(t);
  const { subtle: n } = Ko(), r = hr(e.kdf.salt), o = hr(e.aead.iv), i = hr(e.aead.ciphertext);
  try {
    const a = await Js(t, r, e.kdf.iterations), s = new Uint8Array(
      await n.decrypt(
        { name: "AES-GCM", iv: Me(o), additionalData: Me(Ys(e.rootId)) },
        a,
        Me(i)
      )
    );
    if (s.length !== Vn)
      throw lt(s), new pr();
    return s;
  } catch (a) {
    throw a instanceof pr ? a : new pr();
  } finally {
    lt(r, o, i);
  }
}
async function Xs(e, t, n, r) {
  const o = await tr(e, t);
  try {
    const i = await er(o, e.rootId, n, r ?? e.kdf.iterations);
    return i.createdAt = e.createdAt, i.updatedAt = Date.now(), i;
  } finally {
    lt(o);
  }
}
function Zs(e) {
  return Uo(e), JSON.parse(JSON.stringify(e));
}
function Ie(e) {
  e && e.fill(0);
}
function Df(e) {
  return e.identityRootEnvelope !== null;
}
function Of(e) {
  return e.identityRootUnwrapped !== null;
}
function Nf(e) {
  return e.identityRootId;
}
async function jf(e, t, n = qs) {
  if (e.identityRootEnvelope)
    throw new Error("An identity root already exists for this kernel. Use rotateIdentityRoot() to replace it.");
  const { rootId: r, root: o } = Fo();
  try {
    e.identityRootEnvelope = await er(o, r, t, n), e.identityRootId = r, e.identityRootUnwrapped = Uint8Array.from(o);
  } finally {
    Ie(o);
  }
  return ae(e), { rootId: r };
}
async function Kf(e, t) {
  if (!e.identityRootEnvelope)
    throw new Error("No identity root exists for this kernel yet. Call createIdentityRoot() first.");
  const n = await tr(e.identityRootEnvelope, t);
  return Ie(e.identityRootUnwrapped), e.identityRootUnwrapped = n, e.identityRootId = e.identityRootEnvelope.rootId, ae(e), { rootId: e.identityRootId };
}
function Vf(e) {
  Ie(e.identityRootUnwrapped), e.identityRootUnwrapped = null, e.localSecrets = {}, e.localNoises = {}, e._ownerScope = null, ae(e);
}
async function Ff(e, t, n) {
  if (!e.identityRootEnvelope)
    throw new Error("No identity root exists for this kernel yet.");
  const r = await Xs(e.identityRootEnvelope, t, n);
  if (e.identityRootEnvelope = r, e.identityRootUnwrapped) {
    const o = await tr(r, n);
    Ie(e.identityRootUnwrapped), e.identityRootUnwrapped = o;
  }
}
async function Uf(e, t, n) {
  if (!n?.acknowledgeExistingV4CiphertextBecomesUnreadable)
    throw new Error(
      "rotateIdentityRoot() replaces the root; any v4 ciphertext encrypted under the previous root will no longer be derivable from it. Pass { acknowledgeExistingV4CiphertextBecomesUnreadable: true } to proceed."
    );
  if (e.identityRootEnvelope && !e.identityRootUnwrapped)
    throw new Error(
      "An identity root exists for this kernel but is locked. Call unlockIdentity(password) first — rotateIdentityRoot() must not be callable without proving ownership of the current root."
    );
  const r = e.identityRootId, { rootId: o, root: i } = Fo();
  try {
    e.identityRootEnvelope = await er(i, o, t, n.iterations), e.identityRootId = o, Ie(e.identityRootUnwrapped), e.identityRootUnwrapped = Uint8Array.from(i);
  } finally {
    Ie(i);
  }
  return e.migrationV4 = {}, e.migrationV4Values = {}, ae(e), { rootId: o, previousRootId: r };
}
function Tf(e) {
  if (!e.identityRootEnvelope)
    throw new Error("No identity root exists for this kernel yet.");
  return Zs(e.identityRootEnvelope);
}
function $f(e, t, n = {}) {
  if (Uo(t), e.identityRootEnvelope && e.identityRootEnvelope.rootId !== t.rootId && !n.force)
    throw new G(
      "A different identity root already exists for this kernel. Pass { force: true } to replace it explicitly."
    );
  return e.identityRootEnvelope = Zs(t), e.identityRootId = t.rootId, Ie(e.identityRootUnwrapped), e.identityRootUnwrapped = null, ae(e), { rootId: t.rootId };
}
function wi(e) {
  Ie(e.identityRootUnwrapped), e.identityRootUnwrapped = null, e.identityRootEnvelope = null, e.identityRootId = null, e.migrationV4 = {}, e.migrationV4Values = {};
}
function Lf(e) {
  const t = {
    migratedScopes: 0,
    migratedChunks: 0,
    pendingScopes: [],
    skippedAlreadyV4: 0,
    skippedOtherFormat: 0,
    errors: 0
  };
  if (!e.identityRootUnwrapped) {
    for (const n of e.branchStore.listScopes())
      e.migrationV4[n] = "pending", t.pendingScopes.push(n);
    return t;
  }
  for (const n of e.branchStore.listScopes()) {
    const r = n.split(".").filter(Boolean), o = oe(e, r);
    if (!o) {
      e.migrationV4[n] = "pending", t.pendingScopes.push(n);
      continue;
    }
    let i = 0, a = !1;
    try {
      const s = mo(e, r, o), c = Ta(e, r, "branch");
      for (const [u, f] of Object.entries(s)) {
        const p = ht(f);
        if (p === "v4") {
          t.skippedAlreadyV4++;
          continue;
        }
        if (p !== "v3") {
          t.skippedOtherFormat++;
          continue;
        }
        const d = he(e, r, o, u);
        if (!d || typeof d != "object") {
          t.errors++, a = !0;
          continue;
        }
        const h = lu(d, c, "branch", r, e.identityRootUnwrapped), y = fu(h, c, "branch", r, e.identityRootUnwrapped);
        if (JSON.stringify(y) !== JSON.stringify(d)) {
          t.errors++, a = !0;
          continue;
        }
        go(e, r, u, h, o), i++, t.migratedChunks++;
      }
    } catch {
      t.errors++, a = !0;
    } finally {
      He(e, n);
    }
    i > 0 && t.migratedScopes++, !a && i === 0 || (a ? (e.migrationV4[n] = "pending", t.pendingScopes.push(n)) : e.migrationV4[n] = "migrated");
  }
  return t;
}
function zf(e) {
  const t = { migrated: 0, pending: [], skippedAlreadyV4: 0, errors: 0 }, n = Object.entries(e.index).filter(([, r]) => ao(r));
  for (const [r, o] of n) {
    const i = ht(o);
    if (i === "v4") {
      t.skippedAlreadyV4++;
      continue;
    }
    if (i !== "v3") continue;
    if (!e.identityRootUnwrapped) {
      e.migrationV4Values[r] = "pending", t.pending.push(r);
      continue;
    }
    const a = r.split(".").filter(Boolean);
    let s;
    try {
      const c = qn(e, a, "value");
      s = oo(o, c);
    } catch {
      s = null;
    }
    if (s == null) {
      e.migrationV4Values[r] = "pending", t.pending.push(r);
      continue;
    }
    try {
      Ee(e, a, s, null), e.migrationV4Values[r] = "migrated", t.migrated++;
    } catch {
      t.errors++, e.migrationV4Values[r] = "pending", t.pending.push(r);
    }
  }
  return t;
}
function nr(e) {
  let t = 0;
  for (let n = 0; n < e.length; n++) t += e[n] * e[n];
  return Math.sqrt(t);
}
function Qs(e, t) {
  const n = Math.min(e.length, t.length);
  let r = 0, o = 0, i = 0;
  for (let a = 0; a < n; a++) {
    const s = e[a], c = t[a];
    r += s * c, o += s * s, i += c * c;
  }
  return o <= 0 || i <= 0 ? 0 : r / (Math.sqrt(o) * Math.sqrt(i));
}
function ec(e, t, n, r, o = nr(e)) {
  let i = 0, a = 0;
  for (let s = 0; s < r; s++) {
    const c = e[s], u = t[n + s];
    i += c * u, a += u * u;
  }
  return o <= 0 || a <= 0 ? 0 : i / (o * Math.sqrt(a));
}
function To(e) {
  const t = nr(e);
  if (t <= 0) return Float32Array.from(e);
  const n = new Float32Array(e.length);
  for (let r = 0; r < e.length; r++) n[r] = e[r] / t;
  return n;
}
function Fn(e, t, n) {
  if (n <= 0) return;
  let r = e.length;
  for (; r > 0 && Wf(t, e[r - 1]) < 0; )
    r--;
  r >= n || (e.splice(r, 0, t), e.length > n && (e.length = n));
}
function Wf(e, t) {
  return e.score !== t.score ? t.score - e.score : e.index !== t.index ? e.index - t.index : e.path.localeCompare(t.path);
}
function tc(e) {
  const n = (typeof process < "u" ? process : null)?.getBuiltinModule;
  if (typeof n == "function")
    return n(e);
}
function nc() {
  return tc("node:fs");
}
function Hf() {
  return tc("node:path");
}
function qf(e) {
  return `${e.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "root"}.${pe(e)}`;
}
function Gf(e) {
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
function Jf(e) {
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
function $o(e) {
  return e.join(".");
}
function rc(e, t) {
  const n = e.branchStore.getAuxiliaryPath(`vector-indexes/${qf($o(t))}.json`);
  return typeof n == "string" && n.length > 0 ? n : null;
}
function oc(e, t, n) {
  e.vectorIndexes.set($o(t), n);
}
function Yf(e, t) {
  return e.vectorIndexes.get($o(t)) ?? null;
}
function Xf(e, t, n) {
  const r = rc(e, t);
  if (!r) return { persisted: !1, path: null };
  const o = nc(), i = Hf();
  if (!o || !i) return { persisted: !1, path: null };
  const a = {
    meta: n.meta,
    centroids: Gf(n.centroids),
    postingLists: n.postingLists
  };
  return o.mkdirSync(i.dirname(r), { recursive: !0 }), o.writeFileSync(r, JSON.stringify(a), "utf8"), { persisted: !0, path: r };
}
function Zf(e, t) {
  const n = Yf(e, t);
  if (n) return n;
  const r = rc(e, t);
  if (!r) return null;
  const o = nc();
  if (!o || !o.existsSync(r)) return null;
  try {
    const i = JSON.parse(o.readFileSync(r, "utf8"));
    if (!i || typeof i != "object" || !i.meta || typeof i.centroids != "string" || !Array.isArray(i.postingLists))
      return null;
    const a = {
      meta: i.meta,
      centroids: Jf(i.centroids),
      postingLists: i.postingLists.map(
        (s) => Array.isArray(s) ? s.filter((c) => c && typeof c == "object").map((c) => ({
          chunkId: String(c.chunkId ?? ""),
          count: Math.max(0, Math.floor(Number(c.count ?? 0) || 0))
        })).filter((c) => c.chunkId.length > 0 && c.count > 0) : []
      )
    };
    return oc(e, t, a), a;
  } catch {
    return null;
  }
}
function Se() {
  return typeof performance < "u" && typeof performance.now == "function" ? performance.now() : Date.now();
}
function Qf(e, t) {
  const n = Array.isArray(t) ? t : String(t || "").split(".").filter(Boolean);
  return e.normalizeSelectorPath(n);
}
function ed(e) {
  if (e instanceof Float32Array) return e;
  const t = new Float32Array(e.length);
  for (let n = 0; n < e.length; n++) t[n] = Number(e[n]) || 0;
  return t;
}
function td(e) {
  return !Number.isFinite(e) || e <= 0 || e === Number.MAX_SAFE_INTEGER ? null : Math.floor(e);
}
function ic(e, t) {
  const n = td(t);
  if (e instanceof Float32Array)
    return n === null || e.length === n ? e : null;
  if (Array.isArray(e))
    return n !== null && e.length !== n ? null : Float32Array.from(e.map((r) => Number(r) || 0));
  if (e && typeof e == "object") {
    if (n === null) return null;
    const r = new Float32Array(n);
    let o = !1;
    const i = e;
    for (let a = 0; a < n; a++) {
      const s = i[String(a)];
      s !== void 0 && (o = !0), r[a] = Number(s) || 0;
    }
    return o ? r : null;
  }
  return null;
}
function ac(e) {
  return [...e].sort((t, n) => ki(t) - ki(n) || t.localeCompare(n));
}
function ki(e) {
  const t = /^idx_(\d+)$/.exec(e);
  if (t) return Number(t[1]);
  const n = /^(\d+)_root$/.exec(e);
  return n ? Number(n[1]) : Number.MAX_SAFE_INTEGER;
}
function Ei(e, t, n, r, o) {
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
function sc(e, t) {
  const n = Qf(e, t), r = e.resolveBranchScope(n);
  if (!r || r.length === 0 || r.join(".") !== n.join("."))
    throw new Error(
      `Vector search requires a collection-scoped secret branch. Expected a secret declared exactly at "${n.join(".")}".`
    );
  const o = e.computeEffectiveSecret(n);
  if (!o)
    throw new Error(`Vector search could not resolve an effective secret for "${n.join(".")}".`);
  return { scope: n, scopeSecret: o };
}
function Mi(e, t) {
  return t ? To(e) : Float32Array.from(e);
}
function Lo(e, t, n, r, o) {
  const i = n * r;
  if (o) {
    let u = 0;
    for (let f = 0; f < r; f++) u += e[f] * t[i + f];
    return u;
  }
  let a = 0, s = 0, c = 0;
  for (let u = 0; u < r; u++) {
    const f = e[u], p = t[i + u];
    a += f * p, s += f * f, c += p * p;
  }
  return s <= 0 || c <= 0 ? 0 : a / (Math.sqrt(s) * Math.sqrt(c));
}
function cc(e, t, n, r, o) {
  let i = 0, a = -1 / 0;
  for (let s = 0; s < n; s++) {
    const c = Lo(e, t, s, r, o);
    c > a && (a = c, i = s);
  }
  return i;
}
function Bi(e, t, n, r) {
  const o = t * r;
  for (let i = 0; i < r; i++) e[o + i] = n[i];
}
function nd(e, t, n, r, o, i) {
  const a = t * o;
  if (r <= 0) return;
  const s = new Float32Array(o);
  for (let u = 0; u < o; u++) s[u] = n[u] / r;
  const c = i ? To(s) : s;
  for (let u = 0; u < o; u++) e[a + u] = c[u];
}
function rd(e, t, n, r) {
  const o = new Float32Array(t * n);
  Bi(o, 0, e[0], n);
  for (let i = 1; i < t; i++) {
    let a = 0, s = -1 / 0;
    for (let c = 0; c < e.length; c++) {
      const u = e[c];
      let f = -1 / 0;
      for (let d = 0; d < i; d++)
        f = Math.max(f, Lo(u, o, d, n, r));
      const p = 1 - f;
      p > s && (s = p, a = c);
    }
    Bi(o, i, e[a], n);
  }
  return o;
}
function od(e, t, n, r, o) {
  const i = rd(e, t, n, o);
  for (let a = 0; a < r; a++) {
    const s = Array.from({ length: t }, () => new Float32Array(n)), c = new Uint32Array(t);
    for (const u of e) {
      const f = cc(u, i, t, n, o);
      c[f] += 1;
      const p = s[f];
      for (let d = 0; d < n; d++) p[d] += u[d];
    }
    for (let u = 0; u < t; u++)
      c[u] <= 0 || nd(i, u, s[u], c[u], n, o);
  }
  return i;
}
function Ci(e, t) {
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
function Ai(e, t) {
  return e <= 0 || t <= 0 ? 1 : Math.max(1, Math.round(e / t));
}
function id(e, t, n, r, o, i) {
  const a = [];
  let s = 0, c = 0;
  for (const u of r) {
    const f = e.getDecryptedChunk(t, n, u);
    if (!f) continue;
    if (yt(f)) {
      const g = f.payload, v = g.embeddings, x = g.meta.dims, M = g.meta.count;
      if (!(v instanceof Float32Array) || x <= 0 || M <= 0 || (s === 0 && (s = x), x !== s)) continue;
      c += M;
      const m = Ci(M, i), b = Ai(M, m.length), k = m.map((B) => {
        const D = B * x, R = D + x;
        return {
          vector: Mi(v.subarray(D, R), o),
          weight: b
        };
      });
      k.length > 0 && a.push({
        chunkId: u,
        vectorCount: M,
        representatives: k
      });
      continue;
    }
    if (!Array.isArray(f)) continue;
    const p = [];
    for (let g = 0; g < f.length; g++) {
      const v = f[g];
      if (!v || typeof v != "object") continue;
      const x = ic(v.embedding, s || Number.MAX_SAFE_INTEGER);
      x && (s === 0 && (s = x.length), x.length === s && p.push(Mi(x, o)));
    }
    if (p.length <= 0) continue;
    c += p.length;
    const d = Ci(p.length, i), h = Ai(p.length, d.length), y = d.map((g) => ({
      vector: p[g],
      weight: h
    }));
    a.push({
      chunkId: u,
      vectorCount: p.length,
      representatives: y
    });
  }
  return { chunks: a, dims: s, totalVectors: c };
}
function ad(e, t, n, r, o, i) {
  const a = [];
  for (let s = 0; s < n; s++) {
    const c = Lo(e, t, s, r, o);
    a.push({ centroidId: s, score: c });
  }
  return a.sort((s, c) => c.score - s.score || s.centroidId - c.centroidId), a.slice(0, i);
}
function sd(e, t, n, r, o, i) {
  const a = [], s = nr(r);
  let c = 0, u = 0, f = 0;
  for (const p of o) {
    const d = e.getDecryptedChunk(t, n, p);
    if (d) {
      if (u++, yt(d)) {
        const h = d.payload, y = h.embeddings;
        if (!(y instanceof Float32Array) || h.meta.dims <= 0 || h.meta.count <= 0) continue;
        if (r.length !== h.meta.dims)
          throw new Error(
            `searchVector dims mismatch for "${t.join(".")}": query=${r.length}, payload=${h.meta.dims}`
          );
        c = h.meta.dims;
        for (let g = 0; g < h.meta.count; g++) {
          const v = g * h.meta.dims, x = ec(r, y, v, h.meta.dims, s);
          if (f++, x < i.minScore) continue;
          const M = h.ids?.[g] ?? g, { path: m, index: b } = Ei(t, p, g, M, e.secretChunkSize);
          Fn(a, {
            path: m,
            score: x,
            index: b,
            id: M,
            chunkId: p,
            chunkOffset: g
          }, i.k);
        }
        continue;
      }
      if (Array.isArray(d))
        for (let h = 0; h < d.length; h++) {
          const y = d[h];
          if (!y || typeof y != "object") continue;
          const g = ic(y.embedding, r.length);
          if (!g) continue;
          const v = Qs(r, g);
          if (f++, v < i.minScore) continue;
          const x = y.id, M = typeof x == "number" && Number.isFinite(x) ? Math.floor(x) : h, { path: m, index: b } = Ei(t, p, h, M, e.secretChunkSize);
          Fn(a, {
            path: m,
            score: v,
            index: b,
            id: M,
            chunkId: p,
            chunkOffset: h
          }, i.k);
        }
    }
  }
  return {
    dims: c,
    scannedVectors: f,
    decryptedChunks: u,
    hits: a
  };
}
function cd(e, t, n = {}) {
  const r = Se(), { scope: o, scopeSecret: i } = sc(e, t), a = ac(e.branchStore.listChunks(o.join("."))), s = Math.max(1, Math.floor(n.chunkRepresentativesPerChunk ?? 4)), c = Math.max(256, Math.floor(n.maxTrainingVectors ?? 4096)), u = n.normalize !== !1, f = id(
    e,
    o,
    i,
    a,
    u,
    s
  ), p = f.dims, d = f.totalVectors, h = f.chunks.flatMap((R) => R.representatives.map((V) => V.vector)), y = Math.max(1, Math.floor(h.length / c)), g = [];
  for (let R = 0; R < h.length && g.length < c; R += y)
    g.push(h[R]);
  if (p <= 0 || d <= 0 || g.length === 0)
    throw new Error(`buildVectorIndex could not find any vectors under "${o.join(".")}".`);
  const v = Math.max(1, Math.min(d, Math.min(g.length, Math.floor(n.k ?? Math.round(Math.sqrt(d)))))), x = Math.max(1, Math.min(v, Math.floor(n.nprobe ?? 3))), M = Math.max(1, Math.floor(n.iterations ?? 6)), m = od(g, v, p, M, u), b = Array.from({ length: v }, () => /* @__PURE__ */ new Map());
  for (const R of f.chunks)
    for (const V of R.representatives) {
      if (V.vector.length !== p) continue;
      const q = cc(V.vector, m, v, p, u);
      b[q].set(
        R.chunkId,
        (b[q].get(R.chunkId) ?? 0) + V.weight
      );
    }
  const k = b.map(
    (R) => [...R.entries()].map(([V, q]) => ({ chunkId: V, count: q })).sort((V, q) => q.count - V.count || V.chunkId.localeCompare(q.chunkId))
  ), B = {
    meta: {
      version: 1,
      scopePath: o.join("."),
      dims: p,
      k: v,
      nprobe: x,
      totalVectors: d,
      totalChunks: a.length,
      trainingVectors: g.length,
      normalize: u,
      builtAt: Date.now()
    },
    centroids: m,
    postingLists: k
  };
  oc(e, o, B);
  const D = Xf(e, o, B);
  return {
    scopePath: o.join("."),
    tookMs: Se() - r,
    dims: p,
    k: v,
    nprobe: x,
    totalVectors: d,
    totalChunks: a.length,
    trainingVectors: g.length,
    persisted: D.persisted,
    indexPath: D.path
  };
}
function ud(e, t, n, r = {}) {
  const o = Se(), { scope: i, scopeSecret: a } = sc(e, t), s = Zf(e, i);
  if (!s)
    throw new Error(`searchVector could not find an IVF sidecar for "${i.join(".")}". Build it first with buildVectorIndex().`);
  const c = Math.max(1, Math.floor(r.k ?? 10)), u = Math.max(1, Math.min(s.meta.k, Math.floor(r.nprobe ?? s.meta.nprobe))), f = Number.isFinite(r.minScore) ? Number(r.minScore) : -1 / 0, p = Math.max(1, Math.floor(r.maxCandidateChunks ?? Math.max(c, u * 4))), d = ed(n);
  if (d.length !== s.meta.dims)
    throw new Error(
      `searchVector dims mismatch for "${i.join(".")}": query=${d.length}, index=${s.meta.dims}`
    );
  const h = s.meta.normalize ? To(d) : d, y = Se(), g = ad(h, s.centroids, s.meta.k, s.meta.dims, s.meta.normalize, u), v = /* @__PURE__ */ new Map();
  for (const { centroidId: B, score: D } of g) {
    const R = s.postingLists[B] ?? [];
    for (const V of R)
      v.set(V.chunkId, (v.get(V.chunkId) ?? 0) + D * V.count);
  }
  const x = [...v.entries()].sort((B, D) => D[1] - B[1] || B[0].localeCompare(D[0])).slice(0, p).map(([B]) => B), M = Se() - y, m = Se(), b = sd(e, i, a, d, ac(x), { k: c, minScore: f }), k = Se() - m;
  return {
    scopePath: i.join("."),
    tookMs: Se() - o,
    coarseMs: M,
    exactMs: k,
    dims: b.dims,
    k: c,
    nprobe: u,
    candidateChunks: x.length,
    decryptedChunks: b.decryptedChunks,
    scannedVectors: b.scannedVectors,
    hits: b.hits
  };
}
function _i() {
  return typeof performance < "u" && typeof performance.now == "function" ? performance.now() : Date.now();
}
function ld(e, t) {
  const n = Array.isArray(t) ? t : String(t || "").split(".").filter(Boolean);
  return e.normalizeSelectorPath(n);
}
function fd(e) {
  if (e instanceof Float32Array) return e;
  const t = new Float32Array(e.length);
  for (let n = 0; n < e.length; n++) t[n] = Number(e[n]) || 0;
  return t;
}
function dd(e, t) {
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
function hd(e) {
  return [...e].sort((t, n) => Ri(t) - Ri(n) || t.localeCompare(n));
}
function Ri(e) {
  const t = /^idx_(\d+)$/.exec(e);
  if (t) return Number(t[1]);
  const n = /^(\d+)_root$/.exec(e);
  return n ? Number(n[1]) : Number.MAX_SAFE_INTEGER;
}
function Ii(e, t, n, r, o) {
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
function pd(e, t, n, r = {}) {
  const o = _i(), i = ld(e, t), a = e.resolveBranchScope(i);
  if (!a || a.length === 0 || a.join(".") !== i.join("."))
    throw new Error(
      `searchExact requires a collection-scoped secret branch. Expected a secret declared exactly at "${i.join(".")}".`
    );
  const s = e.computeEffectiveSecret(i);
  if (!s)
    throw new Error(`searchExact could not resolve an effective secret for "${i.join(".")}".`);
  const c = Math.max(1, Math.floor(r.k ?? 10)), u = Number.isFinite(r.minScore) ? Number(r.minScore) : -1 / 0, f = fd(n), p = nr(f), d = hd(e.branchStore.listChunks(i.join("."))), h = [];
  let y = 0, g = 0, v = 0;
  for (const x of d) {
    const M = e.getDecryptedChunk(i, s, x);
    if (M) {
      if (g++, yt(M)) {
        const m = M.payload, b = m.embeddings;
        if (!(b instanceof Float32Array) || m.meta.dims <= 0 || m.meta.count <= 0) continue;
        if (f.length !== m.meta.dims)
          throw new Error(
            `searchExact dims mismatch for "${i.join(".")}": query=${f.length}, payload=${m.meta.dims}`
          );
        y = m.meta.dims;
        for (let k = 0; k < m.meta.count; k++) {
          const B = k * m.meta.dims, D = ec(f, b, B, m.meta.dims, p);
          if (v++, D < u) continue;
          const R = m.ids?.[k] ?? k, { path: V, index: q } = Ii(i, x, k, R, e.secretChunkSize);
          Fn(h, {
            path: V,
            score: D,
            index: q,
            id: R,
            chunkId: x,
            chunkOffset: k
          }, c);
        }
        continue;
      }
      if (Array.isArray(M))
        for (let m = 0; m < M.length; m++) {
          const b = M[m];
          if (!b || typeof b != "object") continue;
          const k = b.embedding, B = dd(k, f.length);
          if (!B) continue;
          y === 0 && (y = B.length);
          const D = Qs(f, B);
          if (v++, D < u) continue;
          const R = b.id, V = typeof R == "number" && Number.isFinite(R) ? Math.floor(R) : m, { path: q, index: Ke } = Ii(i, x, m, V, e.secretChunkSize);
          Fn(h, {
            path: q,
            score: D,
            index: Ke,
            id: V,
            chunkId: x,
            chunkOffset: m
          }, c);
        }
    }
  }
  return {
    scopePath: i.join("."),
    tookMs: _i() - o,
    scannedChunks: g,
    scannedVectors: v,
    dims: y,
    hits: h
  };
}
const uc = "this.me.seed:v1", yd = "this.me/identity:v1::", md = "me.seed/compound:v1::", { keccak256: lc } = Oi;
let xn = null;
function gd(e) {
  let t = "";
  for (const n of e) t += n.toString(16).padStart(2, "0");
  return t;
}
function bd() {
  const e = globalThis.crypto;
  if (!e?.getRandomValues)
    throw new Error("Secure random values are required to initialize .me.");
  const t = new Uint8Array(32);
  return e.getRandomValues(t), gd(t);
}
function xd(e) {
  if (e != null)
    return typeof e == "string" ? e : String(e);
}
function yr(e) {
  return lc(yd + e);
}
function mr(e, t) {
  return lc(md + e + "::" + t);
}
function Pi(e) {
  return String(e || "").trim().replace(/^https?:\/\//i, "").replace(/\/+$/g, "").replace(/^\.+/, "").replace(/\.+$/g, "");
}
function vd() {
  if (xn !== null) return xn;
  try {
    const e = globalThis.localStorage?.getItem(uc);
    if (e !== null)
      return xn = e, e;
  } catch {
  }
}
function Sd(e) {
  xn = e;
  try {
    globalThis.localStorage?.setItem(uc, e);
  } catch {
  }
}
function Di(e) {
  const t = xd(e);
  if (t !== void 0) return t;
  const n = vd() ?? bd();
  return Sd(n), n;
}
var ee, ce, X;
const Pe = class Pe {
  constructor(t, n = {}, r = {}) {
    bn(this, ee);
    bn(this, ce);
    bn(this, X);
    te(this, X, null), this._ownerScope = null, this._currentCallerScope = void 0;
    const o = typeof n == "string";
    if (o && typeof t != "string")
      throw new Error("COMPOUND_SEED_WHO_REQUIRED");
    const i = o ? t : null, a = o ? n : null, s = o ? r : n;
    Object.assign(this, kf(s)), te(this, ee, Di(o ? mr(i, a) : t)), te(this, ce, yr(H(this, ee))), te(this, X, i), this.bumpSecretEpoch(), this.rebuildIndex(), Object.defineProperty(this, ui, {
      configurable: !0,
      enumerable: !1,
      get: () => H(this, ee)
    }), Object.defineProperty(this, Pr, {
      configurable: !0,
      enumerable: !1,
      get: () => H(this, X)
    }), Object.defineProperty(this, Dn, {
      configurable: !0,
      enumerable: !1,
      get: () => ({
        hash: H(this, ce),
        expression: H(this, X)
      })
    }), Object.defineProperty(this, Mo, {
      configurable: !0,
      enumerable: !1,
      value: (u) => {
        te(this, X, u);
      }
    }), Object.defineProperty(this, Dr, {
      configurable: !0,
      enumerable: !1,
      value: (u, f) => {
        te(this, ee, mr(u, f)), te(this, ce, yr(H(this, ee))), te(this, X, u), wi(this), this.localSecrets = {}, this.localNoises = {}, this.protectedScopeKeys.clear(), this._ownerScope = null, this.bumpSecretEpoch(), this.rebuildIndex();
      }
    });
    const c = this.createProxy([]);
    if (Object.setPrototypeOf(c, Pe.prototype), Object.assign(c, this), Object.defineProperty(c, Pl, {
      configurable: !0,
      enumerable: !1,
      value: () => ({
        seed: H(this, ee),
        expression: H(this, X)
      })
    }), Object.defineProperty(c, ui, {
      configurable: !0,
      enumerable: !1,
      get: () => H(this, ee)
    }), Object.defineProperty(c, Pr, {
      configurable: !0,
      enumerable: !1,
      get: () => H(this, X)
    }), Object.defineProperty(c, Dn, {
      configurable: !0,
      enumerable: !1,
      get: () => ({
        hash: H(this, ce),
        expression: H(this, X)
      })
    }), Object.defineProperty(c, Dr, {
      configurable: !0,
      enumerable: !1,
      value: (u, f) => {
        te(this, ee, mr(u, f)), te(this, ce, yr(H(this, ee))), te(this, X, u), wi(this), this.localSecrets = {}, this.localNoises = {}, this.protectedScopeKeys.clear(), this._ownerScope = null, this.bumpSecretEpoch(), this.rebuildIndex();
      }
    }), s.namespace) {
      const u = String(H(this, X) || "").trim();
      if (!u) throw new Error("ACTIVE_EXPRESSION_REQUIRED");
      const f = Pi(s.namespace);
      if (!f) throw new Error("ROOT_NAMESPACE_REQUIRED");
      c.profile.rootNamespace(f), c.profile.namespace(`${u}.${f}`);
    }
    return c;
  }
  /** @internal Low-level crypto helper kept out of the main public docs surface. */
  static wrapSecretV1(t) {
    return ku(t);
  }
  /** @internal Low-level crypto helper kept out of the main public docs surface. */
  static unwrapSecretV1(t, n, r = "bytes") {
    return ua(t, n, r);
  }
  /**
   * Public redacted memory log.
   * This never exposes internal forensic fields such as `effectiveSecret`.
   */
  get memories() {
    return Bo(this._memories);
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
    return pf(this, t);
  }
  /**
   * Explain how a semantic path is derived.
   * Useful for debugging pointers, operators, and derived values.
   */
  explain(t) {
    return yl(this, t);
  }
  /**
   * Execute a raw target string or parsed target AST without going through proxy property access.
   * Useful for tooling, explicit runtime dispatch, and tests.
   */
  execute(t, n, r) {
    return yf(this, t, n, r);
  }
  /**
   * Exact vector search over a collection-scoped secret branch backed by chunked columnar storage.
   * This is the correctness baseline used before approximate indexes such as IVF.
   */
  searchExact(t, n, r = {}) {
    return pd(this, t, n, r);
  }
  /**
   * Build an approximate IVF sidecar for a collection-scoped secret vector corpus.
   * The sidecar lives outside the kernel log and is intended to reduce chunk decrypts during search.
   */
  buildVectorIndex(t, n = {}) {
    return cd(this, t, n);
  }
  /**
   * Approximate vector search backed by the IVF sidecar.
   * Uses centroids for coarse routing and exact scan only on the selected candidate chunks.
   */
  searchVector(t, n, r = {}) {
    return ud(this, t, n, r);
  }
  cloneValue(t) {
    return Y(t);
  }
  handleSelfTarget(t, n, r) {
    return Fs(this, t, n, r);
  }
  handleKernelTarget(t, n, r) {
    return Ma(this, t, n, r);
  }
  handleKernelRead(t) {
    return Ba(this, t);
  }
  handleKernelExport(t) {
    return Ca(this, t);
  }
  handleKernelImport(t, n) {
    return Aa(this, t, n);
  }
  handleKernelReplay(t, n) {
    return Ra(this, t, n);
  }
  handleKernelRehydrate(t, n) {
    return Ia(this, t, n);
  }
  handleKernelGet(t) {
    return Pa(this, t);
  }
  handleKernelSet(t, n) {
    return Da(this, t, n);
  }
  handleKeySpaceTarget(t, n, r) {
    return Os(this, t, n, r);
  }
  inspectAtPath(t) {
    return Us(this, t);
  }
  parseKeySpacePath(t) {
    return Ns(t);
  }
  readWrappedKey(t) {
    return Do(this, t);
  }
  writeWrappedKey(t, n) {
    return js(this, t, n);
  }
  openWrappedKey(t, n) {
    return Ks(this, t, n);
  }
  normalizeExecutableTarget(t) {
    return Oa(this, t);
  }
  parseExecutableTarget(t) {
    return Na(t);
  }
  splitTargetNamespace(t, n) {
    return ja(t, n);
  }
  normalizeExecutablePath(t) {
    return fo(t);
  }
  findTopLevelIndex(t, n) {
    return la(t, n);
  }
  /**
   * Export a portable public snapshot.
   * Snapshot memories are redacted and omit internal forensic fields.
   */
  exportSnapshot() {
    return uf(this);
  }
  /**
   * Hydrate the runtime from a snapshot payload.
   * This is the primary restore API for bringing a saved kernel back to life in memory.
   */
  hydrate(t) {
    return Oo(this, t);
  }
  /**
   * Import a snapshot into the current runtime.
   * Accepts both redacted public snapshots and legacy/internal payloads.
   * Prefer `hydrate()` in user-facing code.
   */
  importSnapshot(t) {
    return lf(this, t);
  }
  /**
   * Rehydrate the runtime from a snapshot payload.
   * Backward-compatible alias for `hydrate()`.
   */
  rehydrate(t) {
    return ff(this, t);
  }
  /**
   * Replay a memory log into the current runtime.
   * Accepts both public `Memory[]` and legacy/internal memory payloads.
   */
  replayMemories(t) {
    return Ll(this, t);
  }
  /**
   * Ingest a single memory-like payload into the runtime.
   * Useful for tools that already operate at the memory-log layer.
   */
  learn(t) {
    return $l(this, t);
  }
  /**
   * Derive a branch-scoped proof for the current active expression.
   * This signs a canonical payload with an Ed25519 key deterministically derived
   * from the root seed and active branch expression.
   */
  async prove(t) {
    const n = String(H(this, X) || "").trim();
    if (!n) throw new Error("ACTIVE_EXPRESSION_REQUIRED");
    const r = Pi(t.rootNamespace);
    if (!r) throw new Error("ROOT_NAMESPACE_REQUIRED");
    const o = Date.now(), i = t.challenge == null ? null : String(t.challenge), a = `${n}.${r}`, s = await bu(H(this, ee), n), { privateKey: c, publicKey: u } = await xu(s), f = {
      identityHash: H(this, ce),
      expression: n,
      namespace: a,
      rootNamespace: r,
      challenge: i,
      timestamp: o
    }, p = Sn(f), d = await vu(c, p), h = await wu(u);
    return {
      identityHash: H(this, ce),
      expression: n,
      namespace: a,
      rootNamespace: r,
      publicKey: h,
      message: p,
      signature: d,
      timestamp: o
    };
  }
  /**
   * Control whether derivations recompute eagerly or lazily.
   */
  setRecomputeMode(t) {
    return Nu(this, t);
  }
  /**
   * Read the current derivation recompute mode.
   */
  getRecomputeMode() {
    return ju(this);
  }
  /** @internal Low-level keyring helper kept out of the main public docs surface. */
  installRecipientKey(t, n) {
    return nf(this, t, n);
  }
  /** @internal Low-level keyring helper kept out of the main public docs surface. */
  uninstallRecipientKey(t) {
    return rf(this, t);
  }
  /** @internal Low-level keyring helper kept out of the main public docs surface. */
  storeWrappedKey(t, n, r) {
    return of(this, t, n, r);
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
        const a = this.ensureScopeChunks(r, o), s = Ua(this, r, "branch");
        for (const [c, u] of Object.entries(a)) {
          if (ht(u) === "v3") {
            t.skipped++;
            continue;
          }
          const f = this.getDecryptedChunk(r, o, c);
          if (!f || typeof f != "object") {
            t.errors++;
            continue;
          }
          this.setChunkBlob(r, c, du(f, s, "branch", r), o), i++, t.migratedChunks++;
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
  // --- Identity-Bound Secrets: private root lifecycle ---
  // See typedocs/Identity-Bound-Secrets.md. These are thin delegations to
  // identity-context.ts (lifecycle) and identity-migration.ts (v3->v4);
  // the crypto itself lives in identity-root.ts / crypto.ts.
  /** Whether this kernel has ever created/imported an identity root (locked or not). */
  hasIdentityRoot() {
    return Df(this);
  }
  /** Whether the identity root is currently unwrapped in this session. */
  isIdentityUnlocked() {
    return Of(this);
  }
  /**
   * The current root's public, non-secret identifier — or null if none.
   * Named `currentIdentityRootId` (not `identityRootId`) because the raw
   * `identityRootId` string field already lives directly on kernel state
   * (see kernel-state.ts) — a same-named method would be shadowed by that
   * own data property the moment the instance is constructed.
   */
  currentIdentityRootId() {
    return Nf(this);
  }
  /**
   * Create a brand-new identity root, wrap it under `password`, and leave it
   * unlocked for the remainder of this session. Throws if a root already
   * exists — use `rotateIdentityRoot()` to replace one explicitly.
   */
  async createIdentityRoot(t, n) {
    return jf(this, t, n);
  }
  /**
   * Unlock the identity root for this session. Per Option B this never
   * restores branch `_()`/`~()` secrets — only `_()`/`~()` themselves do
   * that, explicitly, per scope. Throws on a wrong password.
   */
  async unlockIdentity(t) {
    return Kf(this, t);
  }
  /**
   * Lock the identity: wipe the unwrapped root and every derived-key /
   * decrypted-plaintext cache, and clear session-supplied `_()`/`~()`
   * values. See identity-context.ts for the documented limits of
   * JavaScript memory scrubbing this relies on.
   */
  lockIdentity() {
    return Vf(this);
  }
  /**
   * Change the password protecting the identity root. Re-wraps the SAME
   * root under the new password; branch ciphertext is untouched. Distinct
   * from `rotateIdentityRoot()` — never treat the two as interchangeable.
   */
  async changeIdentityPassword(t, n) {
    return Ff(this, t, n);
  }
  /**
   * Replace the identity root with a brand-new, independently-random one.
   * A real "rotate + re-encrypt every scope" migration platform is out of
   * scope for this phase (see typedocs/Identity-Bound-Secrets.md) — this
   * mints the new root/rootId and requires the caller to acknowledge that
   * v4 ciphertext under the OLD root becomes undecryptable from the new
   * one. v3 ciphertext is unaffected either way.
   */
  async rotateIdentityRoot(t, n) {
    return Uf(this, t, n);
  }
  /**
   * Export the wrapped (ciphertext) root envelope for backup. Never returns
   * the raw root. Safe to persist/transmit; it is still password-protected.
   */
  exportIdentityRootBackup() {
    return Tf(this);
  }
  /**
   * Restore a previously-exported envelope. Per Option B this never
   * auto-unlocks or auto-restores branch secrets — call `unlockIdentity()`
   * afterward. Refuses to overwrite a different existing root unless
   * `{ force: true }` is passed explicitly.
   */
  importIdentityRootBackup(t, n) {
    return $f(this, t, n);
  }
  /**
   * Re-encrypt existing v3 branch chunks into v4, scope by scope. Only
   * touches scopes whose secret is currently available AND whose identity
   * is unlocked; anything else is recorded pending and left untouched.
   * Resumable and idempotent — safe to call repeatedly as more secrets
   * become available in later sessions.
   * @internal Maintenance helper for the v3->v4 migration.
   */
  migrateEncryptedBranchesToV4() {
    return Lf(this);
  }
  /**
   * Re-encrypt existing v3 root-scope value blobs into v4. Does not mutate
   * historical memory-log entries (would break hash-chain integrity,
   * axiom A8) — instead re-asserts each plaintext through the normal write
   * path, appending a new v4-encrypted memory entry. See
   * identity-migration.ts for the full reasoning.
   * @internal Maintenance helper for the v3->v4 migration.
   */
  migrateEncryptedValuesToV4() {
    return zf(this);
  }
  bumpSecretEpoch() {
    return ae(this);
  }
  normalizeArgs(t) {
    return Bf(t);
  }
  /**
   * Internal escape hatch for tests and controlled rollback verification.
   * Not part of the public runtime surface.
   */
  setSecretBlobVersionForTesting(t) {
    this.secretBlobVersion = t;
  }
  opKind(t) {
    return ye(this.operators, t);
  }
  isSecretScopeCall(t, n) {
    return Li(this.operators, t, n);
  }
  isNoiseScopeCall(t, n) {
    return qr(this.operators, t, n);
  }
  isPointerCall(t, n) {
    return zi(this.operators, t, n);
  }
  isIdentityCall(t, n) {
    return Wi(this.operators, t, n);
  }
  isEvalCall(t, n) {
    return Gr(this.operators, t, n);
  }
  isQueryCall(t, n) {
    return Jr(this.operators, t, n);
  }
  isDefineOpCall(t, n) {
    return Hr(t, n);
  }
  getPrevMemoryHash() {
    return Hn(this);
  }
  extractExpressionRefs(t) {
    return ts(t);
  }
  resolveRefPath(t, n) {
    return os(this, t, n);
  }
  unregisterDerivation(t) {
    return So(this, t);
  }
  getRefVersion(t) {
    return Zn(this, t);
  }
  bumpRefVersion(t) {
    return _n(this, t);
  }
  snapshotDerivationRefVersions(t) {
    return wo(this, t);
  }
  registerDerivation(t, n, r) {
    return fs(this, t, n, r);
  }
  recomputeTarget(t) {
    return _r(this, t);
  }
  isDerivationVersionStale(t) {
    return hs(this, t);
  }
  ensureTargetFresh(t) {
    return Rn(this, t);
  }
  invalidateFromPath(t) {
    return In(this, t);
  }
  clearDerivationsByPrefix(t) {
    return ys(this, t);
  }
  commitMemoryOnly(t, n, r, o) {
    return Je(this, t, n, r, o);
  }
  commitValueMapping(t, n, r = null) {
    return Ee(this, t, n, r);
  }
  /**
   * @internal Escape hatch for controlled benchmarks that need the real batch writer
   * without going through the semantic proxy surface.
   */
  _commitIndexedBatch(t, n, r, o = null) {
    return ql(this, t, n, r, o);
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
    return Jc(t), this;
  }
  /**
   * @internal Benchmark hook: drain the current blob crypto telemetry window.
   */
  _takeBlobCryptoDebugWindow() {
    return Yc();
  }
  /**
   * @internal Benchmark hook: enable DiskStore serialization/allocation telemetry.
   */
  _enableDiskStoreDebug(t = !0) {
    return gf(t), this;
  }
  /**
   * @internal Benchmark hook: drain the current DiskStore telemetry window.
   */
  _takeDiskStoreDebugWindow() {
    return bf();
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
    return As(this, t, n);
  }
  tryResolveEvalTokenValue(t, n) {
    return Ja(this, t, n);
  }
  tokenizeEvalExpression(t) {
    return bo(t);
  }
  tryEvaluateAssignExpression(t, n) {
    return xo(this, t, n);
  }
  postulate(t, n, r = null) {
    return Nn(this, t, n, r);
  }
  removeSubtree(t) {
    return Xl(this, t);
  }
  computeEffectiveSecret(t) {
    return oe(this, t);
  }
  applyMemoryToIndex(t) {
    return Is(this, t);
  }
  removeIndexPrefix(t) {
    return Ps(this, t);
  }
  rebuildIndex() {
    return Zl(this);
  }
  getIndex(t) {
    return ut(this, t);
  }
  setIndex(t, n) {
    return Ql(this, t, n);
  }
  resolveIndexPointerPath(t, n = 8) {
    return Po(this, t, n);
  }
  chunkCacheKey(t, n) {
    return ct(t, n);
  }
  clearScopeChunkCache(t) {
    return He(this, t);
  }
  getChunkId(t, n) {
    return Ze(this, t, n);
  }
  setAtPath(t, n, r) {
    return Jn(t, n, r);
  }
  flattenLeaves(t, n, r) {
    return yo(t, n, r);
  }
  migrateLegacyScopeToChunks(t, n, r) {
    return Ga(this, t, n, r);
  }
  ensureScopeChunks(t, n) {
    return mo(this, t, n);
  }
  getChunkBlob(t, n) {
    return Yn(this, t, n);
  }
  setChunkBlob(t, n, r, o) {
    return go(this, t, n, r, o);
  }
  getDecryptedChunk(t, n, r) {
    return he(this, t, n, r);
  }
  resolveBranchScope(t) {
    return me(this, t);
  }
  normalizeSelectorPath(t) {
    return F(t);
  }
  pathContainsIterator(t) {
    return da(t);
  }
  substituteIteratorInPath(t, n) {
    return co(t, n);
  }
  substituteIteratorInExpression(t, n) {
    return ha(t, n);
  }
  collectIteratorIndices(t) {
    return Co(this, t);
  }
  parseFilterExpression(t) {
    return pa(t);
  }
  parseLogicalFilterExpression(t) {
    return Xe(t);
  }
  compareValues(t, n, r) {
    return ya(t, n, r);
  }
  parseLiteralOrPath(t) {
    return ma(t);
  }
  resolveRelativeFirst(t, n) {
    return Nr(this, t, n);
  }
  evaluateFilterClauseForScope(t, n) {
    return jr(this, t, n);
  }
  evaluateLogicalFilterForScope(t, n) {
    return Ao(this, t, n);
  }
  collectChildrenForPrefix(t) {
    return Qn(this, t);
  }
  parseSelectorSegment(t) {
    return Ae(t);
  }
  parseSelectorKeys(t) {
    return uo(t);
  }
  parseTransformSelector(t) {
    return wn(t);
  }
  evaluateTransformPath(t) {
    return gs(this, t);
  }
  evaluateSelectionPath(t) {
    return bs(this, t);
  }
  buildPublicSubtree(t) {
    return _o(this, t);
  }
  evaluateFilterPath(t) {
    return xs(this, t);
  }
  pathContainsFilterSelector(t) {
    return vs(this, t);
  }
  collectFilteredScopes(t) {
    return Ss(this, t);
  }
  isStealthBlocked(t, n) {
    if (n === void 0) return !1;
    const r = F(t);
    for (let o = r.length; o >= 0; o--) {
      const i = r.slice(0, o).join("."), a = this.localSecrets[i];
      if (a !== void 0 && a !== n)
        return !0;
    }
    return !1;
  }
  /**
   * Root string read for a string the path-expression parser classified (path-expr.ts, handleCall.ts):
   * - aggregate (`x[]`, `x[].f`): evaluated in the public-view context for EVERY caller (contract v4.1 §2.3), so
   *   the owner, `me.as(null)` and `me.as(key)` get the same value; nothing is written;
   * - rejected form (any route): `undefined`; nothing is written.
   * Plain and quoted-literal strings never come here: they keep the 4.1 route (readPath).
   */
  readPathExpression(t, n) {
    if (t.kind === "aggregate")
      return Ea(this, t.ref, "public-view").value;
  }
  readPath(t) {
    const n = this._currentCallerScope, r = F(t);
    if (!this.isStealthBlocked(r, n))
      return mf(this, t);
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
    return Yr(this.operators, t, n);
  }
  createProxy(t) {
    return Lr(this, t);
  }
  describeRuntimeMethod(t, n, r, o) {
    return Q(this, t, n, r, o);
  }
  buildRuntimeSurface() {
    return zs(this);
  }
  createRuntimeProxy(t) {
    return jn(this, t);
  }
  describeRuntimeSurface() {
    return Ws();
  }
  resolveRuntimeValue(t) {
    return $r(this, t);
  }
};
ee = new WeakMap(), ce = new WeakMap(), X = new WeakMap(), Pe.RUNTIME_ESCAPE_TOKEN = jo, Pe.generateP256KeyPair = sa, Pe.exportP256PublicKey = ca, Pe.importP256PublicKey = so;
let Be = Pe;
function zo(e, t) {
  return e[t] || /* @__PURE__ */ new Set();
}
function wd(e, t, n) {
  (e[t] || (e[t] = /* @__PURE__ */ new Set())).add(n);
}
function kd(e, t, n) {
  const r = e[t];
  r && (r.delete(n), r.size === 0 && delete e[t]);
}
function Ed() {
  return {
    data: /* @__PURE__ */ new Map(),
    deps: {},
    dependents: {},
    listeners: /* @__PURE__ */ new Map(),
    dirty: /* @__PURE__ */ new Set(),
    scheduled: !1
  };
}
function Md(e, t, n) {
  e.data.get(t) !== n && (e.data.set(t, n), fc(e, t));
}
function fc(e, t) {
  if (e.dirty.has(t)) return;
  e.dirty.add(t);
  const n = zo(e.dependents, t);
  for (const r of n)
    fc(e, r);
  Bd(e);
}
function Bd(e) {
  e.scheduled || (e.scheduled = !0, queueMicrotask(() => Cd(e)));
}
function Cd(e) {
  if (e.scheduled = !1, e.dirty.size === 0) return;
  const t = Ad(e.dirty, e.deps);
  for (let n = 0; n < t.length; n++) {
    const r = t[n], o = e.data.get(r), i = e.listeners.get(r);
    if (i)
      for (const a of i) a(o);
  }
  e.dirty.clear();
}
function Ad(e, t) {
  const n = [], r = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set();
  function i(a) {
    if (r.has(a) || o.has(a)) return;
    o.add(a);
    const s = zo(t, a);
    for (const c of s)
      e.has(c) && i(c);
    o.delete(a), r.add(a), n.push(a);
  }
  for (const a of e) i(a);
  return n;
}
function _d(e, t, n) {
  const r = new Set(n), o = zo(e.deps, t);
  for (const i of o)
    kd(e.dependents, i, t);
  e.deps[t] = r;
  for (const i of r)
    wd(e.dependents, i, t);
}
function Rd(e, t, n) {
  e.listeners.has(t) || e.listeners.set(t, /* @__PURE__ */ new Set());
  const r = e.listeners.get(t);
  return r.add(n), () => {
    r.delete(n), r.size === 0 && e.listeners.delete(t);
  };
}
function Id(e) {
  return !!e && typeof e == "object" && !Array.isArray(e);
}
function Pd(e) {
  return Id(e);
}
function Dd(e) {
  return String(e || "").trim() ? Ye(e) : "";
}
function Od(e, t) {
  const n = String(t.name || "").trim();
  if (!n) return e;
  const r = je(n), o = String(t.displayName || n).trim() || n, i = Dd(String(t.space || t.namespace || ""));
  return e["@"](r), e.profile.name(o), e.profile.username(r), i && (e.profile.rootNamespace(i), e.profile.namespace(`${r}.${i}`)), e;
}
function dc(e, t, n) {
  if (!Pd(e)) {
    if (typeof t == "string") {
      if (typeof e != "string")
        throw new Error("COMPOUND_SEED_WHO_REQUIRED");
      return new Be(e, t, n);
    }
    return new Be(e, t);
  }
  const r = e.options ?? (typeof t == "string" ? n : t), o = new Be(e.seed, r);
  return Od(o, e);
}
function Wo(e, t, n) {
  return dc(e, t, n);
}
Object.setPrototypeOf(Wo, Be);
Wo.prototype = Be.prototype;
const U = Wo;
U.ME = Be;
U.createThisMe = dc;
U.parseMeUri = Wr;
U.tryParseMeUri = Mc;
U.parseCanonicalMeUri = Ti;
U.formatCanonicalMeUri = Un;
U.canonicalizeLegacyAtOperator = Bc;
U.canonicalizeHumanIdentity = $i;
U.projectDnsHostToNamespace = Cc;
U.normalizeCanonicalHandle = je;
U.normalizeCanonicalSpace = Ye;
U.DiskStore = Sf;
U.MemoryStore = $s;
U.createMe = Ed;
U.write = Md;
U.define = _d;
U.subscribe = Rd;
U.normalizeProofMessage = Sn;
U.verifyEd25519Signature = Su;
U.deriveHkdfBytes = ia;
U.generateIdentityRoot = Fo;
U.wrapIdentityRoot = er;
U.unwrapIdentityRoot = tr;
U.changeIdentityRootPassword = Xs;
export {
  Be as ME,
  $i as canonicalizeHumanIdentity,
  Bc as canonicalizeLegacyAtOperator,
  Xs as changeIdentityRootPassword,
  dc as createThisMe,
  U as default,
  bu as deriveBranchProofSeed,
  ia as deriveHkdfBytes,
  wu as exportEd25519PublicKey,
  Un as formatCanonicalMeUri,
  Fo as generateIdentityRoot,
  xu as importEd25519SigningKey,
  je as normalizeCanonicalHandle,
  Ye as normalizeCanonicalSpace,
  Sn as normalizeProofMessage,
  Ti as parseCanonicalMeUri,
  Wr as parseMeUri,
  Cc as projectDnsHostToNamespace,
  vu as signEd25519Proof,
  Mc as tryParseMeUri,
  tr as unwrapIdentityRoot,
  Su as verifyEd25519Signature,
  er as wrapIdentityRoot
};

#!/usr/bin/env python3
"""Last-mile example data for the Veracruz port demo: 2 CEDIS + 1,000 scheduled trips.

Input : overpass_raw.json (same Overpass response as build_basemap.py; not committed)
Output: port-lastmile.js  (export const CEDIS, NODES, PARENT, TRIPS, SHIFT)

- Addresses: 1,000 points sampled deterministically (random.Random(SEED)) on OSM
  residential / tertiary / secondary road segments inside the visible frame
  (Centro and nearby neighbourhoods), weighted by segment length.
- Each trip is served from the CEDIS with the shorter road distance.
- Routes: shortest path (plain length, one-way tags ignored) on the OSM road graph.
  Exported as one shortest-path tree per CEDIS (PARENT[c][i] = previous node index),
  so the page rebuilds the exact road polyline of every trip.
- Windows and loads are EXAMPLE values (seeded), not real orders:
  window = 3 h starting on the hour between 08:00 and 14:00; load 150–900 kg.
"""
import heapq, json, math, random, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
RAW = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "overpass_raw.json"
OUT = ROOT / "port-lastmile.js"
SEED, N_TRIPS = 1000, 1000

SOUTH, WEST, NORTH, EAST = 19.192, -96.142, 19.205, -96.122   # page crop (unchanged)
W, H, PAD = 1200, 800, 24
def proj(lon, lat):
    return (PAD + (lon - WEST) / (EAST - WEST) * (W - 2 * PAD), PAD + (NORTH - lat) / (NORTH - SOUTH) * (H - 2 * PAD))

CLASSES = ("primary", "secondary", "tertiary", "residential")
ADDRESS_CLASSES = ("secondary", "tertiary", "residential")
# CEDIS A = the cargo yard/warehouse by the port (same point as the page's YARD node).
# CEDIS B = an EXAMPLE second distribution centre inside the city (hypothetical site on an OSM street).
CEDIS_DEF = [
    {"id": "A", "near": (513.6, 457.8), "pt": (513.6, 457.8), "label": "CEDIS A · cargo yard"},
    {"id": "B", "near": (230.0, 560.0), "pt": None, "label": "CEDIS B · example site"},
]

d = json.load(open(RAW))
pos = {e["id"]: proj(e["lon"], e["lat"]) for e in d["elements"] if e["type"] == "node" and "lon" in e}
adj, segs, node_road = {}, [], {}
for e in d["elements"]:
    if e["type"] != "way": continue
    t = e.get("tags") or {}
    hw = t.get("highway")
    if hw not in CLASSES: continue
    ns = [n for n in e["nodes"] if n in pos]
    for a, b in zip(ns, ns[1:]):
        L = math.dist(pos[a], pos[b])
        adj.setdefault(a, []).append((b, L)); adj.setdefault(b, []).append((a, L))
        if hw in ADDRESS_CLASSES: segs.append((a, b, L))
    for n in ns:
        if t.get("name"): node_road.setdefault(n, (CLASSES.index(hw), t["name"]))

# largest connected component
seen, comps = set(), []
for s in adj:
    if s in seen: continue
    comp, st = [], [s]; seen.add(s)
    while st:
        u = st.pop(); comp.append(u)
        for v, _ in adj[u]:
            if v not in seen: seen.add(v); st.append(v)
    comps.append(comp)
main = set(max(comps, key=len))

def inframe(p, m): return m <= p[0] <= W - m and m <= p[1] <= H - m

def tree(src):
    dist, prev, pq = {src: 0.0}, {src: None}, [(0.0, src)]
    while pq:
        du, u = heapq.heappop(pq)
        if du > dist[u]: continue
        for v, w in adj[u]:
            nd = du + w
            if nd < dist.get(v, 1e18): dist[v] = nd; prev[v] = u; heapq.heappush(pq, (nd, v))
    return dist, prev

cedis = []
for c in CEDIS_DEF:
    cands = [n for n in main if inframe(pos[n], 30) and (c["pt"] is not None or node_road.get(n, (9,))[0] <= 2)]
    n = min(cands, key=lambda n: math.dist(pos[n], c["near"]))
    pt = c["pt"] or pos[n]
    road = node_road.get(n, (9, ""))[1]
    dist, prev = tree(n)
    cedis.append({**c, "node": n, "pt": pt, "road": road, "dist": dist, "prev": prev})

rng = random.Random(SEED)
cand = [(a, b, L) for a, b, L in segs if a in main and b in main and inframe(pos[a], 20) and inframe(pos[b], 20) and L > 2]
cum, acc = [], 0.0
for s in cand: acc += s[2]; cum.append(acc)
import bisect
trips, used = [], set()
while len(trips) < N_TRIPS:
    a, b, L = cand[bisect.bisect_left(cum, rng.random() * acc)]
    u = rng.uniform(0.15, 0.85)
    x, y = pos[a][0] + (pos[b][0] - pos[a][0]) * u, pos[a][1] + (pos[b][1] - pos[a][1]) * u
    if (round(x), round(y)) in used: continue
    used.add((round(x), round(y)))
    # nearer CEDIS by road distance; route enters the segment from its nearer end
    best = None
    for ci, c in enumerate(cedis):
        for n in (a, b):
            if n not in c["dist"]: continue
            dd = c["dist"][n] + math.dist(pos[n], (x, y))
            if best is None or dd < best[0]: best = (dd, ci, n)
    start_h = rng.randint(8, 14)
    trips.append({"x": round(x, 1), "y": round(y, 1), "node": best[2], "c": best[1], "w0": start_h, "w1": start_h + 3, "kg": rng.randrange(150, 901, 10)})

# export only the nodes used by the trees' paths to trip nodes
used_nodes = set()
for c in cedis: used_nodes.add(c["node"])
for t in trips:
    n, prev = t["node"], cedis[t["c"]]["prev"]
    while n is not None: used_nodes.add(n); n = prev[n]
order = sorted(used_nodes)
idx = {n: i for i, n in enumerate(order)}
NODES = [[round(pos[n][0], 1), round(pos[n][1], 1)] for n in order]
PARENT = []
for c in cedis:
    PARENT.append([idx[c["prev"][n]] if n in c["prev"] and c["prev"][n] is not None and c["prev"][n] in idx and n in used_nodes else -1 for n in order])
# trip row: [x, y, nodeIndex, cedisIndex, windowStartHour, windowEndHour, kg]
TRIPS = [[t["x"], t["y"], idx[t["node"]], t["c"], t["w0"], t["w1"], t["kg"]] for t in trips]
CEDIS = [{"id": c["id"], "label": c["label"], "road": c["road"], "pt": [round(c["pt"][0], 1), round(c["pt"][1], 1)], "node": idx[c["node"]]} for c in cedis]
OUT.write_text(
    "// Generated by build_lastmile.py from OpenStreetMap road geometry (© OpenStreetMap contributors).\n"
    "// EXAMPLE schedule (seeded): 1,000 trips from 2 CEDIS to addresses on OSM streets inside the frame.\n"
    "// TRIPS row: [x, y, nodeIndex, cedisIndex, windowStartHour, windowEndHour, kg]; routes = PARENT trees.\n"
    f"export const CEDIS = {json.dumps(CEDIS, ensure_ascii=False)};\n"
    f"export const NODES = {json.dumps(NODES, separators=(',', ':'))};\n"
    f"export const PARENT = {json.dumps(PARENT, separators=(',', ':'))};\n"
    f"export const TRIPS = {json.dumps(TRIPS, separators=(',', ':'))};\n")
per = [sum(1 for t in trips if t["c"] == i) for i in range(len(cedis))]
print("nodes:", len(NODES), "trips:", len(TRIPS), "per CEDIS:", per, "kg total:", sum(t["kg"] for t in trips), "bytes:", OUT.stat().st_size)
for c in CEDIS: print(" ", c)

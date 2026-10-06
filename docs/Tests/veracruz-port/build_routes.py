#!/usr/bin/env python3
"""Truck routes for the Veracruz port demo, computed on OSM road geometry.

Input : overpass_raw.json (same Overpass response as build_basemap.py; not committed)
Output: port-routes.js  (export const ROUTES, KEY, EXITS) in page SVG coordinates

Routing: Dijkstra on the undirected OSM road graph (primary/secondary/tertiary/
residential), cost = length x class factor (prefers main roads; one-way tags are
ignored). Port-internal service roads are not in the data, so the last metres
between a dock/queue/train key point and its nearest road node are a straight
connector. Exit routes are cut ~EXIT_MARGIN px beyond the visible frame so trucks
visibly drive off the map edge.
"""
import heapq, json, math, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
RAW = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "overpass_raw.json"
OUT = ROOT / "port-routes.js"

SOUTH, WEST, NORTH, EAST = 19.192, -96.142, 19.205, -96.122   # page crop (unchanged)
W, H, PAD = 1200, 800, 24
EXIT_MARGIN = 140
FACTOR = {"primary": 1.0, "secondary": 1.15, "tertiary": 1.45, "residential": 2.6}

def proj(lon, lat):
    return (PAD + (lon - WEST) / (EAST - WEST) * (W - 2 * PAD),
            PAD + (NORTH - lat) / (NORTH - SOUTH) * (H - 2 * PAD))

# Key points (page SVG coords, same as the semantic nodes in veracruz-port.html)
KEY = {
    "qimp": (686.4, 313.2), "qexp": (484.8, 284.3), "train": (340.8, 342.2),
    "depot": (513.6, 457.8), "port": (600.0, 255.4),
    "berth1": (768.0, 176.0), "berth2": (852.0, 290.0), "berth3": (908.0, 380.0),
}
# Exit targets: far nodes on named OSM roads (outside the frame)
EXITS = {
    "nw": {"road": "Doctor Rafaél Cuervo X", "label": "NW · Rafael Cuervo → Hwy 180 (Cardel)", "pick": lambda x, y: -x - y},
    "sw": {"road": "Avenida Salvador Díaz Mirón", "label": "S · Díaz Mirón → Xalapa", "pick": lambda x, y: y},
    "s":  {"road": "Bulevar Manuel Ávila Camacho", "label": "S · Ávila Camacho → Boca del Río", "pick": lambda x, y: y},
}

d = json.load(open(RAW))
pos = {e["id"]: proj(e["lon"], e["lat"]) for e in d["elements"] if e["type"] == "node" and "lon" in e}
adj, cls_of = {}, {}
road_nodes = {}
for e in d["elements"]:
    if e["type"] != "way": continue
    t = e.get("tags") or {}
    hw = t.get("highway")
    if hw not in FACTOR: continue
    ns = [n for n in e["nodes"] if n in pos]
    for a, b in zip(ns, ns[1:]):
        L = math.dist(pos[a], pos[b]) * FACTOR[hw]
        adj.setdefault(a, []).append((b, L)); adj.setdefault(b, []).append((a, L))
    for n in ns:
        cls_of[n] = min(cls_of.get(n, 9), list(FACTOR).index(hw))
    if t.get("name"): road_nodes.setdefault(t["name"], set()).update(ns)

# keep the largest connected component
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

def nearest(pt, max_cls=2):
    cands = [n for n in main if cls_of[n] <= max_cls] or list(main)
    return min(cands, key=lambda n: math.dist(pos[n], pt))

def dijkstra(src, dst):
    dist, prev, pq = {src: 0.0}, {}, [(0.0, src)]
    while pq:
        du, u = heapq.heappop(pq)
        if u == dst: break
        if du > dist[u]: continue
        for v, w in adj[u]:
            nd = du + w
            if nd < dist.get(v, 1e18): dist[v] = nd; prev[v] = u; heapq.heappush(pq, (nd, v))
    path, u = [dst], dst
    while u != src: u = prev[u]; path.append(u)
    return path[::-1]

def inframe(p, m=0): return -m <= p[0] <= W + m and -m <= p[1] <= H + m

def cut_beyond_frame(pts):
    """keep points until the route has gone EXIT_MARGIN px beyond the frame"""
    out = []
    left = False
    for p in pts:
        out.append(p)
        if not inframe(p): left = True
        if left and not inframe(p, EXIT_MARGIN): break
    return out

exit_node = {}
for k, ex in EXITS.items():
    ns = [n for n in road_nodes.get(ex["road"], ()) if n in main]
    exit_node[k] = max(ns, key=lambda n: ex["pick"](*pos[n]))

key_node = {k: nearest(p, 2 if k in ("depot",) else 2) for k, p in KEY.items()}

def road_route(a_pt, a_node, b_node, b_pt=None):
    pts = [a_pt] + [pos[n] for n in dijkstra(a_node, b_node)]
    if b_pt: pts.append(b_pt)
    return pts

ROUTES = {}
def add(name, pts, cut=False):
    if cut: pts = cut_beyond_frame(pts)
    # drop consecutive duplicates
    clean = [pts[0]]
    for p in pts[1:]:
        if math.dist(p, clean[-1]) > 0.5: clean.append(p)
    ROUTES[name] = [[round(x, 1), round(y, 1)] for x, y in clean]

for ek in EXITS:
    for b in ("berth1", "berth2", "berth3"):          # import, laden: berth → out of frame
        add(f"{b}>{ek}", road_route(KEY[b], key_node[b], exit_node[ek]), cut=True)
    add(f"{ek}>qimp", road_route(KEY["qimp"], key_node["qimp"], exit_node[ek])[::-1], cut=False)   # empty return
    add(f"{ek}>qexp", road_route(KEY["qexp"], key_node["qexp"], exit_node[ek])[::-1], cut=False)   # export laden in
    add(f"train>{ek}", road_route(KEY["train"], key_node["train"], exit_node[ek]), cut=True)       # export empty out
    add(f"{ek}>depot", road_route(KEY["depot"], key_node["depot"], exit_node[ek])[::-1], cut=False)
    add(f"depot>{ek}", road_route(KEY["depot"], key_node["depot"], exit_node[ek]), cut=True)

# inbound routes: start just beyond the frame (reverse of the cut outbound geometry)
for name in list(ROUTES):
    if name.startswith(("nw>", "sw>", "s>")):
        pts = ROUTES[name][::-1]
        ROUTES[name] = cut_beyond_frame([tuple(p) for p in pts])[::-1]
        ROUTES[name] = [[round(x, 1), round(y, 1)] for x, y in ROUTES[name]]

# short in-port connectors (no service roads in the data → road route where possible)
for b in ("berth1", "berth2", "berth3"):
    add(f"qimp>{b}", road_route(KEY["qimp"], key_node["qimp"], key_node[b], KEY[b]))
add("qexp>train", road_route(KEY["qexp"], key_node["qexp"], key_node["train"], KEY["train"]))
add("depot>qimp", road_route(KEY["depot"], key_node["depot"], key_node["qimp"], KEY["qimp"]))
add("depot>qexp", road_route(KEY["depot"], key_node["depot"], key_node["qexp"], KEY["qexp"]))
add("qimp>depot", road_route(KEY["qimp"], key_node["qimp"], key_node["depot"], KEY["depot"]))
add("qexp>depot", road_route(KEY["qexp"], key_node["qexp"], key_node["depot"], KEY["depot"]))

def length(pts): return sum(math.dist(a, b) for a, b in zip(pts, pts[1:]))
meta = {k: round(length(v)) for k, v in ROUTES.items()}
OUT.write_text(
    "// Generated by build_routes.py from OpenStreetMap road geometry (© OpenStreetMap contributors).\n"
    "// Page SVG coordinates (1200×800 frame); exit routes extend beyond the frame edge.\n"
    f"export const KEY = {json.dumps(KEY)};\n"
    f"export const EXITS = {json.dumps({k: v['label'] for k, v in EXITS.items()})};\n"
    f"export const ROUTES = {json.dumps(ROUTES, separators=(',', ':'))};\n")
print("routes:", len(ROUTES), "bytes:", OUT.stat().st_size)
for k, v in sorted(meta.items()): print(f"  {k:14s} {v:6d}px  pts={len(ROUTES[k])}  start={ROUTES[k][0]} end={ROUTES[k][-1]}")

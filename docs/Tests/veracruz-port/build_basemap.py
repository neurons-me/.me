#!/usr/bin/env python3
"""Convert Overpass JSON → GeoJSON + dark static SVG basemap for Veracruz."""
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent
RAW = ROOT / "overpass_raw.json"
GEOJSON = ROOT / "veracruz.geojson"
SVG = ROOT / "basemap.svg"

# Bbox (slightly padded for coast+centro)
SOUTH, WEST, NORTH, EAST = 19.192, -96.142, 19.205, -96.122
SVG_W, SVG_H = 1200, 800
PAD = 24

# Equirectangular projection into SVG
def project(lon, lat):
    x = PAD + (lon - WEST) / (EAST - WEST) * (SVG_W - 2 * PAD)
    y = PAD + (NORTH - lat) / (NORTH - SOUTH) * (SVG_H - 2 * PAD)
    return x, y

def in_bbox(lon, lat, margin=0.002):
    return (WEST - margin) <= lon <= (EAST + margin) and (SOUTH - margin) <= lat <= (NORTH + margin)

data = json.load(open(RAW))
nodes = {}
ways = []
places = []

for el in data["elements"]:
    if el["type"] == "node":
        nodes[el["id"]] = (el.get("lon"), el.get("lat"))
        tags = el.get("tags") or {}
        if "place" in tags or tags.get("amenity") == "townhall":
            if el.get("lon") is not None and in_bbox(el["lon"], el["lat"]):
                places.append({
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [el["lon"], el["lat"]]},
                    "properties": {
                        "name": tags.get("name", ""),
                        "place": tags.get("place", tags.get("amenity", "")),
                        "osm_id": el["id"],
                    },
                })
    elif el["type"] == "way":
        ways.append(el)

# Limit residential: keep those intersecting a tighter centro+puerto window
RES_SOUTH, RES_WEST, RES_NORTH, RES_EAST = 19.192, -96.142, 19.205, -96.122

def way_coords(way):
    coords = []
    for nid in way.get("nodes", []):
        if nid in nodes and nodes[nid][0] is not None:
            coords.append(list(nodes[nid]))
    return coords

def residential_near_centro(coords):
    for lon, lat in coords:
        if RES_WEST <= lon <= RES_EAST and RES_SOUTH <= lat <= RES_NORTH:
            return True
    return False

road_features = []
water_features = []
coast_features = []

for way in ways:
    tags = way.get("tags") or {}
    coords = way_coords(way)
    if len(coords) < 2:
        continue
    # clip: at least one point in bbox
    if not any(in_bbox(lon, lat) for lon, lat in coords):
        continue

    hw = tags.get("highway")
    if hw in ("primary", "secondary", "tertiary"):
        road_features.append({
            "type": "Feature",
            "geometry": {"type": "LineString", "coordinates": coords},
            "properties": {"highway": hw, "name": tags.get("name", ""), "osm_id": way["id"]},
        })
    elif hw == "residential" and residential_near_centro(coords):
        road_features.append({
            "type": "Feature",
            "geometry": {"type": "LineString", "coordinates": coords},
            "properties": {"highway": hw, "name": tags.get("name", ""), "osm_id": way["id"]},
        })

    nat = tags.get("natural")
    if nat == "coastline":
        coast_features.append({
            "type": "Feature",
            "geometry": {"type": "LineString", "coordinates": coords},
            "properties": {"natural": "coastline", "osm_id": way["id"]},
        })
    elif nat == "water":
        # closed ring if first==last else treat as line
        geom_type = "Polygon" if len(coords) >= 4 and coords[0] == coords[-1] else "LineString"
        geom = {"type": geom_type, "coordinates": [coords] if geom_type == "Polygon" else coords}
        water_features.append({
            "type": "Feature",
            "geometry": geom,
            "properties": {"natural": "water", "name": tags.get("name", ""), "osm_id": way["id"]},
        })

fc = {
    "type": "FeatureCollection",
    "properties": {
        "bbox": [WEST, SOUTH, EAST, NORTH],
        "source": "OpenStreetMap via Overpass API",
        "copyright": "© OpenStreetMap contributors",
    },
    "features": coast_features + water_features + road_features + places,
}
GEOJSON.write_text(json.dumps(fc))
print(f"GeoJSON: {len(coast_features)} coast, {len(water_features)} water, {len(road_features)} roads, {len(places)} places → {GEOJSON}")

# --- SVG ---
STROKE = {
    "primary": ("#505860", 2.6, 0.78),
    "secondary": ("#404850", 2.0, 0.6),
    "tertiary": ("#383e46", 1.5, 0.5),
    "residential": ("#2e343c", 1.0, 0.4),
}

def path_d(coords):
    parts = []
    for i, (lon, lat) in enumerate(coords):
        x, y = project(lon, lat)
        parts.append(f"{'M' if i == 0 else 'L'}{x:.2f},{y:.2f}")
    return " ".join(parts)

lines = [
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SVG_W} {SVG_H}" width="{SVG_W}" height="{SVG_H}">',
    f'  <rect width="100%" height="100%" fill="#0b0d10"/>',
    '  <g id="water" fill="none" stroke="#1a222c" stroke-width="1.4" opacity="0.5">',
]
for f in coast_features:
    d = path_d(f["geometry"]["coordinates"])
    lines.append(f'    <path d="{d}"/>')
lines.append('  </g>')

lines.append('  <g id="water-polys" fill="#12161c" stroke="#1a222c" stroke-width="0.6" opacity="0.55">')
for f in water_features:
    g = f["geometry"]
    if g["type"] == "Polygon":
        d = path_d(g["coordinates"][0]) + " Z"
        lines.append(f'    <path d="{d}"/>')
    else:
        d = path_d(g["coordinates"])
        lines.append(f'    <path d="{d}" fill="none"/>')
lines.append('  </g>')

# roads by class (residential first = under)
for klass in ("residential", "tertiary", "secondary", "primary"):
    color, sw, op = STROKE[klass]
    lines.append(f'  <g id="roads-{klass}" fill="none" stroke="{color}" stroke-width="{sw}" opacity="{op}" stroke-linecap="round" stroke-linejoin="round">')
    for f in road_features:
        if f["properties"]["highway"] == klass:
            d = path_d(f["geometry"]["coordinates"])
            lines.append(f'    <path d="{d}"/>')
    lines.append('  </g>')

# faint place dots
lines.append('  <g id="places" fill="#2a3038" opacity="0.4">')
for f in places:
    lon, lat = f["geometry"]["coordinates"]
    x, y = project(lon, lat)
    lines.append(f'    <circle cx="{x:.2f}" cy="{y:.2f}" r="1.5"/>')
lines.append('  </g>')

lines.append(f'  <!-- bbox W={WEST} S={SOUTH} E={EAST} N={NORTH} equirectangular -->')
lines.append('  <!-- © OpenStreetMap contributors -->')
lines.append('</svg>')
SVG.write_text("\n".join(lines) + "\n")
print(f"SVG → {SVG} ({SVG.stat().st_size} bytes)")

# also dump projection helpers for embedding
meta = {
    "bbox": {"south": SOUTH, "west": WEST, "north": NORTH, "east": EAST},
    "svg": {"width": SVG_W, "height": SVG_H, "pad": PAD},
    "counts": {
        "coast": len(coast_features),
        "water": len(water_features),
        "roads": len(road_features),
        "places": len(places),
    },
    "overpass_endpoint_note": "Data fetched via Overpass (lz4.overpass-api.de / prior full query retained)",
}
(ROOT / "basemap_meta.json").write_text(json.dumps(meta, indent=2))
print(json.dumps(meta, indent=2))

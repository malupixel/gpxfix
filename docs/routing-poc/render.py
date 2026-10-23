#!/usr/bin/env python3
"""Build an offline route overlay and recompute derived metrics from saved raw data.
Usage: python3 docs/routing-poc/render.py docs/routing-poc/results/<run>
No network requests. Geographic overlay has no map background.
"""
import html
import json
import math
import pathlib
import sys
from compare import summarize

folder = pathlib.Path(sys.argv[1])
entries = json.loads((folder / "summary.json").read_text())
features, sections = [], []
for entry in entries:
    if "raw_file" not in entry:
        continue
    data = json.loads((folder / entry["raw_file"]).read_text())
    entry.update(summarize(data, entry["engine"]))
    geometry = (data["routes"][0]["geometry"] if entry["engine"] == "osrm"
                else data["features"][0]["geometry"])
    features.append({"type": "Feature", "geometry": geometry, "properties": {
        k: entry[k] for k in ("case", "engine", "profile", "distance_m")}})
(folder / "summary.json").write_text(json.dumps(entries, indent=2) + "\n")
(folder / "routes.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": features}) + "\n")
for case in dict.fromkeys(f["properties"]["case"] for f in features):
    group = [f for f in features if f["properties"]["case"] == case]
    lat0 = sum(c[1] for f in group for c in f["geometry"]["coordinates"]) / sum(len(f["geometry"]["coordinates"]) for f in group)
    def project(c):
        return c[0] * math.cos(math.radians(lat0)), -c[1]
    points = [project(c) for f in group for c in f["geometry"]["coordinates"]]
    xmin, xmax = min(x for x,y in points), max(x for x,y in points)
    ymin, ymax = min(y for x,y in points), max(y for x,y in points)
    scale = min(920 / max(xmax-xmin, .0001), 480 / max(ymax-ymin, .0001))
    layers, controls = [], []
    for i, f in enumerate(group):
        p = f["properties"]
        color = {"fastbike": "#1764ca", "trekking": "#08854e", "cycling": "#dc2626", "driving": "#9f3fd0"}[p["profile"]]
        key = f"{case}-{i}"
        coords = " ".join(f"{20+(x-xmin)*scale:.2f},{20+(y-ymin)*scale:.2f}" for x,y in map(project,f["geometry"]["coordinates"]))
        layers.append(f'<polyline id="{key}" points="{coords}" fill="none" stroke="{color}" stroke-width="3" opacity=".75"/>')
        label = html.escape(f'{p["engine"]} / {p["profile"]}: {p["distance_m"]/1000:.3f} km')
        controls.append(f'<label style="color:{color}"><input type="checkbox" checked onchange="document.getElementById(\'{key}\').style.display=this.checked?\'\':\'none\'">{label}</label>')
    sections.append(f'<section><h2>{html.escape(case)}</h2>{"".join(controls)}<svg viewBox="0 0 960 520" role="img" aria-label="Porównanie przebiegu tras, północ u góry">{"".join(layers)}</svg></section>')
page = '''<!doctype html><html lang="pl"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>TweakMyRoute — routing PoC</title><style>body{font:16px system-ui;max-width:1050px;margin:2rem auto;padding:1rem;color:#182838;background:#f5f7fa}section{background:white;padding:1rem;margin:1rem 0;border:1px solid #ccd3dd;border-radius:12px}label{display:inline-block;margin:.4rem}svg{width:100%;background:#f3f4f6}</style><h1>Porównanie rzeczywistych geometrii</h1><p>BRouter: fastbike — kandydat szosa; trekking — kandydat gravel. OSRM cycling/driving — kontrola błędnego profilu. Warstwy można wyłączać. Północ u góry. Szkic bez podkładu; do kontroli dróg użyj routes.geojson w QGIS. Dane © OpenStreetMap contributors, ODbL; routing BRouter / OSRM. Wyniki eksperymentu, bez gwarancji legalności przejazdu.</p>'''
(folder / "comparison.html").write_text(page + "".join(sections) + "</html>")
print(folder / "comparison.html")

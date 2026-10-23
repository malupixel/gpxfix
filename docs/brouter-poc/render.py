#!/usr/bin/env python3
"""Offline comparison HTML/CSV from recorded results, no network or map services."""
import csv
import html
import json
import math
from pathlib import Path
import sys

folder=Path(sys.argv[1])
rows=json.loads((folder/'summary.json').read_text())
features=json.loads((folder/'routes.geojson').read_text())['features']
with (folder/'comparison.csv').open('w',newline='') as f:
    fields=['case','profile','http_status','accepted','distance_m','elapsed_s','server_cpu_s','unknown_surface_pct','major_road_proxy_m','snap_start_m','snap_end_m','error']
    w=csv.DictWriter(f,fieldnames=fields,extrasaction='ignore'); w.writeheader(); w.writerows(rows)
flags=[]
for r in rows:
    for flag in r.get('review_flags',[]):
        flags.append({'type':'Feature','geometry':{'type':'Point','coordinates':flag['location']},
                      'properties':dict(case=r['case'],profile=r['profile'],**{k:v for k,v in flag.items() if k!='location'})})
(folder/'review-flags.geojson').write_text(json.dumps({'type':'FeatureCollection','features':flags},ensure_ascii=False)+'\n')
sections=[]
for case in dict.fromkeys(r['case'] for r in rows):
    group=[f for f in features if f['properties']['case']==case]
    table='<table><tr><th>Profil<th>HTTP<th>km<th>s<th>Nieznana naw. %<th>Primary+secondary km<th>Snap start/koniec m'
    for r in [r for r in rows if r['case']==case]:
        fmt=lambda key,scale=1: '—' if r.get(key) is None else f'{r[key]/scale:.2f}'
        table+=f'<tr><td>{html.escape(r["profile"])}<td>{r["http_status"]}<td>{fmt("distance_m",1000)}<td>{fmt("elapsed_s")}<td>{fmt("unknown_surface_pct")}<td>{fmt("major_road_proxy_m",1000)}<td>{fmt("snap_start_m")} / {fmt("snap_end_m")}'
        if 'error' in r: table+=f'<tr><td colspan="7">{html.escape(r["error"])}'
    table+='</table>'
    layers=[]; controls=[]
    if group:
        lat0=group[0]['geometry']['coordinates'][0][1]
        def project(c): return c[0]*math.cos(math.radians(lat0)),-c[1]
        points=[project(c) for f in group for c in f['geometry']['coordinates']]
        xmin,xmax=min(x for x,y in points),max(x for x,y in points)
        ymin,ymax=min(y for x,y in points),max(y for x,y in points)
        scale=min(920/max(xmax-xmin,.0001),480/max(ymax-ymin,.0001))
        for i,f in enumerate(group):
            profile=f['properties']['profile']; color='#1764ca' if profile=='road-v1' else '#08854e'; key=f'{case}-{i}'
            coords=' '.join(f'{20+(x-xmin)*scale:.2f},{20+(y-ymin)*scale:.2f}' for x,y in map(project,f['geometry']['coordinates']))
            layers.append(f'<polyline id="{key}" points="{coords}" fill="none" stroke="{color}" stroke-width="3" opacity=".75"/>')
            controls.append(f'<label style="color:{color}"><input type="checkbox" checked onchange="document.getElementById(\'{key}\').style.display=this.checked?\'\':\'none\'">{profile}</label>')
            case_row=next(r for r in rows if r['case']==case and r['profile']==profile)
            for j,c in enumerate(case_row['points']):
                x,y=project(c); x=20+(x-xmin)*scale; y=20+(y-ymin)*scale
                layers.append(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="3" fill="#d33"><title>Waypoint {j+1}</title></circle>')
    sections.append(f'<section><h2>{html.escape(case)}</h2>{table}{"".join(controls)}<svg viewBox="0 0 960 520" aria-label="Geometrie tras, północ u góry">{"".join(layers)}</svg></section>')
(folder/'comparison.html').write_text('''<!doctype html><html lang="pl"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>BRouter ROAD / GRAVEL PoC</title><style>body{font:16px system-ui;max-width:1050px;margin:2rem auto;padding:1rem;color:#182838;background:#f5f7fa}section{background:white;padding:1rem;margin:1rem 0;border:1px solid #ccd3dd;border-radius:12px}label{display:inline-block;margin:.4rem}svg{width:100%;background:#f3f4f6}table{border-collapse:collapse;width:100%;font-size:.85rem}td,th{border:1px solid #ccd3dd;padding:.35rem;text-align:left}</style><h1>BRouter ROAD / GRAVEL — lokalne PoC</h1><p>Szkic geometrii bez podkładu, działa offline. Czerwone punkty to żądane waypointy, nie pozycje snapu. Pełne geometrie i flagi do przeglądu w QGIS: routes.geojson / review-flags.geojson. Primary+secondary to klasy dróg, nie pomiar ruchu. HTTP 200 nie stanowi oceny legalności ani bezpieczeństwa. Nieznana nawierzchnia nie jest asfaltem. Dane © OpenStreetMap contributors, ODbL; routing BRouter.</p>'''+''.join(sections)+'</html>')
print(folder/'comparison.html')

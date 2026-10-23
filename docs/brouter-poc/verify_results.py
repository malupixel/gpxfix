#!/usr/bin/env python3
"""Offline integrity + conservative quality audit; does not mutate captures."""
import argparse
import hashlib
import json
from pathlib import Path
from poc import summarize, write
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('folder',type=Path)
a=p.parse_args(); rows=json.loads((a.folder/'summary.json').read_text()); audited=[]
for row in rows:
    raw=(a.folder/row['raw_file']).read_bytes()
    if hashlib.sha256(raw).hexdigest()!=row['raw_sha256']:
        raise ValueError('Capture hash mismatch: '+row['raw_file'])
    audit={'case':row['case'],'profile':row['profile'],'capture_integrity':True}
    if row['http_status']==200:
        m,_=summarize(raw,{'points':row['points']})
        if m['geometry_sha256']!=row['geometry_sha256']:
            raise ValueError('Geometry hash mismatch')
        audit.update(diagnostic_accounting=m['accounting_ok'],hard_violations=m['hard_violations'],
                     snap_exceeds_proposed_30m=m['snap_start_m']>30 or m['snap_end_m']>30,
                     unknown_surface_pct=m['unknown_surface_pct'],
                     maximum_nearest_via_vertex_m=max(v['nearest_geometry_m'] for v in m['waypoint_nearest_vertex']))
    else:
        audit['recorded_error']=row.get('error')
    audited.append(audit)
write(a.folder/'quality-audit.json',audited)
print('Integrity verified:',len(rows),'captures')
print('Hard violations:',sum(len(r.get('hard_violations',[])) for r in audited))
print('Successful responses with snap >30m:',sum(r.get('snap_exceeds_proposed_30m',False) for r in audited))

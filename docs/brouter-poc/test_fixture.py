#!/usr/bin/env python3
"""Build tiny RD5 controls: public bridge, bicycle=no, bicycle=dismount.
No map download. Never serve this synthetic graph as real-world geography.
"""
import argparse
import json
from pathlib import Path
import subprocess as sp
from types import SimpleNamespace
import tempfile
from poc import ROOT, VERSION, PROFILES, Server, request, summarize, write

p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--home',type=Path,default=Path('/tmp/tmr-brouter-poc'))
p.add_argument('--output',type=Path,default=ROOT/'results/synthetic-access')
a=p.parse_args(); a.home=a.home.resolve(); a.output.mkdir(parents=True,exist_ok=False)
jar=a.home/'app'/f'brouter-{VERSION}'/f'brouter-{VERSION}-all.jar'
rows=[]
with tempfile.TemporaryDirectory(prefix='tmr-fixture-build-') as build:
    sp.run(['javac','--release','17','-cp',str(jar),'-d',build,str(ROOT/'FixtureBuilder.java')],check=True)
    for permission in ('yes','no','dismount'):
        home=a.home/'fixtures'/a.output.name/permission
        home.mkdir(parents=True,exist_ok=False)
        with (a.output/f'build-{permission}.log').open('w') as log:
            sp.run(['java','-cp',f'{build}:{jar}','FixtureBuilder',str(home),str(a.home/'profiles/lookups.dat'),permission],stdout=log,stderr=log,check=True)
        (home/'app').symlink_to(a.home/'app',target_is_directory=True)
        folder=a.output/permission;folder.mkdir()
        args=SimpleNamespace(home=home,port=17779,heap=128,threads=1,container=False)
        case={'points':[[20.013,51.01],[20.19,51.01]]}
        with Server(args,folder):
            for profile in PROFILES:
                r,raw=request(args.port,case,profile)
                r.update(permission=permission,profile=profile)
                (folder/f'{profile}.response').write_bytes(raw)
                if r['http_status']==200:
                    metrics,_=summarize(raw,case)
                    r.update(metrics)
                    r['passed']=permission=='yes' and not metrics['hard_violations']
                else:
                    r['error']=raw.decode(errors='replace')
                    # Only exact no-route outcomes qualify: not timeout/OOM/missing tile.
                    r['passed']=permission!='yes' and any(text in r['error'].lower() for text in ('no track found','target island detected'))
                rows.append(r); print(permission,profile,r['http_status'],r.get('distance_m'),r.get('error'),r['passed'],flush=True)
write(a.output/'summary.json',rows)
raise SystemExit(not all(r['passed'] for r in rows))

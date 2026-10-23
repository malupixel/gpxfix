#!/usr/bin/env python3
"""Regression policies evaluated by actual pinned BRouter expression interpreter."""
import argparse
import json
from pathlib import Path
import subprocess as sp
import tempfile

ROOT=Path(__file__).resolve().parent
p=argparse.ArgumentParser()
p.add_argument('--home',type=Path,default=Path('/tmp/tmr-brouter-poc'))
p.add_argument('--output',type=Path,default=ROOT/'results/profile-tests.json')
a=p.parse_args()
jar=a.home/'app/brouter-1.7.10/brouter-1.7.10-all.jar'
cases=[]
def test(name,tags,allowed,reverse=False,context='way'):
    cases.append((name,tags,allowed,reverse,context))
for tags in ('bicycle=no','bicycle=private','bicycle=dismount','bicycle=use_sidepath','bicycle=destination','bicycle=permit',
             'vehicle=no','vehicle=private','vehicle=destination','access=no','access=private','access=destination','access=forestry',
             'motorroad=yes','smoothness=very_bad','smoothness=impassable','mtb:scale=2','sac_scale=mountain_hiking'):
    test(tags,'highway=residential surface=asphalt '+tags,False)
for road in ('motorway','motorway_link','trunk','trunk_link','steps','construction','proposed','platform','raceway','corridor'):
    test(road,f'highway={road} surface=asphalt bicycle=yes',False)
test('tram is not a bicycle road','railway=tram oneway=yes',False)
test('rail is not a bicycle road','railway=rail',False)
for road in ('path','footway','pedestrian','bridleway'):
    test(road+' unknown permission',f'highway={road} surface=asphalt',False)
    test(road+' bike yes',f'highway={road} surface=asphalt bicycle=yes',True)
    test(road+' cycle route not permission',f'highway={road} route_bicycle_lcn=yes surface=asphalt',False)
for tags in ('access=no vehicle=no bicycle=yes','access=private bicycle=designated','motor_vehicle=no',
             'access=no vehicle=yes','bicycle=permissive','smoothness=good','mtb:scale=0'):
    test(tags,'highway=residential surface=asphalt '+tags,True)
for reverse in (False,True):
    test('oneway forward direction','highway=residential oneway=yes',not reverse,reverse)
    test('reverse oneway','highway=residential oneway=-1',reverse,reverse)
    test('bike contraflow','highway=residential oneway=yes oneway:bicycle=no',True,reverse)
    test('reverse oneway bike exemption','highway=residential oneway=-1 oneway:bicycle=no',True,reverse)
    test('bike forward prohibition','highway=residential bicycle:forward=no',reverse,reverse)
    test('bike backward prohibition','highway=residential bicycle:backward=no',not reverse,reverse)
    test('roundabout','highway=residential junction=roundabout',not reverse,reverse)
    test('bike route cannot lift ban','highway=residential bicycle=no route_bicycle_lcn=yes',False,reverse)
for tags in ('bicycle=no','bicycle=dismount','bicycle=private','access=no','vehicle=no','barrier=stile','barrier=wall','barrier=kissing_gate'):
    test('node '+tags,tags,False,context='node')
for tags in ('barrier=bollard','barrier=cycle_barrier','barrier=gate','access=no bicycle=yes','vehicle=no bicycle=designated'):
    test('node '+tags,tags,True,context='node')
rows=[]
with tempfile.TemporaryDirectory(prefix='tmr-profile-probe-') as build:
    sp.run(['javac','--release','17','-cp',str(jar),'-d',build,str(ROOT/'ProfileProbe.java')],check=True)
    def cost(profile,tags,reverse=False,context='way'):
        output=sp.check_output(['java','-cp',f'{build}:{jar}','ProfileProbe',str(a.home/'profiles/lookups.dat'),
              str(ROOT/'profiles'/f'{profile}.brf'),context,str(reverse).lower(),*tags.split()],text=True)
        return float(output.strip())
    for profile in ('road-v1','gravel-v1'):
        for name,tags,allowed,reverse,context in cases:
            value=cost(profile,tags,reverse,context)
            actual=value<(1000000 if context=='node' else 10000)
            rows.append(dict(profile=profile,name=name,tags=tags,reverse=reverse,context=context,cost=value,
                             expected_allowed=allowed,passed=actual==allowed))
        for name,good,bad in (
            ('asphalt beats gravel','surface=asphalt','surface=gravel'),
            ('asphalt beats unknown','surface=asphalt',''),
            ('local beats primary','highway=residential surface=asphalt','highway=primary surface=asphalt'),
            ('good beats bad smoothness','smoothness=good','smoothness=bad'),
            ('grade1 beats grade4','highway=track tracktype=grade1 surface=compacted','highway=track tracktype=grade4 surface=compacted')):
            first=cost(profile,'highway=residential '+good)
            second=cost(profile,'highway=residential '+bad)
            rows.append(dict(profile=profile,name=name,cost_good=first,cost_bad=second,passed=first<second))
# Cross-profile differentiation on identical known gravel path.
# End-to-end graph test is separate; these cases prove only tag policy semantics.
a.output.parent.mkdir(parents=True,exist_ok=True)
a.output.write_text(json.dumps({'tests':rows,'passed':sum(r['passed'] for r in rows),'total':len(rows)},indent=2)+'\n')
failed=[r for r in rows if not r['passed']]
print(len(rows)-len(failed),'/',len(rows),'passed')
for row in failed: print(row)
raise SystemExit(bool(failed))

#!/usr/bin/env python3
"""Isolated BRouter PoC. Python stdlib + Java 17+, no application imports."""
import argparse
import concurrent.futures
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import platform
import shutil
import signal
import socket
import subprocess as sp
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parent
VERSION = '1.7.10'
ZIP_SHA = '023fec3ba997758e8cd7ab9e1bae52e962af3f00b57683e3de86b84ffad01532'
TILES = [f'E{x}_N{y}.rd5' for x in (10, 15, 20) for y in (45, 50)]
PROFILES = ('road-v1', 'gravel-v1')
# No proxy for local routing. Downloads use normal HTTPS proxy configuration.
LOCAL = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def write(path, data):
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n')


def sha(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1024*1024), b''):
            h.update(chunk)
    return h.hexdigest()


def download(url, path):
    # Never overwrite a completed file; interrupted downloads use .part.
    if not path.exists():
        part = path.with_suffix(path.suffix + '.part')
        with urllib.request.urlopen(url, timeout=120) as r, part.open('wb') as f:
            shutil.copyfileobj(r, f)
            headers = dict(r.headers)
        if headers.get('Content-Length') and part.stat().st_size!=int(headers['Content-Length']):
            raise ValueError('Incomplete download: '+url)
        part.replace(path)
        write(path.with_suffix(path.suffix + '.http.json'), {'url': url, 'headers': headers,
              'retrieved_at': dt.datetime.now(dt.timezone.utc).isoformat()})


def verify_manifest(home):
    manifest=json.loads((home/'manifest.json').read_text())
    for f in manifest['files']:
        path=home/f['name']
        if path.stat().st_size!=f['bytes'] or sha(path)!=f['sha256']:
            raise ValueError('Data manifest mismatch: '+str(path))


def setup(home):
    for d in ('downloads', 'app', 'segments4', 'profiles', 'custom', 'runtime'):
        (home / d).mkdir(parents=True, exist_ok=True)
    archive = home / 'downloads' / f'brouter-{VERSION}.zip'
    download(f'https://github.com/abrensch/brouter/releases/download/v{VERSION}/{archive.name}', archive)
    if sha(archive) != ZIP_SHA:
        raise ValueError('Release SHA256 mismatch')
    if not (home / 'app' / f'brouter-{VERSION}').exists():
        with zipfile.ZipFile(archive) as z:
            z.extractall(home / 'app')
    for tile in TILES:
        print('data', tile, flush=True)
        download('https://brouter.de/brouter/segments4/' + tile, home / 'segments4' / tile)
    if (home/'manifest.json').exists(): verify_manifest(home)
    prepare(home)
    files = [archive, home/'profiles/lookups.dat', *sorted((home/'segments4').glob('*.rd5'))]
    write(home/'manifest.json', {'engine': VERSION, 'release_sha256': ZIP_SHA,
          'captured_at': dt.datetime.now(dt.timezone.utc).isoformat(),
          'coverage_rectangle': [10,45,25,55],
          'files': [{'name': str(p.relative_to(home)), 'bytes': p.stat().st_size,
                     'sha256': sha(p)} for p in files]})
    print(home/'manifest.json')


def prepare(home):
    (home/'profiles').mkdir(exist_ok=True)
    (home/'custom').mkdir(exist_ok=True)
    (home/'runtime').mkdir(exist_ok=True)
    shutil.copyfile(home/'app'/f'brouter-{VERSION}'/'profiles2/lookups.dat', home/'profiles/lookups.dat')
    for p in (ROOT/'profiles').glob('*.brf'):
        shutil.copyfile(p, home/'profiles'/p.name)


def java_args(home, heap, threads, port, bind='127.0.0.1'):
    return ['java', '-Xms64m', f'-Xmx{heap}m', '-XX:ActiveProcessorCount=2',
            '-XX:+ExitOnOutOfMemoryError', '-DmaxRunningTime=30', '-cp',
            str(home/'app'/f'brouter-{VERSION}'/f'brouter-{VERSION}-all.jar'),
            'btools.server.RouteServer', str(home/'segments4'), str(home/'profiles'),
            str(home/'custom'), str(port), str(threads), bind]


def request(port, case, profile):
    params = {'lonlats': '|'.join(','.join(map(str, p)) for p in case['points']),
              'profile': profile, 'alternativeidx': 0, 'format': 'geojson',
              'exportWaypoints': '1'}
    params.update(case.get('params', {}))
    url = f'http://127.0.0.1:{port}/brouter?' + urllib.parse.urlencode(params)
    start = time.monotonic()
    try:
        with LOCAL.open(url, timeout=40) as r:
            raw, status = r.read(), r.status
    except urllib.error.HTTPError as e:
        raw, status = e.read(), e.code
    except Exception as e:
        raw, status = str(e).encode(), 0
    return {'http_status': status, 'error_text':raw.decode(errors='replace')[:2000] if status!=200 else None, 'elapsed_s': round(time.monotonic()-start, 4),
            'url': url, 'raw_sha256': hashlib.sha256(raw).hexdigest()}, raw


def haversine(a, b):
    import math
    x1,y1,x2,y2 = map(math.radians, [a[0],a[1],b[0],b[1]])
    h=math.sin((y2-y1)/2)**2+math.cos(y1)*math.cos(y2)*math.sin((x2-x1)/2)**2
    return 12742000*math.asin(min(1, math.sqrt(h)))


def summarize(raw, case):
    data = json.loads(raw)
    feature = next(f for f in data['features'] if f['geometry']['type']=='LineString')
    props, coords = feature['properties'], feature['geometry']['coordinates']
    rows = props.get('messages', [])
    if not rows or 'WayTags' not in rows[0]:
        raise ValueError('No diagnostic tags; statistics unavailable')
    surfaces, roads, flags, violations = {}, {}, [], []
    for values in rows[1:]:
        row = dict(zip(rows[0], values))
        distance = float(row['Distance'])
        tags = dict(t.split('=',1) for t in row.get('WayTags','').split() if '=' in t)
        surface, road = tags.get('surface','UNKNOWN'), tags.get('highway','UNKNOWN')
        surfaces[surface] = surfaces.get(surface,0)+distance
        roads[road] = roads.get(road,0)+distance
        reasons = []
        if surface in ('UNKNOWN','unknown'): reasons.append('unknown_surface')
        if surface not in ('asphalt','concrete','paved','paving_stones','UNKNOWN','unknown'): reasons.append('other_surface')
        if road in ('primary','primary_link','secondary','secondary_link'): reasons.append('major_road_proxy')
        if tags.get('smoothness') in ('bad','very_bad','horrible','very_horrible','impassable'): reasons.append('rough')
        if tags.get('tracktype') in ('grade3','grade4','grade5'): reasons.append('rough_track')
        illegal = ((road not in {'primary','primary_link','secondary','secondary_link','tertiary','tertiary_link','cycleway','residential','living_street','unclassified','service','track','path','footway','pedestrian','bridleway','road'}) or road in ('motorway','motorway_link','trunk','trunk_link','steps') or
                   tags.get('motorroad') == 'yes' or tags.get('bicycle') in
                   ('no','private','dismount','use_sidepath','destination','permit') or
                   (road in ('path','footway','pedestrian','bridleway') and
                    tags.get('bicycle') not in ('yes','designated','permissive')))
        # Generic restrictions can be overridden by a specific bicycle/vehicle grant.
        if tags.get('bicycle') is None and tags.get('vehicle') not in ('yes','designated','permissive'):
            illegal |= tags.get('vehicle') in ('no','private','destination','permit')
            if tags.get('vehicle') is None:
                illegal |= tags.get('access') in ('no','private','destination','permit','forestry')
        flag = {'distance_m':distance, 'location':[float(row['Longitude'])/1e6,float(row['Latitude'])/1e6],
                'tags':tags, 'reasons':reasons}
        if reasons: flags.append(flag)
        if illegal: violations.append(flag)
    length = float(props['track-length'])
    accounted = sum(surfaces.values())
    unknown = surfaces.get('UNKNOWN',0)+surfaces.get('unknown',0)
    points = case['points']
    via = [{'requested':p, 'nearest_geometry_m':round(min(haversine(p,c) for c in coords),2)} for p in points]
    return {'distance_m':length, 'creator':props.get('creator'), 'vertices':len(coords),
            'geometry_sha256':hashlib.sha256(json.dumps(coords).encode()).hexdigest(),
            'surface_m':surfaces, 'highway_m':roads, 'unknown_surface_m':unknown,
            'unknown_surface_pct':round(100*unknown/accounted,2) if accounted else None,
            'major_road_proxy_m':sum(roads.get(k,0) for k in ('primary','primary_link','secondary','secondary_link')),
            'diagnostic_distance_m':accounted, 'diagnostic_delta_m':round(accounted-length,2),
            'review_flags':flags, 'hard_violations':violations,
            'waypoint_nearest_vertex':via,
            'snap_start_m':round(haversine(points[0],coords[0]),2),
            'snap_end_m':round(haversine(points[-1],coords[-1]),2),
            'accounting_ok':abs(accounted-length)<=max(10,length*0.001)}, feature


def proc_stats(pid):
    try:
        status = dict(line.split(':',1) for line in Path(f'/proc/{pid}/status').read_text().splitlines() if ':' in line)
        stat = Path(f'/proc/{pid}/stat').read_text().split(') ',1)[1].split()
        return {'rss_kib': int(status.get('VmRSS','0 kB').split()[0]),
                'hwm_kib':int(status.get('VmHWM','0 kB').split()[0]),
                'cpu_s':(int(stat[11])+int(stat[12]))/os.sysconf('SC_CLK_TCK')}
    except (OSError, ValueError):
        return {}


class Server:
    def __init__(self, args, folder):
        self.args, self.folder, self.container = args, folder, None
        self.samples, self.done = [], threading.Event()
    def __enter__(self):
        args = self.args
        # Refuse an occupied port rather than benchmark someone else's service.
        with socket.socket() as s:
            s.setsockopt(socket.SOL_SOCKET,socket.SO_REUSEADDR,1)
            s.bind(('127.0.0.1', args.port))
        prepare(args.home)
        self.log = (self.folder/'server.log').open('w')
        start = time.monotonic()
        if args.container:
            self.container = 'tmr-brouter-poc-' + str(os.getpid())
            command = ['docker','run','-d','--name',self.container,'--cpus','2',
                       '--memory',f'{args.memory}m','--memory-swap',f'{args.memory}m',
                       '--pids-limit','128','--read-only','--cap-drop','ALL',
                       '--security-opt','no-new-privileges','--user',f'{os.getuid()}:{os.getgid()}',
                       '--tmpfs','/tmp:rw,noexec,nosuid,size=32m',
                       '-p',f'127.0.0.1:{args.port}:17777',
                       '-v',f'{args.home}:/poc:ro', '-w','/tmp', '--entrypoint','java',args.image]
            command += java_args(Path('/poc'), args.heap, args.threads, 17777,'0.0.0.0')[1:]
            sp.run(command, check=True, stdout=self.log, stderr=self.log)
            info=json.loads(sp.check_output(['docker','inspect',self.container]))[0]
            self.pid=info['State']['Pid']
            self.config={'image':info['Image'], 'host_config':{k:info['HostConfig'][k] for k in
                         ('Memory','MemorySwap','NanoCpus','PortBindings')},
                         'java_version':sp.check_output(['docker','exec',self.container,'java','-version'],stderr=sp.STDOUT,text=True)}
        else:
            cpus=sorted(os.sched_getaffinity(0))[:2]
            command=['taskset','-c',','.join(map(str,cpus))]+java_args(args.home,args.heap,args.threads,args.port)
            self.process=sp.Popen(command,cwd=args.home/'runtime',stdout=self.log,stderr=self.log)
            self.pid=self.process.pid
            self.config={'command':command, 'memory_limit':'heap only; no total RSS cgroup cap',
                         'java_version':sp.check_output(['java','-version'],stderr=sp.STDOUT,text=True)}
        self.thread=threading.Thread(target=self.sample,daemon=True)
        self.thread.start()
        for _ in range(200):
            try:
                with socket.create_connection(('127.0.0.1',args.port),timeout=.5) as probe:
                    probe.sendall(b'GET / HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n')
                    if probe.recv(128).startswith(b'HTTP/1.1'): break
            except OSError: time.sleep(.05)
        else:
            self.__exit__(None,None,None)
            raise RuntimeError('BRouter did not start; see server.log')
        self.startup_s=round(time.monotonic()-start,4)
        self.idle_stats=proc_stats(self.pid)
        return self
    def sample(self):
        while not self.done.wait(.05):
            self.samples.append({'elapsed_s':time.monotonic(), **proc_stats(self.pid)})
    def __exit__(self,*exc):
        self.done.set()
        self.thread.join()
        self.final_stats=proc_stats(self.pid)
        if self.container:
            sp.run(['docker','logs',self.container],stdout=self.log,stderr=self.log)
            self.inspect=json.loads(sp.check_output(['docker','inspect',self.container]))[0]['State']
            cg=sp.check_output(['docker','exec',self.container,'sh','-c','cat /sys/fs/cgroup/memory.peak /sys/fs/cgroup/memory.events /sys/fs/cgroup/cpu.stat'],text=True)
            (self.folder/'cgroup-final.txt').write_text(cg)
            sp.run(['docker','stop','-t','5',self.container],stdout=sp.DEVNULL,check=True)
            sp.run(['docker','rm',self.container],stdout=sp.DEVNULL,check=True)
        else:
            self.process.terminate()
            try: self.process.wait(timeout=5)
            except sp.TimeoutExpired:
                self.process.kill(); self.process.wait()
        self.log.close()


def run(args):
    verify_manifest(args.home)
    folder=args.output
    folder.mkdir(parents=True,exist_ok=False)
    shutil.copyfile(ROOT/'cases.json',folder/'cases.json')
    shutil.copytree(ROOT/'profiles',folder/'profiles')
    write(folder/'source-hashes.json',{p.name:sha(p) for p in ROOT.glob('*.py')})
    cases=json.loads((ROOT/'cases.json').read_text())
    if args.quick:
        cases=[c for c in cases if c['id'] in ('city-cycleway','warszawa-lodz','multi-200km')]
    entries, features, batches = [], [], []
    with Server(args,folder) as server:
        for case in cases:
            for profile in PROFILES:
                before=proc_stats(server.pid)
                entry,raw=request(args.port,case,profile)
                after=proc_stats(server.pid)
                entry.update(case=case['id'],profile=profile,points=case['points'],expected=case.get('expected','route'))
                suffix='json' if entry['http_status']==200 else 'txt'
                filename=f'{case["id"]}-{profile}.{suffix}'
                (folder/filename).write_bytes(raw)
                entry['raw_file']=filename
                entry['server_cpu_s']=round(after.get('cpu_s',0)-before.get('cpu_s',0),3)
                entry['server_cpu_pct']=round(100*entry['server_cpu_s']/max(entry['elapsed_s'],.001),1)
                if entry['http_status']==200:
                    try:
                        summary,feature=summarize(raw,case)
                        entry.update(summary)
                        entry['accepted']=case.get('expected')!='no_route' and not entry['hard_violations'] and entry['accounting_ok']
                        feature['properties']={'case':case['id'],'profile':profile,'distance_m':entry['distance_m']}
                        features.append(feature)
                    except Exception as e:
                        entry.update(accepted=False,analysis_error=str(e))
                else:
                    entry['error']=raw.decode(errors='replace')[:2000]
                    # Only an actual no-route response qualifies, never timeout/missing tile/OOM.
                    message=entry['error'].lower()
                    entry['accepted']=case.get('expected')=='no_route' and ('no track found' in message or 'not found' in message and 'waypoint' in message)
                if case.get('expected')=='coverage_error':
                    entry['accepted']=entry['http_status']!=200 and '.rd5' in entry.get('error','') and 'not found' in entry.get('error','').lower()
                entries.append(entry)
                write(folder/'summary.json',entries)
                print(case['id'],profile,entry['http_status'],entry['elapsed_s'],entry.get('distance_m'),entry['accepted'],flush=True)
        # Short and long warm repeats, plus 2/4 concurrent requests. Server thread policy matters.
        for workers in (1,2,4):
            jobs=[(next(c for c in cases if c['id']==name),profile) for name in ('city-cycleway','warszawa-lodz') for profile in PROFILES]*2
            begin=time.monotonic(); before=proc_stats(server.pid)
            with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
                outputs=list(pool.map(lambda job: request(args.port,*job)[0],jobs))
            elapsed=time.monotonic()-begin; after=proc_stats(server.pid)
            batch={'clients':workers,'requests':len(jobs),'wall_s':round(elapsed,4),
                   'server_cpu_s':round(after.get('cpu_s',0)-before.get('cpu_s',0),3),
                   'responses':[dict(case=job[0]['id'],profile=job[1],**r) for job,r in zip(jobs,outputs)]}
            batches.append(batch)
            print('concurrency',workers,'seconds',round(elapsed,3),'statuses',[r['http_status'] for r in outputs],flush=True)
        write(folder/'routes.geojson',{'type':'FeatureCollection','features':features})
    stats={'recorded_at':dt.datetime.now(dt.timezone.utc).isoformat(),'host':platform.uname()._asdict(),
           'startup_s':server.startup_s,'idle':server.idle_stats,'final':server.final_stats,
           'peak_rss_kib':max([s.get('rss_kib',0) for s in server.samples]+[server.final_stats.get('hwm_kib',0)]),
           'heap_mib':args.heap,'memory_cap_mib':args.memory if args.container else None,
           'threads':args.threads,'config':server.config,'batches':batches,
           'disk_bytes':{d:sum(p.stat().st_size for p in (args.home/d).rglob('*') if p.is_file()) for d in ('app','segments4','downloads')},
           'profile_sha256':{p:sha(ROOT/'profiles'/f'{p}.brf') for p in PROFILES},
           'data_manifest':json.loads((args.home/'manifest.json').read_text())}
    if args.container: stats['container_state_before_stop']=server.inspect
    write(folder/'benchmark.json',stats)
    write(folder/'rss-samples.json',server.samples)
    print('results',folder)


def serve(args):
    prepare(args.home)
    # Foreground lifecycle: shell/systemd owns PID; Ctrl-C/SIGTERM stops Java.
    cpus=sorted(os.sched_getaffinity(0))[:2]
    command=['taskset','-c',','.join(map(str,cpus))]+java_args(args.home,args.heap,args.threads,args.port)
    os.chdir(args.home/'runtime')
    os.execvp(command[0],command)


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('action',choices=('setup','serve','run'))
    p.add_argument('--home',type=Path,default=Path(os.environ.get('BROUTER_POC_HOME','/tmp/tmr-brouter-poc')))
    p.add_argument('--port',type=int,default=17777)
    p.add_argument('--heap',type=int,default=640)
    p.add_argument('--threads',type=int,default=2)
    p.add_argument('--container',action='store_true')
    p.add_argument('--image',default='maven:3.9-eclipse-temurin-21')
    p.add_argument('--memory',type=int,default=1024)
    p.add_argument('--quick',action='store_true')
    p.add_argument('--output',type=Path,default=ROOT/'results'/dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
    args=p.parse_args(); args.home=args.home.resolve()
    if args.home.is_relative_to(ROOT.parents[1]):
        p.error('Data directory must be outside repository')
    if args.action=='setup': setup(args.home)
    elif args.action=='serve': serve(args)
    else: run(args)

if __name__=='__main__': main()

/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS browser harness. */
/* Run with Node 24 and PLAYWRIGHT_MODULE pointing to an installed playwright-core.
   Uses the actual Next UI and MapLibre with an isolated API and empty base style. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const http = require('node:http');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const base = 'http://127.0.0.1:3261';
const api = 'http://127.0.0.1:3262';
const requests = [];
const geometry = v => ({ type: 'LineString', coordinates: [[21, 52], [21.02, 52 + v * .005], [21.04, 52]] });
const data = v => ({ publicId:'ghost-test', name:'Ghost test', description:null, originalFilename:'test.gpx', geometry:geometry(v), distanceMeters:4200, elevationGainMeters:null, elevationProfile:[], createdAt:'2026-01-01T00:00:00Z', updatedAt:'2026-01-01T00:00:00Z', versionCreatedAt:'2026-01-01T00:00:00Z', currentVersion:8, viewedVersion:v, isCurrentVersion:v===8, versionCount:8, creationSource:'INITIAL_UPLOAD', suggestionsEnabled:true, originalAvailable:true });
const server = http.createServer((req,res) => {
  const request={method:req.method,url:req.url,body:''};requests.push(request);req.on('data',chunk=>request.body+=chunk);
  res.setHeader('Access-Control-Allow-Origin',base); res.setHeader('Access-Control-Allow-Credentials','true'); res.setHeader('Access-Control-Allow-Headers','Content-Type,Idempotency-Key'); res.setHeader('Content-Type','application/json');
  if(req.method==='OPTIONS'){res.end();return;}
  if(req.url.includes('/gpx')){res.setHeader('Content-Type','application/gpx+xml');res.setHeader('Content-Disposition','attachment; filename="main.gpx"');res.end('<gpx version="1.1"><trk><trkseg>'+geometry(8).coordinates.map(([lon,lat])=>`<trkpt lat="${lat}" lon="${lon}"/>`).join('')+'</trkseg></trk></gpx>');return;}
  let result;
  if(req.url.endsWith('/versions')) result=Array.from({length:8},(_,i)=>({versionNumber:8-i,current:i===0,source:'INITIAL_UPLOAD'}));
  else if(req.url.includes('/suggestions')) result=[];
  else if(req.url.includes('/owner/editor')) result={route:data(8),editorDocument:null};
  else if(req.url.endsWith('/owner')) result={};
  else if(req.url.endsWith('/share')) result={...data(8),publicUrl:`${base}/route/ghost-test`,previewUrl:null};
  else if(req.url.includes('/activity')) result={items:[],nextCursor:null};
  else result=data(Number(req.url.match(/\/versions\/(\d+)/)?.[1] || 8));
  res.end(JSON.stringify(result));
});
const gpx = (version='1.1') => `<?xml version="1.0"?><gpx version="${version}" xmlns="http://www.topografix.com/GPX/${version.replace('.','/')}"><trk><trkseg><trkpt lat="52" lon="21"/><trkpt lat="52.01" lon="21.01"/></trkseg><trkseg><trkpt lat="53" lon="22"/><trkpt lat="53.01" lon="22.01"/></trkseg></trk><trk><trkseg><trkpt lat="54" lon="23"/><trkpt lat="54.01" lon="23.01"/></trkseg></trk></gpx>`;
let child, browser;
async function getMap(page) {
  return page.waitForFunction(() => {
    const node=document.querySelector('.maplibregl-map');
    let fiber=node?.[Object.keys(node).find(key=>key.startsWith('__reactFiber$'))];
    for (;fiber;fiber=fiber.return) {
      for(let hook=fiber.memoizedState;hook;hook=hook.next) {
        const value=hook.memoizedState?.current ?? hook.memoizedState;
        if(value && typeof value.getLayer==='function' && value.getStyle() && (value.getLayer('route-line') || value.getLayer('editor-route-line'))) {value.on('error',event=>console.error('Browser map error:',event.error));return value;}
      }
    }
    return false;
  });
}
async function panel(page) { const summary=page.locator('summary').filter({hasText:'Trasy w tle'}); if(!await summary.evaluate(el=>el.parentElement.open)) await summary.click(); return summary.locator('..'); }
(async()=>{
  await new Promise(resolve=>server.listen(3262,'127.0.0.1',resolve));
  child=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev','--hostname','127.0.0.1','--port','3261'],{cwd:root,env:{...process.env,API_INTERNAL_URL:api,NEXT_PUBLIC_API_URL:api,NEXT_PUBLIC_MAP_STYLE_URL:'https://ghost-test.invalid/style.json'},stdio:['ignore','pipe','pipe']});
  let logs='';child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);
  for(let i=0;i<120;i++){try{if((await fetch(base,{signal:AbortSignal.timeout(2000)})).status<500)break;}catch{} await new Promise(r=>setTimeout(r,500));if(i===119)throw Error(logs);}
  browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({locale:'pl-PL',viewport:{width:1280,height:900}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error' && /MapLibre error|Browser map error/.test(message.text()))errors.push(message.text().split('\n')[0]);});
  await page.route('https://ghost-test.invalid/**',route=>route.fulfill({json:{version:8,sources:{},layers:[{id:'background',type:'background',paint:{'background-color':'#eeeeee'}}]}}));
  console.log('Opening route'); await page.goto(`${base}/route/ghost-test`);await page.locator('canvas.maplibregl-canvas').waitFor();
  console.log('Map ready'); const map=await getMap(page);await page.waitForTimeout(500);
  let p=await panel(page);
  const before=await map.evaluate(async m=>JSON.stringify((await m.getSource('route-source').getData())));
  const beforeRequests=requests.length;
  await p.locator('input[type=file]').setInputFiles([{name:'old.gpx',mimeType:'application/gpx+xml',buffer:Buffer.from(gpx())},{name:'v10.gpx',mimeType:'application/gpx+xml',buffer:Buffer.from(gpx('1.0'))}]);
  await page.waitForFunction(()=>document.querySelectorAll('details li').length===2);
  assert.equal(requests.slice(beforeRequests).filter(r=>r.method==='POST').length,0);
  assert.equal(await map.evaluate(async m=>(await m.getSource('ghost-routes').getData()).features[0].geometry.coordinates.length),3);
  await p.locator('li input[type=checkbox]').first().uncheck();
  await page.waitForTimeout(100);assert.equal(await map.evaluate(async m=>(await m.getSource('ghost-routes').getData()).features.length),1);
  await p.locator('li input[type=checkbox]').first().check();
  await p.locator('input[type=file]').setInputFiles({name:'invalid.gpx',mimeType:'application/gpx+xml',buffer:Buffer.from('<gpx version="1.1"><trk>')});
  await p.getByRole('alert').waitFor();assert.match(await p.getByRole('alert').innerText(),/Nieprawidłowy/);
  await p.locator('input[type=file]').setInputFiles({name:'bounds.gpx',mimeType:'application/gpx+xml',buffer:Buffer.from(gpx().replace('lat="52"','lat="999"'))});
  await page.waitForTimeout(100);assert.equal(await p.locator('li').count(),2);
  const layers=await map.evaluate(async m=>m.getStyle().layers.map(l=>l.id));
  assert.ok(layers.includes('ghost-routes-lines'));
  assert.ok(await map.evaluate(m=>m.queryRenderedFeatures({layers:['ghost-routes-lines']}).length)>0);
  assert.ok(layers.indexOf('ghost-routes-lines')<layers.indexOf('route-line'));
  assert.ok(layers.indexOf('route-line')<layers.indexOf('persisted-suggestions-lines'));
  assert.ok(layers.indexOf('persisted-suggestions-lines')<layers.indexOf('suggestion-handles'));
  assert.equal(await map.evaluate(async m=>JSON.stringify((await m.getSource('route-source').getData()))),before);
  await page.locator('summary').filter({hasText:'Trasy w tle'}).click();
  for(let i=0;i<2;i++){
    await page.getByRole('button',{name:'Wersja v8 — historia wersji',exact:true}).click();
    await page.getByRole('dialog').locator('li').filter({has:page.getByRole('link',{name:'v3',exact:true})}).getByRole('button',{name:i?'Pokaż na mapie':'Pokaż jako ducha',exact:true}).click();
    await page.getByRole('dialog').waitFor({state:'hidden'});
  }
  p=await panel(page);assert.equal(await p.locator('li').count(),3);
  await page.locator('summary').filter({hasText:'Trasy w tle'}).click();
  await page.getByRole('button',{name:'Wersja v8 — historia wersji',exact:true}).click();
  await page.getByRole('button',{name:'Porównaj wersje',exact:true}).click();
  await page.getByLabel('Wersja główna (A)').selectOption('3');await page.getByLabel('Wersja porównywana (B)').selectOption('7');
  await page.getByRole('button',{name:'Porównaj wersje',exact:true}).last().click();
  await page.getByRole('dialog').waitFor({state:'hidden'});
  await page.waitForTimeout(100);
  assert.equal(await map.evaluate(async m=>m.getLayoutProperty('route-line','visibility')),'none');
  assert.equal(await map.evaluate(async m=>(await m.getSource('ghost-routes').getData()).features.length),5);
  await page.getByRole('button',{name:'Zamknij porównanie',exact:true}).click();
  assert.equal(await map.evaluate(async m=>m.getLayoutProperty('route-line','visibility')),'visible');
  assert.equal(await map.evaluate(async m=>JSON.stringify((await m.getSource('route-source').getData()))),before);
  assert.equal(requests.filter(r=>r.method==='POST'||r.method==='PATCH').length,0);
  // Real pointer clicks: a ghost never supplies a suggestion anchor.
  page.on('dialog',dialog=>dialog.accept());
  async function clickCoordinate(coordinate) {
    const point=await map.evaluate((m,c)=>{const p=m.project(c),r=m.getCanvas().getBoundingClientRect();return {x:p.x+r.left,y:p.y+r.top};},coordinate);
    await page.mouse.click(point.x,point.y);await page.waitForTimeout(150);
  }
  for(const tool of ['Zaproponuj objazd','Zgłoś problem','Dodaj notatkę']) {
    await page.getByRole('button',{name:'Zaproponuj zmiany',exact:true}).click();
    await page.getByRole('button',{name:new RegExp(tool)}).click();
    await map.evaluate(m=>m.fitBounds([[20.995,51.995],[21.045,52.045]],{padding:70,duration:0}));await page.waitForTimeout(300);
    await clickCoordinate([21.009,52.009]);
    assert.equal(await map.evaluate(async m=>(await m.getSource('suggestion-handles-source').getData()).features.length),0);
    await clickCoordinate([21.003,52.006]);
    assert.equal(await map.evaluate(async m=>(await m.getSource('suggestion-handles-source').getData()).features.length),1);
    if(tool!=='Dodaj notatkę') {
      if(tool==='Zaproponuj objazd') {
        await clickCoordinate([21.009,52.009]);
        assert.equal(await map.evaluate(async m=>(await m.getSource('suggestion-handles-source').getData()).features.length),2);
      }
      await clickCoordinate([21.037,52.006]);
    }
    await page.getByRole('dialog').waitFor();
    if(tool==='Dodaj notatkę') {
      await page.getByLabel('Opis',{exact:true}).fill('Reference only');
      await page.getByLabel('Twoje imię',{exact:true}).fill('Tester');
      await page.getByRole('button',{name:'Wyślij sugestię',exact:true}).click();
      await page.getByRole('button',{name:'Gotowe',exact:true}).click();
      const submitted=JSON.parse(requests.find(r=>r.method==='POST' && r.url.includes('/suggestions')).body);
      assert.equal(submitted.type,'NOTE');assert.equal(submitted.proposedGeometry,null);
      assert.equal('ghosts' in submitted,false);assert.equal('geometry' in submitted,false);
    } else {
      await page.getByRole('button',{name:'Wróć do mapy',exact:true}).first().click();
    }
    await page.getByRole('button',{name:'Zobacz trasę',exact:true}).click();
    assert.equal(await map.evaluate(async m=>(await m.getSource('ghost-routes').getData()).features.length),3);
  }
  await page.getByRole('button',{name:/Pobierz GPX/}).first().click();
  const downloadPromise=page.waitForEvent('download');
  await page.getByRole('dialog').getByRole('button',{name:/Pobierz GPX/}).click();
  const download=await downloadPromise;const exported=await fs.readFile(await download.path(),'utf8');
  assert.equal((exported.match(/<trkpt /g)||[]).length,3);assert.ok(!exported.includes('54.01'));
  await page.getByRole('dialog').getByRole('button',{name:'Anuluj',exact:true}).click();
  await page.setViewportSize({width:390,height:844});p=await panel(page);
  const rect=await p.locator('ul').evaluate(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right};});console.log('Mobile panel bounds',rect);await page.screenshot({path:'/tmp/ghost-routes-mobile-bounds.png'});assert.ok(rect.left>=0 && rect.right<=390);
  await p.getByRole('button',{name:'Usuń z mapy',exact:true}).first().click();assert.equal(await p.locator('li').count(),2);
  await page.screenshot({path:'/tmp/ghost-routes-mobile.png'});
  await page.getByRole('button',{name:'EN',exact:true}).click();
  await page.locator('summary').filter({hasText:'Ghost Routes'}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Add background GPX',exact:true}).count(),1);
  await page.getByRole('button',{name:'PL',exact:true}).click();
  await page.locator('summary').filter({hasText:'Trasy w tle'}).click();
  await page.getByRole('button',{name:'Wersja v8 — historia wersji',exact:true}).click();
  await page.getByRole('dialog').getByRole('link',{name:'v1',exact:true}).click();
  await page.getByRole('button',{name:'Wersja v1 — historia wersji',exact:true}).waitFor();
  const historicalMap=await getMap(page);
  assert.equal(await historicalMap.evaluate(async m=>(await m.getSource('ghost-routes').getData()).features.length),2);
  assert.deepEqual(await historicalMap.evaluate(async m=>(await m.getSource('route-source').getData()).geometry),geometry(1));
  await page.getByRole('link',{name:/Przejdź do aktualnej|Zobacz aktualną|Wróć do aktualnej/}).click();
  await page.getByRole('button',{name:'Wersja v8 — historia wersji',exact:true}).waitFor();
  await page.getByRole('button',{name:'Edytuj trasę',exact:true}).click();
  await page.getByLabel('Mapa edytora trasy').waitFor();
  const ownerMap=await getMap(page);
  assert.equal(await ownerMap.evaluate(async m=>(await m.getSource('ghost-routes').getData()).features.length),2);
  const ownerGeometry=await ownerMap.evaluate(async m=>JSON.stringify(await m.getSource('editor-route').getData()));
  p=await panel(page);await p.locator('li input[type=checkbox]').first().uncheck();
  assert.equal(await ownerMap.evaluate(async m=>JSON.stringify(await m.getSource('editor-route').getData())),ownerGeometry);
  await page.getByRole('button',{name:'Zobacz trasę',exact:true}).click();
  // The shared editor map renders the same ghosts without touching the document.
  await page.goto(`${base}/draw`);await page.locator('canvas').waitFor();
  const editorMap=await getMap(page);
  await page.setViewportSize({width:390,height:844});p=await panel(page);
  await p.locator('input[type=file]').setInputFiles({name:'guide.gpx',mimeType:'application/gpx+xml',buffer:Buffer.from(gpx())});
  await page.waitForFunction(()=>document.querySelectorAll('details li').length===1);
  assert.equal(await editorMap.evaluate(async m=>(await m.getSource('editor-route').getData()).features.length),0);
  const editorLayers=await editorMap.evaluate(async m=>m.getStyle().layers.map(l=>l.id));assert.ok(editorLayers.includes('ghost-routes-lines'));assert.ok(editorLayers.indexOf('ghost-routes-lines')<editorLayers.indexOf('editor-route-line'));
  await page.locator('summary').filter({hasText:'Trasy w tle'}).click();
  await page.getByRole('button',{name:/Linia prosta/}).click();
  await page.mouse.click(150,340);await page.mouse.click(260,420);
  await page.waitForTimeout(200);
  const drawn=await editorMap.evaluate(async m=>JSON.stringify(await m.getSource('editor-route').getData()));
  assert.equal(await editorMap.evaluate(async m=>(await m.getSource('editor-route').getData()).features.length),1);
  await page.getByRole('button',{name:'↶ Cofnij',exact:true}).click();
  assert.equal(await editorMap.evaluate(async m=>(await m.getSource('editor-route').getData()).features.length),0);
  await page.getByRole('button',{name:'↷ Ponów',exact:true}).click();
  assert.equal(await editorMap.evaluate(async m=>JSON.stringify(await m.getSource('editor-route').getData())),drawn);
  assert.equal(await editorMap.evaluate(async m=>(await m.getSource('ghost-routes').getData()).features.length),1);
  await page.screenshot({path:'/tmp/ghost-routes-editor-mobile.png'});
  p=await panel(page);await p.getByRole('button',{name:'Usuń z mapy',exact:true}).click();
  assert.equal(await editorMap.evaluate(m=>!!m.getSource('ghost-routes')),false);
  assert.equal(await editorMap.evaluate(m=>!!m.getLayer('ghost-routes-lines')),false);
  assert.equal(await editorMap.evaluate(async m=>JSON.stringify(await m.getSource('editor-route').getData())),drawn);
  assert.deepEqual(errors,[]);
  console.log('PASS: GPX 1.0/1.1, 3 separate segments, multiple files, invalid XML/coordinates, visibility/removal, local-only import, version API, deduplication, historical A/B, close comparison, unchanged main route, layer hierarchy, mobile panel, drawing editor.');
})().catch(async error=>{await browser?.contexts()[0]?.pages()[0]?.screenshot({path:'/tmp/ghost-routes-failure.png'});console.error(error);process.exitCode=1;}).finally(async()=>{await browser?.close();child?.kill();server.close();});

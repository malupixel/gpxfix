import { test, expect, owner, API, more, closeDialog } from './fixtures';
import type { Page } from '@playwright/test';

async function historyAction(page: Page, version: number, action: string) {
  await more(page, 'Version history');
  await page.getByRole('button', { name: `Actions for version v${version}`, exact: true }).click();
  await page.getByRole('menuitem', { name: action === 'Download GPX' ? /Download GPX/ : action, exact: true }).click();
}
async function clickRoute(page: Page, fraction: number) {
  const canvas=page.locator('canvas.maplibregl-canvas');
  await expect(page.getByRole('button',{name:'START',exact:true})).toBeVisible();
  const box=(await canvas.boundingBox())!;
  const project=(lon:number,lat:number)=>[(lon+180)/360,(1-Math.log(Math.tan(Math.PI/4+lat*Math.PI/360))/Math.PI)/2];
  const a=project(21.0122,52.2297),b=project(21.03,52.24),mid=project(21.02,52.235);
  const center=[(a[0]+b[0])/2,(a[1]+b[1])/2];
  const scale=Math.min((box.width-100)/(b[0]-a[0]),(box.height-100)/(a[1]-b[1]),512*2**16);
  const from=fraction<.5?a:mid,to=fraction<.5?mid:b,part=fraction<.5?fraction*2:(fraction-.5)*2;
  await canvas.click({position:{x:box.width/2+(from[0]+(to[0]-from[0])*part-center[0])*scale,y:box.height/2+(from[1]+(to[1]-from[1])*part-center[1])*scale}});
}

for (const source of ['gpx', 'drawn'] as const) {
test(`new variant can be edited and saved immediately without a prior merge or reload (${source})`, async ({page}) => {
  test.setTimeout(90_000);
  let route: {publicId:string};
  if (source === 'gpx') route = await owner(page, 'Immediate variant edit');
  else {
    const coords = [[21.0122,52.2297],[21.02,52.235],[21.03,52.24]];
    const created = await page.request.post(`${API}/api/routes/drawn`, {data:{name:'Immediate variant edit', editorDocument:{version:1,
      points:coords.map((coordinate,i)=>({id:`p${i}`,coordinate})),
      segments:coords.slice(1).map((coordinate,i)=>({id:`s${i}`,fromId:`p${i}`,toId:`p${i+1}`,mode:'DIRECT',geometry:[coords[i],coordinate]}))
    }}});
    expect(created.status()).toBe(201); route = await created.json();
    await page.goto(`/route/${route.publicId}`);
    await expect(page.getByText('Owner mode', {exact:true})).toBeVisible();
  }
  const api = `${API}/api/routes/${route.publicId}`;
  const original = await (await page.request.get(api)).json();
  await historyAction(page, original.viewedVersion, 'Create variant from this version');
  await page.getByRole('dialog').getByLabel('Name', {exact:true}).fill('Small change');
  await page.getByRole('button', {name:'Save', exact:true}).click();
  await expect(page).toHaveURL(/\?branch=/);
  const branch = new URL(page.url()).searchParams.get('branch')!;
  await expect(page.getByLabel('Variant', {exact:true})).toHaveValue(branch);
  await page.getByRole('button', {name:'Edit route', exact:true}).click();
  await page.getByRole('button', {name:'✏ Direct', exact:true}).click();
  const canvas = page.locator('canvas.maplibregl-canvas');
  const box = (await canvas.boundingBox())!;
  await canvas.click({position:{x:box.width * .8, y:box.height * .45}});
  await expect(page.locator('.route-control-point')).toHaveCount(original.geometry.coordinates.length + 1);
  await page.getByRole('button', {name:'Save as new version', exact:true}).click();
  const saving = page.waitForResponse(r => r.request().method() === 'POST' && r.url().includes('/owner/versions'));
  await page.getByRole('button', {name:'Save as new version', exact:true}).last().click();
  const response = await saving;
  expect(new URL(response.url()).searchParams.get('branch')).toBe(branch);
  expect(response.request().postDataJSON().baseVersionNumber).toBe(original.viewedVersion);
  expect(response.status(), await response.text()).toBe(201);
  await expect(page.getByRole('button', {name:'Version v2 — version history'})).toBeVisible();
  const variant = await (await page.request.get(`${api}?branch=${branch}`)).json();
  expect(variant.currentVersion).toBe(2);
  expect(variant.geometry).not.toEqual(original.geometry);
  const main = await (await page.request.get(api)).json();
  expect(main.geometry).toEqual(original.geometry);
  expect(main.currentVersion).toBe(original.currentVersion);
  await page.reload();
  await expect(page.getByRole('button', {name:'Version v2 — version history'})).toBeVisible();
});
}

test('historical variant: map suggestion, merge, owner edit, ghost and GPX remain isolated', async ({page})=>{
  test.setTimeout(120_000);
  const route=await owner(page,'Branch browser route');
  const api=`${API}/api/routes/${route.publicId}`;
  const initial=await (await page.request.get(api)).json();
  const edit=await page.request.post(`${api}/owner/versions`,{data:{baseVersionNumber:1,name:'Branch browser route',editorDocument:{version:1,points:[{id:'a',coordinate:[21.0122,52.2297]},{id:'b',coordinate:[21.04,52.24]}],segments:[{id:'ab',fromId:'a',toId:'b',mode:'DIRECT',geometry:[[21.0122,52.2297],[21.04,52.24]]}]}}});
  expect(edit.status()).toBe(201);const main=await edit.json();await page.reload();
  await historyAction(page,1,'Create variant from this version');
  await page.getByRole('dialog').getByLabel('Name',{exact:true}).fill('Gravel');
  await page.getByRole('dialog').getByLabel('Description (optional)').fill('Independent variation');
  await page.getByRole('button',{name:'Save',exact:true}).click();
  await expect(page).toHaveURL(/\?branch=/);
  const branch=new URL(page.url()).searchParams.get('branch')!;
  await expect(page.getByLabel('Variant',{exact:true})).toHaveValue(branch);
  await page.reload();
  expect((await (await page.request.get(`${api}?branch=${branch}`)).json()).geometry).toEqual(initial.geometry);
  await page.getByRole('button',{name:'Suggest changes',exact:true}).click();
  await page.getByRole('button',{name:/Suggest a detour/}).click();
  await clickRoute(page,.52);
  const canvas=page.locator('canvas.maplibregl-canvas'),box=(await canvas.boundingBox())!;
  await canvas.click({position:{x:box.width*.7,y:box.height*.6}});
  await clickRoute(page,.78);
  await page.getByRole('dialog').getByLabel('Description',{exact:true}).fill('Variant detour');
  await page.getByRole('dialog').getByLabel('Your name',{exact:true}).fill('Browser rider');
  await page.getByRole('button',{name:'Submit suggestion',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Your suggestion was sent'})).toBeVisible();
  await page.getByRole('button',{name:'Done',exact:true}).click();
  await page.getByRole('button').filter({hasText:'Variant detour'}).click();
  await page.getByRole('button',{name:'Publish',exact:true}).click();
  await page.getByRole('button',{name:'Merge into official route',exact:true}).click();
  await expect(page.getByRole('button',{name:'Version v3 — version history'})).toBeVisible();
  const merged=await (await page.request.get(`${api}?branch=${branch}`)).json();
  expect(merged.geometry).not.toEqual(initial.geometry);
  expect((await (await page.request.get(api)).json()).geometry).toEqual(main.geometry);
  expect(await (await page.request.get(`${api}/suggestions?includeArchived=true`)).json()).toEqual([]);
  await historyAction(page,1,'Show as ghost');
  await expect(page.getByText('Ghost Routes (1)',{exact:true})).toBeVisible();
  await historyAction(page,1,'Rename version');
  await page.getByLabel('Version name (optional)').fill('Before gravel');
  await page.getByRole('button',{name:'Save',exact:true}).click();
  await more(page,'Version history');
  await expect(page.getByText('Before gravel',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Compare versions',exact:true}).click();
  await page.getByLabel('Primary version (A)').selectOption('1');
  await page.getByLabel('Comparison version (B)').selectOption('3');
  await page.getByRole('button',{name:'Compare versions',exact:true}).last().click();
  await expect(page.getByText('Ghost Routes (3)',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Edit route',exact:true}).click();
  await page.getByRole('button',{name:'✏ Direct',exact:true}).click();
  const editBox=(await canvas.boundingBox())!;
  await canvas.click({position:{x:editBox.width*.82,y:editBox.height*.4}});
  await page.getByRole('button',{name:'Save as new version',exact:true}).click();
  await page.getByRole('button',{name:'Save as new version',exact:true}).last().click();
  await expect(page.getByRole('button',{name:'Version v4 — version history'})).toBeVisible();
  expect((await (await page.request.get(api)).json()).geometry).toEqual(main.geometry);
  await historyAction(page,1,'Download GPX');
  const downloadPromise=page.waitForEvent('download');
  await page.getByRole('dialog').getByRole('button',{name:/Download GPX/}).click();
  const download=await downloadPromise;expect(download.suggestedFilename()).toContain('v1');
  const stream=(await download.createReadStream())!;const chunks:Buffer[]=[];for await(const chunk of stream)chunks.push(chunk);
  expect(Buffer.concat(chunks).toString()).toContain('<ele>100</ele>');
  await closeDialog(page);
  await page.getByLabel('Variant',{exact:true}).selectOption('main');
  await expect(page).toHaveURL(`/route/${route.publicId}`);
  await expect(page.getByRole('button',{name:'Version v2 — version history'})).toBeVisible();
});

test('public copy returns independent links; menu supports Escape, outside click, keyboard, PL/EN and retry', async ({page})=>{
  test.setTimeout(120_000);
  const route=await owner(page,'Public source');
  await more(page,'Version history');
  const trigger=page.getByRole('button',{name:'Actions for version v1',exact:true});
  await trigger.focus();await page.keyboard.press('Enter');
  await expect(page.getByRole('menu')).toBeVisible();
  await page.keyboard.press('End');await expect(page.getByRole('menuitem',{name:'Rename version'})).toBeFocused();
  await page.keyboard.press('Escape');await expect(page.getByRole('menu')).not.toBeVisible();await expect(page.getByRole('dialog')).toBeVisible();
  await trigger.click();await page.getByRole('heading',{name:'Version history',exact:true}).click();await expect(page.getByRole('menu')).not.toBeVisible();
  await closeDialog(page);
  await historyAction(page,1,'Create variant from this version');
  await page.getByLabel('Name',{exact:true}).fill('Retry variant');
  await page.route('**/owner/branches',r=>r.fulfill({status:400,json:{error:'Test rejected request'}}),{times:1});
  await page.getByRole('button',{name:'Save',exact:true}).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Could not save');
  await page.getByRole('button',{name:'Save',exact:true}).click();await expect(page).toHaveURL(/\?branch=/);
  await page.context().clearCookies();await page.reload();
  await expect(page.getByText('Owner mode',{exact:true})).toHaveCount(0);
  await more(page,'Version history');await page.getByRole('button',{name:'Actions for version v1'}).click();
  await expect(page.getByRole('menuitem',{name:'Create variant from this version'})).toHaveCount(0);
  await page.getByRole('menuitem',{name:'Create new route from this version'}).click();
  await page.getByLabel('Name',{exact:true}).fill('Independent copy');
  await page.getByRole('button',{name:'Save',exact:true}).click();
  const publicLink=await page.getByLabel('Public link',{exact:true}).inputValue();
  const ownerLink=await page.getByLabel('Private owner link',{exact:true}).inputValue();
  expect(publicLink).not.toContain(route.publicId);expect(ownerLink).not.toContain(route.managementToken);
  await page.getByRole('link',{name:'Edit the new route'}).click();
  await expect(page.getByRole('button',{name:'Save as new version',exact:true})).toBeVisible({timeout:30_000});
  await page.getByRole('button',{name:/Cancel/,exact:false}).first().click();
  await expect(page.getByRole('heading',{name:'Independent copy',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'PL',exact:true}).click();
  await page.getByRole('button',{name:'Wersja v1 — historia wersji'}).click();
  await page.getByRole('button',{name:'Operacje na wersji v1'}).click();
  await expect(page.getByRole('menuitem',{name:'Utwórz nową trasę z tej wersji'})).toBeVisible();
  await expect(page.getByRole('menuitem',{name:'Utwórz wariant z tej wersji'})).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('version-menu.png') });
});

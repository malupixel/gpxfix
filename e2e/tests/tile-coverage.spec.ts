import { test, expect, API } from './fixtures';
import type { Page, JSHandle } from '@playwright/test';
import type { Map as MapLibreMap, GeoJSONSource } from '../../web/node_modules/maplibre-gl';
import { routeTileCoverage } from '../../web/src/components/map/route-tiles';
import { tileToBounds } from '../../web/src/components/map/xyz-tiles';

const xy = (x: number, y: number) => { const b = tileToBounds(x, y, 14); return [b.west, b.north]; };
const sparse = [xy(9148.2, 5405.4), xy(9160.8, 5405.4)];
function gpx(points: number[][]) {
  return Buffer.from(`<gpx version="1.1" creator="E2E" xmlns="http://www.topografix.com/GPX/1/1"><trk><trkseg>${points.map(([lon, lat]) => `<trkpt lon="${lon}" lat="${lat}"/>`).join('')}</trkseg></trk></gpx>`);
}
const largeCheck = (page: Page) => page.getByRole('checkbox', { name: 'Show Squadrats grid', exact: true });
const fineCheck = (page: Page) => page.getByRole('checkbox', { name: 'Show Squadratinhos grid', exact: true });
async function counts(page: Page, points: number[][]) {
  const expected = routeTileCoverage(points);
  await expect(page.getByText(`Squadrats (${expected.large.features.length.toLocaleString('en')})`, { exact: true })).toBeVisible();
  await expect(page.getByText(`Squadratinhos (${expected.fine.features.length.toLocaleString('en')})`, { exact: true })).toBeVisible();
  return expected;
}
async function getMap(page: Page) {
  let map!: JSHandle<MapLibreMap>;
  await expect(async () => {
    map = await largeCheck(page).evaluateHandle(element => {
      type Fiber = { memoizedProps?: { map?: MapLibreMap }; alternate?: Fiber; return?: Fiber };
      let fiber = (element as unknown as Record<string, Fiber>)[Object.keys(element).find(k => k.startsWith('__reactFiber$'))!];
      while (fiber) {
        const map = fiber.memoizedProps?.map ?? fiber.alternate?.memoizedProps?.map;
        if (map && typeof map.getZoom === 'function') return map;
        fiber = fiber.return!;
      }
      throw new Error('Map not loaded');
    });
  }).toPass({ timeout: 10000 });
  return map;
}
async function upload(page: Page, points: number[][]) {
  const response = await page.request.post(`${API}/api/routes`, { multipart: { file: { name: 'coverage.gpx', mimeType: 'application/gpx+xml', buffer: gpx(points) }, name: 'Coverage test' } });
  expect(response.status()).toBe(201);
  const route = await response.json();
  await page.goto(`/route/${route.publicId}`);
  await counts(page, points);
  return route;
}
async function rendered(map: JSHandle<MapLibreMap>, layer: string) {
  return map.evaluate((map, layer) => map.getLayer(layer) ? map.queryRenderedFeatures({ layers: [layer] }).length : 0, layer);
}

test('uploaded sparse GPX: independent fills, whole-route counts, ghosts and suggestions excluded', async ({ page }, info) => {
  const route = await upload(page, sparse);
  const expected = routeTileCoverage(sparse);
  expect(expected.large.features.length).toBe(13);
  const official = await (await page.request.get(`${API}/api/routes/${route.publicId}`)).json();
  const suggestion = await page.request.post(`${API}/api/routes/${route.publicId}/suggestions`, { data: {
    type: 'DETOUR', authorName: 'Rider', description: 'Excluded detour',
    start: { longitude: sparse[0][0], latitude: sparse[0][1], distanceMeters: 0 },
    end: { longitude: sparse[1][0], latitude: sparse[1][1], distanceMeters: official.distanceMeters },
    proposedGeometry: { type: 'LineString', coordinates: [sparse[0], xy(9150, 5410), sparse[1]] },
  } });
  expect(suggestion.status()).toBe(201);
  const item = await suggestion.json();
  const published = await page.request.patch(`${API}/api/routes/${route.publicId}/suggestions/owner/${item.publicId}/moderation`, { data: { moderationStatus: 'PUBLISHED' } });
  expect(published.ok()).toBe(true);
  await page.reload();
  await counts(page, sparse);
  const map = await getMap(page);
  await map.evaluate((map, center) => map.jumpTo({ center: center as [number, number], zoom: 14 }), sparse[0]);
  await largeCheck(page).check();
  await expect.poll(() => rendered(map, 'squadrats-grid-fill')).toBeGreaterThan(0);
  expect(await map.evaluate(map => !!map.getSource('squadratinhos-grid-coverage'))).toBe(false);
  await fineCheck(page).check();
  await expect.poll(() => rendered(map, 'squadratinhos-grid-fill')).toBeGreaterThan(0);
  await largeCheck(page).uncheck();
  expect(await map.evaluate(map => !!map.getLayer('squadrats-grid-fill'))).toBe(false);
  await expect.poll(() => rendered(map, 'squadratinhos-grid-fill')).toBeGreaterThan(0);
  await largeCheck(page).check();
  const order = await map.evaluate(map => map.getStyle().layers.map(l => l.id));
  for (const fill of ['squadrats-grid-fill', 'squadratinhos-grid-fill']) {
    for (const line of ['squadrats-grid-lines', 'squadratinhos-grid-lines', 'route-line']) expect(order.indexOf(fill)).toBeLessThan(order.indexOf(line));
  }
  await expect.poll(() => map.evaluate(async map => ((await (map.getSource('squadrats-grid-coverage') as GeoJSONSource).getData()) as GeoJSON.FeatureCollection).features.length)).toBe(13);
  await page.getByText('Ghost Routes (0)', { exact: true }).click();
  const choosing = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Add background GPX', exact: true }).click();
  await (await choosing).setFiles({ name: 'ghost-only.gpx', mimeType: 'application/gpx+xml', buffer: gpx([xy(9148.2, 5412.2), xy(9160.8, 5412.2)]) });
  await expect(page.getByText('Ghost Routes (1)', { exact: true })).toBeVisible();
  await page.getByText('Ghost Routes (1)', { exact: true }).click();
  await counts(page, sparse);
  const data = await map.evaluate(async map => (map.getSource('squadrats-grid-coverage') as GeoJSONSource).getData());
  expect(data).toEqual(expected.large);
  await map.evaluate(map => map.jumpTo({ center: [0, 0], zoom: 14 }));
  await expect.poll(() => rendered(map, 'squadrats-grid-fill')).toBe(0);
  await counts(page, sparse); // Count all 13, though none are in the viewport.
  await map.evaluate((map, center) => map.jumpTo({ center: center as [number, number], zoom: 14 }), sparse[0]);
  await expect.poll(() => rendered(map, 'squadrats-grid-fill')).toBeGreaterThan(0);
  await page.screenshot({ path: info.outputPath('coverage.png') });
  await fineCheck(page).uncheck();
  expect(await map.evaluate(map => !!map.getSource('squadratinhos-grid-coverage'))).toBe(false);
  await largeCheck(page).uncheck();
  expect(await map.evaluate(map => !!map.getSource('squadrats-grid-coverage'))).toBe(false);
  await page.getByRole('button', { name: 'PL', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Pokaż siatkę Squadratinhos', exact: true })).toBeVisible();
});

test('editing updates after add, undo, redo and drag; saved versions have their own coverage', async ({ page }) => {
  const route = await upload(page, sparse);
  await page.getByRole('button', { name: 'Edit route', exact: true }).click();
  await counts(page, sparse);
  const map = await getMap(page);
  await largeCheck(page).check(); await fineCheck(page).check();
  await page.getByRole('button', { name: '✏ Direct', exact: true }).click();
  await map.evaluate(map => map.jumpTo({ center: [21.02, 52.235], zoom: 11 }));
  const canvas = page.locator('canvas.maplibregl-canvas');
  const box = (await canvas.boundingBox())!;
  await canvas.click({ position: { x: box.width * .65, y: box.height * .5 } });
  const editorGeometry = () => map.evaluate(async map => {
    const data = await (map.getSource('editor-route') as GeoJSONSource).getData() as GeoJSON.FeatureCollection<GeoJSON.LineString>;
    return data.features[0].geometry.coordinates;
  });
  const changed = await editorGeometry();
  await counts(page, changed);
  expect(routeTileCoverage(changed).large.features.length).not.toBe(13);
  await page.getByRole('button', { name: '↶ Undo', exact: true }).click();
  await counts(page, sparse);
  await page.getByRole('button', { name: '↷ Redo', exact: true }).click();
  await counts(page, changed);
  // Move the last control point and wait for the committed geometry, not cursor previews.
  const marker = page.locator('.route-control-point[data-kind="end"]');
  const markerBox = (await marker.boundingBox())!;
  await page.mouse.move(markerBox.x + markerBox.width / 2, markerBox.y + markerBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(markerBox.x + markerBox.width / 2 - 60, markerBox.y + markerBox.height / 2 + 40, { steps: 8 });
  await page.mouse.up();
  await expect.poll(editorGeometry).not.toEqual(changed);
  const moved = await editorGeometry();
  await counts(page, moved);
  await page.getByRole('button', { name: 'Save as new version', exact: true }).click();
  await page.getByRole('button', { name: 'Save as new version', exact: true }).last().click();
  await expect(page.getByRole('button', { name: 'Version v2 — version history' })).toBeVisible();
  await counts(page, moved);
  await page.getByRole('button', { name: 'Version v2 — version history' }).click();
  await page.getByRole('link', { name: 'v1', exact: true }).click();
  await expect(page).toHaveURL(`/route/${route.publicId}/v/1`);
  await counts(page, sparse);
  await largeCheck(page).check();
  const historic = await getMap(page);
  await expect.poll(() => historic.evaluate(async map => ((await (map.getSource('squadrats-grid-coverage') as GeoJSONSource).getData()) as GeoJSON.FeatureCollection).features.length)).toBe(13);
});

test('500 km GPX uses a worker, keeps full counts offscreen and does not recompute on pan', async ({ page }, info) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    const state = window as typeof window & { coverageRequests: number[] };
    state.coverageRequests = [];
    const original = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function(data, options?: StructuredSerializeOptions) {
      if (Array.isArray(data) && Array.isArray(data[0])) state.coverageRequests.push(data.length);
      original.call(this, data, options ?? {});
    };
  });
  const points = Array.from({ length: 20_001 }, (_, i) => [16 + i / 20_000 * 7.3, 52.12345]);
  await upload(page, points);
  const requests = () => page.evaluate(() => (window as typeof window & { coverageRequests: number[] }).coverageRequests);
  expect(await requests()).toEqual([20001]);
  const map = await getMap(page);
  await largeCheck(page).check(); await fineCheck(page).check();
  await map.evaluate(map => map.jumpTo({ center: [19.5, 52.12345], zoom: 14 }));
  await expect.poll(() => rendered(map, 'squadratinhos-grid-fill')).toBeGreaterThan(0);
  await map.evaluate(map => map.panBy([120, 50], { duration: 0 }));
  await counts(page, points);
  expect(await requests()).toEqual([20001]);
  const layers = await map.evaluate(map => map.getStyle().layers.map(l => l.id));
  expect(layers.indexOf('squadratinhos-grid-fill')).toBeLessThan(layers.indexOf('route-line'));
  await page.screenshot({ path: info.outputPath('long-route.png') });
  await info.attach('coverage-performance', { body: JSON.stringify({ points: points.length, requests: await requests(), large: 333, fine: 2659 }), contentType: 'application/json' });
});


test('new drawing and rapid undo/redo keep only the latest geometry and survive saving', async ({ page }) => {
  await page.goto('/draw');
  await counts(page, []);
  const map = await getMap(page);
  await map.evaluate(map => map.jumpTo({ center: [21.02, 52.235], zoom: 14 }));
  await largeCheck(page).check(); await fineCheck(page).check();
  await page.getByRole('button', { name: '✏ Direct', exact: true }).click();
  const canvas = page.locator('canvas.maplibregl-canvas');
  const box = (await canvas.boundingBox())!;
  await canvas.click({ position: { x: box.width * .2, y: box.height * .5 } });
  await canvas.click({ position: { x: box.width * .7, y: box.height * .6 } });
  await page.getByRole('button', { name: '↶ Undo', exact: true }).click();
  await counts(page, []);
  await page.getByRole('button', { name: '↷ Redo', exact: true }).click();
  const data = await map.evaluate(async map => (map.getSource('editor-route') as GeoJSONSource).getData()) as GeoJSON.FeatureCollection<GeoJSON.LineString>;
  const points = data.features[0].geometry.coordinates;
  await counts(page, points);
  await expect.poll(() => rendered(map, 'squadratinhos-grid-fill')).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Finish & save', exact: true }).click();
  await page.getByLabel('Route name', { exact: true }).fill('Drawn coverage');
  await page.getByRole('button', { name: 'Save route', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Drawn coverage' })).toBeVisible();
  await counts(page, points);
});

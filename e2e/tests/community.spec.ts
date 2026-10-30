import { test, expect, owner, API, gpx, more } from './fixtures';

async function clickRoute(page: import('@playwright/test').Page, fraction: number) {
  const canvas = page.locator('canvas.maplibregl-canvas');
  await expect(page.getByRole('button', { name: 'START', exact: true })).toBeVisible();
  const box = await canvas.boundingBox();
  const project = (lon: number, lat: number) => [(lon + 180) / 360, (1 - Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) / Math.PI) / 2];
  const a = project(21.0122, 52.2297), b = project(21.03, 52.24);
  const center = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const scale = Math.min((box!.width - 100) / (b[0] - a[0]), (box!.height - 100) / (a[1] - b[1]), 512 * 2 ** 16);
  // Select a visible route point away from endpoint markers and drawing controls.
  const mid = project(21.02, 52.235);
  const from = fraction < .5 ? a : mid, to = fraction < .5 ? mid : b;
  const part = fraction < .5 ? fraction * 2 : (fraction - .5) * 2;
  await canvas.click({ position: { x: box!.width / 2 + (from[0] + (to[0] - from[0]) * part - center[0]) * scale, y: box!.height / 2 + (from[1] + (to[1] - from[1]) * part - center[1]) * scale } });
}

for (const type of ['note', 'issue', 'detour'] as const) {
  test(`submit ${type} using real map interactions`, async ({ page }) => {
    const route = await owner(page);
    await page.getByRole('button', { name: 'Suggest changes', exact: true }).click();
    const labels = { note: 'Add a note', issue: 'Report an issue', detour: 'Suggest a detour' };
    await page.getByRole('button', { name: new RegExp(labels[type]) }).click();
    await clickRoute(page, .52);
    if (type !== 'note') await clickRoute(page, .72);
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('button', { name: 'Submit suggestion', exact: true })).toBeDisabled();
    if (type === 'issue') await dialog.getByRole('combobox', { name: 'Category', exact: true }).selectOption('badSurface');
    await dialog.getByLabel('Description', { exact: true }).fill(`E2E ${type} map submission`);
    await dialog.getByLabel('Your name', { exact: true }).fill('Browser rider');
    await dialog.getByRole('button', { name: 'Submit suggestion', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Your suggestion was sent' })).toBeVisible();
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    const suggestions = await (await page.request.get(`${API}/api/routes/${route.publicId}/suggestions/owner`)).json();
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].moderationStatus).toBe('PENDING');
    expect(suggestions[0].description).toBe(`E2E ${type} map submission`);
  });
}

test('ghost GPX visibility, grid and fullscreen controls', async ({ page }) => {
  await owner(page);
  await page.getByText('Ghost Routes (0)', { exact: true }).click();
  const choosing = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Add background GPX', exact: true }).click();
  await (await choosing).setFiles({ name: 'background.gpx', mimeType: 'application/gpx+xml', buffer: gpx });
  await expect(page.getByText('Ghost Routes (1)', { exact: true })).toBeVisible();
  const visible = page.getByRole('checkbox', { name: 'Hide route: background.gpx', exact: true });
  await visible.uncheck();
  await page.getByRole('checkbox', { name: 'Show route: background.gpx', exact: true }).check();
  await page.getByRole('button', { name: 'Remove from map', exact: true }).click();
  await expect(page.getByText('Ghost Routes (0)', { exact: true })).toBeVisible();
  await page.getByText('Ghost Routes (0)', { exact: true }).click();
  await page.getByRole('checkbox', { name: 'Show Squadrats grid' }).check();
  await page.getByRole('combobox', { name: 'Distance markers:' }).selectOption('0');
  await page.getByRole('button', { name: 'Fullscreen map', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Exit fullscreen', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Exit fullscreen', exact: true }).click();
});

test('merge detour creates a version and historical geometry stays immutable', async ({ page }) => {
  const route = await owner(page);
  const original = await (await page.request.get(`${API}/api/routes/${route.publicId}`)).json();
  const response = await page.request.post(`${API}/api/routes/${route.publicId}/suggestions`, { data: {
    type: 'DETOUR', authorName: 'Rider', description: 'Safer E2E detour', tags: ['safer'],
    start: { longitude: 21.0122, latitude: 52.2297, distanceMeters: 0 },
    end: { longitude: 21.03, latitude: 52.24, distanceMeters: original.distanceMeters },
    proposedGeometry: { type: 'LineString', coordinates: [[21.0122, 52.2297], [21.025, 52.235], [21.03, 52.24]] },
  } });
  expect(response.status()).toBe(201);
  await page.reload();
  await page.getByRole('button').filter({ hasText: 'Safer E2E detour' }).click();
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  await page.getByRole('button', { name: 'Merge into official route', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Version v2 — version history' })).toBeVisible();
  const historic = await (await page.request.get(`${API}/api/routes/${route.publicId}/versions/1`)).json();
  expect(historic.geometry).toEqual(original.geometry);
  await more(page, 'Version history');
  await page.getByRole('button', { name: 'Compare versions', exact: true }).click();
  await page.getByLabel('Primary version (A)').selectOption('1');
  await page.getByLabel('Comparison version (B)').selectOption('2');
  await page.getByRole('button', { name: 'Compare versions', exact: true }).last().click();
  await expect(page.getByText('Ghost Routes (2)', { exact: true })).toBeVisible();
});

test('BUG-003: owner sees the submitted suggestion immediately after Done', async ({ page }) => {
  await owner(page);
  await page.getByRole('button', { name: 'Suggest changes', exact: true }).click();
  await page.getByRole('button', { name: /Add a note/ }).click();
  await clickRoute(page, .52);
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Description', { exact: true }).fill('Immediately visible new note');
  await dialog.getByLabel('Your name', { exact: true }).fill('Owner');
  await dialog.getByRole('button', { name: 'Submit suggestion', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your suggestion was sent' })).toBeVisible();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  test.fail(true, 'BUG-003: submission does not refresh suggestions state after success');
  await expect(page.getByRole('button').filter({ hasText: 'Immediately visible new note' })).toBeVisible();
});

import { test, expect, owner, API } from './fixtures';

async function drawPoints(page: import('@playwright/test').Page) {
  const canvas = page.locator('canvas.maplibregl-canvas');
  await expect(canvas).toBeVisible();
  await expect(page.getByRole('button', { name: /Finish & save/ })).toBeDisabled();
  // Avoid editor controls at the top/bottom and route hits after the first point.
  await page.getByRole('button', { name: '✏ Direct', exact: true }).click();
  const box = await canvas.boundingBox();
  await canvas.click({ position: { x: box!.width * .25, y: box!.height * .4 } });
  await canvas.click({ position: { x: box!.width * .65, y: box!.height * .48 } });
  await expect(page.getByRole('button', { name: /Finish & save/ })).toBeEnabled();
}

test('draw route, undo/redo and save', async ({ page }) => {
  await page.goto('/draw');
  await drawPoints(page);
  await page.getByRole('button', { name: '↶ Undo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Finish & save', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '↷ Redo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Finish & save', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Finish & save', exact: true }).click();
  await page.getByLabel('Route name', { exact: true }).fill('Drawn route E2E');
  await page.getByRole('button', { name: 'Save route', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Drawn route E2E' })).toBeVisible();
  await expect(page.getByText('Owner mode', { exact: true })).toBeVisible();
});

test('owner edits geometry and browses immutable version history', async ({ page }) => {
  const route = await owner(page);
  await page.getByRole('button', { name: 'Edit route', exact: true }).click();
  const canvas = page.locator('canvas.maplibregl-canvas');
  await expect(canvas).toBeVisible();
  await page.getByRole('button', { name: '✏ Direct', exact: true }).click();
  const box = await canvas.boundingBox();
  await canvas.click({ position: { x: box!.width * .8, y: box!.height * .45 } });
  await page.getByRole('button', { name: 'Save as new version', exact: true }).click();
  await page.getByRole('button', { name: 'Save as new version', exact: true }).last().click();
  await expect(page.getByRole('button', { name: 'Version v2 — version history' })).toBeVisible();
  await page.getByRole('button', { name: 'Version v2 — version history' }).click();
  await page.getByRole('link', { name: 'v1', exact: true }).click();
  await expect(page).toHaveURL(`/route/${route.publicId}/v/1`);
  await expect(page.getByText('Historical version — read only', { exact: true })).toBeVisible();
  const versions = await (await page.request.get(`${API}/api/routes/${route.publicId}/versions`)).json();
  expect(versions.length).toBe(2);
});

test('BUG-001: restoring a saved drawing must hydrate without React errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/draw');
  await drawPoints(page);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('route-community.route-editor.v1') ?? 'null')?.points?.length)).toBe(2);
  page.on('dialog', dialog => dialog.accept());
  await page.reload();
  await expect(page.getByRole('button', { name: 'Finish & save', exact: true })).toBeEnabled();
  expect(errors, 'Restoring a draft should not cause hydration errors').toEqual([]);
});

test('follow-roads drawing resolves routing and persists a complete route', async ({ page }) => {
  await page.goto('/draw');
  const canvas = page.locator('canvas.maplibregl-canvas');
  await expect(canvas).toBeVisible();
  await expect(page.getByRole('button', { name: /Follow roads/ })).toHaveAttribute('aria-pressed', 'true');
  const box = await canvas.boundingBox();
  await canvas.click({ position: { x: box!.width * .25, y: box!.height * .4 } });
  const routed = page.waitForResponse(r => r.url().endsWith('/api/routing/route') && r.request().method() === 'POST');
  await canvas.click({ position: { x: box!.width * .65, y: box!.height * .48 } });
  expect((await routed).ok()).toBeTruthy();
  await expect(page.getByRole('button', { name: 'Finish & save', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Finish & save', exact: true }).click();
  await page.getByLabel('Route name', { exact: true }).fill('Routed E2E route');
  await page.getByRole('button', { name: 'Save route', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Routed E2E route' })).toBeVisible();
});

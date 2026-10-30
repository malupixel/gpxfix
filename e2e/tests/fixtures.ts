import { test as base, expect, type Page, type APIRequestContext } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

export const API = 'http://127.0.0.1:8251';
export const gpx = fs.readFileSync(path.join(__dirname, '../fixtures/valid.gpx'));
export const test = base.extend<{ diagnostics: void }>({
  diagnostics: [async ({ page }, use, info) => {
    const errors: string[] = [];
    const network: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') network.push(`console: ${m.text()}`); });
    page.on('requestfailed', r => { if (!r.failure()?.errorText.includes('ERR_ABORTED')) network.push(`${r.method()} ${r.url()}: ${r.failure()?.errorText}`); });
    page.on('response', r => { if (r.status() >= 400) network.push(`${r.status()} ${r.url()}`); });
    // A minimal local style keeps real MapLibre/WebGL and application interactions,
    // while removing the test suite's dependency on external tile providers.
    await page.route('**/e2e-map-style.json', r => r.fulfill({ json: { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#e8eee8' } }] } }));
    await use();
    if (!page.isClosed()) {
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'Page should not overflow horizontally').toBe(true);
    }
    await info.attach('browser-diagnostics', { body: JSON.stringify({ errors, network }, null, 2), contentType: 'application/json' });
    expect(errors, 'Uncaught browser errors').toEqual([]);
    // Expected 4xx cases (visitor ownership, invalid GPX, missing route) stay in the report.
    expect(network.filter(s => /^(5\d\d |.*net::ERR_)/.test(s)), 'Server/network failures').toEqual([]);
    expect(network.filter(s => s.startsWith('console:') && !/Failed to load resource: the server responded with a status of (400|403|404|422)/.test(s)), 'Unexpected console errors').toEqual([]);
  }, { auto: true }],
});
export { expect };
export async function seed(request: APIRequestContext, name = 'E2E route') {
  const result = await request.post(`${API}/api/routes`, { multipart: { file: { name: 'valid.gpx', mimeType: 'application/gpx+xml', buffer: gpx }, name } });
  expect(result.status()).toBe(201);
  return await result.json() as { publicId: string; managementToken: string };
}
export async function owner(page: Page, name?: string) {
  const route = await seed(page.request, name);
  await page.goto(`/route/${route.publicId}`);
  await expect(page.getByText('Owner mode', { exact: true })).toBeVisible();
  return route;
}
export async function more(page: Page, action: string) {
  await page.getByRole('button', { name: '••• More', exact: true }).click();
  await page.getByRole('group', { name: 'More', exact: true }).getByRole('button', { name: action, exact: true }).click();
}
export async function closeDialog(page: Page) {
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
}

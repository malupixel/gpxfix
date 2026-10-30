import { test, expect, API, seed, gpx } from './fixtures';

const admin = { Authorization: 'Bearer 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' };

test('API health, admin authorization, search and restore only test data', async ({ request }) => {
  expect((await request.get(`${API}/actuator/health`)).ok()).toBeTruthy();
  const route = await seed(request, `Admin E2E ${Date.now()} ${test.info().project.name}`);
  expect((await request.get(`${API}/api/admin/dashboard`)).status()).toBe(401);
  const system = await request.get(`${API}/api/admin/system`, { headers: admin });
  expect(system.ok()).toBeTruthy();
  expect((await system.json()).databaseConnected).toBe(true);
  const listed = await request.get(`${API}/api/admin/routes?search=${route.publicId}`, { headers: admin });
  expect(listed.ok()).toBeTruthy();
  const found = (await listed.json()).items.find((item: { publicId: string }) => item.publicId === route.publicId);
  expect(found).toBeTruthy();
  const plan = await request.get(`${API}/api/admin/routes/${found.id}/permanent-delete-plan`, { headers: admin });
  expect((await plan.json()).executable).toBe(false);
  for (const deleted of [true, false]) {
    const changed = await request.patch(`${API}/api/admin/routes/${found.id}/status`, { headers: admin, data: { deleted, expectedDeleted: !deleted, confirmationName: found.name } });
    expect(changed.ok()).toBeTruthy();
    expect((await request.get(`${API}/api/routes/${route.publicId}`)).status()).toBe(deleted ? 404 : 200);
  }
});

test('original GPX bytes and public social metadata', async ({ request }) => {
  const route = await seed(request);
  const metadata = await request.get(`${API}/api/routes/${route.publicId}/share`);
  expect(metadata.ok()).toBeTruthy();
  const share = await metadata.json();
  expect(JSON.stringify(share)).not.toContain(route.managementToken);
  const routePage = await request.get(`http://127.0.0.1:8250/route/${route.publicId}`);
  expect(routePage.ok()).toBeTruthy();
  const html = await routePage.text();
  expect(html).toContain('og:image'); expect(html).not.toContain(route.managementToken);
  const image = html.match(/property="og:image" content="([^"]+)"/);
  expect(image).toBeTruthy();
  const original = await request.get(`${API}/api/routes/${route.publicId}/gpx/original`);
  expect(await original.body()).toEqual(gpx);
});

test('BUG-002: social preview must be available through the frontend proxy', async ({ request }) => {
  const route = await seed(request);
  const metadata = await (await request.get(`${API}/api/routes/${route.publicId}/share`)).json();
  const preview = await request.get(`http://127.0.0.1:8250${metadata.imagePath}`);
  test.fail(true, 'BUG-002: Next rewrites capture localhost:8080 at build time; runtime API_INTERNAL_URL has no effect');
  expect(preview.ok()).toBeTruthy();
  expect(preview.headers()['content-type']).toContain('image/png');
  expect((await preview.body()).subarray(1, 4).toString()).toBe('PNG');
});

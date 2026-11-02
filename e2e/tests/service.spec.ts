import { test, expect, API, gpx, seed, owner, more, closeDialog } from './fixtures';

test('home, language persistence, licence and missing pages', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Plan your route. Let others help make it better.', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Draw a route', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'PL', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Wgraj trasę' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Wgraj trasę' })).toBeVisible();
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await page.getByRole('link', { name: /Data licences/ }).click();
  await expect(page.getByRole('heading', { name: 'Elevation data licence' })).toBeVisible();
  await page.goto('/route/does-not-exist');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
});

test('invalid GPX, empty GPX and successful upload with clipboard fallback', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => { throw new Error('Clipboard blocked by test'); } }, configurable: true }));
  await page.goto('/');
  const file = page.getByLabel('GPX file');
  await file.setInputFiles({ name: 'empty.gpx', mimeType: 'application/gpx+xml', buffer: Buffer.alloc(0) });
  await page.getByRole('button', { name: 'Upload route' }).click();
  await expect(page.locator('form [role=alert]')).toContainText('non-empty');
  await file.setInputFiles({ name: 'invalid.gpx', mimeType: 'application/gpx+xml', buffer: Buffer.from('<gpx/>') });
  await page.getByRole('button', { name: 'Upload route' }).click();
  await expect(page.locator('form [role=alert]')).toContainText('valid GPX');
  await file.setInputFiles({ name: 'valid.gpx', mimeType: 'application/gpx+xml', buffer: gpx });
  await page.getByLabel('Route name').fill('Uploaded <script>literal</script>');
  await page.getByRole('button', { name: 'Upload route' }).click();
  const dialog = page.getByRole('dialog');
  const managementLink = await dialog.getByLabel('Management link', { exact: true }).inputValue();
  expect(managementLink).toContain('?manage=');
  await dialog.getByRole('button', { name: 'Copy management link and continue' }).click();
  await expect(dialog.getByRole('button', { name: 'Continue to route', exact: true })).toBeDisabled();
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', { name: 'Continue to route', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Uploaded <script>literal</script>' })).toBeVisible();
  await expect(page.getByText('Owner mode', { exact: true })).toBeVisible();
  await expect(page.locator('canvas.maplibregl-canvas')).toBeVisible();
});

test('owner metadata, settings, share and GPX download', async ({ page }) => {
  const route = await owner(page);
  await more(page, 'Edit route information');
  await page.getByRole('dialog').getByLabel('Route name', { exact: true }).fill('Updated E2E route');
  await page.getByRole('dialog').getByLabel('Description').fill('A multiline description\n<script>literal</script>');
  await page.getByRole('button', { name: 'Save information', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Changes saved' })).toBeVisible();
  await closeDialog(page);
  await expect(page.getByRole('heading', { name: 'Updated E2E route', exact: true })).toBeVisible();
  await more(page, 'Suggestion settings');
  await page.getByRole('checkbox', { name: 'Accept new suggestions' }).uncheck();
  await page.getByRole('button', { name: 'Save settings', exact: true }).click();
  await expect(page.getByText('Suggestions closed', { exact: true }).first()).toBeVisible();
  await closeDialog(page);
  await more(page, 'Suggestion settings');
  await page.getByRole('checkbox', { name: 'Accept new suggestions' }).check();
  await page.getByRole('button', { name: 'Save settings', exact: true }).click();
  await closeDialog(page);
  await page.getByRole('button', { name: 'Share route', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('textbox')).toHaveValue(`http://127.0.0.1:8250/route/${route.publicId}/v/1`);
  await closeDialog(page);
  await page.getByRole('button', { name: /Download GPX/ }).click();
  await page.getByRole('dialog').getByRole('checkbox').uncheck();
  await page.getByRole('dialog').getByRole('textbox').fill('My export');
  const downloading = page.waitForEvent('download');
  await page.getByRole('dialog').getByRole('button', { name: /Download GPX/ }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe('my-export.gpx');
  const stream = await download.createReadStream();
  const chunks: Buffer[] = []; for await (const chunk of stream!) chunks.push(chunk);
  const exported = Buffer.concat(chunks).toString();
  expect(exported).toContain('<trkpt'); expect(exported).not.toContain('<ele>');
});

test('visitor cannot manage; private link restores ownership; deletion removes public route', async ({ page, browser }) => {
  const route = await owner(page, 'Delete only E2E route');
  const visitor = await browser.newContext({ locale: 'en-GB' });
  try {
    await visitor.route('**/e2e-map-style.json', r => r.fulfill({ json: { version: 8, sources: {}, layers: [] } }));
    const p = await visitor.newPage();
    await p.goto(`http://127.0.0.1:8250/route/${route.publicId}`);
    await p.getByRole('button', { name: '••• More', exact: true }).click();
    await expect(p.getByRole('button', { name: 'Delete route', exact: true })).toHaveCount(0);
    expect((await p.request.delete(`${API}/api/routes/${route.publicId}/owner`, { data: { confirmationName: 'Delete only E2E route' } })).status()).toBe(403);
    await p.goto(`http://127.0.0.1:8250/route/${route.publicId}?manage=${route.managementToken}`);
    await expect(p.getByText('Owner mode', { exact: true })).toBeVisible();
    await expect(p).toHaveURL(new RegExp(`/route/${route.publicId}$`));
  } finally { await visitor.close(); }
  await more(page, 'Delete route');
  await expect(page.getByRole('button', { name: 'Confirm route deletion', exact: true })).toBeDisabled();
  await page.getByRole('dialog').getByRole('textbox').fill('Delete only E2E route');
  await page.getByRole('button', { name: 'Confirm route deletion', exact: true }).click();
  await expect(page).toHaveURL('/');
  expect((await page.request.get(`${API}/api/routes/${route.publicId}`)).status()).toBe(404);
});

test('suggestion and comment moderation with independent visitor', async ({ page, playwright }) => {
  const route = await owner(page);
  const visitor = await playwright.request.newContext();
  try {
    const created = await visitor.post(`${API}/api/routes/${route.publicId}/suggestions`, { data: { type: 'NOTE', authorName: 'Visitor', description: 'Water fountain E2E', category: 'water', tags: [], start: { longitude: 21.0122, latitude: 52.2297, distanceMeters: 0 } } });
    expect(created.status()).toBe(201);
    const suggestion = await created.json();
    expect(await (await visitor.get(`${API}/api/routes/${route.publicId}/suggestions`)).json()).toEqual([]);
    await page.reload();
    await page.getByRole('button').filter({ hasText: 'Water fountain E2E' }).click();
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Unpublish', exact: true })).toBeVisible();
    expect((await (await visitor.get(`${API}/api/routes/${route.publicId}/suggestions`)).json()).length).toBe(1);
    const comment = await visitor.post(`${API}/api/routes/${route.publicId}/suggestions/${suggestion.publicId}/comments`, { data: { authorName: 'Commenter', content: 'Test unpublished comment' } });
    expect(comment.status()).toBe(201);
    await page.reload();
    await page.getByRole('button').filter({ hasText: 'Water fountain E2E' }).click();
    const card = page.locator('[id^="comment-"]').filter({ hasText: 'Test unpublished comment' });
    await card.getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(card.getByText('Published', { exact: true })).toBeVisible();
    const publicSuggestion = await (await visitor.get(`${API}/api/routes/${route.publicId}/suggestions/${suggestion.publicId}`)).json();
    expect(publicSuggestion.comments[0].content).toBe('Test unpublished comment');
    await page.getByRole('button', { name: 'Unpublish', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeVisible();
    expect(await (await visitor.get(`${API}/api/routes/${route.publicId}/suggestions`)).json()).toEqual([]);
  } finally { await visitor.dispose(); }
});

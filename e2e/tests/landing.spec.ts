import { test, expect } from './fixtures';
import { DEMO_DURATIONS } from '../../web/src/features/landing/demo-model';

async function demo(page: import('@playwright/test').Page) {
  await page.goto('/');
  const panel = page.locator('.route-demo');
  await panel.scrollIntoViewIfNeeded();
  await expect(panel).toHaveAttribute('data-running', 'true');
  return panel;
}

test('demo manual navigation, pause, acceptance, replay and language switch never mutate the API', async ({ page }) => {
  const writes: string[] = [];
  page.on('request', r => { if (r.url().includes('/api/')) writes.push(r.url()); });
  await page.route('**/api/**', route => route.abort());
  const panel = await demo(page);
  await panel.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(panel).toHaveAttribute('data-running', 'false');
  await panel.getByRole('button', { name: /^Step 4:/ }).click();
  await expect(panel).toHaveAttribute('data-stage', '3');
  await expect(panel.locator('.demo-route-alternative')).toHaveCSS('opacity', '1');
  await panel.getByRole('button', { name: 'Accept the change', exact: true }).click();
  await expect(panel).toHaveAttribute('data-stage', '4');
  await expect(panel.locator('.demo-route-replaced')).toHaveCSS('opacity', '0');
  await expect(panel.locator('.demo-route-alternative')).toHaveCSS('stroke', 'rgb(37, 99, 235)');
  await panel.getByRole('button', { name: 'Previous step', exact: true }).click();
  await panel.getByRole('button', { name: 'Next step', exact: true }).click();
  await panel.getByRole('button', { name: /^Step 1:/ }).click();
  await expect(panel.locator('.demo-route-start')).toHaveCSS('stroke-dashoffset', '0px');
  await panel.getByRole('button', { name: 'Restart', exact: true }).click();
  await expect(panel).toHaveAttribute('data-stage', '0');
  await panel.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: 'PL', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Zobacz, jak to działa' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Zaplanuj trasę/ })).toBeVisible();
  await panel.getByRole('button', { name: /^Krok 4:/ }).click();
  await expect(panel.getByRole('button', { name: 'Zaakceptuj poprawkę', exact: true })).toBeVisible();
  expect(writes).toEqual([]);
});

test('automatic demo finishes in one short cycle; pause freezes advancement; offscreen stops playback', async ({ page }) => {
  await page.clock.install();
  const panel = await demo(page);
  await panel.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.clock.fastForward(18000);
  await expect(panel).toHaveAttribute('data-stage', '0');
  await panel.getByRole('button', { name: 'Play', exact: true }).click();
  for (let step = 0; step < 4; step++) {
    await page.clock.fastForward(DEMO_DURATIONS[step]);
    await expect(panel).toHaveAttribute('data-stage', String(step + 1));
  }
  await page.clock.fastForward(DEMO_DURATIONS[4]);
  await expect(panel).toHaveAttribute('data-running', 'false');
  await expect(panel).toHaveAttribute('data-stage', '4');
  await panel.getByRole('button', { name: 'Restart', exact: true }).click();
  // Move the demo outside the viewport and verify its timer is suspended.
  await page.evaluate(() => { document.querySelector<HTMLElement>('.landing-page')!.style.paddingBottom = '1500px'; window.scrollTo(0, document.body.scrollHeight); });
  await expect(panel).toHaveAttribute('data-running', 'false');
  await page.clock.fastForward(18000);
  await expect(panel).toHaveAttribute('data-stage', '0');
  await page.evaluate(() => { document.querySelector<HTMLElement>('.landing-page')!.style.paddingBottom = ''; });
  await panel.scrollIntoViewIfNeeded();
  await expect(panel).toHaveAttribute('data-running', 'true');
  // Navigate away while a timer is scheduled, then back: no stale step leaks.
  await page.getByRole('link', { name: /Data licences/ }).click();
  await page.goto('/');
  await expect(page.locator('.route-demo')).toHaveAttribute('data-stage', '0');
});

test('reduced motion is manual, static and supports keyboard acceptance', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install();
  await page.goto('/');
  const panel = page.locator('.route-demo');
  await panel.scrollIntoViewIfNeeded();
  await expect(panel).toHaveAttribute('data-reduced', 'true');
  await expect(panel).toHaveAttribute('data-running', 'false');
  await page.clock.fastForward(20000);
  await expect(panel).toHaveAttribute('data-stage', '0');
  await expect(panel.locator('.demo-route-start')).toHaveCSS('stroke-dashoffset', '0px');
  await panel.getByRole('button', { name: /^Step 4:/ }).focus();
  await page.keyboard.press('Enter');
  await panel.getByRole('button', { name: 'Accept the change', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(panel).toHaveAttribute('data-stage', '4');
  await panel.getByRole('button', { name: 'Restart', exact: true }).click();
  await expect(panel).toHaveAttribute('data-stage', '0');
  await expect(panel).toHaveAttribute('data-running', 'false');
});

for (const width of [320, 375, 768, 1440]) {
  test(`home screenshot and layout at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 960 });
    await page.goto('/');
    await page.getByRole('button', { name: 'PL', exact: true }).click();
    const panel = page.locator('.route-demo');
    await panel.getByRole('button', { name: /^Krok 4:/ }).click();
    await expect(panel.getByRole('button', { name: 'Zaakceptuj poprawkę', exact: true })).toBeVisible();
    await expect(panel.locator('.demo-comment')).toHaveCSS('opacity', '1');
    // The annotation must not obscure the finish marker, especially at 320px.
    await panel.locator('circle[cx="705"]').click({ trial: true, timeout: 3000 });
    await expect(page.getByLabel('Plik GPX')).toBeAttached();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const path = info.outputPath(`home-${width}-pl.png`);
    await page.screenshot({ path, fullPage: true });
    await info.attach(`home-${width}-pl`, { path, contentType: 'image/png' });
    await page.getByRole('link', { name: 'Zacznij od swojej trasy' }).click();
    await expect(page.getByRole('heading', { name: 'Zacznij od swojej trasy', exact: true })).toBeInViewport();
  });
}

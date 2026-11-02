import { test, expect, owner } from './fixtures';
import type { JSHandle } from '@playwright/test';
import type { Map as MapLibreMap, GeoJSONSource } from '../../web/node_modules/maplibre-gl';

for (const view of ['route', 'drawing', 'owner editor'] as const) {
  test(`Squadratinhos zoom, pan and grid lifecycle in ${view}`, async ({ page }, info) => {
    if (view === 'drawing') await page.goto('/draw');
    else {
      await owner(page);
      if (view === 'owner editor') await page.getByRole('button', { name: 'Edit route', exact: true }).click();
    }
    const checkbox = page.getByRole('checkbox', { name: 'Show Squadrats grid', exact: true });
    await expect(checkbox).toBeVisible();
    // Inspect the actual MapLibre instance passed to the shared grid component.
    // This stays in test code: no application globals or test-only runtime hooks.
    let map!: JSHandle<MapLibreMap>;
    await expect(async () => {
      map = await checkbox.evaluateHandle(element => {
        type Fiber = { memoizedProps?: { map?: MapLibreMap }; alternate?: Fiber; return?: Fiber };
        const key = Object.keys(element).find(key => key.startsWith('__reactFiber$'))!;
        let fiber = (element as unknown as Record<string, Fiber>)[key];
        while (fiber) {
          const instance = fiber.memoizedProps?.map ?? fiber.alternate?.memoizedProps?.map;
          if (instance && typeof instance.jumpTo === "function") return instance;
          fiber = fiber.return!;
        }
        throw new Error('Grid has no loaded MapLibre instance');
      });
    }).toPass({ timeout: 10_000 });
    await map.evaluate(map => map.jumpTo({ center: [21.02, 52.235], zoom: 9 }));
    await checkbox.check();
    await expect(page.getByText('Zoom in to see the Squadrats grid.', { exact: true })).toBeVisible();

    const counts = () => map.evaluate(async map => {
      const result = { large: 0, fine: 0, renderedFine: 0 };
      for (const [key, id] of [['large', 'squadrats-grid'], ['fine', 'squadratinhos-grid']] as const) {
        const source = map.getSource(id) as GeoJSONSource | undefined;
        const data = await source?.getData();
        result[key] = data?.type === 'FeatureCollection' ? data.features.length : 0;
      }
      if (map.getLayer('squadratinhos-grid-lines')) {
        result.renderedFine = map.queryRenderedFeatures({ layers: ['squadratinhos-grid-lines'] }).length;
      }
      return result;
    });
    await expect.poll(counts).toEqual({ large: 0, fine: 0, renderedFine: 0 });
    await map.evaluate(map => map.jumpTo({ zoom: 13.99 }));
    await expect(page.getByText('Zoom in to also see squadratinhos.', { exact: true })).toBeVisible();
    await expect.poll(async () => (await counts()).large).toBeGreaterThan(0);
    expect((await counts()).fine).toBe(0);

    await map.evaluate(map => map.jumpTo({ zoom: 14 }));
    await expect.poll(async () => (await counts()).renderedFine).toBeGreaterThan(0);
    await expect(page.getByText('Zoom in to also see squadratinhos.', { exact: true })).toHaveCount(0);
    const order = await map.evaluate(map => map.getStyle().layers.map(layer => layer.id));
    expect(order.indexOf('squadratinhos-grid-lines')).toBeLessThan(order.indexOf('squadrats-grid-lines'));
    expect(order.indexOf('squadrats-grid-lines')).toBeLessThan(order.indexOf(view === 'route' ? 'route-line' : 'editor-route-line'));

    const canvas = page.locator('canvas.maplibregl-canvas');
    await canvas.focus();
    if (view === 'route') await canvas.press('-');
    else await page.getByRole('button', { name: 'Zoom out', exact: true }).click();
    await expect.poll(async () => (await counts()).fine).toBe(0);
    expect((await counts()).large).toBeGreaterThan(0);
    if (view === 'route') await canvas.press('=');
    else await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    await expect.poll(async () => (await counts()).renderedFine).toBeGreaterThan(0);

    const beforePan = await map.evaluate(async map => (map.getSource('squadratinhos-grid') as GeoJSONSource).getData());
    const box = (await canvas.boundingBox())!;
    await page.mouse.move(box.x + box.width * .55, box.y + box.height * .55);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * .8, box.y + box.height * .65, { steps: 12 });
    await page.mouse.up();
    await expect.poll(() => map.evaluate(async map => (map.getSource('squadratinhos-grid') as GeoJSONSource).getData())).not.toEqual(beforePan);
    await expect.poll(async () => (await counts()).renderedFine).toBeGreaterThan(0);

    if (view === 'route') {
      await page.getByRole('button', { name: 'Fullscreen map', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Exit fullscreen', exact: true })).toBeVisible();
      await expect.poll(async () => (await counts()).renderedFine).toBeGreaterThan(0);
      await page.getByRole('button', { name: 'Exit fullscreen', exact: true }).click();
    }
    // Recreate the base style without either grid; style.load must restore both.
    await map.evaluate(map => {
      const style = map.getStyle();
      style.layers = style.layers.filter(layer => !['squadrats-grid-lines', 'squadratinhos-grid-lines'].includes(layer.id));
      delete style.sources['squadrats-grid'];
      delete style.sources['squadratinhos-grid'];
      map.setStyle(style, { diff: false });
    });
    await expect.poll(async () => (await counts()).renderedFine).toBeGreaterThan(0);
    await page.screenshot({ path: info.outputPath('squadratinhos.png') });
    await checkbox.uncheck();
    expect(await map.evaluate(map => ['squadrats-grid', 'squadratinhos-grid'].some(id => map.getSource(id)))).toBe(false);
    expect(await map.evaluate(map => ['squadrats-grid-lines', 'squadratinhos-grid-lines'].some(id => map.getLayer(id)))).toBe(false);
    await checkbox.check();
    await expect.poll(async () => (await counts()).renderedFine).toBeGreaterThan(0);
    // Leave the page with the grid enabled; diagnostics also cover navigation.
    await page.goto('/');
  });
}

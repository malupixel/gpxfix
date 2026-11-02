import type { FeatureCollection, LineString } from 'geojson';

// Original illustrative street network, not a navigable route or third-party map.
// Geographic coordinates keep the tiny dataset portable; SVG projects these bounds.
const coordinate = ([x, y]: number[]) => [19.9 + x / 20000, 50.08 - y / 20000];
const line = (id: string, points: number[][]) => ({ type: 'Feature' as const, properties: { id }, geometry: { type: 'LineString' as const, coordinates: points.map(coordinate) } });
export const demoRoutes: FeatureCollection<LineString, { id: string }> = {
  type: 'FeatureCollection', features: [
    line('start', [[85,330],[180,330],[180,260],[295,260]]),
    line('replaced', [[295,260],[295,150],[505,150],[505,225]]),
    line('finish', [[505,225],[625,225],[625,100],[705,100]]),
    line('alternative', [[295,260],[345,320],[460,320],[505,275],[505,225]]),
  ],
};
export function projectCoordinate([longitude, latitude]: number[]) {
  return [Math.round((longitude - 19.9) * 20000), Math.round((50.08 - latitude) * 20000)];
}
export function demoPath(id: string) {
  return demoRoutes.features.find(feature => feature.properties.id === id)!.geometry.coordinates.map((point, i) => `${i ? 'L' : 'M'}${projectCoordinate(point).join(',')}`).join(' ');
}
export const demoStreets = [
  'M-20 100H720', 'M-20 150H730', 'M-20 225H740', 'M-20 260H700', 'M-20 330H740',
  'M85 -10V440', 'M180 -10V440', 'M295 -10V260', 'M505 -10V440', 'M625 -10V440',
  'M85 330L180 420', 'M295 260L345 320H460L505 275', 'M180 100L295 10',
];

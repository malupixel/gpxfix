export type RouteCoordinate = [longitude: number, latitude: number];

export type RouteDistanceMarker = {
  coordinate: RouteCoordinate;
  distanceMeters: number;
};

export type RoutePosition = {
  lng: number;
  lat: number;
  distanceMeters: number;
  segmentIndex: number;
  segmentFraction: number;
  distanceToRouteMeters: number;
};

export type RouteMeasure = {
  coordinates: RouteCoordinate[];
  segmentDistances: number[];
  cumulativeDistances: number[];
  totalDistanceMeters: number;
};

const EARTH_RADIUS_METERS = 6_371_000;
const FINISH_MARKER_CLEARANCE_METERS = 250;

export function calculateDistanceMeters(from: RouteCoordinate, to: RouteCoordinate): number {
  const latitude1 = degreesToRadians(from[1]);
  const latitude2 = degreesToRadians(to[1]);
  const latitudeDelta = degreesToRadians(to[1] - from[1]);
  const longitudeDelta = degreesToRadians(shortestLongitudeDelta(from[0], to[0]));

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(longitudeDelta / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(haversine));
}

export function calculateDistanceMarkers(
  coordinates: RouteCoordinate[],
  intervalMeters: number,
): RouteDistanceMarker[] {
  if (coordinates.length < 2 || intervalMeters <= 0) return [];

  const { segmentDistances, totalDistanceMeters: totalDistance } = createRouteMeasure(coordinates);
  const markers: RouteDistanceMarker[] = [];
  let cumulativeDistance = 0;
  let targetDistance = intervalMeters;

  for (let index = 0; index < segmentDistances.length; index += 1) {
    const segmentDistance = segmentDistances[index];
    const segmentEndDistance = cumulativeDistance + segmentDistance;

    while (
      segmentDistance > 0 &&
      targetDistance <= segmentEndDistance &&
      targetDistance <= totalDistance - FINISH_MARKER_CLEARANCE_METERS
    ) {
      const fraction = (targetDistance - cumulativeDistance) / segmentDistance;
      markers.push({
        coordinate: interpolateCoordinate(coordinates[index], coordinates[index + 1], fraction),
        distanceMeters: targetDistance,
      });
      targetDistance += intervalMeters;
    }

    cumulativeDistance = segmentEndDistance;
  }

  return markers;
}

export function createRouteMeasure(coordinates: RouteCoordinate[]): RouteMeasure {
  const segmentDistances = coordinates.slice(1).map((coordinate, index) => calculateDistanceMeters(coordinates[index], coordinate));
  const cumulativeDistances = [0];
  for (const distance of segmentDistances) cumulativeDistances.push(cumulativeDistances.at(-1)! + distance);
  return { coordinates, segmentDistances, cumulativeDistances, totalDistanceMeters: cumulativeDistances.at(-1) ?? 0 };
}

export function findNearestPositionOnRoute(click: RouteCoordinate, measure: RouteMeasure): RoutePosition | null {
  if (measure.coordinates.length < 2) return null;
  let nearest: RoutePosition | null = null;
  for (let segmentIndex = 0; segmentIndex < measure.coordinates.length - 1; segmentIndex += 1) {
    const projected = projectOntoSegment(click, measure.coordinates[segmentIndex], measure.coordinates[segmentIndex + 1]);
    const distanceToRouteMeters = calculateDistanceMeters(click, projected.coordinate);
    if (!nearest || distanceToRouteMeters < nearest.distanceToRouteMeters) {
      nearest = {
        lng: projected.coordinate[0], lat: projected.coordinate[1], distanceToRouteMeters,
        segmentIndex, segmentFraction: projected.fraction,
        distanceMeters: measure.cumulativeDistances[segmentIndex] + measure.segmentDistances[segmentIndex] * projected.fraction,
      };
    }
  }
  return nearest;
}

export function normalizeRoutePositions(a: RoutePosition, b: RoutePosition): [RoutePosition, RoutePosition] {
  return a.distanceMeters <= b.distanceMeters ? [a, b] : [b, a];
}

export function extractRouteSection(measure: RouteMeasure, a: RoutePosition, b: RoutePosition): { type: "LineString"; coordinates: RouteCoordinate[] } {
  const [start, end] = normalizeRoutePositions(a, b);
  const coordinates: RouteCoordinate[] = [[start.lng, start.lat]];
  for (let index = start.segmentIndex + 1; index <= end.segmentIndex; index += 1) coordinates.push(measure.coordinates[index]);
  const endCoordinate: RouteCoordinate = [end.lng, end.lat];
  const last = coordinates.at(-1)!;
  if (last[0] !== endCoordinate[0] || last[1] !== endCoordinate[1]) coordinates.push(endCoordinate);
  if (coordinates.length === 1) coordinates.push(endCoordinate);
  return { type: "LineString", coordinates };
}

export function calculatePolylineDistance(coordinates: RouteCoordinate[]): number {
  return coordinates.slice(1).reduce((total, coordinate, index) => total + calculateDistanceMeters(coordinates[index], coordinate), 0);
}

export function areRouteEndpointsClose(
  coordinates: RouteCoordinate[],
  thresholdMeters = 40,
): boolean {
  if (coordinates.length < 2) return false;
  return calculateDistanceMeters(coordinates[0], coordinates.at(-1)!) <= thresholdMeters;
}

export function interpolateCoordinate(
  from: RouteCoordinate,
  to: RouteCoordinate,
  fraction: number,
): RouteCoordinate {
  const longitude = from[0] + shortestLongitudeDelta(from[0], to[0]) * fraction;
  const latitude = from[1] + (to[1] - from[1]) * fraction;
  return [normalizeLongitude(longitude), latitude];
}

function projectOntoSegment(point: RouteCoordinate, from: RouteCoordinate, to: RouteCoordinate): { coordinate: RouteCoordinate; fraction: number } {
  const referenceLatitude = degreesToRadians((point[1] + from[1] + to[1]) / 3);
  const toLocalMeters = (coordinate: RouteCoordinate): [number, number] => [
    EARTH_RADIUS_METERS * degreesToRadians(shortestLongitudeDelta(point[0], coordinate[0])) * Math.cos(referenceLatitude),
    EARTH_RADIUS_METERS * degreesToRadians(coordinate[1] - point[1]),
  ];
  const a = toLocalMeters(from);
  const b = toLocalMeters(to);
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const squaredLength = dx * dx + dy * dy;
  const fraction = squaredLength === 0 ? 0 : Math.max(0, Math.min(1, -(a[0] * dx + a[1] * dy) / squaredLength));
  return { coordinate: interpolateCoordinate(from, to, fraction), fraction };
}

function shortestLongitudeDelta(from: number, to: number): number {
  let delta = to - from;
  while (delta > 180) delta -= 360;
  while (delta < -180) delta += 360;
  return delta;
}

function normalizeLongitude(longitude: number): number {
  return ((longitude + 540) % 360) - 180;
}

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

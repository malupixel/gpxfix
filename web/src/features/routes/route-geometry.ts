export type RouteCoordinate = [longitude: number, latitude: number];

export type RouteDistanceMarker = {
  coordinate: RouteCoordinate;
  distanceMeters: number;
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

  const segmentDistances = coordinates.slice(1).map((coordinate, index) =>
    calculateDistanceMeters(coordinates[index], coordinate),
  );
  const totalDistance = segmentDistances.reduce((total, distance) => total + distance, 0);
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

export function areRouteEndpointsClose(
  coordinates: RouteCoordinate[],
  thresholdMeters = 40,
): boolean {
  if (coordinates.length < 2) return false;
  return calculateDistanceMeters(coordinates[0], coordinates.at(-1)!) <= thresholdMeters;
}

function interpolateCoordinate(
  from: RouteCoordinate,
  to: RouteCoordinate,
  fraction: number,
): RouteCoordinate {
  const longitude = from[0] + shortestLongitudeDelta(from[0], to[0]) * fraction;
  const latitude = from[1] + (to[1] - from[1]) * fraction;
  return [normalizeLongitude(longitude), latitude];
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

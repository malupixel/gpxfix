import type { MultiLineString } from "geojson";
import { MAX_FILE_BYTES, MAX_POINTS } from "./model";

// The existing parser is server-side Java/StAX. This local reader implements its
// track/segment semantics without uploading files or calculating route metrics.
export function parseGhostGpx(text: string, parser: Pick<DOMParser, "parseFromString"> = new DOMParser()): MultiLineString {
  if (new TextEncoder().encode(text).length > MAX_FILE_BYTES) throw new Error("ghost.fileTooLarge");
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error("ghost.invalidGpx");
  const doc = parser.parseFromString(text, "application/xml");
  const root = doc.documentElement;
  if (doc.getElementsByTagName("parsererror").length || root.localName !== "gpx" || !["1.0", "1.1"].includes(root.getAttribute("version") ?? "")) throw new Error("ghost.invalidGpx");
  const children = (node: Element, name: string) => Array.from(node.children).filter(child => child.localName === name && child.namespaceURI === root.namespaceURI);
  let count = 0;
  const coordinates: number[][][] = [];
  for (const track of children(root, "trk")) for (const segment of children(track, "trkseg")) {
    const points = children(segment, "trkpt").map(point => {
      if (++count > MAX_POINTS) throw new Error("ghost.tooComplex");
      const lat = point.getAttribute("lat"), lon = point.getAttribute("lon");
      const latitude = Number(lat), longitude = Number(lon);
      if (!lat?.trim() || !lon?.trim() || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) throw new Error("ghost.invalidGpx");
      return [longitude, latitude];
    });
    // Single points cannot form a line; never join separate segments or tracks.
    if (points.length >= 2) coordinates.push(points);
  }
  if (!coordinates.length) throw new Error("ghost.noPoints");
  return { type: "MultiLineString", coordinates };
}
export async function readGhostFile(file: Pick<File, "size" | "text">) {
  if (file.size > MAX_FILE_BYTES) throw new Error("ghost.fileTooLarge");
  return parseGhostGpx(await file.text());
}

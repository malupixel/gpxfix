#!/usr/bin/env python3
"""Offline analysis of captured routing responses. Python stdlib; no app imports/network."""
import argparse
import collections
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def analyze(path):
    data = json.loads(path.read_text())
    result = {"file": path.name, "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}
    if "features" in data:
        feature = data["features"][0]
        props = feature["properties"]
        result.update(engine=props["creator"], distance_m=float(props["track-length"]))
        rows = props["messages"]
        header = rows[0]
        surface, highway, flags = collections.Counter(), collections.Counter(), []
        for row in rows[1:]:
            tags = dict(item.split("=", 1) for item in row[header.index("WayTags")].split() if "=" in item)
            distance = float(row[header.index("Distance")])
            surface[tags.get("surface", "UNKNOWN")] += distance
            highway[tags.get("highway", "UNKNOWN")] += distance
            if (tags.get("highway") in {"motorway", "motorway_link", "trunk", "trunk_link", "steps"}
                    or tags.get("motorroad") == "yes"
                    or tags.get("bicycle") in {"no", "private", "dismount"}
                    or tags.get("access") in {"no", "private"}):
                flags.append({"distance_m": distance, "tags": tags,
                              "location": [float(row[header.index("Longitude")]) / 1e6,
                                           float(row[header.index("Latitude")]) / 1e6]})
        result.update(surface_m=dict(surface), highway_m=dict(highway), review_flags=flags,
                      messages_distance_m=sum(surface.values()))
        # Sanity check of diagnostic accounting, not a legal/surface certification.
        if abs(sum(surface.values()) - result["distance_m"]) > 2:
            raise ValueError(f"Diagnostic distances do not reconcile: {path}")
        geometry = feature["geometry"]
    else:
        if data.get("code") != "Ok" or not data.get("routes"):
            raise ValueError(f"Invalid OSRM response: {path}")
        route = data["routes"][0]
        result.update(engine="OSRM public demo; version unknown", distance_m=route["distance"])
        result["motorway_named_steps"] = [
            {"name": step["name"], "ref": step.get("ref"), "distance_m": step["distance"]}
            for leg in route["legs"] for step in leg["steps"]
            if "Autostrada" in step.get("name", "")]
        geometry = route["geometry"]
    # GeoJSON output is explicitly 2D, like the app's geometry contract.
    geometry = {"type": "LineString", "coordinates": [point[:2] for point in geometry["coordinates"]]}
    return result, {"type": "Feature", "properties": {"file": path.stem, "distance_m": result["distance_m"]}, "geometry": geometry}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--results", type=Path, default=ROOT / "results")
    parser.add_argument("--output", type=Path, default=ROOT)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    rows, features = [], []
    for path in sorted(args.results.glob("*.json")):
        if path.name == "manifest.json":
            continue
        row, feature = analyze(path)
        rows.append(row)
        features.append(feature)
    by_file = {f["properties"]["file"]: f for f in features}
    control = (by_file["warszawa-lodz-osrm-cycling"]["geometry"] ==
               by_file["warszawa-lodz-osrm-driving"]["geometry"])
    summary = {"osrm_cycling_driving_identical_geometry": control, "results": rows,
               "limitations": ["Single public-service samples; latency is not a benchmark.",
                               "BRouter messages expose profile-used tags, not complete raw OSM tags.",
                               "UNKNOWN is missing diagnostic surface, never assumed asphalt.",
                               "Review flags are candidates, not determinations of legality."]}
    (args.output / "summary.json").write_text(json.dumps(summary, indent=2, ensure_ascii=False) + "\n")
    (args.output / "comparison.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": features}, ensure_ascii=False) + "\n")
    template = (ROOT / "viewer-template.html").read_text()
    (args.output / "comparison.html").write_text(template.replace("/*DATA*/null", json.dumps({"features": features, "rows": rows}, ensure_ascii=False).replace("</", "<\\/")))
    print("OSRM cycling == driving geometry:", control)
    for row in rows:
        surfaces = row.get("surface_m", {})
        print(row["file"], f'{row["distance_m"] / 1000:.3f} km',
              f'unknown={surfaces.get("UNKNOWN", 0):.0f} m' if surfaces else 'surface=n/a',
              f'flags={len(row["review_flags"])}' if 'review_flags' in row else 'flags=n/a')


if __name__ == "__main__":
    main()

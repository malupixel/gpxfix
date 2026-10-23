#!/usr/bin/env python3
"""Read-only public API experiment; no app imports, credentials or database access.

Run explicitly: python3 docs/routing-poc/compare.py --run
Public demos: sequential requests, >=1s pause, no retries. Never production backends.
"""
import argparse
import datetime
import hashlib
import json
import pathlib
import time
import urllib.error
import urllib.parse
import urllib.request

CASES = {
    "warszawa-lodz": [[21.0122, 52.2297], [19.4560, 51.7592]],
    "warszawa-gora-kalwaria": [[21.0122, 52.2297], [21.2156, 51.9760]],
    "bodzentyn-swiety-krzyz": [[20.9576, 50.9415], [21.0525, 50.8586]],
    "kabin-lasy": [[21.0585, 52.1102], [21.0910, 52.1000]],
}


def summarize(data, engine):
    if engine == "osrm":
        route = data["routes"][0]
        coords = route["geometry"]["coordinates"]
        return {"distance_m": route["distance"], "vertices": len(coords),
                "geometry_sha256": hashlib.sha256(json.dumps(coords).encode()).hexdigest()}
    feature = data["features"][0]
    props = feature["properties"]
    messages = props.get("messages", [])
    totals = {"known_paved_m": 0, "known_other_surface_m": 0, "unknown_surface_m": 0,
              "track_path_m": 0, "cycleway_m": 0, "primary_secondary_m": 0,
              "motorway_trunk_m": 0, "bicycle_no_or_dismount_m": 0,
              "restricted_access_m": 0}
    if messages:
        header = messages[0]
        for values in messages[1:]:
            row = dict(zip(header, values))
            distance = float(row.get("Distance", 0))
            tags = dict(item.split("=", 1) for item in row.get("WayTags", "").split() if "=" in item)
            surface, highway = tags.get("surface"), tags.get("highway")
            key = ("unknown_surface_m" if not surface or surface == "unknown" else "known_paved_m" if surface in
                   {"asphalt", "paved", "concrete", "concrete:lanes", "concrete:plates", "paving_stones", "sett"}
                   else "known_other_surface_m")
            totals[key] += distance
            for key, condition in {
                "track_path_m": highway in {"track", "path", "footway", "bridleway"},
                "cycleway_m": highway == "cycleway",
                "primary_secondary_m": highway in {"primary", "primary_link", "secondary", "secondary_link"},
                "motorway_trunk_m": highway in {"motorway", "motorway_link", "trunk", "trunk_link"},
                "bicycle_no_or_dismount_m": tags.get("bicycle") in {"no", "private", "dismount"},
                "restricted_access_m": tags.get("access") in {"no", "private"},
            }.items():
                if condition:
                    totals[key] += distance
    return {"distance_m": float(props["track-length"]), "creator": props.get("creator"),
            "vertices": len(feature["geometry"]["coordinates"]),
            "message_distance_m": sum(totals[k] for k in
                                      ["known_paved_m", "known_other_surface_m", "unknown_surface_m"]),
            **totals}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run", action="store_true", help="Explicitly permit public API reads")
    parser.add_argument("--output", type=pathlib.Path, default=pathlib.Path(__file__).parent / "results")
    args = parser.parse_args()
    if not args.run:
        parser.print_help()
        return
    # Unique run directory prevents accidentally treating old responses as new measurements.
    folder = args.output / datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    folder.mkdir(parents=True, exist_ok=False)
    results = []
    for name, points in CASES.items():
        jobs = [("brouter", p) for p in ("fastbike", "trekking")]
        if name == "warszawa-lodz":
            jobs += [("osrm", p) for p in ("cycling", "driving")]
        for engine, profile in jobs:
            if engine == "brouter":
                params = {"lonlats": "|".join(",".join(map(str, p)) for p in points),
                          "profile": profile, "alternativeidx": 0, "format": "geojson"}
                url = "https://brouter.de/brouter?" + urllib.parse.urlencode(params)
            else:
                coords = ";".join(",".join(map(str, p)) for p in points)
                url = f"https://router.project-osrm.org/route/v1/{profile}/{coords}?overview=full&geometries=geojson&steps=true"
            entry = {"case": name, "engine": engine, "profile": profile, "points": points,
                     "requested_at": datetime.datetime.now(datetime.timezone.utc).isoformat(), "url": url}
            start = time.monotonic()
            try:
                request = urllib.request.Request(url, headers={"User-Agent": "TweakMyRoute-routing-research/1.0"})
                with urllib.request.urlopen(request, timeout=45) as response:
                    raw = response.read()
                    entry["http_status"] = response.status
                path = folder / f"{name}-{engine}-{profile}.json"
                path.write_bytes(raw)
                entry["raw_file"] = path.name
                entry["raw_sha256"] = hashlib.sha256(raw).hexdigest()
                entry.update(summarize(json.loads(raw), engine))
                entry["status"] = "ok"
            except Exception as error:
                entry.update(status="error", error=str(error))
            entry["elapsed_s"] = round(time.monotonic() - start, 3)
            results.append(entry)
            (folder / "summary.json").write_text(json.dumps(results, indent=2) + "\n")
            print(json.dumps(entry), flush=True)
            time.sleep(1.1)


if __name__ == "__main__":
    main()

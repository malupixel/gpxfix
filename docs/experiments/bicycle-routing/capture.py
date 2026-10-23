#!/usr/bin/env python3
"""Explicit network experiment; writes a NEW directory, never contacts TweakMyRoute."""
import argparse
import datetime
import hashlib
import json
from pathlib import Path
import subprocess
import time
from urllib.parse import urlencode

CASES = [
    ("warszawa-lodz", [21.0122, 52.2297], [19.455, 51.7592]),
    ("warszawa-gora-kalwaria", [21.0122, 52.2297], [21.2155, 51.9761]),
    ("bodzentyn-swiety-krzyz", [20.957, 50.9413], [21.0528, 50.8587]),
    ("kabaty-powsin", [21.052, 52.104], [21.087, 52.116]),
]


def requests():
    for name, start, end in CASES:
        coords = ",".join(map(str, start)) + "|" + ",".join(map(str, end))
        for profile in ["fastbike-lowtraffic", "gravel"]:
            query = urlencode(dict(lonlats=coords, profile=profile, alternativeidx=0, format="geojson"))
            yield name + "-" + profile, "https://brouter.de/brouter?" + query
        profiles = ["cycling", "driving"] if name == "warszawa-lodz" else ["cycling"]
        for profile in profiles:
            yield name + "-osrm-" + profile, ("https://router.project-osrm.org/route/v1/" + profile + "/" +
                 coords.replace("|", ";") + "?overview=full&geometries=geojson&steps=true")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True, help="New output directory (must not exist)")
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=False)
    records = []
    try:
        for name, url in requests():
            path = args.output / (name + ".json")
            started = datetime.datetime.now(datetime.timezone.utc).isoformat()
            # No retries: keep demo-service traffic small and make failures visible.
            result = subprocess.run(["curl", "-sS", "--max-time", "45", "-A",
                                     "TweakMyRoute-routing-research/1.0", url,
                                     "-o", str(path), "-w", "%{http_code} %{time_total}"],
                                    capture_output=True, text=True, timeout=50)
            records.append(dict(file=path.name, url=url, started_utc=started,
                                curl_exit=result.returncode, http_and_seconds=result.stdout.strip(),
                                error=result.stderr.strip(),
                                sha256=hashlib.sha256(path.read_bytes()).hexdigest() if path.exists() else None))
            print(name, result.stdout.strip(), "exit", result.returncode, flush=True)
            if result.returncode or not result.stdout.startswith("200 "):
                raise RuntimeError("Capture failed; see manifest.json. No automatic retry.")
            time.sleep(1.1)
    finally:
        (args.output / "manifest.json").write_text(json.dumps(records, indent=2) + "\n")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Prepare explicitly selected Copernicus GLO-30 tiles; never runs during build/deploy."""
import argparse
import os
from pathlib import Path
import tempfile
import urllib.error
import urllib.request

BASE = "https://copernicus-dem-30m.s3.amazonaws.com"
LICENSE = "https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/DEM/resources/license/License-COPDEM-30.pdf"


def label(lat, lon):
    return f"{'N' if lat >= 0 else 'S'}{abs(lat):02d}{'E' if lon >= 0 else 'W'}{abs(lon):03d}"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bounds", nargs=4, type=int, required=True, metavar=("WEST", "SOUTH", "EAST", "NORTH"),
                        help="integer tile bounds, east/north exclusive; Warsaw: 20 52 22 53; Poland envelope: 14 49 25 55")
    parser.add_argument("--output", type=Path, required=True, help="external dataset directory (not the repository)")
    parser.add_argument("--accept-license", action="store_true", help=f"confirm you have read and accepted {LICENSE}")
    parser.add_argument("--dry-run", action="store_true", help="list size/tiles without GDAL, download or writing files")
    parser.add_argument("--skip-uncovered", action="store_true", help="report and skip requested tiles absent from the official dataset (e.g. sea-only tiles)")
    args = parser.parse_args()
    west, south, east, north = args.bounds
    if not (-180 <= west < east <= 179 and -89 <= south < north <= 90):
        parser.error("invalid bounds; include room for the south/east neighbouring tiles")
    target = args.output.expanduser().resolve()
    repository = Path(__file__).resolve().parents[1]
    if target == repository or repository in target.parents:
        parser.error("DEM output must be outside the repository")
    count = (east - west) * (north - south)
    print(f"Preparing {count} HGT tiles (~{count * 3601 * 3601 * 2 / 1024**3:.2f} GiB), plus source GeoTIFFs and south/east halo.")
    prepared_count = 0
    skipped = []
    for lat in range(south, north):
        for lon in range(west, east):
            print(target / (label(lat, lon) + ".hgt"))
    if args.dry_run:
        return
    if not args.accept_license:
        parser.error(f"Read {LICENSE}, then explicitly pass --accept-license. No data has been downloaded.")
    try:
        from osgeo import gdal
    except ImportError:
        parser.error("Install python3-gdal (Ubuntu/Debian), then run using /usr/bin/python3")
    gdal.UseExceptions()
    target.mkdir(parents=True, exist_ok=True)
    sources = target / "source-cog"
    sources.mkdir(exist_ok=True)
    downloaded = {}
    # COG omits the shared south/east nodes. Neighbouring tiles restore them;
    # GDAL also handles GLO-30's latitude-dependent horizontal resolution.
    for lat in range(south - 1, north):
        for lon in range(west, east + 1):
            stem = f"Copernicus_DSM_COG_10_{'N' if lat >= 0 else 'S'}{abs(lat):02d}_00_{'E' if lon >= 0 else 'W'}{abs(lon):03d}_00_DEM"
            path = sources / (stem + ".tif")
            if not path.exists():
                url = f"{BASE}/{stem}/{stem}.tif"
                temporary = None
                try:
                    print(f"Downloading {url}")
                    with urllib.request.urlopen(url, timeout=120) as response, tempfile.NamedTemporaryFile(dir=sources, suffix=".part", delete=False) as output:
                        temporary = Path(output.name)
                        while chunk := response.read(1024 * 1024):
                            output.write(chunk)
                    os.replace(temporary, path)
                except urllib.error.HTTPError as error:
                    if error.code != 404:
                        raise
                    print(f"No official source tile {label(lat, lon)}; not substituting another dataset or zero heights.")
                finally:
                    if temporary is not None and temporary.exists():
                        temporary.unlink()
            if path.exists():
                downloaded[(lat, lon)] = str(path)
    for lat in range(south, north):
        for lon in range(west, east):
            filename = target / (label(lat, lon) + ".hgt")
            if filename.exists():
                prepared_count += 1
                print(f"Keeping existing {filename}; remove it explicitly to regenerate.")
                continue
            if (lat, lon) not in downloaded:
                if args.skip_uncovered:
                    skipped.append(filename.name)
                    print(f"UNAVAILABLE: {filename.name}; no official source, no replacement heights generated.")
                    continue
                raise RuntimeError(f"Missing official source for {filename.name}; requested area has no coverage")
            paths = [downloaded[key] for key in [(lat, lon), (lat, lon + 1), (lat - 1, lon), (lat - 1, lon + 1)] if key in downloaded]
            half = 0.5 / 3600
            with tempfile.TemporaryDirectory(prefix="dem-convert-", dir=target) as work:
                raster = gdal.Warp(str(Path(work) / "aligned.tif"), paths, format="GTiff", dstSRS="EPSG:4326",
                                   outputBounds=(lon - half, lat - half, lon + 1 + half, lat + 1 + half),
                                   width=3601, height=3601, resampleAlg="bilinear", outputType=gdal.GDT_Int16,
                                   dstNodata=-32768, multithread=False)
                prepared = Path(work) / filename.name
                hgt = gdal.Translate(str(prepared), raster, format="SRTMHGT")
                hgt = None
                raster = None
                if prepared.stat().st_size != 3601 * 3601 * 2:
                    raise RuntimeError(f"Unexpected raster size: {prepared}")
                os.replace(prepared, filename)
            print(f"Prepared {filename}")
            prepared_count += 1
    print(f"Coverage: {prepared_count}/{count} requested tiles installed; unavailable: {', '.join(skipped) or 'none'}.")
    print(f"Done. Keep source/license provenance; source-cog is not needed by the backend. License: {LICENSE}")


if __name__ == "__main__":
    main()

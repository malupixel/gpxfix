# Local elevation (Copernicus GLO-30)

## Dataset decision

Use **Copernicus DEM GLO-30 Public**, approximately 30 m resolution, distributed as WGS84
one-degree Cloud Optimized GeoTIFF tiles. The public AWS collection uses the 2021 release;
do not describe it as a live/current terrain survey. GLO-30 is available free under its
specific licence; the higher resolution EEA-10 product has different access restrictions.

Sources:

- [Official Copernicus collection and access conditions](https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM)
- [Public distribution, tile naming, pixel alignment and varying horizontal spacing](https://copernicus-dem-30m.s3.amazonaws.com/readme.html)
- [Licence: read and accept before downloading/using](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/DEM/resources/license/License-COPDEM-30.pdf)
- [GDAL HGT format](https://gdal.org/en/stable/drivers/raster/srtmhgt.html)

This is a **surface model (DSM)**, not bare-earth DTM: vegetation/buildings can affect
cycling profiles. Integer-metre HGT conversion introduces at most ~0.5 m quantization;
bilinear interpolation gives fractional heights. No smoothing/gain correction is added.
For future DTM/dataset changes, implement another `ElevationProvider` without changing routes/UI.

The application reads HGT directly in Java; no GDAL/native dependency is installed in the JAR.
GDAL is only an offline preparation tool. `N52E021.hgt` represents 52–53° N, 21–22° E,
3601×3601 signed big-endian 16-bit samples, north-to-south rows, `-32768` = NoData.
The reader also accepts standard 1201×1201 HGT. Do not rename arbitrary rasters to `.hgt`.
The original COG uses latitude-dependent column spacing and omits shared south/east nodes:
the preparation script warps the original tile plus neighbouring tiles onto correctly
aligned one-arc-second node centres, avoiding a half-pixel shift at tile edges.
Missing source tiles remain unavailable; they are not replaced by a random dataset or sea-level values.

## Install a small test area

No account is required for this public distribution. **You must personally read and accept
the linked licence**. The script refuses to download without `--accept-license`.
It never runs during Maven, Docker build or deployment and refuses output inside this repository.

Install the offline tool on the machine preparing data (Ubuntu/Debian):

```bash
sudo apt-get install python3-gdal
/usr/bin/python3 scripts/prepare-dem.py --bounds 20 52 22 53 --output /home/malupixel/data/elevation --dry-run
# Only after reading/accepting the licence:
/usr/bin/python3 scripts/prepare-dem.py --bounds 20 52 22 53 --output /home/malupixel/data/elevation --accept-license
```

This prepares both Warsaw tiles (`N52E020.hgt` and `N52E021.hgt`), plus downloads the
south/east source halo needed for edge interpolation. Western Warsaw (including
Połczyńska/Bemowo) lies west of 21° E and needs `N52E020.hgt`; the eastern tile alone
does not cover the whole city.
The exact primary file is:
`https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N52_00_E021_00_DEM/Copernicus_DSM_COG_10_N52_00_E021_00_DEM.tif`.
If downloading manually, place that and the corresponding `N51/E021`, `N52/E022`, `N51/E022`
source TIFFs in `/home/malupixel/data/elevation/source-cog/` with their original names,
then run the same script; existing source files are reused. Backend files belong directly
in `/home/malupixel/data/elevation/N52E021.hgt`, not `source-cog/`.

For the Poland bounding envelope, explicitly select `--bounds 14 49 25 55 --skip-uncovered`
(66 output tiles, ~1.6 GiB HGT plus source downloads/workspace). This envelope also covers
some neighbouring countries. Any sea-only tiles absent from the official dataset are
reported and skipped with this explicit flag, never filled with zero heights; without
the flag a missing primary source stops conversion. Do not download global data.
Bounds are integers; west/south inclusive, east/north exclusive. Existing HGT files are
never overwritten; replacing a dataset is an explicit operator action followed by API restart.

## Configuration and VPS

Spring follows the existing `app.*` configuration convention:

```properties
app.elevation.provider=local-dem
app.elevation.data-path=/home/malupixel/data/elevation
app.elevation.sample-interval-meters=100
app.elevation.cache-megabytes=128
```

Environment equivalents: `ELEVATION_PROVIDER`, `ELEVATION_DATA_PATH`,
`ELEVATION_SAMPLE_INTERVAL_METERS`, `ELEVATION_CACHE_MEGABYTES`.
Default provider is `local-dem`. Unknown providers, missing/unreadable directories,
invalid intervals, or cache below one full-resolution tile fail startup visibly.
An existing but empty directory starts, but enrichment fails with HTTP 503 and logs the
missing tile path. No automatic external fallback. Missing/NoData/corrupt tiles likewise
fail with 503; creation/merge is not committed. Imported GPX with complete elevation does
not query a provider. Configuration is still validated at startup.

For the existing production `tweakmyroute-api.service`, put these variables in its
existing EnvironmentFile (check `systemctl cat tweakmyroute-api.service`) or a systemd drop-in:

```ini
[Service]
Environment=ELEVATION_PROVIDER=local-dem
Environment=ELEVATION_DATA_PATH=/home/malupixel/data/elevation
Environment=ELEVATION_SAMPLE_INTERVAL_METERS=100
Environment=ELEVATION_CACHE_MEGABYTES=128
```

Install tiles **once**, independently of code deployment; ensure the service user can
traverse the directory and read files (typically directory 0755, files 0644). Review
licence notices below before exposing results publicly. Then daemon-reload/restart the
service and check journal/health plus a drawn route entirely within installed coverage.
Do not deploy the new default before installing data or explicitly configuring remote.
DEM is outside the application's deployment directory, excluded from Docker/JAR/Git;
`deploy.sh` does not copy it. Back up/version the dataset separately.

### Upload or extend server coverage

Run the separate script from the repository root after preparing local tiles:

```bash
./sync-elevation.sh --dry-run
./sync-elevation.sh
# When replacing existing tiles, clear the API's tile cache:
./sync-elevation.sh --restart
```

Defaults match production: SSH host `malupixel`, local and remote directory
`/home/malupixel/data/elevation`. The local default can also come from the exported
`ELEVATION_DATA_PATH` variable; the script does not load `.env`. Override with
`--source DIR`, `--remote HOST`, or `--target DIR` as needed. The remote target must
match the API's configured `ELEVATION_DATA_PATH`.

Only top-level `*.hgt` files and `License-COPDEM-30.pdf` are uploaded. The local
directory must contain both prepared tiles and the licence PDF; `source-cog`, TIFFs
and temporary conversion files stay local. The script creates the remote directory
and sets directory/file permissions to 0755/0644. Local and remote machines need
`rsync`, with SSH access as for `deploy.sh`.

Checksums skip unchanged contents. Interrupted transfers can be resumed by rerunning
the command; each completed file replaces its destination atomically. Remote files
are never deleted, so a source directory containing only a new country's tiles can
extend existing coverage. New tiles are read without a restart; replacing cached
tiles requires `--restart` (uses the same sudo/systemd command as deployment).
The script does not configure systemd or run as part of `deploy.sh`.
`--dry-run` only previews rsync changes and does not create the target directory or
restart the API; if the remote parent directory does not exist yet, create it before
previewing the first transfer.

Docker Compose mounts this host directory read-only at `/data/elevation`; it refuses to
auto-create a missing host directory. In `.env`, `ELEVATION_DATA_PATH` is the host path.
Even when using remote in Compose, create/mount an empty external directory explicitly.

For dev/testing without tiles select `ELEVATION_PROVIDER=remote` and optionally
`ELEVATION_BASE_URL=https://api.open-meteo.com`. Remote uses batches of 100, two parallel
requests and retries; **there is no longer a 500-sample limit**, so long routes can hit
remote quotas. Remote is explicit, never automatically selected on local failure.

## Pipeline, persistence and performance

`RouteVersionPipeline → RouteElevationEnricher → ElevationProvider` is shared by drawn
routes, incomplete GPX uploads, and merges. Complete imported GPX remains byte-for-byte
unchanged. Missing heights are sampled at intervals no greater than 100 m (endpoints
included); 137 km ≈ 1371 samples, 300 km ≈ 3001. There is no route-length-dependent cap.
Original points remain, and missing heights at them are interpolated from the samples;
existing imported heights are preserved.

**PostGIS geometry/editor document is unchanged**. Profile/export representation has
additional points along the same line, stored with `<ele>` in the **specific route
version's GPX**, referenced by that version's storage key. Version metrics derive from
that profile; creation distance remains the original route distance. Each merge receives
its own profile; earlier versions keep their files/geometry. Existing versions lacking
heights are enriched on the existing details/download endpoint, as before. Already-complete
profiles are not automatically recalculated when the dataset/provider changes.

The details endpoint continues returning `elevationProfile` with distance/height/lat/lon;
normal/fullscreen charts and hover-map synchronization consume it unchanged. Save/merge
wait for enrichment before successful response, using existing pending states; an error
keeps the save form's values. No public elevation endpoint or UI-side lookup is introduced.

Local requests are grouped by tile and output ordering is preserved. Cache is byte-bounded
LRU (default 128 MiB, about five full-resolution tiles), holds decoded arrays rather than
file handles, and serializes loads/reads so parallel requests cannot retain evicted rasters.
Each tile is read once per cache residency, not per point; thousands of samples are normal.
Changing source tiles requires an API restart to invalidate cached content.

Verification: `cd api && mvn test` (Java 21, Docker for PostGIS integration tests).
Offline preparation tests: `/usr/bin/python3 -m unittest discover -s scripts -v`;
the synthetic raster conversion test requires GDAL and otherwise reports a skip.
No real DEM data is fetched by tests. A GDAL-equipped disposable container can run all
four preparation tests with its network disabled:

```bash
docker run --rm --network none --user 1000:1000 \
  -v "$PWD/scripts:/work/scripts:ro" -w /work \
  ghcr.io/osgeo/gdal:ubuntu-small-3.13.3 python3 -m unittest discover -s scripts -v
```

Future gradient/climb/gain analyses can reuse distance-tagged version profiles and the
provider boundary. No new analysis features or microservice are introduced.

## Attribution / distribution requirements

Preserve source/version/licence information with your dataset installation. Adapted
public results carry the provider's attribution in generated GPX metadata. Public display
must also expose the notice and legal disclaimer (the site includes a data licence notice):

> produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved.

> The organisations in charge of the Copernicus programme by law or by delegation do not incur any liability for any use of the Copernicus WorldDEM-30.

Do not imply Copernicus/ESA endorsement. Consult the full licence for redistribution obligations.

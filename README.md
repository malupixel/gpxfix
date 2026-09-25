# Route Community

Production-oriented foundation for a registration-free community GPX route sharing and review application. The first vertical slice supports GPX upload, secure parsing, PostGIS persistence, public route pages, and interactive maps; review workflows remain future work.

## Architecture

- `api/`: Java 21, Spring Boot 3.5, Maven, JPA, Flyway, PostgreSQL/PostGIS, springdoc, and Actuator.
- `web/`: Next.js App Router, React, TypeScript, Tailwind CSS, TanStack Query, React Hook Form, Zod, and MapLibre GL JS.
- `docker-compose.yml`: one PostgreSQL/PostGIS database, API, and web application with health-aware startup.

The applications remain independently buildable. Database structure is owned exclusively by Flyway; Hibernate runs with `ddl-auto: validate`.

## Directory structure

```text
.
├── api/
│   ├── src/main/java/pl/routecommunity/api/
│   ├── src/main/resources/db/migration/
│   ├── src/test/
│   ├── Dockerfile
│   └── pom.xml
├── web/
│   ├── public/
│   ├── src/{app,components,features,lib,types}/
│   ├── Dockerfile
│   └── package.json
├── .env.example
├── docker-compose.yml
└── Makefile
```

## Requirements

For the recommended workflow: Docker Engine with Docker Compose v2. For running outside Docker: Java 21, Maven 3.6.3+, Node.js 24+, npm, and PostgreSQL 17 with PostGIS.

## Initial setup and startup

```bash
cp .env.example .env
docker compose up --build
```

Or start in the background with `make up`. The first build downloads Maven and npm dependencies and can take several minutes.

Stop services with `docker compose down` (or `make down`). Database data remains in the named `postgres_data` volume. Use `docker compose down -v` only when you deliberately want to delete local database data. Rebuild with `docker compose build` or `make build`.

## Local endpoints

- Frontend: http://localhost:8150
- API health: http://localhost:8151/api/health
- Swagger UI: http://localhost:8151/swagger-ui.html
- OpenAPI JSON: http://localhost:8151/v3/api-docs
- Actuator health: http://localhost:8151/actuator/health
- PostgreSQL: `localhost:8152`

Values can be changed in the root `.env`. `NEXT_PUBLIC_API_URL` is compiled into the browser bundle, so rebuild the web image after changing it.

## Development and tests

Run all checks with `make test`, or individually:

```bash
cd api && mvn test
cd api && mvn clean package
cd web && npm install
cd web && npm run lint
cd web && npm run typecheck
cd web && npm run build
```

The API integration test uses a disposable `postgis/postgis` Testcontainer and automatically skips only when Docker is unavailable. For rapid host-based development, run `mvn spring-boot:run -Dspring-boot.run.profiles=local` and `npm run dev` in separate terminals after starting the database with `docker compose up -d db`. Next.js then provides Fast Refresh; Spring Boot can simply be restarted after backend changes. The Compose configuration favors reproducible production-like images over fragile bind-mounted dependency directories.

Flyway migrations live in `api/src/main/resources/db/migration`. Add changes as new versioned files; never edit a migration already applied to a shared database.

Connect to PostgreSQL with:

```bash
docker compose exec db psql -U routecommunity -d routecommunity
```

or run `make db` (which honors exported `POSTGRES_USER` and `POSTGRES_DB` values).

## Troubleshooting

```bash
docker compose ps
docker compose logs -f
docker compose logs -f api
docker compose logs -f web
docker compose config
docker compose build --no-cache
```

If port 8150, 8151, or 8152 is already occupied, change the matching host port in `.env`. If a migration failed only in disposable local data, inspect API logs first, then recreate the database with `docker compose down -v && docker compose up --build`. Ensure Docker is running when the integration test is expected to execute.

## GPX route upload

The first end-to-end feature accepts a GPX 1.0/1.1 track, calculates distance and available elevation gain, stores an SRID 4326 PostGIS `LineString`, preserves the source GPX outside PostgreSQL, and creates a public route page.

### API

- `POST /api/routes` — multipart upload with required `file` and optional `name` and `description`; returns `{ "publicId": "..." }`.
- `GET /api/routes/{publicId}` — public route details and GeoJSON-compatible longitude/latitude coordinates.

Example:

```bash
curl -X POST http://localhost:8151/api/routes \
  -F 'file=@route.gpx;type=application/gpx+xml' \
  -F 'name=Weekend ride' \
  -F 'description=A route worth checking locally'
+```

Open the result at `http://localhost:8150/route/{publicId}`.

Uploaded source files are stored under `GPX_STORAGE_PATH` (`/data/gpx` in Docker) using generated internal names. Compose mounts the persistent `gpx_data` volume. Upload limits are controlled by `GPX_MAX_FILE_SIZE`, `GPX_MAX_REQUEST_SIZE`, and `GPX_MAX_FILE_SIZE_BYTES`.

The map style is provider-independent and configurable with `NEXT_PUBLIC_MAP_STYLE_URL`. Development defaults to OpenFreeMap's public Liberty style, which requires no API key; use your own compatible style URL for deployment if desired. Server-side frontend requests use `API_INTERNAL_URL`.

### Current GPX limitations

Only `trk/trkseg/trkpt` track data is read; routes and waypoints are ignored. Multiple segments are concatenated for the initial public `LineString`, but distance and elevation gain are calculated within each segment so gaps do not inflate metrics. Geometry is stored in 2D; elevation remains a separate metric. Elevation gain is returned as `null` when no consecutive points contain elevations, and there is no automatic elevation lookup. Uploaded GPX files are not currently downloadable through the API.

CREATE TABLE routes (
    id BIGSERIAL PRIMARY KEY,
    public_id VARCHAR(12) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    original_filename VARCHAR(255) NOT NULL,
    storage_key VARCHAR(255) NOT NULL UNIQUE,
    distance_meters DOUBLE PRECISION NOT NULL CHECK (distance_meters >= 0),
    elevation_gain_meters DOUBLE PRECISION CHECK (elevation_gain_meters >= 0),
    track_geometry geometry(LineString, 4326) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX routes_track_geometry_gix ON routes USING GIST (track_geometry);

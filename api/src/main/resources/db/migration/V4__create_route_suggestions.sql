CREATE TABLE route_suggestions (
    id BIGSERIAL PRIMARY KEY,
    public_id VARCHAR(12) NOT NULL UNIQUE,
    route_id BIGINT NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    type VARCHAR(16) NOT NULL CHECK (type IN ('NOTE', 'PROBLEM', 'DETOUR')),
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED')),
    author_name VARCHAR(80) NOT NULL,
    description VARCHAR(2000) NOT NULL,
    category VARCHAR(40),
    tags VARCHAR(300),
    start_point geometry(Point, 4326) NOT NULL,
    end_point geometry(Point, 4326),
    proposed_geometry geometry(LineString, 4326),
    start_distance_meters DOUBLE PRECISION NOT NULL CHECK (start_distance_meters >= 0),
    end_distance_meters DOUBLE PRECISION CHECK (end_distance_meters >= start_distance_meters),
    base_route_updated_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT route_suggestions_shape_check CHECK (
        (type = 'NOTE' AND end_point IS NULL AND end_distance_meters IS NULL AND proposed_geometry IS NULL)
        OR (type = 'PROBLEM' AND end_point IS NOT NULL AND end_distance_meters IS NOT NULL AND proposed_geometry IS NULL)
        OR (type = 'DETOUR' AND end_point IS NOT NULL AND end_distance_meters IS NOT NULL AND proposed_geometry IS NOT NULL)
    )
);

CREATE INDEX route_suggestions_route_id_idx ON route_suggestions(route_id);
CREATE INDEX route_suggestions_status_idx ON route_suggestions(status);
CREATE INDEX route_suggestions_type_idx ON route_suggestions(type);
CREATE INDEX route_suggestions_created_at_idx ON route_suggestions(created_at DESC);
CREATE INDEX route_suggestions_start_point_gix ON route_suggestions USING GIST(start_point);
CREATE INDEX route_suggestions_end_point_gix ON route_suggestions USING GIST(end_point);
CREATE INDEX route_suggestions_proposed_geometry_gix ON route_suggestions USING GIST(proposed_geometry);

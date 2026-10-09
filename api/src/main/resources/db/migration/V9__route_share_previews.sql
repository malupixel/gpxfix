-- Durable preview jobs: a new version or route name is picked up after its transaction commits.
CREATE TABLE route_share_previews (
    version_id BIGINT NOT NULL REFERENCES route_versions(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    revision VARCHAR(64) NOT NULL UNIQUE,
    ready BOOLEAN NOT NULL DEFAULT FALSE,
    attempts INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (version_id, name)
);
CREATE INDEX route_share_previews_pending_idx ON route_share_previews(next_attempt_at) WHERE NOT ready;

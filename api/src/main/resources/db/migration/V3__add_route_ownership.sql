ALTER TABLE routes ADD COLUMN owner_token_hash BYTEA;

CREATE TABLE route_owner_sessions (
    id BIGSERIAL PRIMARY KEY,
    route_id BIGINT NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    token_hash BYTEA NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX route_owner_sessions_route_id_idx ON route_owner_sessions(route_id);
CREATE INDEX route_owner_sessions_expires_at_idx ON route_owner_sessions(expires_at);

-- Existing routes remain public and usable. Their NULL hash deliberately means
-- that no management link exists: a secret cannot safely be reconstructed.

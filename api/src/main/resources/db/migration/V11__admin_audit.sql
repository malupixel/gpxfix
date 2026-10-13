-- No FK: the audit must survive a future, separately reviewed permanent deletion.
CREATE TABLE admin_audit (
    id BIGSERIAL PRIMARY KEY,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    operation VARCHAR(40) NOT NULL,
    resource_id BIGINT NOT NULL,
    result VARCHAR(24) NOT NULL CHECK (result IN ('SUCCESS','REJECTED','FAILED'))
);
CREATE INDEX admin_audit_occurred_at_idx ON admin_audit(occurred_at DESC);
CREATE INDEX routes_admin_created_idx ON routes(created_at DESC, id DESC);
CREATE INDEX routes_admin_updated_idx ON routes(updated_at DESC, id DESC);
CREATE INDEX routes_admin_deleted_idx ON routes(deleted_at, id);

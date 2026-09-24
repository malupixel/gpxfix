ALTER TABLE route_suggestions DROP CONSTRAINT route_suggestions_status_check;
ALTER TABLE route_suggestions RENAME COLUMN status TO moderation_status;
UPDATE route_suggestions SET moderation_status = 'PUBLISHED' WHERE moderation_status = 'ACCEPTED';
ALTER TABLE route_suggestions ADD CONSTRAINT route_suggestions_moderation_status_check CHECK (moderation_status IN ('PENDING','PUBLISHED','REJECTED'));
ALTER TABLE route_suggestions ADD COLUMN integration_status VARCHAR(24) NOT NULL DEFAULT 'NOT_APPLICABLE';
ALTER TABLE route_suggestions ADD COLUMN applicability VARCHAR(24) NOT NULL DEFAULT 'NOT_APPLICABLE';
UPDATE route_suggestions SET integration_status='NOT_MERGED', applicability='CLEAN' WHERE type='DETOUR';
ALTER TABLE route_suggestions ADD CONSTRAINT route_suggestions_integration_status_check CHECK (integration_status IN ('NOT_APPLICABLE','NOT_MERGED','MERGED'));
ALTER TABLE route_suggestions ADD CONSTRAINT route_suggestions_applicability_check CHECK (applicability IN ('NOT_APPLICABLE','CLEAN','CONFLICT','OUTDATED'));
DROP INDEX route_suggestions_status_idx;
CREATE INDEX route_suggestions_moderation_status_idx ON route_suggestions(route_id, moderation_status, created_at);

CREATE TABLE suggestion_comments (
 id BIGSERIAL PRIMARY KEY,
 public_id VARCHAR(12) NOT NULL UNIQUE,
 suggestion_id BIGINT NOT NULL REFERENCES route_suggestions(id) ON DELETE CASCADE,
 author_name VARCHAR(80) NOT NULL,
 content VARCHAR(2000) NOT NULL,
 moderation_status VARCHAR(16) NOT NULL DEFAULT 'PENDING' CHECK (moderation_status IN ('PENDING','PUBLISHED','REJECTED')),
 created_at TIMESTAMPTZ NOT NULL,
 updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX suggestion_comments_suggestion_id_idx ON suggestion_comments(suggestion_id);
CREATE INDEX suggestion_comments_moderation_status_idx ON suggestion_comments(moderation_status);
CREATE INDEX suggestion_comments_created_at_idx ON suggestion_comments(created_at);

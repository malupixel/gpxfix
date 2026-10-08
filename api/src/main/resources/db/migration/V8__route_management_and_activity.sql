-- Route metadata is shared; historical version snapshots remain intact.
ALTER TABLE routes ADD COLUMN name VARCHAR(200), ADD COLUMN description TEXT,
    ADD COLUMN updated_at TIMESTAMPTZ, ADD COLUMN suggestions_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN deleted_at TIMESTAMPTZ, ADD COLUMN original_upload_storage_key VARCHAR(255),
    ADD COLUMN original_upload_filename VARCHAR(255);
UPDATE routes r SET name=v.name, description=v.description, updated_at=v.created_at
FROM route_versions v WHERE v.id=r.current_version_id;
ALTER TABLE routes ALTER COLUMN name SET NOT NULL, ALTER COLUMN updated_at SET NOT NULL;
-- Existing descriptions are retained, even if an old client allowed more than the new input limit.
CREATE INDEX routes_active_public_id_idx ON routes(public_id) WHERE deleted_at IS NULL;

CREATE TABLE route_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id BIGINT NOT NULL REFERENCES routes(id),
    event_type VARCHAR(40) NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    version_id BIGINT REFERENCES route_versions(id),
    suggestion_id BIGINT REFERENCES route_suggestions(id),
    comment_id BIGINT REFERENCES suggestion_comments(id),
    actor_kind VARCHAR(16) NOT NULL,
    actor_name VARCHAR(80),
    owner_only BOOLEAN NOT NULL DEFAULT FALSE,
    event_key VARCHAR(200) NOT NULL,
    request_key VARCHAR(160),
    request_hash VARCHAR(64),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    UNIQUE(route_id,event_key), UNIQUE(route_id,request_key)
);
CREATE INDEX route_activity_page_idx ON route_activity(route_id,occurred_at DESC,id DESC);
CREATE INDEX route_activity_suggestion_idx ON route_activity(suggestion_id);
CREATE INDEX route_activity_comment_idx ON route_activity(comment_id);

-- Only timestamps and operations actually recorded by the existing model are backfilled.
INSERT INTO route_activity(route_id,event_type,occurred_at,version_id,suggestion_id,actor_kind,event_key)
SELECT route_id,CASE source WHEN 'INITIAL_UPLOAD' THEN 'ROUTE_CREATED' WHEN 'INITIAL_DRAWN' THEN 'ROUTE_CREATED'
 WHEN 'OWNER_EDIT' THEN 'OWNER_EDITED' WHEN 'SUGGESTION_MERGE' THEN 'SUGGESTION_MERGED' ELSE 'VERSION_CREATED' END,
 created_at,id,merged_suggestion_id,'OWNER','version:'||id FROM route_versions
ON CONFLICT DO NOTHING;
INSERT INTO route_activity(route_id,event_type,occurred_at,version_id,suggestion_id,actor_kind,actor_name,event_key)
SELECT route_id,'SUGGESTION_CREATED',created_at,base_version_id,id,'CONTRIBUTOR',author_name,'suggestion:'||id FROM route_suggestions
ON CONFLICT DO NOTHING;
INSERT INTO route_activity(route_id,event_type,occurred_at,version_id,suggestion_id,comment_id,actor_kind,actor_name,event_key)
SELECT s.route_id,'COMMENT_CREATED',c.created_at,s.base_version_id,s.id,c.id,'CONTRIBUTOR',c.author_name,'comment:'||c.id
FROM suggestion_comments c JOIN route_suggestions s ON s.id=c.suggestion_id ON CONFLICT DO NOTHING;

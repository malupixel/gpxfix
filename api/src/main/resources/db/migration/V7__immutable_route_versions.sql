CREATE TABLE route_versions (
    id BIGSERIAL PRIMARY KEY,
    route_id BIGINT NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL CHECK (version_number > 0),
    created_at TIMESTAMPTZ NOT NULL,
    source VARCHAR(32) NOT NULL CHECK (source IN ('INITIAL_UPLOAD','INITIAL_DRAWN','SUGGESTION_MERGE','OWNER_EDIT')),
    based_on_version_id BIGINT REFERENCES route_versions(id),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    original_filename VARCHAR(255) NOT NULL,
    storage_key VARCHAR(255) NOT NULL UNIQUE,
    distance_meters DOUBLE PRECISION NOT NULL CHECK (distance_meters >= 0),
    elevation_gain_meters DOUBLE PRECISION CHECK (elevation_gain_meters >= 0),
    track_geometry geometry(LineString, 4326) NOT NULL,
    source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('GPX','DRAWN')),
    editor_definition JSONB,
    CONSTRAINT route_versions_route_number_uk UNIQUE(route_id, version_number),
    CONSTRAINT route_versions_based_on_not_self CHECK (based_on_version_id IS NULL OR based_on_version_id <> id)
);

INSERT INTO route_versions(route_id,version_number,created_at,source,name,description,original_filename,storage_key,distance_meters,elevation_gain_meters,track_geometry,source_type,editor_definition)
SELECT id,1,created_at,CASE WHEN source_type='DRAWN' THEN 'INITIAL_DRAWN' ELSE 'INITIAL_UPLOAD' END,name,description,original_filename,storage_key,distance_meters,elevation_gain_meters,track_geometry,source_type,editor_definition
FROM routes;

ALTER TABLE routes ADD COLUMN current_version_id BIGINT REFERENCES route_versions(id);
UPDATE routes r SET current_version_id=(SELECT rv.id FROM route_versions rv WHERE rv.route_id=r.id AND rv.version_number=1);
CREATE UNIQUE INDEX routes_current_version_id_uk ON routes(current_version_id);

ALTER TABLE route_suggestions ADD COLUMN base_version_id BIGINT REFERENCES route_versions(id);
UPDATE route_suggestions s SET base_version_id=(SELECT r.current_version_id FROM routes r WHERE r.id=s.route_id);
ALTER TABLE route_suggestions ALTER COLUMN base_version_id SET NOT NULL;
ALTER TABLE route_suggestions ADD COLUMN merged_into_version_id BIGINT REFERENCES route_versions(id);
ALTER TABLE route_suggestions ADD COLUMN merged_at TIMESTAMPTZ;
ALTER TABLE route_suggestions ADD CONSTRAINT route_suggestions_merge_state_check CHECK (
    (integration_status='MERGED' AND merged_into_version_id IS NOT NULL AND merged_at IS NOT NULL)
    OR (integration_status<>'MERGED' AND merged_into_version_id IS NULL AND merged_at IS NULL)
);
CREATE INDEX route_suggestions_base_version_idx ON route_suggestions(base_version_id);
CREATE UNIQUE INDEX route_suggestions_merged_version_uk ON route_suggestions(merged_into_version_id) WHERE merged_into_version_id IS NOT NULL;

ALTER TABLE route_versions ADD COLUMN merged_suggestion_id BIGINT REFERENCES route_suggestions(id);
CREATE UNIQUE INDEX route_versions_merged_suggestion_uk ON route_versions(merged_suggestion_id) WHERE merged_suggestion_id IS NOT NULL;
ALTER TABLE route_versions ADD CONSTRAINT route_versions_source_relation_check CHECK (
    (source='SUGGESTION_MERGE' AND merged_suggestion_id IS NOT NULL AND based_on_version_id IS NOT NULL)
    OR (source<>'SUGGESTION_MERGE' AND merged_suggestion_id IS NULL)
);

ALTER TABLE route_suggestions DROP COLUMN base_route_updated_at;
DROP INDEX routes_track_geometry_gix;
ALTER TABLE routes DROP COLUMN name, DROP COLUMN description, DROP COLUMN original_filename, DROP COLUMN storage_key,
    DROP COLUMN distance_meters, DROP COLUMN elevation_gain_meters, DROP COLUMN track_geometry,
    DROP COLUMN updated_at, DROP COLUMN source_type, DROP COLUMN editor_definition;

CREATE INDEX route_versions_route_id_idx ON route_versions(route_id, version_number DESC);
CREATE INDEX route_versions_track_geometry_gix ON route_versions USING GIST(track_geometry);

-- Cross-table ownership invariants cannot be expressed by ordinary CHECK constraints.
CREATE FUNCTION verify_route_version_ownership() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM routes r JOIN route_versions v ON v.id=r.current_version_id AND v.route_id=r.id WHERE r.id=NEW.id) THEN
        RAISE EXCEPTION 'current version must belong to its route';
    END IF;
    RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER routes_current_version_owner
AFTER INSERT OR UPDATE OF current_version_id ON routes DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION verify_route_version_ownership();

CREATE FUNCTION verify_suggestion_version_ownership() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM route_versions WHERE id=NEW.base_version_id AND route_id=NEW.route_id)
       OR (NEW.merged_into_version_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM route_versions WHERE id=NEW.merged_into_version_id AND route_id=NEW.route_id)) THEN
        RAISE EXCEPTION 'suggestion versions must belong to its route';
    END IF;
    RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER route_suggestions_version_owner
AFTER INSERT OR UPDATE OF route_id,base_version_id,merged_into_version_id ON route_suggestions DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION verify_suggestion_version_ownership();

CREATE FUNCTION verify_route_version_relations() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF (NEW.based_on_version_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM route_versions WHERE id=NEW.based_on_version_id AND route_id=NEW.route_id))
       OR (NEW.merged_suggestion_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM route_suggestions WHERE id=NEW.merged_suggestion_id AND route_id=NEW.route_id)) THEN
        RAISE EXCEPTION 'version relations must belong to its route';
    END IF;
    RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER route_versions_relation_owner
AFTER INSERT OR UPDATE OF route_id,based_on_version_id,merged_suggestion_id ON route_versions DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION verify_route_version_relations();

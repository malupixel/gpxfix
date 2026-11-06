CREATE TABLE route_branches (
    id BIGSERIAL PRIMARY KEY,
    route_id BIGINT NOT NULL REFERENCES routes(id),
    public_id VARCHAR(36) NOT NULL,
    name VARCHAR(80) NOT NULL,
    description VARCHAR(2000),
    fork_version_id BIGINT REFERENCES route_versions(id),
    current_version_id BIGINT REFERENCES route_versions(id),
    created_at TIMESTAMPTZ NOT NULL,
    UNIQUE(route_id, public_id),
    CHECK ((public_id = 'main' AND fork_version_id IS NULL) OR (public_id <> 'main' AND fork_version_id IS NOT NULL))
);
INSERT INTO route_branches(route_id,public_id,name,current_version_id,created_at)
SELECT id,'main','Main',current_version_id,created_at FROM routes ORDER BY id;
ALTER TABLE route_versions ADD COLUMN branch_id BIGINT REFERENCES route_branches(id);
UPDATE route_versions v SET branch_id=b.id FROM route_branches b WHERE b.route_id=v.route_id;
ALTER TABLE route_versions ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE route_versions ADD COLUMN label VARCHAR(80);
ALTER TABLE route_suggestions ADD COLUMN branch_id BIGINT REFERENCES route_branches(id);
UPDATE route_suggestions s SET branch_id=b.id FROM route_branches b WHERE b.route_id=s.route_id;
ALTER TABLE route_suggestions ALTER COLUMN branch_id SET NOT NULL;
-- Provenance is a snapshot, deliberately without cascading foreign keys.
ALTER TABLE routes ADD COLUMN source_route_public_id VARCHAR(12);
ALTER TABLE routes ADD COLUMN source_version_number INTEGER;
ALTER TABLE routes ADD COLUMN source_version_id BIGINT;
ALTER TABLE routes ADD COLUMN source_route_name VARCHAR(200);
CREATE INDEX route_versions_branch_idx ON route_versions(branch_id,version_number DESC);
CREATE INDEX route_versions_parent_idx ON route_versions(based_on_version_id);
CREATE INDEX route_suggestions_branch_idx ON route_suggestions(branch_id,moderation_status,created_at);
CREATE INDEX route_branches_head_idx ON route_branches(current_version_id);

CREATE FUNCTION verify_branch_relations() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE b route_branches;
BEGIN
    SELECT * INTO b FROM route_branches WHERE id=NEW.id;
    IF NOT EXISTS (SELECT 1 FROM route_versions v WHERE v.id=b.current_version_id AND v.route_id=b.route_id
        AND (v.branch_id=b.id OR v.id=b.fork_version_id))
       OR (b.fork_version_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM route_versions WHERE id=b.fork_version_id AND route_id=b.route_id)) THEN
        RAISE EXCEPTION 'branch head and fork must belong to its route and history';
    END IF;
    IF b.public_id='main' AND NOT EXISTS (SELECT 1 FROM routes WHERE id=b.route_id AND current_version_id=b.current_version_id) THEN
        RAISE EXCEPTION 'main compatibility head mismatch';
    END IF;
    RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER route_branches_relations AFTER INSERT OR UPDATE ON route_branches
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION verify_branch_relations();

CREATE FUNCTION verify_version_branch() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM route_branches WHERE id=NEW.branch_id AND route_id=NEW.route_id) THEN
        RAISE EXCEPTION 'version branch must belong to its route';
    END IF;
    IF NEW.based_on_version_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM route_versions p JOIN route_branches b ON b.id=NEW.branch_id
        WHERE p.id=NEW.based_on_version_id AND p.route_id=NEW.route_id AND p.version_number<NEW.version_number
        AND (p.branch_id=NEW.branch_id OR p.id=b.fork_version_id)) THEN
        RAISE EXCEPTION 'version parent must precede child in branch history';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER route_versions_branch BEFORE INSERT ON route_versions FOR EACH ROW EXECUTE FUNCTION verify_version_branch();
CREATE FUNCTION immutable_route_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF (to_jsonb(NEW)-'label') IS DISTINCT FROM (to_jsonb(OLD)-'label') THEN
        RAISE EXCEPTION 'route version geometry and ancestry are immutable';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER route_versions_immutable BEFORE UPDATE ON route_versions FOR EACH ROW EXECUTE FUNCTION immutable_route_version();
CREATE FUNCTION verify_suggestion_branch() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM route_branches WHERE id=NEW.branch_id AND route_id=NEW.route_id) THEN
        RAISE EXCEPTION 'suggestion branch must belong to its route';
    END IF;
    IF NEW.merged_into_version_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM route_versions WHERE id=NEW.merged_into_version_id AND branch_id=NEW.branch_id) THEN
        RAISE EXCEPTION 'suggestion cannot merge into another branch';
    END IF;
    IF TG_OP='UPDATE' AND (NEW.branch_id<>OLD.branch_id OR NEW.base_version_id<>OLD.base_version_id) THEN
        RAISE EXCEPTION 'suggestion branch and base are immutable';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER route_suggestions_branch BEFORE INSERT OR UPDATE ON route_suggestions FOR EACH ROW EXECUTE FUNCTION verify_suggestion_branch();
ALTER TABLE route_versions DROP CONSTRAINT route_versions_source_check;
ALTER TABLE route_versions ADD CONSTRAINT route_versions_source_check CHECK (source IN ('INITIAL_UPLOAD','INITIAL_DRAWN','INITIAL_COPY','SUGGESTION_MERGE','OWNER_EDIT'));
CREATE FUNCTION immutable_branch_origin() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.route_id<>OLD.route_id OR NEW.public_id<>OLD.public_id OR NEW.fork_version_id IS DISTINCT FROM OLD.fork_version_id THEN
        RAISE EXCEPTION 'branch identity and fork are immutable';
    END IF;
    IF OLD.current_version_id IS NOT NULL AND NEW.current_version_id IS DISTINCT FROM OLD.current_version_id
       AND NOT EXISTS (SELECT 1 FROM route_versions WHERE id=NEW.current_version_id AND based_on_version_id=OLD.current_version_id AND branch_id=NEW.id) THEN
        RAISE EXCEPTION 'branch head must advance from its previous head';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER route_branches_immutable_origin BEFORE UPDATE ON route_branches FOR EACH ROW EXECUTE FUNCTION immutable_branch_origin();
CREATE FUNCTION verify_main_compatibility() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM routes r JOIN route_branches b ON b.route_id=r.id AND b.public_id='main' AND b.current_version_id=r.current_version_id WHERE r.id=NEW.id) THEN
        RAISE EXCEPTION 'main branch is required and must match compatibility head';
    END IF;
    RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER routes_main_compatibility AFTER INSERT OR UPDATE OF current_version_id ON routes
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION verify_main_compatibility();

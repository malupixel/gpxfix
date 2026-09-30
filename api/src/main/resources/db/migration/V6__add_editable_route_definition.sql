ALTER TABLE routes ADD COLUMN source_type VARCHAR(20) NOT NULL DEFAULT 'GPX';
ALTER TABLE routes ADD COLUMN editor_definition JSONB;
ALTER TABLE routes ADD CONSTRAINT routes_source_type_check CHECK (source_type IN ('GPX','DRAWN'));

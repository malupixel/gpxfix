-- A conscious loop declaration belongs to an immutable geometry version.
ALTER TABLE route_versions ADD COLUMN loop_declared boolean NOT NULL DEFAULT false;

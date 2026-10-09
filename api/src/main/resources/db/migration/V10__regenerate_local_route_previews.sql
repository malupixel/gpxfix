-- Preview jobs are derived data. Invalidate every previous style, including failed jobs.
-- The worker will backfill active routes with preview-local-v2 filenames and public URLs.
-- Keep route/version rows and old files intact; old image URLs fail the new revision check.
DELETE FROM route_share_previews;

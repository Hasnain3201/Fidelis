-- ============================================
-- Remove created_by column from events table
-- ============================================

-- Step 1: Drop RLS policies that depend on created_by

DROP POLICY IF EXISTS events_insert_creator ON events;
DROP POLICY IF EXISTS events_update_creator ON events;
DROP POLICY IF EXISTS events_delete_creator ON events;

DROP POLICY IF EXISTS event_artists_modify_event_creator ON event_artists;


-- Step 2: Drop the column

ALTER TABLE events
DROP COLUMN IF EXISTS created_by;


-- Step 3: Ensure required defaults exist

ALTER TABLE events
ALTER COLUMN created_at SET DEFAULT now(),
ALTER COLUMN updated_at SET DEFAULT now(),
ALTER COLUMN is_promoted SET DEFAULT false;


-- Step 4: Ensure venue_id is required
ALTER TABLE events
ALTER COLUMN venue_id SET NOT NULL;

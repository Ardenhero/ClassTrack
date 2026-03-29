-- Enable Realtime for evidence_documents table
-- This allows the frontend to receive postgres_changes events

BEGIN;
  -- Set replica identity to FULL so that all changes (including updates/deletes) are broadcasted with full data
  ALTER TABLE public.evidence_documents REPLICA IDENTITY FULL;

  -- Add the table to the supabase_realtime publication if it's not already there
  DO $$
  BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
      BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE evidence_documents;
      EXCEPTION
        WHEN duplicate_object THEN
          NULL;
      END;
    ELSE
      CREATE PUBLICATION supabase_realtime FOR TABLE evidence_documents;
    END IF;
  END $$;
COMMIT;

-- Dynamically find and update the foreign key from evidence_date_links to attendance_logs to use ON DELETE CASCADE
DO $$
DECLARE
    fk_name text;
    col_name text;
BEGIN
    SELECT
        c.conname,
        a.attname
    INTO
        fk_name,
        col_name
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
    WHERE c.conrelid = 'public.evidence_date_links'::regclass
      AND c.confrelid = 'public.attendance_logs'::regclass
      AND c.contype = 'f'
    LIMIT 1;

    IF fk_name IS NOT NULL AND col_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.evidence_date_links DROP CONSTRAINT %I', fk_name);
        EXECUTE format('ALTER TABLE public.evidence_date_links ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.attendance_logs(id) ON DELETE CASCADE', fk_name, col_name);
    END IF;
END $$;

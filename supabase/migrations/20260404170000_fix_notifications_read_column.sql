DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='is_read') THEN
        ALTER TABLE notifications ADD COLUMN is_read BOOLEAN DEFAULT false;
    END IF;
    
    -- Legacy column check (if used as 'read' elsewhere)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='read') THEN
        ALTER TABLE notifications ADD COLUMN "read" BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Ensure an index exists for performance when filtering unread notifications
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications("read") WHERE "read" = false;

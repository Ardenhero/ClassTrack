-- Add columns for room activator fingerprint enrollment
ALTER TABLE instructors ADD COLUMN IF NOT EXISTS activator_fingerprint_slot INTEGER;
ALTER TABLE instructors ADD COLUMN IF NOT EXISTS activator_device_serial TEXT;

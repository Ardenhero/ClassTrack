-- Add pending_command column to kiosk_devices
-- Used for one-shot commands from website to ESP32 (enrollment, ping, reboot, etc.)
ALTER TABLE kiosk_devices ADD COLUMN IF NOT EXISTS pending_command TEXT;

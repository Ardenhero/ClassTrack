ALTER TABLE kiosk_devices
ADD COLUMN IF NOT EXISTS admin_pin VARCHAR(10) DEFAULT '1234';

-- Ensure the Super Admin and Admins can update this field
COMMENT ON COLUMN kiosk_devices.admin_pin IS 'PIN code required to access the device control screen on the physical kiosk';

-- Cleanup Migration: 20260317999999_cleanup_iot_local.sql
-- Description: Removes columns and tables added for the Local Tuya integration.

-- 1. Remove Local Tuya metadata columns from iot_devices
ALTER TABLE public.iot_devices 
DROP COLUMN IF EXISTS gateway_ip,
DROP COLUMN IF EXISTS gateway_key,
DROP COLUMN IF EXISTS gateway_id,
DROP COLUMN IF EXISTS sub_device_id,
DROP COLUMN IF EXISTS local_dp_id;

-- 2. Remove diagnostic logging tables
DROP TABLE IF EXISTS public.iot_system_logs CASCADE;
DROP TABLE IF EXISTS public.iot_device_logs CASCADE;

-- 3. Cleanup Realtime publications if they were only for these tables
-- Since we can't easily check if others use it, we just let it be or explicitly remove if we added it.
-- ALTER PUBLICATION supabase_realtime DROP TABLE iot_system_logs;

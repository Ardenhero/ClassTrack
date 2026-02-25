-- Migration: System settings table + pre-activation scan tracking
-- Phase 4: Pre-Activation Scan Policy

-- System settings (key-value store for admin-configurable behaviors)
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES instructors(id) ON DELETE SET NULL
);

-- Default settings
INSERT INTO system_settings (key, value, description) VALUES
  ('pre_activation_scan_policy', 'allow_and_flag', 'What happens when students scan before room IoT is activated. Options: allow_and_flag, block')
ON CONFLICT (key) DO NOTHING;

-- Add pre_activation flag to attendance_logs
ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS pre_activation BOOLEAN DEFAULT false;

-- RLS
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage settings"
  ON system_settings FOR ALL
  USING (true)
  WITH CHECK (true);

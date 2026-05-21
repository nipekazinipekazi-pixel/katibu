-- ============================================================
-- Theo Sign - Seed Data
-- Run AFTER schema.sql in Supabase SQL Editor
-- ============================================================

-- Insert demo access codes
INSERT INTO access_codes (code, usage_limit, disabled) VALUES
  ('DEMO-1234', -1, false),
  ('TRADE-5678', -1, false),
  ('KX92-ROOT', -1, false)
ON CONFLICT (code) DO NOTHING;

-- Insert settings
INSERT INTO settings (key, value) VALUES
  ('master_code', 'KX92-ROOT'),
  ('app_name', 'Theo Sign'),
  ('app_version', '2.0.0')
ON CONFLICT (key) DO NOTHING;

-- Insert initial analytics record
INSERT INTO analytics (date, total_uploads, total_logins, unique_codes_used)
VALUES (CURRENT_DATE, 0, 0, 0)
ON CONFLICT (date) DO NOTHING;

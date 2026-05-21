-- ============================================================
-- Theo Sign - Supabase Database Schema
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. ACCESS CODES TABLE
CREATE TABLE IF NOT EXISTS access_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  disabled BOOLEAN NOT NULL DEFAULT false,
  usage_count INTEGER NOT NULL DEFAULT 0,
  usage_limit INTEGER NOT NULL DEFAULT -1,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. UPLOADS TABLE
CREATE TABLE IF NOT EXISTS uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  access_code TEXT NOT NULL REFERENCES access_codes(code) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  original_name TEXT,
  storage_path TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  analysis_result JSONB
);

-- 3. SETTINGS TABLE (for config key-value pairs)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- 4. ANALYTICS TABLE (for usage stats aggregation)
CREATE TABLE IF NOT EXISTS analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_uploads INTEGER NOT NULL DEFAULT 0,
  total_logins INTEGER NOT NULL DEFAULT 0,
  unique_codes_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(date)
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_uploads_access_code ON uploads(access_code);
CREATE INDEX IF NOT EXISTS idx_uploads_uploaded_at ON uploads(uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_codes_code ON access_codes(code);
CREATE INDEX IF NOT EXISTS idx_access_codes_disabled ON access_codes(disabled);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS on tables
ALTER TABLE access_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics ENABLE ROW LEVEL SECURITY;

-- Policies for access_codes
CREATE POLICY "Allow all access_codes operations for service_role"
  ON access_codes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow anon to read active codes only (for login validation)
CREATE POLICY "Allow anon to read access_codes"
  ON access_codes
  FOR SELECT
  TO anon
  USING (disabled = false AND (expires_at IS NULL OR expires_at > now()));

-- Policies for uploads
CREATE POLICY "Allow all uploads operations for service_role"
  ON uploads
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow anon to insert uploads
CREATE POLICY "Allow anon to insert uploads"
  ON uploads
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow anon to read uploads (for history)
CREATE POLICY "Allow anon to read uploads"
  ON uploads
  FOR SELECT
  TO anon
  USING (true);

-- Policies for settings
CREATE POLICY "Allow all settings operations for service_role"
  ON settings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policies for analytics
CREATE POLICY "Allow all analytics operations for service_role"
  ON analytics
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow anon to read analytics
CREATE POLICY "Allow anon to read analytics"
  ON analytics
  FOR SELECT
  TO anon
  USING (true);

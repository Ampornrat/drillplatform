-- iap_workflow_patch.sql
-- Adds workflow status + approval trail columns to iap_versions.
-- Run AFTER integration_patch.sql. Safe to re-run (ADD COLUMN IF NOT EXISTS).

ALTER TABLE iap_versions
  ADD COLUMN IF NOT EXISTS status        TEXT DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS submitted_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS submitted_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_comments TEXT,
  ADD COLUMN IF NOT EXISTS approved_at   TIMESTAMPTZ;

-- Idempotent CHECK constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'iap_versions_status_check'
      AND conrelid = 'iap_versions'::regclass
  ) THEN
    ALTER TABLE iap_versions ADD CONSTRAINT iap_versions_status_check
      CHECK (status IN ('draft','safety_brief','pending_approval','approved','active','reviewed','superseded'));
  END IF;
END $$;

-- Backfill any existing rows that have NULL status
UPDATE iap_versions SET status = 'draft' WHERE status IS NULL;

-- ============================================================
-- Board Star: allow users to pin boards as favorites
-- ============================================================

ALTER TABLE project_boards ADD COLUMN IF NOT EXISTS is_starred boolean NOT NULL DEFAULT false;

-- Partial index — only indexes the rows that are actually starred
CREATE INDEX IF NOT EXISTS idx_project_boards_is_starred
  ON project_boards(is_starred)
  WHERE is_starred = true;

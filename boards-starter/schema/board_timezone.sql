-- Add timezone column to project_boards
ALTER TABLE project_boards ADD COLUMN IF NOT EXISTS timezone text;

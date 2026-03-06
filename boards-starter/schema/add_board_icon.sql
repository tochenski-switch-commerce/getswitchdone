-- Add icon and icon_color columns to project_boards
-- Run this in your Supabase SQL editor.
ALTER TABLE project_boards ADD COLUMN IF NOT EXISTS icon text;
ALTER TABLE project_boards ADD COLUMN IF NOT EXISTS icon_color text;

-- Add displayOrder column for folder reordering
-- This is NON-DESTRUCTIVE: only adds a new column with default value 0
ALTER TABLE `spaces` ADD `displayOrder` int NOT NULL DEFAULT 0;

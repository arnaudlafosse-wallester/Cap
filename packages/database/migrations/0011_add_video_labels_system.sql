-- Migration: Add Video Labels & Retention System
-- This migration adds:
-- 1. video_labels table - stores label definitions per organization
-- 2. video_label_assignments table - links videos to labels (many-to-many)
-- 3. New columns on videos table for RAG eligibility and retention

-- =============================================================================
-- TABLE: video_labels
-- =============================================================================
CREATE TABLE `video_labels` (
  `id` varchar(21) NOT NULL,
  `organization_id` varchar(21) NOT NULL,
  `name` varchar(100) NOT NULL,
  `display_name` varchar(100) NOT NULL,
  `description` varchar(500),
  `color` varchar(7) NOT NULL DEFAULT '#6B7280',
  `icon` varchar(50),
  `category` varchar(20) NOT NULL DEFAULT 'content_type',
  `retention_days` int,
  `rag_default` varchar(10) DEFAULT 'pending',
  `is_system` tinyint(1) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `org_idx` (`organization_id`),
  KEY `category_idx` (`category`),
  UNIQUE KEY `org_name_unique` (`organization_id`, `name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- TABLE: video_label_assignments
-- =============================================================================
CREATE TABLE `video_label_assignments` (
  `id` varchar(21) NOT NULL,
  `video_id` varchar(21) NOT NULL,
  `label_id` varchar(21) NOT NULL,
  `assigned_by_id` varchar(21) NOT NULL,
  `assigned_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_ai_suggested` tinyint(1) NOT NULL DEFAULT 0,
  `ai_confidence` float,
  PRIMARY KEY (`id`),
  KEY `video_idx` (`video_id`),
  KEY `label_idx` (`label_id`),
  UNIQUE KEY `video_label_unique` (`video_id`, `label_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- ALTER TABLE: videos - Add RAG and retention columns
-- =============================================================================
ALTER TABLE `videos`
  ADD COLUMN `rag_status` varchar(10) DEFAULT 'pending',
  ADD COLUMN `rag_status_updated_at` timestamp NULL,
  ADD COLUMN `rag_status_updated_by_id` varchar(21) NULL,
  ADD COLUMN `keep_permanently` tinyint(1) NOT NULL DEFAULT 0,
  ADD COLUMN `expires_at` timestamp NULL,
  ADD COLUMN `ai_suggested_labels` json,
  ADD COLUMN `ai_classified_at` timestamp NULL;

-- Add indexes for efficient queries
ALTER TABLE `videos`
  ADD INDEX `expires_at_idx` (`expires_at`),
  ADD INDEX `rag_status_idx` (`rag_status`);

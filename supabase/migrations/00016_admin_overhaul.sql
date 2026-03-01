-- Add is_active to kpi_templates (enables soft-delete in UI)
ALTER TABLE kpi_templates
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Add new notification types for admin features
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'admin_message';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'review_reminder';

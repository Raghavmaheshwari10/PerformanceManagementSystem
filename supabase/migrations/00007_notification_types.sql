-- Extend notification_type enum for event-driven notifications
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'review_submitted';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'manager_review_submitted';

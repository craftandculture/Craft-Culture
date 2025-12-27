-- Add new_user_pending notification type for admin alerts on new signups
ALTER TYPE notification_type ADD VALUE 'new_user_pending' BEFORE 'buy_request_submitted';

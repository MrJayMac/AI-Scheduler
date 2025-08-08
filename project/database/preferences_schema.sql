-- Preferences table for user scheduling settings
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Workday settings
  workday_start TIME DEFAULT '09:00:00',
  workday_end TIME DEFAULT '17:00:00',
  
  -- Buffer and break settings
  buffer_minutes INTEGER DEFAULT 15,
  break_duration_minutes INTEGER DEFAULT 30,
  lunch_break_start TIME DEFAULT '12:00:00',
  lunch_break_end TIME DEFAULT '13:00:00',
  
  -- Focus window settings
  focus_window_start TIME DEFAULT '09:00:00',
  focus_window_end TIME DEFAULT '11:00:00',
  enable_focus_window BOOLEAN DEFAULT FALSE,
  
  -- Default task settings
  default_task_duration_minutes INTEGER DEFAULT 60,
  
  -- Scheduling preferences
  prefer_morning BOOLEAN DEFAULT TRUE,
  allow_weekend_scheduling BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access their own preferences
CREATE POLICY "Users can manage their own preferences" ON preferences
  FOR ALL USING (auth.uid() = user_id);

-- Create index for performance
CREATE INDEX idx_preferences_user_id ON preferences(user_id);

-- Insert default preferences for existing users (optional)
-- This will create default preferences for any existing users
INSERT INTO preferences (user_id)
SELECT id FROM auth.users
WHERE id NOT IN (SELECT user_id FROM preferences)
ON CONFLICT (user_id) DO NOTHING;

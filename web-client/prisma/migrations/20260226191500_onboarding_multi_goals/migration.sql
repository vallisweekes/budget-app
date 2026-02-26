-- Add new enum value for onboarding goal
ALTER TYPE "OnboardingGoal" ADD VALUE IF NOT EXISTS 'build_budget';

-- Allow users to select multiple onboarding goals
ALTER TABLE "UserOnboardingProfile"
ADD COLUMN IF NOT EXISTS "mainGoals" "OnboardingGoal"[] NOT NULL DEFAULT ARRAY[]::"OnboardingGoal"[];

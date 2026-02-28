-- Add onboarding override flag for legacy users
ALTER TABLE "User" ADD COLUMN "isOnboarded" BOOLEAN NOT NULL DEFAULT false;

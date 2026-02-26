-- Create table
CREATE TABLE "MobileAuthSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MobileAuthSession_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "MobileAuthSession_userId_idx" ON "MobileAuthSession"("userId");
CREATE INDEX "MobileAuthSession_expiresAt_idx" ON "MobileAuthSession"("expiresAt");
CREATE INDEX "MobileAuthSession_userId_revokedAt_expiresAt_idx" ON "MobileAuthSession"("userId", "revokedAt", "expiresAt");

-- Foreign key
ALTER TABLE "MobileAuthSession"
ADD CONSTRAINT "MobileAuthSession_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

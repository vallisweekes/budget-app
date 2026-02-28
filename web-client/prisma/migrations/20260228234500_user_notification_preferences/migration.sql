ALTER TABLE "User"
ADD COLUMN "notificationDueReminders" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "notificationPaymentAlerts" BOOLEAN NOT NULL DEFAULT true;

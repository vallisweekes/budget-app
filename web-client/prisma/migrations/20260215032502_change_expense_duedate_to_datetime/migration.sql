/*
  Warnings:

  - The `dueDate` column on the `Expense` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Expense" DROP COLUMN "dueDate",
ADD COLUMN     "dueDate" TIMESTAMP(3);

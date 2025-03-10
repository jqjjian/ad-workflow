/*
  Warnings:

  - A unique constraint covering the columns `[taskNumber]` on the table `tecdo_third_party_tasks` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `taskNumber` to the `tecdo_third_party_tasks` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `tecdo_third_party_tasks` ADD COLUMN `taskNumber` VARCHAR(191) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `tecdo_third_party_tasks_taskNumber_key` ON `tecdo_third_party_tasks`(`taskNumber`);

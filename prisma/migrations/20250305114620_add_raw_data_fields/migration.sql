-- DropIndex
DROP INDEX `tecdo_third_party_tasks_typeId_taskId_key` ON `tecdo_third_party_tasks`;

-- AlterTable
ALTER TABLE `tecdo_third_party_tasks` ADD COLUMN `rawData` TEXT NULL,
    ADD COLUMN `rawResponse` TEXT NULL;

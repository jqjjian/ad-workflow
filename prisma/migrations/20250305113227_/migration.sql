-- DropForeignKey
ALTER TABLE `tecdo_company_registration_details` DROP FOREIGN KEY `tecdo_company_registration_details_taskId_fkey`;

-- AlterTable
ALTER TABLE `tecdo_company_registration_details` MODIFY `taskId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `tecdo_third_party_tasks` MODIFY `taskId` VARCHAR(191) NOT NULL;

-- AddForeignKey
ALTER TABLE `tecdo_company_registration_details` ADD CONSTRAINT `tecdo_company_registration_details_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `tecdo_third_party_tasks`(`taskId`) ON DELETE CASCADE ON UPDATE CASCADE;

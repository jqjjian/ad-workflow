-- DropForeignKey
ALTER TABLE `tecdo_deposit_business_data` DROP FOREIGN KEY `tecdo_deposit_business_data_mediaAccountId_fkey`;

-- AlterTable
ALTER TABLE `tecdo_deposit_business_data` ADD COLUMN `tecdo_media_accountsId` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `tecdo_deposit_business_data` ADD CONSTRAINT `tecdo_deposit_business_data_tecdo_media_accountsId_fkey` FOREIGN KEY (`tecdo_media_accountsId`) REFERENCES `tecdo_media_accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

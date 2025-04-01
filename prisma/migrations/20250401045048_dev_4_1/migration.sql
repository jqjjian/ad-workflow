-- DropForeignKey
ALTER TABLE `tecdo_account_binding_data` DROP FOREIGN KEY `tecdo_account_binding_data_mediaAccountId_fkey`;

-- DropForeignKey
ALTER TABLE `tecdo_withdrawal_business_data` DROP FOREIGN KEY `tecdo_withdrawal_business_data_mediaAccountId_fkey`;

-- DropForeignKey
ALTER TABLE `tecdo_zeroing_business_data` DROP FOREIGN KEY `tecdo_zeroing_business_data_mediaAccountId_fkey`;

-- DropIndex
DROP INDEX `tecdo_account_binding_data_mediaAccountId_idx` ON `tecdo_account_binding_data`;

-- DropIndex
DROP INDEX `tecdo_deposit_business_data_mediaAccountId_idx` ON `tecdo_deposit_business_data`;

-- DropIndex
DROP INDEX `tecdo_withdrawal_business_data_mediaAccountId_idx` ON `tecdo_withdrawal_business_data`;

-- DropIndex
DROP INDEX `tecdo_zeroing_business_data_mediaAccountId_idx` ON `tecdo_zeroing_business_data`;

-- AlterTable
ALTER TABLE `tecdo_account_binding_data` ADD COLUMN `tecdo_media_accountsId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `tecdo_withdrawal_business_data` ADD COLUMN `tecdo_media_accountsId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `tecdo_zeroing_business_data` ADD COLUMN `tecdo_media_accountsId` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `tecdo_withdrawal_business_data` ADD CONSTRAINT `tecdo_withdrawal_business_data_tecdo_media_accountsId_fkey` FOREIGN KEY (`tecdo_media_accountsId`) REFERENCES `tecdo_media_accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tecdo_zeroing_business_data` ADD CONSTRAINT `tecdo_zeroing_business_data_tecdo_media_accountsId_fkey` FOREIGN KEY (`tecdo_media_accountsId`) REFERENCES `tecdo_media_accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tecdo_account_binding_data` ADD CONSTRAINT `tecdo_account_binding_data_tecdo_media_accountsId_fkey` FOREIGN KEY (`tecdo_media_accountsId`) REFERENCES `tecdo_media_accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

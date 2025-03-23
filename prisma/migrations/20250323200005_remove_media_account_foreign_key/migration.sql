/*
  Warnings:

  - You are about to drop the column `completedTime` on the `tecdo_account_binding_data` table. All the data in the column will be lost.
  - You are about to drop the column `ipAddress` on the `tecdo_audit_logs` table. All the data in the column will be lost.
  - You are about to drop the column `oldValue` on the `tecdo_audit_logs` table. All the data in the column will be lost.
  - You are about to drop the column `userAgent` on the `tecdo_audit_logs` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `tecdo_audit_logs` table. All the data in the column will be lost.
  - You are about to drop the column `workOrderId` on the `tecdo_audit_logs` table. All the data in the column will be lost.
  - The values [PROMOTION_LINK] on the enum `tecdo_dictionaries_dictType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to alter the column `status` on the `tecdo_third_party_tasks` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Enum(EnumId(8))`.
  - You are about to drop the `BusinessStatistics` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CompanyAttachment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ErrorLog` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `StatusSyncLog` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `tecdo_account_management_business_data` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `tecdo_account_management_details` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `tecdo_account_unbinding_data` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `tecdo_accounts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `tecdo_attachment_business_data` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `tecdo_attachment_records` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `tecdo_company_registration_details` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `tecdo_email_binding_data` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `tecdo_media_account_sync_logs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `tecdo_payment_records` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `tecdo_pixel_binding_data` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `tecdo_promotion_links` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `tecdo_user_company_attachments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `tecdo_user_statistics` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `tecdo_verification_tokens` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `bindingTime` on table `tecdo_account_binding_data` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `performedBy` to the `tecdo_audit_logs` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `BusinessStatistics` DROP FOREIGN KEY `BusinessStatistics_userId_fkey`;

-- DropForeignKey
ALTER TABLE `CompanyAttachment` DROP FOREIGN KEY `CompanyAttachment_companyInfoId_fkey`;

-- DropForeignKey
ALTER TABLE `CompanyAttachment` DROP FOREIGN KEY `CompanyAttachment_userCompanyInfoId_fkey`;

-- DropForeignKey
ALTER TABLE `StatusSyncLog` DROP FOREIGN KEY `StatusSyncLog_workOrderId_fkey`;

-- DropForeignKey
ALTER TABLE `tecdo_account_management_business_data` DROP FOREIGN KEY `tecdo_account_management_business_data_workOrderId_fkey`;

-- DropForeignKey
ALTER TABLE `tecdo_account_management_details` DROP FOREIGN KEY `tecdo_account_management_details_taskId_fkey`;

-- DropForeignKey
ALTER TABLE `tecdo_account_unbinding_data` DROP FOREIGN KEY `tecdo_account_unbinding_data_mediaAccountId_fkey`;

-- DropForeignKey
ALTER TABLE `tecdo_account_unbinding_data` DROP FOREIGN KEY `tecdo_account_unbinding_data_workOrderId_fkey`;

-- DropForeignKey
ALTER TABLE `tecdo_accounts` DROP FOREIGN KEY `tecdo_accounts_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `tecdo_attachment_business_data` DROP FOREIGN KEY `tecdo_attachment_business_data_workOrderId_fkey`;

-- DropForeignKey
ALTER TABLE `tecdo_attachment_records` DROP FOREIGN KEY `tecdo_attachment_records_taskId_fkey`;

-- DropForeignKey
ALTER TABLE `tecdo_audit_logs` DROP FOREIGN KEY `tecdo_audit_logs_userId_fkey`;

-- DropForeignKey
ALTER TABLE `tecdo_audit_logs` DROP FOREIGN KEY `tecdo_audit_logs_workOrderId_fkey`;

-- DropForeignKey
ALTER TABLE `tecdo_company_registration_details` DROP FOREIGN KEY `tecdo_company_registration_details_taskId_fkey`;

-- DropForeignKey
ALTER TABLE `tecdo_email_binding_data` DROP FOREIGN KEY `tecdo_email_binding_data_mediaAccountId_fkey`;

-- DropForeignKey
ALTER TABLE `tecdo_email_binding_data` DROP FOREIGN KEY `tecdo_email_binding_data_workOrderId_fkey`;

-- DropForeignKey
ALTER TABLE `tecdo_media_account_sync_logs` DROP FOREIGN KEY `tecdo_media_account_sync_logs_mediaAccountId_fkey`;

-- DropForeignKey
ALTER TABLE `tecdo_payment_records` DROP FOREIGN KEY `tecdo_payment_records_taskId_fkey`;

-- DropForeignKey
ALTER TABLE `tecdo_pixel_binding_data` DROP FOREIGN KEY `tecdo_pixel_binding_data_mediaAccountId_fkey`;

-- DropForeignKey
ALTER TABLE `tecdo_pixel_binding_data` DROP FOREIGN KEY `tecdo_pixel_binding_data_workOrderId_fkey`;

-- DropForeignKey
ALTER TABLE `tecdo_promotion_links` DROP FOREIGN KEY `tecdo_promotion_links_userId_fkey`;

-- DropForeignKey
ALTER TABLE `tecdo_third_party_tasks` DROP FOREIGN KEY `tecdo_third_party_tasks_promotionLinkId_fkey`;

-- DropForeignKey
ALTER TABLE `tecdo_user_company_attachments` DROP FOREIGN KEY `tecdo_user_company_attachments_userCompanyInfoId_fkey`;

-- DropForeignKey
ALTER TABLE `tecdo_user_statistics` DROP FOREIGN KEY `tecdo_user_statistics_userId_fkey`;

-- DropForeignKey
ALTER TABLE `tecdo_work_orders` DROP FOREIGN KEY `tecdo_work_orders_mediaAccountId_fkey`;

-- DropIndex
DROP INDEX `tecdo_audit_logs_userId_fkey` ON `tecdo_audit_logs`;

-- DropIndex
DROP INDEX `tecdo_audit_logs_workOrderId_fkey` ON `tecdo_audit_logs`;

-- AlterTable
ALTER TABLE `tecdo_account_binding_data` DROP COLUMN `completedTime`,
    MODIFY `bindingRole` VARCHAR(191) NOT NULL,
    MODIFY `bindingTime` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `tecdo_audit_logs` DROP COLUMN `ipAddress`,
    DROP COLUMN `oldValue`,
    DROP COLUMN `userAgent`,
    DROP COLUMN `userId`,
    DROP COLUMN `workOrderId`,
    ADD COLUMN `performedBy` VARCHAR(191) NOT NULL,
    ADD COLUMN `previousValue` VARCHAR(191) NULL,
    MODIFY `newValue` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `tecdo_dictionaries` MODIFY `dictType` ENUM('SYSTEM', 'BUSINESS', 'USER', 'OTHER') NOT NULL;

-- AlterTable
ALTER TABLE `tecdo_third_party_tasks` MODIFY `status` ENUM('INIT', 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED') NOT NULL;

-- AlterTable
ALTER TABLE `tecdo_work_orders` ADD COLUMN `tecdo_media_accountsId` VARCHAR(191) NULL,
    MODIFY `rawDataId` VARCHAR(191) NULL;

-- DropTable
DROP TABLE `BusinessStatistics`;

-- DropTable
DROP TABLE `CompanyAttachment`;

-- DropTable
DROP TABLE `ErrorLog`;

-- DropTable
DROP TABLE `StatusSyncLog`;

-- DropTable
DROP TABLE `tecdo_account_management_business_data`;

-- DropTable
DROP TABLE `tecdo_account_management_details`;

-- DropTable
DROP TABLE `tecdo_account_unbinding_data`;

-- DropTable
DROP TABLE `tecdo_accounts`;

-- DropTable
DROP TABLE `tecdo_attachment_business_data`;

-- DropTable
DROP TABLE `tecdo_attachment_records`;

-- DropTable
DROP TABLE `tecdo_company_registration_details`;

-- DropTable
DROP TABLE `tecdo_email_binding_data`;

-- DropTable
DROP TABLE `tecdo_media_account_sync_logs`;

-- DropTable
DROP TABLE `tecdo_payment_records`;

-- DropTable
DROP TABLE `tecdo_pixel_binding_data`;

-- DropTable
DROP TABLE `tecdo_promotion_links`;

-- DropTable
DROP TABLE `tecdo_user_company_attachments`;

-- DropTable
DROP TABLE `tecdo_user_statistics`;

-- DropTable
DROP TABLE `tecdo_verification_tokens`;

-- CreateTable
CREATE TABLE `tecdo_business_statistics` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `mediaPlatform` VARCHAR(191) NULL,
    `businessType` VARCHAR(191) NOT NULL,
    `periodStart` DATETIME(3) NOT NULL,
    `periodEnd` DATETIME(3) NOT NULL,
    `totalCount` INTEGER NOT NULL,
    `successCount` INTEGER NOT NULL,
    `failedCount` INTEGER NOT NULL,
    `totalAmount` DECIMAL(15, 2) NULL,
    `currency` VARCHAR(191) NULL,
    `avgProcessingTime` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `tecdo_business_statistics_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tecdo_error_log` (
    `id` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `errorCode` VARCHAR(191) NULL,
    `errorMessage` TEXT NOT NULL,
    `stackTrace` TEXT NULL,
    `severity` VARCHAR(191) NOT NULL,
    `resolved` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `resolvedAt` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tecdo_status_sync_log` (
    `id` VARCHAR(191) NOT NULL,
    `workOrderId` VARCHAR(191) NOT NULL,
    `thirdPartyTaskId` VARCHAR(191) NULL,
    `previousStatus` VARCHAR(191) NOT NULL,
    `newStatus` VARCHAR(191) NOT NULL,
    `syncTimestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `syncDirection` VARCHAR(191) NOT NULL,
    `syncResult` VARCHAR(191) NOT NULL,
    `failureReason` TEXT NULL,

    INDEX `tecdo_status_sync_log_workOrderId_idx`(`workOrderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `tecdo_business_statistics` ADD CONSTRAINT `tecdo_business_statistics_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `tecdo_users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tecdo_status_sync_log` ADD CONSTRAINT `tecdo_status_sync_log_workOrderId_fkey` FOREIGN KEY (`workOrderId`) REFERENCES `tecdo_work_orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tecdo_work_orders` ADD CONSTRAINT `tecdo_work_orders_tecdo_media_accountsId_fkey` FOREIGN KEY (`tecdo_media_accountsId`) REFERENCES `tecdo_media_accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `tecdo_account_binding_data` RENAME INDEX `tecdo_account_binding_data_mediaAccountId_fkey` TO `tecdo_account_binding_data_mediaAccountId_idx`;

-- RenameIndex
ALTER TABLE `tecdo_company_info` RENAME INDEX `tecdo_company_info_userId_fkey` TO `tecdo_company_info_userId_idx`;

-- RenameIndex
ALTER TABLE `tecdo_deposit_business_data` RENAME INDEX `tecdo_deposit_business_data_mediaAccountId_fkey` TO `tecdo_deposit_business_data_mediaAccountId_idx`;

-- RenameIndex
ALTER TABLE `tecdo_third_party_tasks` RENAME INDEX `tecdo_third_party_tasks_promotionLinkId_fkey` TO `tecdo_third_party_tasks_promotionLinkId_idx`;

-- RenameIndex
ALTER TABLE `tecdo_third_party_tasks` RENAME INDEX `tecdo_third_party_tasks_userId_fkey` TO `tecdo_third_party_tasks_userId_idx`;

-- RenameIndex
ALTER TABLE `tecdo_transfer_business_data` RENAME INDEX `tecdo_transfer_business_data_mediaAccountId_fkey` TO `tecdo_transfer_business_data_mediaAccountId_idx`;

-- RenameIndex
ALTER TABLE `tecdo_user_company_info` RENAME INDEX `tecdo_user_company_info_userId_fkey` TO `tecdo_user_company_info_userId_idx`;

-- RenameIndex
ALTER TABLE `tecdo_withdrawal_business_data` RENAME INDEX `tecdo_withdrawal_business_data_mediaAccountId_fkey` TO `tecdo_withdrawal_business_data_mediaAccountId_idx`;

-- RenameIndex
ALTER TABLE `tecdo_work_orders` RENAME INDEX `tecdo_work_orders_companyInfoId_fkey` TO `tecdo_work_orders_companyInfoId_idx`;

-- RenameIndex
ALTER TABLE `tecdo_work_orders` RENAME INDEX `tecdo_work_orders_mediaAccountId_fkey` TO `tecdo_work_orders_mediaAccountId_idx`;

-- RenameIndex
ALTER TABLE `tecdo_work_orders` RENAME INDEX `tecdo_work_orders_userId_fkey` TO `tecdo_work_orders_userId_idx`;

-- RenameIndex
ALTER TABLE `tecdo_workorder_company_attachments` RENAME INDEX `tecdo_workorder_company_attachments_workOrderCompanyInfoId_fkey` TO `tecdo_workorder_company_attachments_workOrderCompanyInfoId_idx`;

-- RenameIndex
ALTER TABLE `tecdo_workorder_company_info` RENAME INDEX `tecdo_workorder_company_info_userCompanyInfoId_fkey` TO `tecdo_workorder_company_info_userCompanyInfoId_idx`;

-- RenameIndex
ALTER TABLE `tecdo_zeroing_business_data` RENAME INDEX `tecdo_zeroing_business_data_mediaAccountId_fkey` TO `tecdo_zeroing_business_data_mediaAccountId_idx`;

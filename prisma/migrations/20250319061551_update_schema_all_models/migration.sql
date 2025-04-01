/*
  Warnings:

  - Added the required column `workOrderSubtype` to the `tecdo_third_party_tasks` table without a default value. This is not possible if the table is not empty.
  - Added the required column `workOrderType` to the `tecdo_third_party_tasks` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `tecdo_third_party_tasks` ADD COLUMN `workOrderSubtype` ENUM('GOOGLE_ACCOUNT', 'TIKTOK_ACCOUNT', 'FACEBOOK_ACCOUNT', 'DEPOSIT', 'WITHDRAWAL', 'TRANSFER', 'ZEROING', 'BIND_ACCOUNT', 'UNBIND_ACCOUNT', 'BIND_PIXEL', 'UNBIND_PIXEL', 'BIND_EMAIL', 'UNBIND_EMAIL', 'GENERAL_MANAGEMENT', 'DOCUMENT_UPLOAD', 'IMAGE_UPLOAD', 'OTHER_ATTACHMENT', 'PAYMENT_PROCESSING', 'PAYMENT_COMPLETED', 'PAYMENT_FAILED') NOT NULL DEFAULT 'GOOGLE_ACCOUNT',
    ADD COLUMN `workOrderType` ENUM('ACCOUNT_APPLICATION', 'ACCOUNT_MANAGEMENT', 'ATTACHMENT_MANAGEMENT', 'PAYMENT') NOT NULL DEFAULT 'ACCOUNT_APPLICATION';

-- 添加默认值后，可以根据typeId更新正确的值
UPDATE `tecdo_third_party_tasks` SET 
    `workOrderType` = CASE 
        WHEN `typeId` = 1 THEN 'ACCOUNT_APPLICATION'
        WHEN `typeId` = 2 THEN 'ACCOUNT_APPLICATION'
        WHEN `typeId` IN (5, 6, 7) THEN 'ACCOUNT_APPLICATION'
        ELSE 'ACCOUNT_APPLICATION'
    END,
    `workOrderSubtype` = CASE 
        WHEN `typeId` = 1 THEN 'GOOGLE_ACCOUNT'
        WHEN `typeId` = 2 THEN 'TIKTOK_ACCOUNT'
        WHEN `typeId` = 5 THEN 'FACEBOOK_ACCOUNT'
        ELSE 'GOOGLE_ACCOUNT'
    END;

-- AlterTable
ALTER TABLE `tecdo_users` ADD COLUMN `lastLoginAt` DATETIME(3) NULL,
    ADD COLUMN `loginCount` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    MODIFY `role` ENUM('SUPER_ADMIN', 'ADMIN', 'USER') NOT NULL DEFAULT 'USER';

-- CreateTable
CREATE TABLE `tecdo_account_management_details` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `taskId` VARCHAR(191) NOT NULL,
    `mediaAccountId` VARCHAR(191) NULL,
    `mediaAccountName` VARCHAR(191) NULL,
    `mediaPlatform` VARCHAR(191) NULL,
    `amount` DECIMAL(15, 2) NULL,
    `currency` VARCHAR(191) NULL,
    `exchangeRate` DECIMAL(10, 6) NULL,
    `bindType` VARCHAR(191) NULL,
    `bindValue` VARCHAR(191) NULL,
    `bindTarget` VARCHAR(191) NULL,
    `actionDetail` TEXT NULL,
    `extraData` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `tecdo_account_management_details_taskId_key`(`taskId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tecdo_attachment_records` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `taskId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `fileType` VARCHAR(191) NOT NULL,
    `fileSize` INTEGER NOT NULL,
    `filePath` VARCHAR(191) NOT NULL,
    `ossObjectKey` VARCHAR(191) NOT NULL,
    `fileUrl` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `uploadStatus` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tecdo_payment_records` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `taskId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `paymentNo` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(15, 2) NOT NULL,
    `currency` VARCHAR(191) NOT NULL,
    `paymentMethod` VARCHAR(191) NOT NULL,
    `paymentChannel` VARCHAR(191) NOT NULL,
    `paymentStatus` ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED', 'CANCELLED') NOT NULL,
    `thirdPartyTradeNo` VARCHAR(191) NULL,
    `thirdPartyBuyerId` VARCHAR(191) NULL,
    `paymentTime` DATETIME(3) NULL,
    `paymentDetail` TEXT NULL,
    `failureReason` TEXT NULL,
    `refundStatus` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `tecdo_payment_records_taskId_key`(`taskId`),
    UNIQUE INDEX `tecdo_payment_records_paymentNo_key`(`paymentNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tecdo_work_orders` (
    `id` VARCHAR(191) NOT NULL,
    `taskId` VARCHAR(191) NOT NULL,
    `taskNumber` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `workOrderType` ENUM('ACCOUNT_APPLICATION', 'ACCOUNT_MANAGEMENT', 'ATTACHMENT_MANAGEMENT', 'PAYMENT') NOT NULL,
    `workOrderSubtype` ENUM('GOOGLE_ACCOUNT', 'TIKTOK_ACCOUNT', 'FACEBOOK_ACCOUNT', 'DEPOSIT', 'WITHDRAWAL', 'TRANSFER', 'ZEROING', 'BIND_ACCOUNT', 'UNBIND_ACCOUNT', 'BIND_PIXEL', 'UNBIND_PIXEL', 'BIND_EMAIL', 'UNBIND_EMAIL', 'GENERAL_MANAGEMENT', 'DOCUMENT_UPLOAD', 'IMAGE_UPLOAD', 'OTHER_ATTACHMENT', 'PAYMENT_PROCESSING', 'PAYMENT_COMPLETED', 'PAYMENT_FAILED') NOT NULL,
    `status` ENUM('INIT', 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED') NOT NULL,
    `priority` INTEGER NOT NULL DEFAULT 0,
    `rawDataId` VARCHAR(191) NOT NULL,
    `businessDataId` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `remark` VARCHAR(191) NULL,
    `processingTime` DATETIME(3) NULL,
    `completedTime` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `isDeleted` BOOLEAN NOT NULL DEFAULT false,
    `mediaAccountId` VARCHAR(191) NULL,

    UNIQUE INDEX `tecdo_work_orders_taskNumber_key`(`taskNumber`),
    UNIQUE INDEX `tecdo_work_orders_rawDataId_key`(`rawDataId`),
    UNIQUE INDEX `tecdo_work_orders_businessDataId_key`(`businessDataId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tecdo_raw_data` (
    `id` VARCHAR(191) NOT NULL,
    `workOrderId` VARCHAR(191) NOT NULL,
    `requestData` TEXT NOT NULL,
    `responseData` TEXT NULL,
    `syncStatus` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `syncAttempts` INTEGER NOT NULL DEFAULT 0,
    `lastSyncTime` DATETIME(3) NULL,
    `syncError` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `tecdo_raw_data_workOrderId_key`(`workOrderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tecdo_deposit_business_data` (
    `id` VARCHAR(191) NOT NULL,
    `workOrderId` VARCHAR(191) NOT NULL,
    `mediaAccountId` VARCHAR(191) NOT NULL,
    `mediaPlatform` VARCHAR(191) NOT NULL,
    `amount` VARCHAR(191) NOT NULL,
    `currency` VARCHAR(191) NOT NULL,
    `dailyBudget` INTEGER NOT NULL,
    `externalTaskNumber` VARCHAR(191) NULL,
    `depositStatus` VARCHAR(191) NOT NULL,
    `depositTime` DATETIME(3) NULL,
    `completedTime` DATETIME(3) NULL,
    `failureReason` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `isDeleted` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `tecdo_deposit_business_data_workOrderId_key`(`workOrderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tecdo_account_application_business_data` (
    `id` VARCHAR(191) NOT NULL,
    `workOrderId` VARCHAR(191) NOT NULL,
    `mediaPlatform` VARCHAR(191) NOT NULL,
    `accountName` VARCHAR(191) NOT NULL,
    `currency` VARCHAR(191) NOT NULL,
    `timezone` VARCHAR(191) NOT NULL,
    `productType` INTEGER NOT NULL,
    `rechargeAmount` VARCHAR(191) NULL,
    `promotionLinks` TEXT NOT NULL,
    `authorizations` TEXT NULL,
    `applicationStatus` VARCHAR(191) NOT NULL,
    `failureReason` VARCHAR(191) NULL,
    `metadata` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `tecdo_account_application_business_data_workOrderId_key`(`workOrderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tecdo_account_management_business_data` (
    `id` VARCHAR(191) NOT NULL,
    `workOrderId` VARCHAR(191) NOT NULL,
    `accountId` VARCHAR(191) NOT NULL,
    `operationType` VARCHAR(191) NOT NULL,
    `oldValue` VARCHAR(191) NULL,
    `newValue` VARCHAR(191) NULL,
    `operationStatus` VARCHAR(191) NOT NULL,
    `operationTime` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `isDeleted` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `tecdo_account_management_business_data_workOrderId_key`(`workOrderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tecdo_attachment_business_data` (
    `id` VARCHAR(191) NOT NULL,
    `workOrderId` VARCHAR(191) NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `fileType` VARCHAR(191) NOT NULL,
    `fileSize` INTEGER NOT NULL,
    `fileUrl` VARCHAR(191) NOT NULL,
    `uploadStatus` VARCHAR(191) NOT NULL,
    `uploadTime` DATETIME(3) NULL,
    `expirationTime` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `isDeleted` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `tecdo_attachment_business_data_workOrderId_key`(`workOrderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tecdo_withdrawal_business_data` (
    `id` VARCHAR(191) NOT NULL,
    `workOrderId` VARCHAR(191) NOT NULL,
    `mediaAccountId` VARCHAR(191) NOT NULL,
    `mediaPlatform` VARCHAR(191) NOT NULL,
    `amount` VARCHAR(191) NOT NULL,
    `currency` VARCHAR(191) NOT NULL,
    `withdrawalStatus` VARCHAR(191) NOT NULL,
    `withdrawalTime` DATETIME(3) NULL,
    `completedTime` DATETIME(3) NULL,
    `failureReason` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `isDeleted` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `tecdo_withdrawal_business_data_workOrderId_key`(`workOrderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tecdo_zeroing_business_data` (
    `id` VARCHAR(191) NOT NULL,
    `workOrderId` VARCHAR(191) NOT NULL,
    `mediaAccountId` VARCHAR(191) NULL,
    `mediaPlatform` VARCHAR(191) NOT NULL,
    `zeroingStatus` VARCHAR(191) NOT NULL,
    `zeroingTime` DATETIME(3) NULL,
    `completedTime` DATETIME(3) NULL,
    `failureReason` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `isDeleted` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `tecdo_zeroing_business_data_workOrderId_key`(`workOrderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tecdo_transfer_business_data` (
    `id` VARCHAR(191) NOT NULL,
    `workOrderId` VARCHAR(191) NOT NULL,
    `mediaPlatform` VARCHAR(191) NOT NULL,
    `sourceAccountId` VARCHAR(191) NOT NULL,
    `targetAccountId` VARCHAR(191) NOT NULL,
    `amount` VARCHAR(191) NULL,
    `currency` VARCHAR(191) NOT NULL,
    `isMoveAllBalance` BOOLEAN NOT NULL,
    `transferStatus` VARCHAR(191) NOT NULL,
    `transferTime` DATETIME(3) NULL,
    `completedTime` DATETIME(3) NULL,
    `failureReason` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `isDeleted` BOOLEAN NOT NULL DEFAULT false,
    `mediaAccountId` VARCHAR(191) NULL,

    UNIQUE INDEX `tecdo_transfer_business_data_workOrderId_key`(`workOrderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tecdo_account_binding_data` (
    `id` VARCHAR(191) NOT NULL,
    `workOrderId` VARCHAR(191) NOT NULL,
    `mediaPlatform` VARCHAR(191) NOT NULL,
    `mediaAccountId` VARCHAR(191) NOT NULL,
    `bindingValue` VARCHAR(191) NOT NULL,
    `bindingRole` INTEGER NOT NULL,
    `bindingStatus` VARCHAR(191) NOT NULL,
    `bindingTime` DATETIME(3) NULL,
    `completedTime` DATETIME(3) NULL,
    `failureReason` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `isDeleted` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `tecdo_account_binding_data_workOrderId_key`(`workOrderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tecdo_account_unbinding_data` (
    `id` VARCHAR(191) NOT NULL,
    `workOrderId` VARCHAR(191) NOT NULL,
    `mediaPlatform` VARCHAR(191) NOT NULL,
    `mediaAccountId` VARCHAR(191) NOT NULL,
    `unbindingValue` VARCHAR(191) NOT NULL,
    `unbindingStatus` VARCHAR(191) NOT NULL,
    `unbindingTime` DATETIME(3) NULL,
    `completedTime` DATETIME(3) NULL,
    `failureReason` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `isDeleted` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `tecdo_account_unbinding_data_workOrderId_key`(`workOrderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tecdo_email_binding_data` (
    `id` VARCHAR(191) NOT NULL,
    `workOrderId` VARCHAR(191) NOT NULL,
    `mediaPlatform` VARCHAR(191) NOT NULL,
    `mediaAccountId` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `bindingRole` INTEGER NOT NULL,
    `bindingStatus` VARCHAR(191) NOT NULL,
    `bindingTime` DATETIME(3) NULL,
    `completedTime` DATETIME(3) NULL,
    `failureReason` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `isDeleted` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `tecdo_email_binding_data_workOrderId_key`(`workOrderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tecdo_pixel_binding_data` (
    `id` VARCHAR(191) NOT NULL,
    `workOrderId` VARCHAR(191) NOT NULL,
    `pixelId` VARCHAR(191) NOT NULL,
    `bindingType` INTEGER NOT NULL,
    `mediaPlatform` INTEGER NOT NULL,
    `bindingValue` VARCHAR(191) NOT NULL,
    `bindingRole` INTEGER NOT NULL,
    `bindingStatus` VARCHAR(191) NOT NULL,
    `bindingTime` DATETIME(3) NULL,
    `completedTime` DATETIME(3) NULL,
    `failureReason` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `isDeleted` BOOLEAN NOT NULL DEFAULT false,
    `mediaAccountId` VARCHAR(191) NULL,

    UNIQUE INDEX `tecdo_pixel_binding_data_workOrderId_key`(`workOrderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tecdo_user_statistics` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `totalWorkOrders` INTEGER NOT NULL DEFAULT 0,
    `totalDeposits` DECIMAL(65, 30) NOT NULL DEFAULT 0,
    `totalWithdrawals` DECIMAL(65, 30) NOT NULL DEFAULT 0,
    `totalTransfers` INTEGER NOT NULL DEFAULT 0,
    `totalZeroings` INTEGER NOT NULL DEFAULT 0,
    `accountApplications` INTEGER NOT NULL DEFAULT 0,
    `lastActivityAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `tecdo_user_statistics_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tecdo_audit_logs` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `workOrderId` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `oldValue` JSON NULL,
    `newValue` JSON NULL,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tecdo_media_accounts` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `platformId` VARCHAR(191) NOT NULL,
    `mediaPlatform` ENUM('FACEBOOK', 'GOOGLE', 'MICROSOFT_ADVERTISING', 'TIKTOK') NOT NULL,
    `accountName` VARCHAR(191) NOT NULL,
    `accountStatus` ENUM('PENDING', 'ACTIVE', 'SUSPENDED', 'DISABLED', 'EXPIRED') NOT NULL,
    `currency` VARCHAR(191) NOT NULL,
    `timezone` VARCHAR(191) NOT NULL,
    `balance` DECIMAL(65, 30) NOT NULL,
    `dailyBudget` DECIMAL(65, 30) NULL,
    `totalSpent` DECIMAL(65, 30) NOT NULL,
    `metadata` JSON NULL,
    `lastSyncTime` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `isDeleted` BOOLEAN NOT NULL DEFAULT false,

    INDEX `tecdo_media_accounts_userId_idx`(`userId`),
    INDEX `tecdo_media_accounts_mediaPlatform_platformId_idx`(`mediaPlatform`, `platformId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tecdo_media_account_sync_logs` (
    `id` VARCHAR(191) NOT NULL,
    `mediaAccountId` VARCHAR(191) NOT NULL,
    `syncType` VARCHAR(191) NOT NULL,
    `syncStatus` VARCHAR(191) NOT NULL,
    `beforeData` JSON NULL,
    `afterData` JSON NULL,
    `errorMessage` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `tecdo_media_account_sync_logs_mediaAccountId_syncType_idx`(`mediaAccountId`, `syncType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `tecdo_account_management_details` ADD CONSTRAINT `tecdo_account_management_details_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `tecdo_third_party_tasks`(`taskId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tecdo_attachment_records` ADD CONSTRAINT `tecdo_attachment_records_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `tecdo_third_party_tasks`(`taskId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tecdo_payment_records` ADD CONSTRAINT `tecdo_payment_records_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `tecdo_third_party_tasks`(`taskId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tecdo_work_orders` ADD CONSTRAINT `tecdo_work_orders_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `tecdo_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tecdo_work_orders` ADD CONSTRAINT `tecdo_work_orders_mediaAccountId_fkey` FOREIGN KEY (`mediaAccountId`) REFERENCES `tecdo_media_accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tecdo_raw_data` ADD CONSTRAINT `tecdo_raw_data_workOrderId_fkey` FOREIGN KEY (`workOrderId`) REFERENCES `tecdo_work_orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tecdo_deposit_business_data` ADD CONSTRAINT `tecdo_deposit_business_data_workOrderId_fkey` FOREIGN KEY (`workOrderId`) REFERENCES `tecdo_work_orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tecdo_deposit_business_data` ADD CONSTRAINT `tecdo_deposit_business_data_mediaAccountId_fkey` FOREIGN KEY (`mediaAccountId`) REFERENCES `tecdo_media_accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tecdo_account_application_business_data` ADD CONSTRAINT `tecdo_account_application_business_data_workOrderId_fkey` FOREIGN KEY (`workOrderId`) REFERENCES `tecdo_work_orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tecdo_account_management_business_data` ADD CONSTRAINT `tecdo_account_management_business_data_workOrderId_fkey` FOREIGN KEY (`workOrderId`) REFERENCES `tecdo_work_orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tecdo_attachment_business_data` ADD CONSTRAINT `tecdo_attachment_business_data_workOrderId_fkey` FOREIGN KEY (`workOrderId`) REFERENCES `tecdo_work_orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tecdo_withdrawal_business_data` ADD CONSTRAINT `tecdo_withdrawal_business_data_workOrderId_fkey` FOREIGN KEY (`workOrderId`) REFERENCES `tecdo_work_orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tecdo_withdrawal_business_data` ADD CONSTRAINT `tecdo_withdrawal_business_data_mediaAccountId_fkey` FOREIGN KEY (`mediaAccountId`) REFERENCES `tecdo_media_accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tecdo_zeroing_business_data` ADD CONSTRAINT `tecdo_zeroing_business_data_workOrderId_fkey` FOREIGN KEY (`workOrderId`) REFERENCES `tecdo_work_orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tecdo_zeroing_business_data` ADD CONSTRAINT `tecdo_zeroing_business_data_mediaAccountId_fkey` FOREIGN KEY (`mediaAccountId`) REFERENCES `tecdo_media_accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tecdo_transfer_business_data` ADD CONSTRAINT `tecdo_transfer_business_data_workOrderId_fkey` FOREIGN KEY (`workOrderId`) REFERENCES `tecdo_work_orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tecdo_transfer_business_data` ADD CONSTRAINT `tecdo_transfer_business_data_mediaAccountId_fkey` FOREIGN KEY (`mediaAccountId`) REFERENCES `tecdo_media_accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tecdo_account_binding_data` ADD CONSTRAINT `tecdo_account_binding_data_workOrderId_fkey` FOREIGN KEY (`workOrderId`) REFERENCES `tecdo_work_orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tecdo_account_binding_data` ADD CONSTRAINT `tecdo_account_binding_data_mediaAccountId_fkey` FOREIGN KEY (`mediaAccountId`) REFERENCES `tecdo_media_accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tecdo_account_unbinding_data` ADD CONSTRAINT `tecdo_account_unbinding_data_workOrderId_fkey` FOREIGN KEY (`workOrderId`) REFERENCES `tecdo_work_orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tecdo_account_unbinding_data` ADD CONSTRAINT `tecdo_account_unbinding_data_mediaAccountId_fkey` FOREIGN KEY (`mediaAccountId`) REFERENCES `tecdo_media_accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tecdo_email_binding_data` ADD CONSTRAINT `tecdo_email_binding_data_workOrderId_fkey` FOREIGN KEY (`workOrderId`) REFERENCES `tecdo_work_orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tecdo_email_binding_data` ADD CONSTRAINT `tecdo_email_binding_data_mediaAccountId_fkey` FOREIGN KEY (`mediaAccountId`) REFERENCES `tecdo_media_accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tecdo_pixel_binding_data` ADD CONSTRAINT `tecdo_pixel_binding_data_workOrderId_fkey` FOREIGN KEY (`workOrderId`) REFERENCES `tecdo_work_orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tecdo_pixel_binding_data` ADD CONSTRAINT `tecdo_pixel_binding_data_mediaAccountId_fkey` FOREIGN KEY (`mediaAccountId`) REFERENCES `tecdo_media_accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tecdo_user_statistics` ADD CONSTRAINT `tecdo_user_statistics_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `tecdo_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tecdo_audit_logs` ADD CONSTRAINT `tecdo_audit_logs_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `tecdo_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tecdo_audit_logs` ADD CONSTRAINT `tecdo_audit_logs_workOrderId_fkey` FOREIGN KEY (`workOrderId`) REFERENCES `tecdo_work_orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tecdo_media_accounts` ADD CONSTRAINT `tecdo_media_accounts_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `tecdo_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tecdo_media_account_sync_logs` ADD CONSTRAINT `tecdo_media_account_sync_logs_mediaAccountId_fkey` FOREIGN KEY (`mediaAccountId`) REFERENCES `tecdo_media_accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

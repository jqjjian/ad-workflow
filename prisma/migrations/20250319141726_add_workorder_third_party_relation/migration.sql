-- AlterTable
ALTER TABLE `tecdo_work_orders` ADD COLUMN `thirdPartyTaskId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `ErrorLog` (
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
CREATE TABLE `StatusSyncLog` (
    `id` VARCHAR(191) NOT NULL,
    `workOrderId` VARCHAR(191) NOT NULL,
    `thirdPartyTaskId` VARCHAR(191) NULL,
    `previousStatus` VARCHAR(191) NOT NULL,
    `newStatus` VARCHAR(191) NOT NULL,
    `syncTimestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `syncDirection` VARCHAR(191) NOT NULL,
    `syncResult` VARCHAR(191) NOT NULL,
    `failureReason` TEXT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BusinessStatistics` (
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

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `tecdo_work_orders_thirdPartyTaskId_idx` ON `tecdo_work_orders`(`thirdPartyTaskId`);

-- AddForeignKey
ALTER TABLE `tecdo_work_orders` ADD CONSTRAINT `tecdo_work_orders_thirdPartyTaskId_fkey` FOREIGN KEY (`thirdPartyTaskId`) REFERENCES `tecdo_third_party_tasks`(`taskId`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StatusSyncLog` ADD CONSTRAINT `StatusSyncLog_workOrderId_fkey` FOREIGN KEY (`workOrderId`) REFERENCES `tecdo_work_orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BusinessStatistics` ADD CONSTRAINT `BusinessStatistics_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `tecdo_users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

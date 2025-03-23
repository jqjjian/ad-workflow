/*
  Warnings:

  - Made the column `completedTime` on table `tecdo_transfer_business_data` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE `tecdo_transfer_business_data` MODIFY `completedTime` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `tecdo_work_orders` ADD COLUMN `companyInfoId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `tecdo_raw_request_data` (
    `id` VARCHAR(191) NOT NULL,
    `rawDataId` VARCHAR(191) NOT NULL,
    `taskNumber` VARCHAR(191) NULL,
    `productType` INTEGER NULL,
    `currencyCode` VARCHAR(191) NULL,
    `timezone` VARCHAR(191) NULL,
    `name` VARCHAR(191) NULL,
    `rechargeAmount` VARCHAR(191) NULL,
    `rawJson` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `tecdo_raw_request_data_rawDataId_key`(`rawDataId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tecdo_user_company_info` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `companyNameCN` VARCHAR(191) NOT NULL,
    `companyNameEN` VARCHAR(191) NOT NULL,
    `businessLicenseNo` VARCHAR(191) NOT NULL,
    `location` INTEGER NOT NULL DEFAULT 1,
    `legalRepName` VARCHAR(191) NOT NULL,
    `idType` INTEGER NOT NULL,
    `idNumber` VARCHAR(191) NOT NULL,
    `legalRepPhone` VARCHAR(191) NOT NULL,
    `legalRepBankCard` VARCHAR(191) NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tecdo_user_company_attachments` (
    `id` VARCHAR(191) NOT NULL,
    `userCompanyInfoId` VARCHAR(191) NOT NULL,
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
CREATE TABLE `tecdo_workorder_company_info` (
    `id` VARCHAR(191) NOT NULL,
    `workOrderId` VARCHAR(191) NOT NULL,
    `userCompanyInfoId` VARCHAR(191) NULL,
    `companyNameCN` VARCHAR(191) NOT NULL,
    `companyNameEN` VARCHAR(191) NOT NULL,
    `businessLicenseNo` VARCHAR(191) NOT NULL,
    `location` INTEGER NOT NULL,
    `legalRepName` VARCHAR(191) NOT NULL,
    `idType` INTEGER NOT NULL,
    `idNumber` VARCHAR(191) NOT NULL,
    `legalRepPhone` VARCHAR(191) NOT NULL,
    `legalRepBankCard` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `tecdo_workorder_company_info_workOrderId_key`(`workOrderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tecdo_workorder_company_attachments` (
    `id` VARCHAR(191) NOT NULL,
    `workOrderCompanyInfoId` VARCHAR(191) NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `fileType` VARCHAR(191) NOT NULL,
    `fileSize` INTEGER NOT NULL,
    `filePath` VARCHAR(191) NOT NULL,
    `ossObjectKey` VARCHAR(191) NOT NULL,
    `fileUrl` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tecdo_company_info` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `companyNameCN` VARCHAR(191) NOT NULL,
    `companyNameEN` VARCHAR(191) NOT NULL,
    `businessLicenseNo` VARCHAR(191) NOT NULL,
    `location` INTEGER NOT NULL DEFAULT 1,
    `legalRepName` VARCHAR(191) NOT NULL,
    `idType` INTEGER NOT NULL,
    `idNumber` VARCHAR(191) NOT NULL,
    `legalRepPhone` VARCHAR(191) NOT NULL,
    `legalRepBankCard` VARCHAR(191) NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CompanyAttachment` (
    `id` VARCHAR(191) NOT NULL,
    `userCompanyInfoId` VARCHAR(191) NOT NULL,
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
    `companyInfoId` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `tecdo_work_orders` ADD CONSTRAINT `tecdo_work_orders_companyInfoId_fkey` FOREIGN KEY (`companyInfoId`) REFERENCES `tecdo_company_info`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tecdo_raw_request_data` ADD CONSTRAINT `tecdo_raw_request_data_rawDataId_fkey` FOREIGN KEY (`rawDataId`) REFERENCES `tecdo_raw_data`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tecdo_user_company_info` ADD CONSTRAINT `tecdo_user_company_info_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `tecdo_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tecdo_user_company_attachments` ADD CONSTRAINT `tecdo_user_company_attachments_userCompanyInfoId_fkey` FOREIGN KEY (`userCompanyInfoId`) REFERENCES `tecdo_user_company_info`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tecdo_workorder_company_info` ADD CONSTRAINT `tecdo_workorder_company_info_workOrderId_fkey` FOREIGN KEY (`workOrderId`) REFERENCES `tecdo_work_orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tecdo_workorder_company_info` ADD CONSTRAINT `tecdo_workorder_company_info_userCompanyInfoId_fkey` FOREIGN KEY (`userCompanyInfoId`) REFERENCES `tecdo_user_company_info`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tecdo_workorder_company_attachments` ADD CONSTRAINT `tecdo_workorder_company_attachments_workOrderCompanyInfoId_fkey` FOREIGN KEY (`workOrderCompanyInfoId`) REFERENCES `tecdo_workorder_company_info`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tecdo_company_info` ADD CONSTRAINT `tecdo_company_info_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `tecdo_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompanyAttachment` ADD CONSTRAINT `CompanyAttachment_userCompanyInfoId_fkey` FOREIGN KEY (`userCompanyInfoId`) REFERENCES `tecdo_user_company_info`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompanyAttachment` ADD CONSTRAINT `CompanyAttachment_companyInfoId_fkey` FOREIGN KEY (`companyInfoId`) REFERENCES `tecdo_company_info`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

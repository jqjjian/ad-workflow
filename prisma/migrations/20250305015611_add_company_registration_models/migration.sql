-- CreateTable
CREATE TABLE `tecdo_third_party_tasks` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `taskId` INTEGER NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `tecdo_third_party_tasks_taskId_key`(`taskId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tecdo_company_registration_details` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `taskId` INTEGER NOT NULL,
    `company_location_id` INTEGER NOT NULL,
    `legal_representative_name` VARCHAR(191) NOT NULL,
    `id_type` INTEGER NOT NULL,
    `id_number` VARCHAR(191) NOT NULL,
    `legal_representative_phone` VARCHAR(191) NOT NULL,
    `legal_representative_bank_card` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `tecdo_company_registration_details_taskId_key`(`taskId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `tecdo_third_party_tasks` ADD CONSTRAINT `tecdo_third_party_tasks_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `tecdo_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tecdo_company_registration_details` ADD CONSTRAINT `tecdo_company_registration_details_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `tecdo_third_party_tasks`(`taskId`) ON DELETE CASCADE ON UPDATE CASCADE;

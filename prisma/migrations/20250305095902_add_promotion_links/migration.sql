-- AlterTable
ALTER TABLE `tecdo_dictionaries` MODIFY `dictType` ENUM('SYSTEM', 'BUSINESS', 'USER', 'OTHER', 'PROMOTION_LINK') NOT NULL;

-- AlterTable
ALTER TABLE `tecdo_third_party_tasks` ADD COLUMN `promotionLinkId` INTEGER NULL;

-- CreateTable
CREATE TABLE `tecdo_promotion_links` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `link` TEXT NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `tecdo_promotion_links` ADD CONSTRAINT `tecdo_promotion_links_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `tecdo_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tecdo_third_party_tasks` ADD CONSTRAINT `tecdo_third_party_tasks_promotionLinkId_fkey` FOREIGN KEY (`promotionLinkId`) REFERENCES `tecdo_promotion_links`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

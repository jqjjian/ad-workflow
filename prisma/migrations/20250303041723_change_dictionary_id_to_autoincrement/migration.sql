-- CreateTable
CREATE TABLE `tecdo_users` (
    `id` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NULL,
    `name` VARCHAR(191) NULL,
    `password` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `email_verified` DATETIME(3) NULL,
    `image` VARCHAR(191) NULL,
    `role` ENUM('ADMIN', 'USER') NOT NULL DEFAULT 'USER',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `companyName` VARCHAR(191) NULL,
    `phoneNumber` VARCHAR(191) NULL,
    `areaCode` VARCHAR(191) NULL,

    UNIQUE INDEX `tecdo_users_username_key`(`username`),
    UNIQUE INDEX `tecdo_users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tecdo_accounts` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `provider_account_id` VARCHAR(191) NOT NULL,
    `refresh_token` TEXT NULL,
    `access_token` TEXT NULL,
    `expires_at` INTEGER NULL,
    `token_type` VARCHAR(191) NULL,
    `scope` VARCHAR(191) NULL,
    `id_token` TEXT NULL,
    `session_state` VARCHAR(191) NULL,
    `refresh_token_expires_in` INTEGER NULL,

    UNIQUE INDEX `tecdo_accounts_provider_provider_account_id_key`(`provider`, `provider_account_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tecdo_verification_tokens` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `expires` DATETIME(3) NOT NULL,

    UNIQUE INDEX `tecdo_verification_tokens_token_key`(`token`),
    UNIQUE INDEX `tecdo_verification_tokens_email_token_key`(`email`, `token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tecdo_dictionaries` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `dictType` ENUM('SYSTEM', 'BUSINESS', 'USER', 'OTHER') NOT NULL,
    `dictCode` VARCHAR(191) NOT NULL,
    `dictName` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `status` BOOLEAN NOT NULL DEFAULT true,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `tecdo_dictionaries_dictType_dictCode_key`(`dictType`, `dictCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tecdo_dictionary_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `dictionaryId` INTEGER NOT NULL,
    `itemCode` VARCHAR(191) NOT NULL,
    `itemName` VARCHAR(191) NOT NULL,
    `itemValue` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `status` BOOLEAN NOT NULL DEFAULT true,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `tecdo_dictionary_items_dictionaryId_itemCode_key`(`dictionaryId`, `itemCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `tecdo_accounts` ADD CONSTRAINT `tecdo_accounts_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `tecdo_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tecdo_dictionary_items` ADD CONSTRAINT `tecdo_dictionary_items_dictionaryId_fkey` FOREIGN KEY (`dictionaryId`) REFERENCES `tecdo_dictionaries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

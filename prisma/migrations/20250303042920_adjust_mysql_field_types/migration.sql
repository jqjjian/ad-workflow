/*
  Warnings:

  - You are about to alter the column `dictCode` on the `tecdo_dictionaries` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(50)`.
  - You are about to alter the column `dictName` on the `tecdo_dictionaries` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(100)`.
  - You are about to alter the column `itemCode` on the `tecdo_dictionary_items` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(50)`.
  - You are about to alter the column `itemName` on the `tecdo_dictionary_items` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(100)`.

*/
-- AlterTable
ALTER TABLE `tecdo_dictionaries` MODIFY `dictCode` VARCHAR(50) NOT NULL,
    MODIFY `dictName` VARCHAR(100) NOT NULL,
    MODIFY `description` TEXT NULL;

-- AlterTable
ALTER TABLE `tecdo_dictionary_items` MODIFY `itemCode` VARCHAR(50) NOT NULL,
    MODIFY `itemName` VARCHAR(100) NOT NULL,
    MODIFY `itemValue` VARCHAR(255) NOT NULL,
    MODIFY `description` TEXT NULL;

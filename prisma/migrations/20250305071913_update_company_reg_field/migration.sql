/*
  Warnings:

  - Added the required column `company_name` to the `tecdo_company_registration_details` table without a default value. This is not possible if the table is not empty.
  - Added the required column `company_name_en` to the `tecdo_company_registration_details` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `tecdo_company_registration_details` ADD COLUMN `company_name` VARCHAR(191) NOT NULL,
    ADD COLUMN `company_name_en` VARCHAR(191) NOT NULL;

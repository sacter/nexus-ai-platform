-- AlterTable
ALTER TABLE "api_keys" ADD COLUMN     "encryption_nonce" VARCHAR(32) NOT NULL DEFAULT '',
ADD COLUMN     "encryption_tag" VARCHAR(32) NOT NULL DEFAULT '';

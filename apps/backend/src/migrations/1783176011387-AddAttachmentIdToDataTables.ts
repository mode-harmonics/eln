import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAttachmentIdToDataTables1783176011387 implements MigrationInterface {
    name = 'AddAttachmentIdToDataTables1783176011387'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "processData" ADD "attachmentId" uuid`);
        await queryRunner.query(`COMMENT ON COLUMN "processData"."attachmentId" IS '关联附件ID'`);
        await queryRunner.query(`ALTER TABLE "calendarLife" ADD "attachmentId" uuid`);
        await queryRunner.query(`COMMENT ON COLUMN "calendarLife"."attachmentId" IS '关联附件ID'`);
        await queryRunner.query(`ALTER TABLE "rawStepData" ADD "attachmentId" uuid`);
        await queryRunner.query(`COMMENT ON COLUMN "rawStepData"."attachmentId" IS '关联附件ID'`);
        await queryRunner.query(`ALTER TABLE "storageSwelling" ADD "attachmentId" uuid`);
        await queryRunner.query(`COMMENT ON COLUMN "storageSwelling"."attachmentId" IS '关联附件ID'`);
        await queryRunner.query(`ALTER TABLE "energyEfficiency" ADD "attachmentId" uuid`);
        await queryRunner.query(`COMMENT ON COLUMN "energyEfficiency"."attachmentId" IS '关联附件ID'`);
        await queryRunner.query(`ALTER TABLE "dcrTest" ADD "attachmentId" uuid`);
        await queryRunner.query(`COMMENT ON COLUMN "dcrTest"."attachmentId" IS '关联附件ID'`);
        await queryRunner.query(`ALTER TABLE "fastCharge" ADD "attachmentId" uuid`);
        await queryRunner.query(`COMMENT ON COLUMN "fastCharge"."attachmentId" IS '关联附件ID'`);
        await queryRunner.query(`ALTER TABLE "htCycle" ADD "attachmentId" uuid`);
        await queryRunner.query(`COMMENT ON COLUMN "htCycle"."attachmentId" IS '关联附件ID'`);
        await queryRunner.query(`CREATE INDEX "IDX_b024f6e1e27264bcb8109d6d44" ON "processData" ("attachmentId") `);
        await queryRunner.query(`CREATE INDEX "IDX_4c0a1720367278f3e08441fa20" ON "calendarLife" ("attachmentId") `);
        await queryRunner.query(`CREATE INDEX "IDX_4f9b4014565b62d8c3f20785e1" ON "rawStepData" ("attachmentId") `);
        await queryRunner.query(`CREATE INDEX "IDX_e667b5e0ae74b70574e06230d9" ON "storageSwelling" ("attachmentId") `);
        await queryRunner.query(`CREATE INDEX "IDX_e82fbf0ebe3fc55ce5b539b846" ON "energyEfficiency" ("attachmentId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c649caf7b0622251228dfa284f" ON "dcrTest" ("attachmentId") `);
        await queryRunner.query(`CREATE INDEX "IDX_90b6f7848a339af2c596a99879" ON "fastCharge" ("attachmentId") `);
        await queryRunner.query(`CREATE INDEX "IDX_05af187b160d28e4914107888d" ON "htCycle" ("attachmentId") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_05af187b160d28e4914107888d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_90b6f7848a339af2c596a99879"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c649caf7b0622251228dfa284f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e82fbf0ebe3fc55ce5b539b846"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e667b5e0ae74b70574e06230d9"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4f9b4014565b62d8c3f20785e1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4c0a1720367278f3e08441fa20"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b024f6e1e27264bcb8109d6d44"`);
        await queryRunner.query(`COMMENT ON COLUMN "htCycle"."attachmentId" IS '关联附件ID'`);
        await queryRunner.query(`ALTER TABLE "htCycle" DROP COLUMN "attachmentId"`);
        await queryRunner.query(`COMMENT ON COLUMN "fastCharge"."attachmentId" IS '关联附件ID'`);
        await queryRunner.query(`ALTER TABLE "fastCharge" DROP COLUMN "attachmentId"`);
        await queryRunner.query(`COMMENT ON COLUMN "dcrTest"."attachmentId" IS '关联附件ID'`);
        await queryRunner.query(`ALTER TABLE "dcrTest" DROP COLUMN "attachmentId"`);
        await queryRunner.query(`COMMENT ON COLUMN "energyEfficiency"."attachmentId" IS '关联附件ID'`);
        await queryRunner.query(`ALTER TABLE "energyEfficiency" DROP COLUMN "attachmentId"`);
        await queryRunner.query(`COMMENT ON COLUMN "storageSwelling"."attachmentId" IS '关联附件ID'`);
        await queryRunner.query(`ALTER TABLE "storageSwelling" DROP COLUMN "attachmentId"`);
        await queryRunner.query(`COMMENT ON COLUMN "rawStepData"."attachmentId" IS '关联附件ID'`);
        await queryRunner.query(`ALTER TABLE "rawStepData" DROP COLUMN "attachmentId"`);
        await queryRunner.query(`COMMENT ON COLUMN "calendarLife"."attachmentId" IS '关联附件ID'`);
        await queryRunner.query(`ALTER TABLE "calendarLife" DROP COLUMN "attachmentId"`);
        await queryRunner.query(`COMMENT ON COLUMN "processData"."attachmentId" IS '关联附件ID'`);
        await queryRunner.query(`ALTER TABLE "processData" DROP COLUMN "attachmentId"`);
    }

}

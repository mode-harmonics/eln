import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRedundancyCountToExperimentDesign1784792714020 implements MigrationInterface {
    name = 'AddRedundancyCountToExperimentDesign1784792714020'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "experimentDesign" ADD "cellCount" integer`);
        await queryRunner.query(`COMMENT ON COLUMN "experimentDesign"."cellCount" IS '该分组的正常电池数量（默认17）'`);
        await queryRunner.query(`ALTER TABLE "experimentDesign" ADD "redundancyCount" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`COMMENT ON COLUMN "experimentDesign"."redundancyCount" IS '该分组的冗余电池数量'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`COMMENT ON COLUMN "experimentDesign"."redundancyCount" IS '该分组的冗余电池数量'`);
        await queryRunner.query(`ALTER TABLE "experimentDesign" DROP COLUMN "redundancyCount"`);
        await queryRunner.query(`COMMENT ON COLUMN "experimentDesign"."cellCount" IS '该分组的正常电池数量（默认17）'`);
        await queryRunner.query(`ALTER TABLE "experimentDesign" DROP COLUMN "cellCount"`);
    }

}

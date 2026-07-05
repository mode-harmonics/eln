import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDataSourceToRawStepData1783300000000 implements MigrationInterface {
    name = 'AddDataSourceToRawStepData1783300000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "rawStepData" ADD "dataSource" varchar(16)`);
        await queryRunner.query(`COMMENT ON COLUMN "rawStepData"."dataSource" IS '数据来源: formation(化成) / grading(定容)'`);
        await queryRunner.query(`CREATE INDEX "IDX_rawStepData_dataSource" ON "rawStepData" ("dataSource") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_rawStepData_dataSource"`);
        await queryRunner.query(`COMMENT ON COLUMN "rawStepData"."dataSource" IS '数据来源: formation(化成) / grading(定容)'`);
        await queryRunner.query(`ALTER TABLE "rawStepData" DROP COLUMN "dataSource"`);
    }

}

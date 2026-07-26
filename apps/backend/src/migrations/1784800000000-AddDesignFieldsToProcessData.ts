import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDesignFieldsToProcessData1784800000000 implements MigrationInterface {
    name = 'AddDesignFieldsToProcessData1784800000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "processData" ADD "experimentDesignId" uuid`);
        await queryRunner.query(`COMMENT ON COLUMN "processData"."experimentDesignId" IS '关联实验设计ID'`);
        await queryRunner.query(`CREATE INDEX "IDX_processData_experimentDesignId" ON "processData" ("experimentDesignId")`);

        await queryRunner.query(`ALTER TABLE "processData" ADD "groupName" character varying(128)`);
        await queryRunner.query(`COMMENT ON COLUMN "processData"."groupName" IS '实验设计分组名称'`);
        await queryRunner.query(`CREATE INDEX "IDX_processData_groupName" ON "processData" ("groupName")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_processData_groupName"`);
        await queryRunner.query(`ALTER TABLE "processData" DROP COLUMN "groupName"`);
        await queryRunner.query(`DROP INDEX "IDX_processData_experimentDesignId"`);
        await queryRunner.query(`ALTER TABLE "processData" DROP COLUMN "experimentDesignId"`);
    }
}

import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTestTypeToPickedCell1784381209489 implements MigrationInterface {
    name = 'AddTestTypeToPickedCell1784381209489'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "pickedCell" ADD "testType" character varying(64)`);
        await queryRunner.query(`COMMENT ON COLUMN "pickedCell"."testType" IS '分配的测试类型'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`COMMENT ON COLUMN "pickedCell"."testType" IS '分配的测试类型'`);
        await queryRunner.query(`ALTER TABLE "pickedCell" DROP COLUMN "testType"`);
    }

}

import { MigrationInterface, QueryRunner } from "typeorm";

export class AddHtCycleNotes1782555200000 implements MigrationInterface {
    name = 'AddHtCycleNotes1782555200000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "htCycle" ADD "notes" character varying(255)`);
        await queryRunner.query(`COMMENT ON COLUMN "htCycle"."notes" IS '备注'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`COMMENT ON COLUMN "htCycle"."notes" IS '备注'`);
        await queryRunner.query(`ALTER TABLE "htCycle" DROP COLUMN "notes"`);
    }

}

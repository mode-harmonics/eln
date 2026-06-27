import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEnergyEfficiencyDerivedFields1782554851819 implements MigrationInterface {
    name = 'AddEnergyEfficiencyDerivedFields1782554851819'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "energyEfficiency" ADD "ee" numeric(18,6)`);
        await queryRunner.query(`COMMENT ON COLUMN "energyEfficiency"."ee" IS '能量效率比 ee=de/ce'`);
        await queryRunner.query(`ALTER TABLE "energyEfficiency" ADD "eePct" numeric(18,6)`);
        await queryRunner.query(`COMMENT ON COLUMN "energyEfficiency"."eePct" IS '能量效率 eePct=de/ce*100 (%)'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`COMMENT ON COLUMN "energyEfficiency"."eePct" IS '能量效率 eePct=de/ce*100 (%)'`);
        await queryRunner.query(`ALTER TABLE "energyEfficiency" DROP COLUMN "eePct"`);
        await queryRunner.query(`COMMENT ON COLUMN "energyEfficiency"."ee" IS '能量效率比 ee=de/ce'`);
        await queryRunner.query(`ALTER TABLE "energyEfficiency" DROP COLUMN "ee"`);
    }

}

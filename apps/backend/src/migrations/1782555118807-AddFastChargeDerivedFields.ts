import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFastChargeDerivedFields1782555118807 implements MigrationInterface {
    name = 'AddFastChargeDerivedFields1782555118807'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "fastCharge" ADD "computedFastChargeTime" numeric(18,6)`);
        await queryRunner.query(`COMMENT ON COLUMN "fastCharge"."computedFastChargeTime" IS '计算10%-80%SOC快充时间 computedFastChargeTime (min)'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`COMMENT ON COLUMN "fastCharge"."computedFastChargeTime" IS '计算10%-80%SOC快充时间 computedFastChargeTime (min)'`);
        await queryRunner.query(`ALTER TABLE "fastCharge" DROP COLUMN "computedFastChargeTime"`);
    }

}

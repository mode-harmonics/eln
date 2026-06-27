import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDcrTestDerivedFields1782554526742 implements MigrationInterface {
    name = 'AddDcrTestDerivedFields1782554526742'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dcrTest" ADD "ddcr" numeric(18,6)`);
        await queryRunner.query(`COMMENT ON COLUMN "dcrTest"."ddcr" IS '放电直流内阻 ddcr=|du1-du0|/di (Ω)'`);
        await queryRunner.query(`ALTER TABLE "dcrTest" ADD "cdcr" numeric(18,6)`);
        await queryRunner.query(`COMMENT ON COLUMN "dcrTest"."cdcr" IS '充电直流内阻 cdcr=|cu1-cu0|/ci (Ω)'`);
        await queryRunner.query(`ALTER TABLE "dcrTest" ADD "dRcProduct" numeric(18,6)`);
        await queryRunner.query(`COMMENT ON COLUMN "dcrTest"."dRcProduct" IS '放电R-C乘积 dRcProduct=q0*ddcr (Ah·Ω)'`);
        await queryRunner.query(`ALTER TABLE "dcrTest" ADD "cRcProduct" numeric(18,6)`);
        await queryRunner.query(`COMMENT ON COLUMN "dcrTest"."cRcProduct" IS '充电R-C乘积 cRcProduct=q0*cdcr (Ah·Ω)'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`COMMENT ON COLUMN "dcrTest"."cRcProduct" IS '充电R-C乘积 cRcProduct=q0*cdcr (Ah·Ω)'`);
        await queryRunner.query(`ALTER TABLE "dcrTest" DROP COLUMN "cRcProduct"`);
        await queryRunner.query(`COMMENT ON COLUMN "dcrTest"."dRcProduct" IS '放电R-C乘积 dRcProduct=q0*ddcr (Ah·Ω)'`);
        await queryRunner.query(`ALTER TABLE "dcrTest" DROP COLUMN "dRcProduct"`);
        await queryRunner.query(`COMMENT ON COLUMN "dcrTest"."cdcr" IS '充电直流内阻 cdcr=|cu1-cu0|/ci (Ω)'`);
        await queryRunner.query(`ALTER TABLE "dcrTest" DROP COLUMN "cdcr"`);
        await queryRunner.query(`COMMENT ON COLUMN "dcrTest"."ddcr" IS '放电直流内阻 ddcr=|du1-du0|/di (Ω)'`);
        await queryRunner.query(`ALTER TABLE "dcrTest" DROP COLUMN "ddcr"`);
    }

}

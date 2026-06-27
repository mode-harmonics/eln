import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCalendarLifeDerivedFields1782554389068 implements MigrationInterface {
    name = 'AddCalendarLifeDerivedFields1782554389068'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "calendarLife" ADD "qRetention" numeric(18,6)`);
        await queryRunner.query(`COMMENT ON COLUMN "calendarLife"."qRetention" IS '容量保持率 qRetention=dq/q0d*100 (%)'`);
        await queryRunner.query(`ALTER TABLE "calendarLife" ADD "qRecovery" numeric(18,6)`);
        await queryRunner.query(`COMMENT ON COLUMN "calendarLife"."qRecovery" IS '容量恢复率 qRecovery=q/q0d*100 (%)'`);
        await queryRunner.query(`ALTER TABLE "calendarLife" ADD "ddcrGrowth" numeric(18,6)`);
        await queryRunner.query(`COMMENT ON COLUMN "calendarLife"."ddcrGrowth" IS '放电DCR增长 ddcrGrowth=(ddcr/ddcr0d-1)*100 (%)'`);
        await queryRunner.query(`ALTER TABLE "calendarLife" ADD "cdcrGrowth" numeric(18,6)`);
        await queryRunner.query(`COMMENT ON COLUMN "calendarLife"."cdcrGrowth" IS '充电DCR增长 cdcrGrowth=(cdcr/cdcr0d-1)*100 (%)'`);
        await queryRunner.query(`ALTER TABLE "calendarLife" ADD "uGrowth" numeric(18,6)`);
        await queryRunner.query(`COMMENT ON COLUMN "calendarLife"."uGrowth" IS '电压增长 uGrowth=(u/u0d-1)*100 (%)'`);
        await queryRunner.query(`ALTER TABLE "calendarLife" ADD "rGrowth" numeric(18,6)`);
        await queryRunner.query(`COMMENT ON COLUMN "calendarLife"."rGrowth" IS '内阻增长 rGrowth=(r/r0d-1)*100 (%)'`);
        await queryRunner.query(`COMMENT ON COLUMN "calendarLife"."q" IS '定容容量(q)'`);
        await queryRunner.query(`COMMENT ON COLUMN "calendarLife"."dq" IS '首次放电容量(dq)'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`COMMENT ON COLUMN "calendarLife"."dq" IS '容量衰减(dq)'`);
        await queryRunner.query(`COMMENT ON COLUMN "calendarLife"."q" IS '容量(q)'`);
        await queryRunner.query(`COMMENT ON COLUMN "calendarLife"."rGrowth" IS '内阻增长 rGrowth=(r/r0d-1)*100 (%)'`);
        await queryRunner.query(`ALTER TABLE "calendarLife" DROP COLUMN "rGrowth"`);
        await queryRunner.query(`COMMENT ON COLUMN "calendarLife"."uGrowth" IS '电压增长 uGrowth=(u/u0d-1)*100 (%)'`);
        await queryRunner.query(`ALTER TABLE "calendarLife" DROP COLUMN "uGrowth"`);
        await queryRunner.query(`COMMENT ON COLUMN "calendarLife"."cdcrGrowth" IS '充电DCR增长 cdcrGrowth=(cdcr/cdcr0d-1)*100 (%)'`);
        await queryRunner.query(`ALTER TABLE "calendarLife" DROP COLUMN "cdcrGrowth"`);
        await queryRunner.query(`COMMENT ON COLUMN "calendarLife"."ddcrGrowth" IS '放电DCR增长 ddcrGrowth=(ddcr/ddcr0d-1)*100 (%)'`);
        await queryRunner.query(`ALTER TABLE "calendarLife" DROP COLUMN "ddcrGrowth"`);
        await queryRunner.query(`COMMENT ON COLUMN "calendarLife"."qRecovery" IS '容量恢复率 qRecovery=q/q0d*100 (%)'`);
        await queryRunner.query(`ALTER TABLE "calendarLife" DROP COLUMN "qRecovery"`);
        await queryRunner.query(`COMMENT ON COLUMN "calendarLife"."qRetention" IS '容量保持率 qRetention=dq/q0d*100 (%)'`);
        await queryRunner.query(`ALTER TABLE "calendarLife" DROP COLUMN "qRetention"`);
    }

}

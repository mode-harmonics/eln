import { MigrationInterface, QueryRunner } from "typeorm";

export class AddProcessDataDerivedFields1782554162868 implements MigrationInterface {
    name = 'AddProcessDataDerivedFields1782554162868'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "processData" ADD "mIn" numeric(18,6)`);
        await queryRunner.query(`COMMENT ON COLUMN "processData"."mIn" IS '注液量 mIn=m1-m0 (g)'`);
        await queryRunner.query(`ALTER TABLE "processData" ADD "mLoss" numeric(18,6)`);
        await queryRunner.query(`COMMENT ON COLUMN "processData"."mLoss" IS '失液量 mLoss=m1-m2 (g)'`);
        await queryRunner.query(`ALTER TABLE "processData" ADD "mHold" numeric(18,6)`);
        await queryRunner.query(`COMMENT ON COLUMN "processData"."mHold" IS '保液量 mHold=m4-m0 (g)'`);
        await queryRunner.query(`ALTER TABLE "processData" ADD "fq" numeric(18,6)`);
        await queryRunner.query(`COMMENT ON COLUMN "processData"."fq" IS '化成充总容量 fq=fq1+fq2 (Ah)'`);
        await queryRunner.query(`ALTER TABLE "processData" ADD "qdFirst" numeric(18,6)`);
        await queryRunner.query(`COMMENT ON COLUMN "processData"."qdFirst" IS '首次放电容量 qdFirst=gqd1 (Ah)'`);
        await queryRunner.query(`ALTER TABLE "processData" ADD "fvg" numeric(18,6)`);
        await queryRunner.query(`COMMENT ON COLUMN "processData"."fvg" IS '化成产气量 fvg=(v1-v0)/qdFirst (mL/Ah)'`);
        await queryRunner.query(`ALTER TABLE "processData" ADD "ku" numeric(18,6)`);
        await queryRunner.query(`COMMENT ON COLUMN "processData"."ku" IS '老化电压降 ku=fu1-fu2 (V)'`);
        await queryRunner.query(`ALTER TABLE "processData" ADD "qcFirst" numeric(18,6)`);
        await queryRunner.query(`COMMENT ON COLUMN "processData"."qcFirst" IS '首次充电容量 qcFirst=fq+gqc1 (Ah)'`);
        await queryRunner.query(`ALTER TABLE "processData" ADD "ceFirst" numeric(18,6)`);
        await queryRunner.query(`COMMENT ON COLUMN "processData"."ceFirst" IS '首圈库比效率 ceFirst=qdFirst/qcFirst*100 (%)'`);
        await queryRunner.query(`ALTER TABLE "processData" ADD "picked" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`COMMENT ON COLUMN "processData"."picked" IS '是否挑选为良品'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`COMMENT ON COLUMN "processData"."picked" IS '是否挑选为良品'`);
        await queryRunner.query(`ALTER TABLE "processData" DROP COLUMN "picked"`);
        await queryRunner.query(`COMMENT ON COLUMN "processData"."ceFirst" IS '首圈库比效率 ceFirst=qdFirst/qcFirst*100 (%)'`);
        await queryRunner.query(`ALTER TABLE "processData" DROP COLUMN "ceFirst"`);
        await queryRunner.query(`COMMENT ON COLUMN "processData"."qcFirst" IS '首次充电容量 qcFirst=fq+gqc1 (Ah)'`);
        await queryRunner.query(`ALTER TABLE "processData" DROP COLUMN "qcFirst"`);
        await queryRunner.query(`COMMENT ON COLUMN "processData"."ku" IS '老化电压降 ku=fu1-fu2 (V)'`);
        await queryRunner.query(`ALTER TABLE "processData" DROP COLUMN "ku"`);
        await queryRunner.query(`COMMENT ON COLUMN "processData"."fvg" IS '化成产气量 fvg=(v1-v0)/qdFirst (mL/Ah)'`);
        await queryRunner.query(`ALTER TABLE "processData" DROP COLUMN "fvg"`);
        await queryRunner.query(`COMMENT ON COLUMN "processData"."qdFirst" IS '首次放电容量 qdFirst=gqd1 (Ah)'`);
        await queryRunner.query(`ALTER TABLE "processData" DROP COLUMN "qdFirst"`);
        await queryRunner.query(`COMMENT ON COLUMN "processData"."fq" IS '化成充总容量 fq=fq1+fq2 (Ah)'`);
        await queryRunner.query(`ALTER TABLE "processData" DROP COLUMN "fq"`);
        await queryRunner.query(`COMMENT ON COLUMN "processData"."mHold" IS '保液量 mHold=m4-m0 (g)'`);
        await queryRunner.query(`ALTER TABLE "processData" DROP COLUMN "mHold"`);
        await queryRunner.query(`COMMENT ON COLUMN "processData"."mLoss" IS '失液量 mLoss=m1-m2 (g)'`);
        await queryRunner.query(`ALTER TABLE "processData" DROP COLUMN "mLoss"`);
        await queryRunner.query(`COMMENT ON COLUMN "processData"."mIn" IS '注液量 mIn=m1-m0 (g)'`);
        await queryRunner.query(`ALTER TABLE "processData" DROP COLUMN "mIn"`);
    }

}

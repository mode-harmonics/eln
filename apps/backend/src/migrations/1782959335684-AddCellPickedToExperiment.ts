import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCellPickedToExperiment1782959335684 implements MigrationInterface {
    name = 'AddCellPickedToExperiment1782959335684'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_cell_group_projectId"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_cell_group_member_groupId"`);
        await queryRunner.query(`CREATE TABLE "rawStepData" ("id" uuid NOT NULL, "experimentId" uuid NOT NULL, "cellName" character varying(64) NOT NULL, "cycleNo" integer NOT NULL, "stepNo" integer NOT NULL, "stepSeqNo" integer NOT NULL, "stepType" character varying(32) NOT NULL, "stepTime" character varying(16), "capacity" numeric(18,6), "startVoltage" numeric(18,6), "endVoltage" numeric(18,6), "startCurrent" numeric(18,6), "endCurrent" numeric(18,6), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_fc062b38833a233a3cc9cc4e8f7" PRIMARY KEY ("id")); COMMENT ON COLUMN "rawStepData"."id" IS '主键ID'; COMMENT ON COLUMN "rawStepData"."experimentId" IS '实验ID'; COMMENT ON COLUMN "rawStepData"."cellName" IS '电芯名称'; COMMENT ON COLUMN "rawStepData"."cycleNo" IS '循环号'; COMMENT ON COLUMN "rawStepData"."stepNo" IS '工步号'; COMMENT ON COLUMN "rawStepData"."stepSeqNo" IS '工步序号'; COMMENT ON COLUMN "rawStepData"."stepType" IS '工步类型'; COMMENT ON COLUMN "rawStepData"."stepTime" IS '工步时间'; COMMENT ON COLUMN "rawStepData"."capacity" IS '容量/能量'; COMMENT ON COLUMN "rawStepData"."startVoltage" IS '起始电压(V)'; COMMENT ON COLUMN "rawStepData"."endVoltage" IS '结束电压(V)'; COMMENT ON COLUMN "rawStepData"."startCurrent" IS '起始电流(A)'; COMMENT ON COLUMN "rawStepData"."endCurrent" IS '结束电流(A)'; COMMENT ON COLUMN "rawStepData"."createdAt" IS '创建时间'`);
        await queryRunner.query(`CREATE INDEX "IDX_786e9f48414b0f70f51368c3de" ON "rawStepData" ("experimentId") `);
        await queryRunner.query(`CREATE INDEX "IDX_d0fb78053c39b6e8dfe07da46d" ON "rawStepData" ("cellName") `);
        await queryRunner.query(`COMMENT ON TABLE "rawStepData" IS '原始工步数据表'`);
        await queryRunner.query(`CREATE TABLE "pickedCell" ("id" uuid NOT NULL, "experimentId" uuid NOT NULL, "cellId" character varying(64) NOT NULL, "pickedBy" character varying(16) NOT NULL DEFAULT 'auto', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_cf6b7b9b12448fd5740a21b581d" PRIMARY KEY ("id")); COMMENT ON COLUMN "pickedCell"."id" IS '主键ID'; COMMENT ON COLUMN "pickedCell"."experimentId" IS '实验ID'; COMMENT ON COLUMN "pickedCell"."cellId" IS '电芯编号'; COMMENT ON COLUMN "pickedCell"."pickedBy" IS '挑选方式(auto/manual)'; COMMENT ON COLUMN "pickedCell"."createdAt" IS '创建时间'`);
        await queryRunner.query(`CREATE INDEX "IDX_9b8f1ec240e5cc2eb1ab1847a0" ON "pickedCell" ("experimentId") `);
        await queryRunner.query(`CREATE INDEX "IDX_3b84118947015ad7fa6e55f29b" ON "pickedCell" ("cellId") `);
        await queryRunner.query(`COMMENT ON TABLE "pickedCell" IS '电池挑选记录表'`);
        await queryRunner.query(`ALTER TABLE "experiment" ADD "cellPicked" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`COMMENT ON COLUMN "experiment"."cellPicked" IS '是否已完成电池挑选'`);
        await queryRunner.query(`COMMENT ON COLUMN "cellGroup"."name" IS '分组名称（如 "方案A", "对照组"）'`);
        await queryRunner.query(`COMMENT ON COLUMN "cellGroup"."color" IS '十六进制色值（如 "#1d74f5"）'`);
        await queryRunner.query(`COMMENT ON COLUMN "cellGroup"."matchValue" IS '前缀模式下存前缀值; manual 模式下为空'`);
        await queryRunner.query(`COMMENT ON COLUMN "cellGroupMember"."cellIdentifier" IS '电芯标识符（cellName 或 cellId）'`);
        await queryRunner.query(`CREATE INDEX "IDX_6d629a63241556d5bb727fd624" ON "cellGroup" ("projectId") `);
        await queryRunner.query(`CREATE INDEX "IDX_54c9767f16a334c9f7fcab0529" ON "cellGroupMember" ("groupId") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_54c9767f16a334c9f7fcab0529"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6d629a63241556d5bb727fd624"`);
        await queryRunner.query(`COMMENT ON COLUMN "cellGroupMember"."cellIdentifier" IS '电芯标识符'`);
        await queryRunner.query(`COMMENT ON COLUMN "cellGroup"."matchValue" IS '前缀值'`);
        await queryRunner.query(`COMMENT ON COLUMN "cellGroup"."color" IS '十六进制色值'`);
        await queryRunner.query(`COMMENT ON COLUMN "cellGroup"."name" IS '分组名称'`);
        await queryRunner.query(`COMMENT ON COLUMN "experiment"."cellPicked" IS '是否已完成电池挑选'`);
        await queryRunner.query(`ALTER TABLE "experiment" DROP COLUMN "cellPicked"`);
        await queryRunner.query(`COMMENT ON TABLE "pickedCell" IS NULL`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3b84118947015ad7fa6e55f29b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9b8f1ec240e5cc2eb1ab1847a0"`);
        await queryRunner.query(`DROP TABLE "pickedCell"`);
        await queryRunner.query(`COMMENT ON TABLE "rawStepData" IS NULL`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d0fb78053c39b6e8dfe07da46d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_786e9f48414b0f70f51368c3de"`);
        await queryRunner.query(`DROP TABLE "rawStepData"`);
        await queryRunner.query(`CREATE INDEX "IDX_cell_group_member_groupId" ON "cellGroupMember" ("groupId") `);
        await queryRunner.query(`CREATE INDEX "IDX_cell_group_projectId" ON "cellGroup" ("projectId") `);
    }

}

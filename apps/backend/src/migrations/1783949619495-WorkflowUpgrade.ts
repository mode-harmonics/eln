import { MigrationInterface, QueryRunner } from "typeorm";

export class WorkflowUpgrade1783949619495 implements MigrationInterface {
    name = 'WorkflowUpgrade1783949619495'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_rawStepData_dataSource"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_pickedCell_projectId"`);
        await queryRunner.query(`CREATE TABLE "workflowTemplate" ("id" uuid NOT NULL, "name" character varying(128) NOT NULL, "description" text, "isDefault" boolean NOT NULL DEFAULT false, "steps" jsonb NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_8d76d84196c57d61a68bee05476" PRIMARY KEY ("id")); COMMENT ON COLUMN "workflowTemplate"."id" IS '主键ID'; COMMENT ON COLUMN "workflowTemplate"."name" IS '模板名称'; COMMENT ON COLUMN "workflowTemplate"."description" IS '模板描述'; COMMENT ON COLUMN "workflowTemplate"."isDefault" IS '是否系统内置默认模板'; COMMENT ON COLUMN "workflowTemplate"."steps" IS '步骤定义数组'; COMMENT ON COLUMN "workflowTemplate"."createdAt" IS '创建时间'`);
        await queryRunner.query(`COMMENT ON TABLE "workflowTemplate" IS '流程模板表'`);
        await queryRunner.query(`CREATE TABLE "workflowInstance" ("id" uuid NOT NULL, "projectId" uuid NOT NULL, "templateId" uuid NOT NULL, "status" character varying(32) NOT NULL DEFAULT 'Active', "currentStepIndex" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_fad03237c3870d17c0cc5807dd0" PRIMARY KEY ("id")); COMMENT ON COLUMN "workflowInstance"."id" IS '主键ID'; COMMENT ON COLUMN "workflowInstance"."projectId" IS '项目ID'; COMMENT ON COLUMN "workflowInstance"."templateId" IS '模板ID'; COMMENT ON COLUMN "workflowInstance"."status" IS '状态(Active/Completed/Paused)'; COMMENT ON COLUMN "workflowInstance"."currentStepIndex" IS '当前步骤索引'; COMMENT ON COLUMN "workflowInstance"."createdAt" IS '创建时间'`);
        await queryRunner.query(`CREATE INDEX "IDX_b98a830d9738b7375f031d94c1" ON "workflowInstance" ("projectId") `);
        await queryRunner.query(`CREATE INDEX "IDX_18fd73aa1edb4f98cf218e850a" ON "workflowInstance" ("templateId") `);
        await queryRunner.query(`COMMENT ON TABLE "workflowInstance" IS '流程实例表'`);
        await queryRunner.query(`CREATE TABLE "workflowStepAssignment" ("id" uuid NOT NULL, "workflowInstanceId" uuid NOT NULL, "stepName" character varying(64) NOT NULL, "stepIndex" integer NOT NULL, "assignedUserId" uuid, "status" character varying(32) NOT NULL DEFAULT 'pending', "canViewOtherSteps" boolean NOT NULL DEFAULT false, "canViewInternalCode" boolean NOT NULL DEFAULT false, "completedAt" TIMESTAMP, "completedBy" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_87dba81143a1752964005283f99" PRIMARY KEY ("id")); COMMENT ON COLUMN "workflowStepAssignment"."id" IS '主键ID'; COMMENT ON COLUMN "workflowStepAssignment"."workflowInstanceId" IS '流程实例ID'; COMMENT ON COLUMN "workflowStepAssignment"."stepName" IS '步骤名称(key)'; COMMENT ON COLUMN "workflowStepAssignment"."stepIndex" IS '步骤序号'; COMMENT ON COLUMN "workflowStepAssignment"."assignedUserId" IS '分配执行人ID'; COMMENT ON COLUMN "workflowStepAssignment"."status" IS '步骤状态(pending/in_progress/completed/skipped)'; COMMENT ON COLUMN "workflowStepAssignment"."canViewOtherSteps" IS '能否查看其他步骤'; COMMENT ON COLUMN "workflowStepAssignment"."canViewInternalCode" IS '能否查看内部代码'; COMMENT ON COLUMN "workflowStepAssignment"."completedAt" IS '完成时间'; COMMENT ON COLUMN "workflowStepAssignment"."completedBy" IS '完成人ID'; COMMENT ON COLUMN "workflowStepAssignment"."createdAt" IS '创建时间'`);
        await queryRunner.query(`CREATE INDEX "IDX_a95f7b90333f01089f76330136" ON "workflowStepAssignment" ("workflowInstanceId") `);
        await queryRunner.query(`CREATE INDEX "IDX_56ba349d31e3c36e7a4ce88c68" ON "workflowStepAssignment" ("stepIndex") `);
        await queryRunner.query(`CREATE INDEX "IDX_5809f5bb4cd206f29f3e88efea" ON "workflowStepAssignment" ("assignedUserId") `);
        await queryRunner.query(`COMMENT ON TABLE "workflowStepAssignment" IS '流程步骤分配表'`);
        await queryRunner.query(`CREATE TABLE "experimentDesign" ("id" uuid NOT NULL, "projectId" uuid NOT NULL, "rowIndex" integer NOT NULL, "group" character varying(128) NOT NULL, "moleculeName" character varying(255) NOT NULL, "chineseName" character varying(128), "molecularStructure" text, "cas" character varying(64) NOT NULL, "designPrinciple" text, "internalCode" character varying(128) NOT NULL, "isRedundancy" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_361b0e62539a89932a54403f187" PRIMARY KEY ("id")); COMMENT ON COLUMN "experimentDesign"."id" IS '主键ID'; COMMENT ON COLUMN "experimentDesign"."projectId" IS '项目ID'; COMMENT ON COLUMN "experimentDesign"."rowIndex" IS '行序号'; COMMENT ON COLUMN "experimentDesign"."group" IS '分组'; COMMENT ON COLUMN "experimentDesign"."moleculeName" IS '分子名称'; COMMENT ON COLUMN "experimentDesign"."chineseName" IS '中文简称'; COMMENT ON COLUMN "experimentDesign"."molecularStructure" IS '分子结构图URL'; COMMENT ON COLUMN "experimentDesign"."cas" IS 'CAS号'; COMMENT ON COLUMN "experimentDesign"."designPrinciple" IS '设计原理'; COMMENT ON COLUMN "experimentDesign"."internalCode" IS '内部代码(自动生成)'; COMMENT ON COLUMN "experimentDesign"."isRedundancy" IS '是否为冗余行'; COMMENT ON COLUMN "experimentDesign"."createdAt" IS '创建时间'`);
        await queryRunner.query(`CREATE INDEX "IDX_ef0d2789fd7256c332b4d2bdc0" ON "experimentDesign" ("projectId") `);
        await queryRunner.query(`COMMENT ON TABLE "experimentDesign" IS '实验设计表'`);
        await queryRunner.query(`CREATE TABLE "reagentProcurement" ("id" uuid NOT NULL, "projectId" uuid NOT NULL, "experimentDesignId" uuid, "moleculeName" character varying(255) NOT NULL, "supplier" character varying(255), "batchNo" character varying(128), "purity" character varying(64), "quantity" character varying(64), "isValid" boolean NOT NULL DEFAULT true, "remark" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_dd3b9f8a8125a662f0087cde720" PRIMARY KEY ("id")); COMMENT ON COLUMN "reagentProcurement"."id" IS '主键ID'; COMMENT ON COLUMN "reagentProcurement"."projectId" IS '项目ID'; COMMENT ON COLUMN "reagentProcurement"."experimentDesignId" IS '关联实验设计ID'; COMMENT ON COLUMN "reagentProcurement"."moleculeName" IS '分子名称'; COMMENT ON COLUMN "reagentProcurement"."supplier" IS '供应商'; COMMENT ON COLUMN "reagentProcurement"."batchNo" IS '批号'; COMMENT ON COLUMN "reagentProcurement"."purity" IS '纯度'; COMMENT ON COLUMN "reagentProcurement"."quantity" IS '数量'; COMMENT ON COLUMN "reagentProcurement"."isValid" IS '是否有效(采购到)'; COMMENT ON COLUMN "reagentProcurement"."remark" IS '备注'; COMMENT ON COLUMN "reagentProcurement"."createdAt" IS '创建时间'`);
        await queryRunner.query(`CREATE INDEX "IDX_893d1e08ac57393bc553797745" ON "reagentProcurement" ("projectId") `);
        await queryRunner.query(`COMMENT ON TABLE "reagentProcurement" IS '试剂采购表'`);
        await queryRunner.query(`CREATE TABLE "summaryData" ("id" uuid NOT NULL, "experimentId" uuid NOT NULL, "dataType" character varying(32) NOT NULL, "attachmentId" uuid, "data" jsonb NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a16b37793095e5677255394992f" PRIMARY KEY ("id")); COMMENT ON COLUMN "summaryData"."id" IS '主键ID'; COMMENT ON COLUMN "summaryData"."experimentId" IS '实验ID'; COMMENT ON COLUMN "summaryData"."dataType" IS '数据类型(calendar/swelling/efficiency/dcr/fastcharge/htcycle)'; COMMENT ON COLUMN "summaryData"."attachmentId" IS '关联附件ID'; COMMENT ON COLUMN "summaryData"."data" IS '汇总数据内容'; COMMENT ON COLUMN "summaryData"."createdAt" IS '创建时间'`);
        await queryRunner.query(`CREATE INDEX "IDX_2fcd996caa06c4504694944801" ON "summaryData" ("experimentId") `);
        await queryRunner.query(`COMMENT ON TABLE "summaryData" IS '汇总数据表'`);
        await queryRunner.query(`ALTER TABLE "project" ADD "workflowInstanceId" uuid`);
        await queryRunner.query(`COMMENT ON COLUMN "project"."workflowInstanceId" IS '关联流程实例ID'`);
        await queryRunner.query(`ALTER TABLE "project" ADD "workflowStatus" character varying(32)`);
        await queryRunner.query(`COMMENT ON COLUMN "project"."workflowStatus" IS '工作流状态(冗余快速查询)'`);
        await queryRunner.query(`ALTER TABLE "project" ADD "defaultCellCount" integer NOT NULL DEFAULT '17'`);
        await queryRunner.query(`COMMENT ON COLUMN "project"."defaultCellCount" IS '默认挑选电池数'`);
        await queryRunner.query(`ALTER TABLE "experiment" ADD "workflowStepName" character varying(64)`);
        await queryRunner.query(`COMMENT ON COLUMN "experiment"."workflowStepName" IS '关联流程步骤名称'`);
        await queryRunner.query(`COMMENT ON COLUMN "pickedCell"."projectId" IS '项目ID'`);
        await queryRunner.query(`CREATE INDEX "IDX_2dc881566db51356dbba057458" ON "project" ("workflowInstanceId") `);
        await queryRunner.query(`CREATE INDEX "IDX_30324211158baaabfe9d1ee99d" ON "rawStepData" ("dataSource") `);
        await queryRunner.query(`CREATE INDEX "IDX_773a1cd1d1b95667c2adb14306" ON "pickedCell" ("projectId") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_773a1cd1d1b95667c2adb14306"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_30324211158baaabfe9d1ee99d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2dc881566db51356dbba057458"`);
        await queryRunner.query(`COMMENT ON COLUMN "pickedCell"."projectId" IS NULL`);
        await queryRunner.query(`COMMENT ON COLUMN "experiment"."workflowStepName" IS '关联流程步骤名称'`);
        await queryRunner.query(`ALTER TABLE "experiment" DROP COLUMN "workflowStepName"`);
        await queryRunner.query(`COMMENT ON COLUMN "project"."defaultCellCount" IS '默认挑选电池数'`);
        await queryRunner.query(`ALTER TABLE "project" DROP COLUMN "defaultCellCount"`);
        await queryRunner.query(`COMMENT ON COLUMN "project"."workflowStatus" IS '工作流状态(冗余快速查询)'`);
        await queryRunner.query(`ALTER TABLE "project" DROP COLUMN "workflowStatus"`);
        await queryRunner.query(`COMMENT ON COLUMN "project"."workflowInstanceId" IS '关联流程实例ID'`);
        await queryRunner.query(`ALTER TABLE "project" DROP COLUMN "workflowInstanceId"`);
        await queryRunner.query(`COMMENT ON TABLE "summaryData" IS NULL`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2fcd996caa06c4504694944801"`);
        await queryRunner.query(`DROP TABLE "summaryData"`);
        await queryRunner.query(`COMMENT ON TABLE "reagentProcurement" IS NULL`);
        await queryRunner.query(`DROP INDEX "public"."IDX_893d1e08ac57393bc553797745"`);
        await queryRunner.query(`DROP TABLE "reagentProcurement"`);
        await queryRunner.query(`COMMENT ON TABLE "experimentDesign" IS NULL`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ef0d2789fd7256c332b4d2bdc0"`);
        await queryRunner.query(`DROP TABLE "experimentDesign"`);
        await queryRunner.query(`COMMENT ON TABLE "workflowStepAssignment" IS NULL`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5809f5bb4cd206f29f3e88efea"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_56ba349d31e3c36e7a4ce88c68"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a95f7b90333f01089f76330136"`);
        await queryRunner.query(`DROP TABLE "workflowStepAssignment"`);
        await queryRunner.query(`COMMENT ON TABLE "workflowInstance" IS NULL`);
        await queryRunner.query(`DROP INDEX "public"."IDX_18fd73aa1edb4f98cf218e850a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b98a830d9738b7375f031d94c1"`);
        await queryRunner.query(`DROP TABLE "workflowInstance"`);
        await queryRunner.query(`COMMENT ON TABLE "workflowTemplate" IS NULL`);
        await queryRunner.query(`DROP TABLE "workflowTemplate"`);
        await queryRunner.query(`CREATE INDEX "IDX_pickedCell_projectId" ON "pickedCell" ("projectId") `);
        await queryRunner.query(`CREATE INDEX "IDX_rawStepData_dataSource" ON "rawStepData" ("dataSource") `);
    }

}

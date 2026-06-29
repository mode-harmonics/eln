import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCellGroups1743291000000 implements MigrationInterface {
    name = 'AddCellGroups1743291000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // cellGroup — 电池分组定义表
        await queryRunner.query(`CREATE TABLE "cellGroup" ("id" uuid NOT NULL, "projectId" uuid NOT NULL, "name" character varying(64) NOT NULL, "color" character varying(9) NOT NULL, "sortOrder" integer NOT NULL DEFAULT '0', "matchMode" character varying(16) NOT NULL, "matchValue" character varying(128), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_cell_group_id" PRIMARY KEY ("id")); COMMENT ON COLUMN "cellGroup"."id" IS '主键ID'; COMMENT ON COLUMN "cellGroup"."projectId" IS '项目ID'; COMMENT ON COLUMN "cellGroup"."name" IS '分组名称'; COMMENT ON COLUMN "cellGroup"."color" IS '十六进制色值'; COMMENT ON COLUMN "cellGroup"."sortOrder" IS '排序权重'; COMMENT ON COLUMN "cellGroup"."matchMode" IS '匹配模式: prefix | manual'; COMMENT ON COLUMN "cellGroup"."matchValue" IS '前缀值'; COMMENT ON COLUMN "cellGroup"."createdAt" IS '创建时间'`);
        await queryRunner.query(`CREATE INDEX "IDX_cell_group_projectId" ON "cellGroup" ("projectId") `);
        await queryRunner.query(`COMMENT ON TABLE "cellGroup" IS '电池分组定义表'`);

        // cellGroupMember — 手动分组电芯表
        await queryRunner.query(`CREATE TABLE "cellGroupMember" ("id" uuid NOT NULL, "groupId" uuid NOT NULL, "cellIdentifier" character varying(128) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_cell_group_member_id" PRIMARY KEY ("id")); COMMENT ON COLUMN "cellGroupMember"."id" IS '主键ID'; COMMENT ON COLUMN "cellGroupMember"."groupId" IS '分组ID'; COMMENT ON COLUMN "cellGroupMember"."cellIdentifier" IS '电芯标识符'; COMMENT ON COLUMN "cellGroupMember"."createdAt" IS '创建时间'`);
        await queryRunner.query(`CREATE INDEX "IDX_cell_group_member_groupId" ON "cellGroupMember" ("groupId") `);
        await queryRunner.query(`COMMENT ON TABLE "cellGroupMember" IS '手动分组电芯表'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "cellGroupMember"`);
        await queryRunner.query(`DROP TABLE "cellGroup"`);
    }
}

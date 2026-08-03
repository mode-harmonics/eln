import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Create scrappedCell table — 电池报废记录表.
 *
 * Project-scoped records marking individual batteries as scrapped.
 * Scrapped cells are excluded from picking / charts / summaries / exports.
 */
export class CreateScrappedCellTable1791000000000 implements MigrationInterface {
    name = 'CreateScrappedCellTable1791000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "scrappedCell" ("id" uuid NOT NULL, "projectId" uuid NOT NULL, "cellId" character varying(64) NOT NULL, "reason" text, "scrappedBy" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_scrappedCell" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_scrappedCell_projectId" ON "scrappedCell" ("projectId") `);
        await queryRunner.query(`CREATE INDEX "IDX_scrappedCell_cellId" ON "scrappedCell" ("cellId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_scrappedCell_project_cell" ON "scrappedCell" ("projectId", "cellId") `);
        await queryRunner.query(`COMMENT ON TABLE "scrappedCell" IS '电池报废记录表'`);
        await queryRunner.query(`COMMENT ON COLUMN "scrappedCell"."id" IS '主键ID'`);
        await queryRunner.query(`COMMENT ON COLUMN "scrappedCell"."projectId" IS '项目ID'`);
        await queryRunner.query(`COMMENT ON COLUMN "scrappedCell"."cellId" IS '电池编号'`);
        await queryRunner.query(`COMMENT ON COLUMN "scrappedCell"."reason" IS '报废原因'`);
        await queryRunner.query(`COMMENT ON COLUMN "scrappedCell"."scrappedBy" IS '报废操作人ID'`);
        await queryRunner.query(`COMMENT ON COLUMN "scrappedCell"."createdAt" IS '创建时间'`);
        await queryRunner.query(`COMMENT ON COLUMN "scrappedCell"."updatedAt" IS '更新时间'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "scrappedCell"`);
    }
}

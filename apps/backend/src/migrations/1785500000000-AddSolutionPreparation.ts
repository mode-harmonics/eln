import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSolutionPreparation1785500000000 implements MigrationInterface {
    name = 'AddSolutionPreparation1785500000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "solutionPreparation" (
                "id" uuid NOT NULL,
                "experimentId" uuid NOT NULL,
                "groupName" character varying(128) NOT NULL,
                "materialName" character varying(255) NOT NULL,
                "specification" character varying(255),
                "formulaAmount" numeric(18,6),
                "actualAmount" numeric(18,6),
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_solutionPreparation" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`COMMENT ON TABLE "solutionPreparation" IS '配液表'`);
        await queryRunner.query(`COMMENT ON COLUMN "solutionPreparation"."id" IS '主键ID'`);
        await queryRunner.query(`COMMENT ON COLUMN "solutionPreparation"."experimentId" IS '实验ID'`);
        await queryRunner.query(`COMMENT ON COLUMN "solutionPreparation"."groupName" IS '配方名称(对应实验设计分组)'`);
        await queryRunner.query(`COMMENT ON COLUMN "solutionPreparation"."materialName" IS '物料名称'`);
        await queryRunner.query(`COMMENT ON COLUMN "solutionPreparation"."specification" IS '规格/纯度'`);
        await queryRunner.query(`COMMENT ON COLUMN "solutionPreparation"."formulaAmount" IS '配方添加量(g)'`);
        await queryRunner.query(`COMMENT ON COLUMN "solutionPreparation"."actualAmount" IS '实际添加量(g)'`);
        await queryRunner.query(`COMMENT ON COLUMN "solutionPreparation"."createdAt" IS '创建时间'`);

        await queryRunner.query(`CREATE INDEX "IDX_solutionPreparation_experimentId" ON "solutionPreparation" ("experimentId")`);
        await queryRunner.query(`CREATE INDEX "IDX_solutionPreparation_groupName" ON "solutionPreparation" ("groupName")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_solutionPreparation_groupName"`);
        await queryRunner.query(`DROP INDEX "IDX_solutionPreparation_experimentId"`);
        await queryRunner.query(`DROP TABLE "solutionPreparation"`);
    }
}

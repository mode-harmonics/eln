import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSolutionPreparationGroup1795000000002 implements MigrationInterface {
  name = 'CreateSolutionPreparationGroup1795000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "solutionPreparationGroup" ("id" uuid NOT NULL, "experimentId" uuid NOT NULL, "groupName" character varying(128) NOT NULL, "formulaInfo" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_solutionPreparationGroup_experiment_group" UNIQUE ("experimentId", "groupName"), CONSTRAINT "PK_solutionPreparationGroup" PRIMARY KEY ("id"))`);
    await queryRunner.query(`COMMENT ON TABLE "solutionPreparationGroup" IS '配液分组信息表'`);
    await queryRunner.query(`COMMENT ON COLUMN "solutionPreparationGroup"."formulaInfo" IS '配方信息'`);
    await queryRunner.query(`CREATE INDEX "IDX_solutionPreparationGroup_experiment" ON "solutionPreparationGroup" ("experimentId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_solutionPreparationGroup_experiment"`);
    await queryRunner.query(`DROP TABLE "solutionPreparationGroup"`);
  }
}

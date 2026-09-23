import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateScrappedSolutionGroup1795000000001 implements MigrationInterface {
  name = 'CreateScrappedSolutionGroup1795000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "scrappedSolutionGroup" ("id" uuid NOT NULL, "experimentId" uuid NOT NULL, "groupName" character varying(128) NOT NULL, "reason" text, "scrappedBy" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_scrappedSolutionGroup_experiment_group" UNIQUE ("experimentId", "groupName"), CONSTRAINT "PK_scrappedSolutionGroup" PRIMARY KEY ("id"))`);
    await queryRunner.query(`COMMENT ON TABLE "scrappedSolutionGroup" IS '配液分组报废记录表'`);
    await queryRunner.query(`CREATE INDEX "IDX_scrappedSolutionGroup_experiment" ON "scrappedSolutionGroup" ("experimentId")`);
    await queryRunner.query(`CREATE INDEX "IDX_scrappedSolutionGroup_group" ON "scrappedSolutionGroup" ("groupName")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_scrappedSolutionGroup_group"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_scrappedSolutionGroup_experiment"`);
    await queryRunner.query(`DROP TABLE "scrappedSolutionGroup"`);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIronDissolutionStage1795000000000 implements MigrationInterface {
  name = 'AddIronDissolutionStage1795000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "htCycle" ADD "ironDissolutionStage" character varying(16)`);
    await queryRunner.query(`COMMENT ON COLUMN "htCycle"."ironDissolutionStage" IS '铁溶出量测量阶段(initial/final)'`);
    await queryRunner.query(`ALTER TABLE "htCycle" ADD CONSTRAINT "CK_htCycle_ironDissolutionStage" CHECK ("ironDissolutionStage" IS NULL OR "ironDissolutionStage" IN ('initial', 'final'))`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "htCycle" DROP CONSTRAINT "CK_htCycle_ironDissolutionStage"`);
    await queryRunner.query(`ALTER TABLE "htCycle" DROP COLUMN "ironDissolutionStage"`);
  }
}

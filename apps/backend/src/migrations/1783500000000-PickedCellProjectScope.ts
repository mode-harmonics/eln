import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Re-scope pickedCell from experiment-level to project-level:
 *  - Drop experimentId column (and its index) from pickedCell
 *  - Add projectId column (with index)
 *  - Drop cellPicked column from experiment
 *
 * No data migration is performed – existing pickedCell rows are dropped.
 */
export class PickedCellProjectScope1783500000000 implements MigrationInterface {
  name = 'PickedCellProjectScope1783500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Clear existing picked-cell records (no migration of old experiment-scoped data)
    await queryRunner.query(`DELETE FROM "pickedCell"`);

    // Drop old experimentId index
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_pickedCell_experimentId"`);

    // Drop experimentId column
    await queryRunner.query(`ALTER TABLE "pickedCell" DROP COLUMN IF EXISTS "experimentId"`);

    // Add projectId column
    await queryRunner.query(`ALTER TABLE "pickedCell" ADD COLUMN "projectId" uuid NOT NULL`);

    // Create index on new projectId column
    await queryRunner.query(`CREATE INDEX "IDX_pickedCell_projectId" ON "pickedCell" ("projectId")`);

    // Drop cellPicked from experiment
    await queryRunner.query(`ALTER TABLE "experiment" DROP COLUMN IF EXISTS "cellPicked"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Re-add cellPicked to experiment
    await queryRunner.query(`ALTER TABLE "experiment" ADD COLUMN "cellPicked" boolean NOT NULL DEFAULT false`);

    // Remove projectId
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_pickedCell_projectId"`);
    await queryRunner.query(`ALTER TABLE "pickedCell" DROP COLUMN IF EXISTS "projectId"`);

    // Restore experimentId
    await queryRunner.query(`ALTER TABLE "pickedCell" ADD COLUMN "experimentId" uuid NOT NULL DEFAULT gen_random_uuid()`);
    await queryRunner.query(`CREATE INDEX "IDX_pickedCell_experimentId" ON "pickedCell" ("experimentId")`);
  }
}

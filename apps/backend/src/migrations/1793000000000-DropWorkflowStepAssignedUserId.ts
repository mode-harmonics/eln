import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropWorkflowStepAssignedUserId1793000000000 implements MigrationInterface {
  name = 'DropWorkflowStepAssignedUserId1793000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_5809f5bb4cd206f29f3e88efea"`);
    await queryRunner.query(`ALTER TABLE "workflowStepAssignment" DROP COLUMN "assignedUserId"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "workflowStepAssignment" ADD "assignedUserId" uuid`);
    await queryRunner.query(`CREATE INDEX "IDX_5809f5bb4cd206f29f3e88efea" ON "workflowStepAssignment" ("assignedUserId")`);
  }
}

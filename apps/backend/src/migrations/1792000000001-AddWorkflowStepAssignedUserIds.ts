import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWorkflowStepAssignedUserIds1792000000001 implements MigrationInterface {
  name = 'AddWorkflowStepAssignedUserIds1792000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "workflowStepAssignment" ADD "assignedUserIds" jsonb`);
    await queryRunner.query(`UPDATE "workflowStepAssignment" SET "assignedUserIds" = jsonb_build_array("assignedUserId") WHERE "assignedUserId" IS NOT NULL`);
    await queryRunner.query(`COMMENT ON COLUMN "workflowStepAssignment"."assignedUserIds" IS '执行人ID列表'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "workflowStepAssignment" DROP COLUMN "assignedUserIds"`);
  }
}

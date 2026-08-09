import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDefaultWorkflowStepPermissions1794000000000 implements MigrationInterface {
  name = 'AddDefaultWorkflowStepPermissions1794000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "role"
      SET "permissionList" = COALESCE("permissionList", '[]'::jsonb) || '["workflow_step:*"]'::jsonb
      WHERE "name" IN ('Admin', 'Editor', 'Viewer')
        AND NOT COALESCE("permissionList", '[]'::jsonb) ? 'workflow_step:*'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "role"
      SET "permissionList" = "permissionList" - 'workflow_step:*'
      WHERE "name" IN ('Admin', 'Editor', 'Viewer')
    `);
  }
}

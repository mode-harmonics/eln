import { MigrationInterface, QueryRunner } from "typeorm";

export class AddVisibleToUserIds1784367554360 implements MigrationInterface {
    name = 'AddVisibleToUserIds1784367554360'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "workflowStepAssignment" ADD "visibleToUserIds" jsonb`);
        await queryRunner.query(`COMMENT ON COLUMN "workflowStepAssignment"."visibleToUserIds" IS '允许查看该步骤的其他人员ID列表'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`COMMENT ON COLUMN "workflowStepAssignment"."visibleToUserIds" IS '允许查看该步骤的其他人员ID列表'`);
        await queryRunner.query(`ALTER TABLE "workflowStepAssignment" DROP COLUMN "visibleToUserIds"`);
    }

}

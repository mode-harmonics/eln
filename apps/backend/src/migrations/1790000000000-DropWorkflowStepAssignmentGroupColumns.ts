import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Drop workflowStepAssignment.isParallelGroup / parentStepName.
 *
 * These were denormalized copies of hierarchy info that is already fully
 * expressed by the workflow template graph (nodes + edges). The workflow
 * service now derives group/child relationships from the template at read
 * time (shared deriveWorkflowGraphMeta), so the persisted copies are
 * redundant and a source of drift.
 */
export class DropWorkflowStepAssignmentGroupColumns1790000000000 implements MigrationInterface {
    name = 'DropWorkflowStepAssignmentGroupColumns1790000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "workflowStepAssignment" DROP COLUMN "isParallelGroup"`);
        await queryRunner.query(`ALTER TABLE "workflowStepAssignment" DROP COLUMN "parentStepName"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "workflowStepAssignment" ADD "parentStepName" character varying(64)`);
        await queryRunner.query(`ALTER TABLE "workflowStepAssignment" ADD "isParallelGroup" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`COMMENT ON COLUMN "workflowStepAssignment"."parentStepName" IS '父级并行组步骤名称'`);
        await queryRunner.query(`COMMENT ON COLUMN "workflowStepAssignment"."isParallelGroup" IS '是否为并行组节点(如testing)'`);
    }
}

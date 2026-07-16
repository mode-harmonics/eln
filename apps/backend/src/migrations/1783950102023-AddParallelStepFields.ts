import { MigrationInterface, QueryRunner } from "typeorm";

export class AddParallelStepFields1783950102023 implements MigrationInterface {
    name = 'AddParallelStepFields1783950102023'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "workflowStepAssignment" ADD "isParallelGroup" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`COMMENT ON COLUMN "workflowStepAssignment"."isParallelGroup" IS '是否为并行组节点(如testing)'`);
        await queryRunner.query(`ALTER TABLE "workflowStepAssignment" ADD "parentStepName" character varying(64)`);
        await queryRunner.query(`COMMENT ON COLUMN "workflowStepAssignment"."parentStepName" IS '父级并行组步骤名称'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`COMMENT ON COLUMN "workflowStepAssignment"."parentStepName" IS '父级并行组步骤名称'`);
        await queryRunner.query(`ALTER TABLE "workflowStepAssignment" DROP COLUMN "parentStepName"`);
        await queryRunner.query(`COMMENT ON COLUMN "workflowStepAssignment"."isParallelGroup" IS '是否为并行组节点(如testing)'`);
        await queryRunner.query(`ALTER TABLE "workflowStepAssignment" DROP COLUMN "isParallelGroup"`);
    }

}

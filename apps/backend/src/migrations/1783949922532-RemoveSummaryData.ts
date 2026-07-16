import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveSummaryData1783949922532 implements MigrationInterface {
    name = 'RemoveSummaryData1783949922532';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "summaryData"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Re-create the table if rollback is needed
        await queryRunner.query(`
            CREATE TABLE "summaryData" (
                "id" uuid NOT NULL,
                "experimentId" uuid NOT NULL,
                "dataType" character varying(32) NOT NULL,
                "attachmentId" uuid,
                "data" jsonb NOT NULL,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_a16b37793095e5677255394992f" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`CREATE INDEX "IDX_2fcd996caa06c4504694944801" ON "summaryData" ("experimentId")`);
        await queryRunner.query(`COMMENT ON TABLE "summaryData" IS '汇总数据表'`);
    }

}

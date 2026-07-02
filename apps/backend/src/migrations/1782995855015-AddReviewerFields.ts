import { MigrationInterface, QueryRunner } from "typeorm";

export class AddReviewerFields1782995855015 implements MigrationInterface {
    name = 'AddReviewerFields1782995855015'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "experiment" ADD "reviewerId" uuid`);
        await queryRunner.query(`COMMENT ON COLUMN "experiment"."reviewerId" IS '审核人ID'`);
        await queryRunner.query(`ALTER TABLE "experiment" ADD "reviewComment" text`);
        await queryRunner.query(`COMMENT ON COLUMN "experiment"."reviewComment" IS '审核意见'`);
        await queryRunner.query(`ALTER TABLE "experiment" ADD "reviewedAt" TIMESTAMP`);
        await queryRunner.query(`COMMENT ON COLUMN "experiment"."reviewedAt" IS '审核时间'`);
        await queryRunner.query(`CREATE INDEX "IDX_f55aeb096e324c495f65d0884d" ON "experiment" ("reviewerId") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_f55aeb096e324c495f65d0884d"`);
        await queryRunner.query(`COMMENT ON COLUMN "experiment"."reviewedAt" IS '审核时间'`);
        await queryRunner.query(`ALTER TABLE "experiment" DROP COLUMN "reviewedAt"`);
        await queryRunner.query(`COMMENT ON COLUMN "experiment"."reviewComment" IS '审核意见'`);
        await queryRunner.query(`ALTER TABLE "experiment" DROP COLUMN "reviewComment"`);
        await queryRunner.query(`COMMENT ON COLUMN "experiment"."reviewerId" IS '审核人ID'`);
        await queryRunner.query(`ALTER TABLE "experiment" DROP COLUMN "reviewerId"`);
    }

}

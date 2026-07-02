import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPhase2Entities1782998013714 implements MigrationInterface {
    name = 'AddPhase2Entities1782998013714'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "experiment_comment" ("id" uuid NOT NULL, "experimentId" uuid NOT NULL, "userId" uuid NOT NULL, "content" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_7590f3d71c4cc8569ebc949a4e4" PRIMARY KEY ("id")); COMMENT ON COLUMN "experiment_comment"."id" IS '主键ID'; COMMENT ON COLUMN "experiment_comment"."experimentId" IS '实验ID'; COMMENT ON COLUMN "experiment_comment"."userId" IS '评论者用户ID'; COMMENT ON COLUMN "experiment_comment"."content" IS '评论内容'; COMMENT ON COLUMN "experiment_comment"."createdAt" IS '创建时间'; COMMENT ON COLUMN "experiment_comment"."updatedAt" IS '更新时间'`);
        await queryRunner.query(`CREATE INDEX "IDX_9f4c51881e0109ea728240a4ef" ON "experiment_comment" ("experimentId") `);
        await queryRunner.query(`CREATE INDEX "IDX_fd6bb290d536ed57958a54bd84" ON "experiment_comment" ("userId") `);
        await queryRunner.query(`COMMENT ON TABLE "experiment_comment" IS '实验评论表'`);
        await queryRunner.query(`CREATE TABLE "notification" ("id" uuid NOT NULL, "userId" uuid NOT NULL, "type" character varying(64) NOT NULL, "payload" jsonb, "relatedExperimentId" uuid, "isRead" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_705b6c7cdf9b2c2ff7ac7872cb7" PRIMARY KEY ("id")); COMMENT ON COLUMN "notification"."id" IS '主键ID'; COMMENT ON COLUMN "notification"."userId" IS '接收者用户ID'; COMMENT ON COLUMN "notification"."type" IS '通知类型(如 REVIEW_SUBMITTED)'; COMMENT ON COLUMN "notification"."payload" IS '附加负载数据'; COMMENT ON COLUMN "notification"."relatedExperimentId" IS '关联实验ID'; COMMENT ON COLUMN "notification"."isRead" IS '是否已读'; COMMENT ON COLUMN "notification"."createdAt" IS '创建时间'`);
        await queryRunner.query(`CREATE INDEX "IDX_1ced25315eb974b73391fb1c81" ON "notification" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_080ab397c379af09b9d2169e5b" ON "notification" ("isRead") `);
        await queryRunner.query(`COMMENT ON TABLE "notification" IS '系统通知表'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`COMMENT ON TABLE "notification" IS NULL`);
        await queryRunner.query(`DROP INDEX "public"."IDX_080ab397c379af09b9d2169e5b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1ced25315eb974b73391fb1c81"`);
        await queryRunner.query(`DROP TABLE "notification"`);
        await queryRunner.query(`COMMENT ON TABLE "experiment_comment" IS NULL`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fd6bb290d536ed57958a54bd84"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9f4c51881e0109ea728240a4ef"`);
        await queryRunner.query(`DROP TABLE "experiment_comment"`);
    }

}

import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUsernameToUser1782600000000 implements MigrationInterface {
    name = 'AddUsernameToUser1782600000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" ADD "username" character varying(64) NOT NULL DEFAULT ''`);
        await queryRunner.query(`COMMENT ON COLUMN "user"."username" IS '用户名'`);
        // Set initial username from email (part before @)
        await queryRunner.query(`UPDATE "user" SET "username" = SPLIT_PART("email", '@', 1) WHERE "username" = ''`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_user_username" ON "user" ("username")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_user_username"`);
        await queryRunner.query(`COMMENT ON COLUMN "user"."username" IS '用户名'`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "username"`);
    }

}

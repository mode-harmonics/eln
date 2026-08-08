import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Make user.email column nullable — 允许用户邮箱字段为空.
 *
 * Allows creating and editing users without requiring an email address.
 */
export class MakeUserEmailNullable1792000000000 implements MigrationInterface {
    name = 'MakeUserEmailNullable1792000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "email" DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "email" SET NOT NULL`);
    }
}

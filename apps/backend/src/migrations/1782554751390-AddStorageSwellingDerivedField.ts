import { MigrationInterface, QueryRunner } from "typeorm";

export class AddStorageSwellingDerivedField1782554751390 implements MigrationInterface {
    name = 'AddStorageSwellingDerivedField1782554751390'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "storageSwelling" ADD "vg" numeric(18,6)`);
        await queryRunner.query(`COMMENT ON COLUMN "storageSwelling"."vg" IS '产气量 vg=(v-v0d)/qd1st (mL/Ah)'`);
        await queryRunner.query(`COMMENT ON COLUMN "storageSwelling"."v" IS '存储后电池体积(v)'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`COMMENT ON COLUMN "storageSwelling"."v" IS '胀气后体积(v)'`);
        await queryRunner.query(`COMMENT ON COLUMN "storageSwelling"."vg" IS '产气量 vg=(v-v0d)/qd1st (mL/Ah)'`);
        await queryRunner.query(`ALTER TABLE "storageSwelling" DROP COLUMN "vg"`);
    }

}

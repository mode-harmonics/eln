import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTableComments1782551257671 implements MigrationInterface {
    name = 'AddTableComments1782551257671'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`COMMENT ON TABLE "user" IS '用户表'`);
        await queryRunner.query(`COMMENT ON TABLE "role" IS '角色表'`);
        await queryRunner.query(`COMMENT ON TABLE "project" IS '项目表'`);
        await queryRunner.query(`COMMENT ON TABLE "experimentCollaborator" IS '实验协作人员表'`);
        await queryRunner.query(`COMMENT ON TABLE "experiment" IS '实验表'`);
        await queryRunner.query(`COMMENT ON TABLE "inventory" IS '库存表'`);
        await queryRunner.query(`COMMENT ON TABLE "attachment" IS '附件表'`);
        await queryRunner.query(`COMMENT ON TABLE "versionHistory" IS '版本历史表'`);
        await queryRunner.query(`COMMENT ON TABLE "processData" IS '制程数据表'`);
        await queryRunner.query(`COMMENT ON TABLE "calendarLife" IS '日历寿命数据表'`);
        await queryRunner.query(`COMMENT ON TABLE "storageSwelling" IS '存储胀气数据表'`);
        await queryRunner.query(`COMMENT ON TABLE "energyEfficiency" IS '能效数据表'`);
        await queryRunner.query(`COMMENT ON TABLE "dcrTest" IS '直流内阻测试数据表'`);
        await queryRunner.query(`COMMENT ON TABLE "fastCharge" IS '快充时间工步表'`);
        await queryRunner.query(`COMMENT ON TABLE "htCycle" IS '高温循环数据表'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`COMMENT ON TABLE "htCycle" IS NULL`);
        await queryRunner.query(`COMMENT ON TABLE "fastCharge" IS NULL`);
        await queryRunner.query(`COMMENT ON TABLE "dcrTest" IS NULL`);
        await queryRunner.query(`COMMENT ON TABLE "energyEfficiency" IS NULL`);
        await queryRunner.query(`COMMENT ON TABLE "storageSwelling" IS NULL`);
        await queryRunner.query(`COMMENT ON TABLE "calendarLife" IS NULL`);
        await queryRunner.query(`COMMENT ON TABLE "processData" IS NULL`);
        await queryRunner.query(`COMMENT ON TABLE "versionHistory" IS NULL`);
        await queryRunner.query(`COMMENT ON TABLE "attachment" IS NULL`);
        await queryRunner.query(`COMMENT ON TABLE "inventory" IS NULL`);
        await queryRunner.query(`COMMENT ON TABLE "experiment" IS NULL`);
        await queryRunner.query(`COMMENT ON TABLE "experimentCollaborator" IS NULL`);
        await queryRunner.query(`COMMENT ON TABLE "project" IS NULL`);
        await queryRunner.query(`COMMENT ON TABLE "role" IS NULL`);
        await queryRunner.query(`COMMENT ON TABLE "user" IS NULL`);
    }

}

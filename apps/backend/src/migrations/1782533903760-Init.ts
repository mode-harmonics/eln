import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1782533903760 implements MigrationInterface {
    name = 'Init1782533903760'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "user" ("id" uuid NOT NULL, "email" character varying(128) NOT NULL, "passwordHash" character varying(255) NOT NULL, "fullName" character varying(64) NOT NULL, "avatar" character varying(512), "roleId" uuid, "departmentId" uuid, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_e12875dfb3b1d92d7d7c5377e2" ON "user" ("email") `);
        await queryRunner.query(`CREATE INDEX "IDX_c28e52f758e7bbc53828db9219" ON "user" ("roleId") `);
        await queryRunner.query(`CREATE TABLE "role" ("id" uuid NOT NULL, "name" character varying(64) NOT NULL, "permissionList" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b36bcfe02fc8de3c57a8b2391c2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "project" ("id" uuid NOT NULL, "name" character varying(128) NOT NULL, "description" text, "status" character varying(32) NOT NULL DEFAULT 'Active', "createdBy" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_4d68b1358bb5b766d3e78f32f57" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_c714b0a5eaf71cc3a36c242d2e" ON "project" ("createdBy") `);
        await queryRunner.query(`CREATE TABLE "experimentCollaborator" ("id" uuid NOT NULL, "experimentId" uuid NOT NULL, "userId" uuid NOT NULL, "role" character varying(32) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d707e9cc8ccaa1b30b83bd2fe4a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_05ba4be00496a7f7b50c8cffae" ON "experimentCollaborator" ("experimentId") `);
        await queryRunner.query(`CREATE INDEX "IDX_fb2aacc1444724703a3c1407fd" ON "experimentCollaborator" ("userId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_6b59fc13761df821a62b4f42d3" ON "experimentCollaborator" ("experimentId", "userId") `);
        await queryRunner.query(`CREATE TABLE "experiment" ("id" uuid NOT NULL, "projectId" uuid NOT NULL, "title" character varying(255) NOT NULL, "content" text, "status" character varying(32) NOT NULL DEFAULT 'Draft', "metadata" jsonb, "aiAnalysisOutput" text, "versionNo" integer NOT NULL DEFAULT '1', "createdBy" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_4f6eec215c62eec1e0fde987caf" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_515a4754daa77993362776c559" ON "experiment" ("projectId") `);
        await queryRunner.query(`CREATE INDEX "IDX_64493affb7ed37cb8c0b58ac0c" ON "experiment" ("createdBy") `);
        await queryRunner.query(`CREATE TABLE "inventory" ("id" uuid NOT NULL, "name" character varying(128) NOT NULL, "type" character varying(64) NOT NULL, "lotNumber" character varying(64), "quantity" character varying(64), "storageLocation" character varying(128), "purity" character varying(64), "status" character varying(32) NOT NULL DEFAULT 'In Stock', "lastUsedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_82aa5da437c5bbfb80703b08309" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "attachment" ("id" uuid NOT NULL, "experimentId" uuid NOT NULL, "fileName" character varying(255) NOT NULL, "filePath" character varying(512) NOT NULL, "fileSize" integer NOT NULL, "mimeType" character varying(128) NOT NULL, "uploadedBy" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d2a80c3a8d467f08a750ac4b420" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_879e0f0818cc2e9294aa9fdcd9" ON "attachment" ("experimentId") `);
        await queryRunner.query(`CREATE INDEX "IDX_ce931a70e87bef5768e1ee3b10" ON "attachment" ("uploadedBy") `);
        await queryRunner.query(`CREATE TABLE "versionHistory" ("id" uuid NOT NULL, "experimentId" uuid NOT NULL, "versionNumber" integer NOT NULL, "changeSummary" character varying(255), "snapshot" jsonb, "updatedBy" uuid NOT NULL, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_db888aac2b4a7e17e05f1ce12a0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_c549e9092793b630f713f52240" ON "versionHistory" ("experimentId") `);
        await queryRunner.query(`CREATE INDEX "IDX_a48644f8cf5c8a91b72017b4e6" ON "versionHistory" ("updatedBy") `);
        await queryRunner.query(`CREATE TABLE "processData" ("id" uuid NOT NULL, "experimentId" uuid NOT NULL, "cellId" character varying(64) NOT NULL, "m0" numeric(18,6), "m1" numeric(18,6), "m2" numeric(18,6), "v0" numeric(18,6), "v1" numeric(18,6), "fu0" numeric(18,6), "fr0" numeric(18,6), "fq1" numeric(18,6), "fq2" numeric(18,6), "fu1" numeric(18,6), "fr1" numeric(18,6), "fu2" numeric(18,6), "fr2" numeric(18,6), "m3" numeric(18,6), "m4" numeric(18,6), "gu0" numeric(18,6), "gr0" numeric(18,6), "gqc1" numeric(18,6), "gqd1" numeric(18,6), "gqc2" numeric(18,6), "gu1" numeric(18,6), "gr1" numeric(18,6), "picked" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_2d9fe649e96f3f40459e9b437b9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_0504697d5e858d8ee01aa0cbe8" ON "processData" ("experimentId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f3f758e69283ec92a398ee6585" ON "processData" ("cellId") `);
        await queryRunner.query(`CREATE TABLE "calendarLife" ("id" uuid NOT NULL, "experimentId" uuid NOT NULL, "cellName" character varying(64) NOT NULL, "isHorizontal" boolean NOT NULL DEFAULT true, "dayCount" integer NOT NULL, "q" numeric(18,6), "dq" numeric(18,6), "ddcr" numeric(18,6), "cdcr" numeric(18,6), "u" numeric(18,6), "r" numeric(18,6), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_6c99ca2561ebc5cf8dd97c28907" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_6d952bed679566ee9fbf9705b6" ON "calendarLife" ("experimentId") `);
        await queryRunner.query(`CREATE INDEX "IDX_82da85236b2c714da21e345649" ON "calendarLife" ("cellName") `);
        await queryRunner.query(`CREATE INDEX "IDX_30d3475a0fc66dd885eb27be68" ON "calendarLife" ("dayCount") `);
        await queryRunner.query(`CREATE TABLE "storageSwelling" ("id" uuid NOT NULL, "experimentId" uuid NOT NULL, "cellName" character varying(64) NOT NULL, "qd1st" numeric(18,6), "dayCount" integer NOT NULL, "v" numeric(18,6), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_878eaff8931fc16879eaeb01f02" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_d2ef6164dc0f3784bccc42f050" ON "storageSwelling" ("experimentId") `);
        await queryRunner.query(`CREATE INDEX "IDX_3519a70e236c8bce0dd814d6ed" ON "storageSwelling" ("cellName") `);
        await queryRunner.query(`CREATE INDEX "IDX_38490d3b9b462636bd18c3c08d" ON "storageSwelling" ("dayCount") `);
        await queryRunner.query(`CREATE TABLE "energyEfficiency" ("id" uuid NOT NULL, "experimentId" uuid NOT NULL, "cellName" character varying(64) NOT NULL, "de" numeric(18,6), "ce" numeric(18,6), "notes" character varying(255), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_2c3994f423cb64f7d5d7cb1f743" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_38e0360b7d29ea8e385e44f65c" ON "energyEfficiency" ("experimentId") `);
        await queryRunner.query(`CREATE INDEX "IDX_d3ce55ad0080aa6314a21d8556" ON "energyEfficiency" ("cellName") `);
        await queryRunner.query(`CREATE TABLE "dcrTest" ("id" uuid NOT NULL, "experimentId" uuid NOT NULL, "cellName" character varying(64) NOT NULL, "q0" numeric(18,6), "du0" numeric(18,6), "du1" numeric(18,6), "di" numeric(18,6), "cu0" numeric(18,6), "cu1" numeric(18,6), "ci" numeric(18,6), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a92508c7dc4bbb1805016c48bdd" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_0506c37b88447691102a295d2d" ON "dcrTest" ("experimentId") `);
        await queryRunner.query(`CREATE INDEX "IDX_20ee83c2eb43aa42ef637fe670" ON "dcrTest" ("cellName") `);
        await queryRunner.query(`CREATE TABLE "fastCharge" ("id" uuid NOT NULL, "experimentId" uuid NOT NULL, "cellName" character varying(64) NOT NULL, "c0" numeric(18,6), "providedFastChargeTime" numeric(18,6), "steps" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_5566b4ad0635d67090f8d0423de" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_a718c38548eab49b2fd07ace3e" ON "fastCharge" ("experimentId") `);
        await queryRunner.query(`CREATE INDEX "IDX_fad8c45fec0a5a952e4a8dbe75" ON "fastCharge" ("cellName") `);
        await queryRunner.query(`CREATE TABLE "htCycle" ("id" uuid NOT NULL, "experimentId" uuid NOT NULL, "cycle" integer NOT NULL, "caps" jsonb NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_aaae4dc9f454267bebc28013097" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_96a8d5541d8d96454458354182" ON "htCycle" ("experimentId") `);
        await queryRunner.query(`CREATE INDEX "IDX_3ce363c5675f2544482b934c00" ON "htCycle" ("cycle") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_3ce363c5675f2544482b934c00"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_96a8d5541d8d96454458354182"`);
        await queryRunner.query(`DROP TABLE "htCycle"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fad8c45fec0a5a952e4a8dbe75"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a718c38548eab49b2fd07ace3e"`);
        await queryRunner.query(`DROP TABLE "fastCharge"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_20ee83c2eb43aa42ef637fe670"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0506c37b88447691102a295d2d"`);
        await queryRunner.query(`DROP TABLE "dcrTest"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d3ce55ad0080aa6314a21d8556"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_38e0360b7d29ea8e385e44f65c"`);
        await queryRunner.query(`DROP TABLE "energyEfficiency"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_38490d3b9b462636bd18c3c08d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3519a70e236c8bce0dd814d6ed"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d2ef6164dc0f3784bccc42f050"`);
        await queryRunner.query(`DROP TABLE "storageSwelling"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_30d3475a0fc66dd885eb27be68"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_82da85236b2c714da21e345649"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6d952bed679566ee9fbf9705b6"`);
        await queryRunner.query(`DROP TABLE "calendarLife"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f3f758e69283ec92a398ee6585"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0504697d5e858d8ee01aa0cbe8"`);
        await queryRunner.query(`DROP TABLE "processData"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a48644f8cf5c8a91b72017b4e6"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c549e9092793b630f713f52240"`);
        await queryRunner.query(`DROP TABLE "versionHistory"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ce931a70e87bef5768e1ee3b10"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_879e0f0818cc2e9294aa9fdcd9"`);
        await queryRunner.query(`DROP TABLE "attachment"`);
        await queryRunner.query(`DROP TABLE "inventory"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_64493affb7ed37cb8c0b58ac0c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_515a4754daa77993362776c559"`);
        await queryRunner.query(`DROP TABLE "experiment"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6b59fc13761df821a62b4f42d3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fb2aacc1444724703a3c1407fd"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_05ba4be00496a7f7b50c8cffae"`);
        await queryRunner.query(`DROP TABLE "experimentCollaborator"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c714b0a5eaf71cc3a36c242d2e"`);
        await queryRunner.query(`DROP TABLE "project"`);
        await queryRunner.query(`DROP TABLE "role"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c28e52f758e7bbc53828db9219"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e12875dfb3b1d92d7d7c5377e2"`);
        await queryRunner.query(`DROP TABLE "user"`);
    }

}

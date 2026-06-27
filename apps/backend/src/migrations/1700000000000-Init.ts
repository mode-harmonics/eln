import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Init — creates all 15 tables from BACKEND_SPEC.md. Columns are camelCase
 * to match TypeORM's default property-name-as-column-name behavior (no
 * custom NamingStrategy). All primary/foreign keys are VARCHAR/UUID with
 * NO physical foreign-key constraints — relations are logical only, by
 * design, to support future horizontal scaling / sharding.
 *
 * Generated for: pnpm --filter @eln/backend run typeorm:run
 */
export class Init1700000000000 implements MigrationInterface {
  name = 'Init1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    // ---------------------------------------------------------------------
    // §一 Core system / IAM tables
    // ---------------------------------------------------------------------

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL,
        "email" varchar(128) NOT NULL,
        "passwordHash" varchar(255) NOT NULL,
        "fullName" varchar(64) NOT NULL,
        "avatar" varchar(512),
        "roleId" uuid,
        "departmentId" uuid,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_users_roleId" ON "users" ("roleId")`);
    await queryRunner.query(`CREATE INDEX "IDX_users_departmentId" ON "users" ("departmentId")`);

    await queryRunner.query(`
      CREATE TABLE "roles" (
        "id" uuid NOT NULL,
        "name" varchar(64) NOT NULL,
        "permissionList" jsonb,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_roles" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "projects" (
        "id" uuid NOT NULL,
        "name" varchar(128) NOT NULL,
        "description" text,
        "status" varchar(32) NOT NULL DEFAULT 'Active',
        "createdBy" uuid NOT NULL,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_projects" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_projects_createdBy" ON "projects" ("createdBy")`);

    await queryRunner.query(`
      CREATE TABLE "experimentCollaborators" (
        "id" uuid NOT NULL,
        "experimentId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "role" varchar(32) NOT NULL,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_experimentCollaborators" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_experimentCollaborators_experimentId" ON "experimentCollaborators" ("experimentId")`);
    await queryRunner.query(`CREATE INDEX "IDX_experimentCollaborators_userId" ON "experimentCollaborators" ("userId")`);

    await queryRunner.query(`
      CREATE TABLE "experiments" (
        "id" uuid NOT NULL,
        "projectId" uuid NOT NULL,
        "title" varchar(255) NOT NULL,
        "content" text,
        "status" varchar(32) NOT NULL DEFAULT 'Draft',
        "metadata" jsonb,
        "aiAnalysisOutput" text,
        "versionNo" integer NOT NULL DEFAULT 1,
        "createdBy" uuid NOT NULL,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_experiments" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_experiments_projectId" ON "experiments" ("projectId")`);
    await queryRunner.query(`CREATE INDEX "IDX_experiments_createdBy" ON "experiments" ("createdBy")`);

    await queryRunner.query(`
      CREATE TABLE "inventory" (
        "id" uuid NOT NULL,
        "name" varchar(128) NOT NULL,
        "type" varchar(64) NOT NULL,
        "lotNumber" varchar(64),
        "quantity" varchar(64),
        "storageLocation" varchar(128),
        "purity" varchar(64),
        "status" varchar(32) NOT NULL DEFAULT 'In Stock',
        "lastUsedAt" timestamp,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_inventory" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "attachments" (
        "id" uuid NOT NULL,
        "experimentId" uuid NOT NULL,
        "fileName" varchar(255) NOT NULL,
        "filePath" varchar(512) NOT NULL,
        "fileSize" integer NOT NULL,
        "mimeType" varchar(128) NOT NULL,
        "uploadedBy" uuid NOT NULL,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_attachments" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_attachments_experimentId" ON "attachments" ("experimentId")`);
    await queryRunner.query(`CREATE INDEX "IDX_attachments_uploadedBy" ON "attachments" ("uploadedBy")`);

    await queryRunner.query(`
      CREATE TABLE "versionHistory" (
        "id" uuid NOT NULL,
        "experimentId" uuid NOT NULL,
        "versionNumber" integer NOT NULL,
        "changeSummary" varchar(255),
        "snapshot" jsonb NOT NULL,
        "updatedBy" uuid NOT NULL,
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_versionHistory" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_versionHistory_experimentId" ON "versionHistory" ("experimentId")`);
    await queryRunner.query(`CREATE INDEX "IDX_versionHistory_updatedBy" ON "versionHistory" ("updatedBy")`);

    // ---------------------------------------------------------------------
    // §二 Battery-science business data tables
    // ---------------------------------------------------------------------

    await queryRunner.query(`
      CREATE TABLE "processData" (
        "id" uuid NOT NULL,
        "experimentId" uuid NOT NULL,
        "cellId" varchar(64) NOT NULL,
        "m0" decimal(18,6), "m1" decimal(18,6), "m2" decimal(18,6),
        "v0" decimal(18,6), "v1" decimal(18,6),
        "fu0" decimal(18,6), "fr0" decimal(18,6),
        "fq1" decimal(18,6), "fq2" decimal(18,6),
        "fu1" decimal(18,6), "fr1" decimal(18,6), "fu2" decimal(18,6), "fr2" decimal(18,6),
        "m3" decimal(18,6), "m4" decimal(18,6),
        "gu0" decimal(18,6), "gr0" decimal(18,6),
        "gqc1" decimal(18,6), "gqd1" decimal(18,6), "gqc2" decimal(18,6),
        "gu1" decimal(18,6), "gr1" decimal(18,6),
        "picked" boolean NOT NULL DEFAULT false,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_processData" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_processData_experimentId" ON "processData" ("experimentId")`);
    await queryRunner.query(`CREATE INDEX "IDX_processData_cellId" ON "processData" ("cellId")`);

    await queryRunner.query(`
      CREATE TABLE "calendarLife" (
        "id" uuid NOT NULL,
        "experimentId" uuid NOT NULL,
        "cellName" varchar(64) NOT NULL,
        "isHorizontal" boolean NOT NULL DEFAULT true,
        "dayCount" integer NOT NULL,
        "q" decimal(18,6), "dq" decimal(18,6),
        "ddcr" decimal(18,6), "cdcr" decimal(18,6),
        "u" decimal(18,6), "r" decimal(18,6),
        "createdAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_calendarLife" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_calendarLife_experimentId" ON "calendarLife" ("experimentId")`);
    await queryRunner.query(`CREATE INDEX "IDX_calendarLife_cellName" ON "calendarLife" ("cellName")`);
    await queryRunner.query(`CREATE INDEX "IDX_calendarLife_dayCount" ON "calendarLife" ("dayCount")`);

    await queryRunner.query(`
      CREATE TABLE "storageSwelling" (
        "id" uuid NOT NULL,
        "experimentId" uuid NOT NULL,
        "cellName" varchar(64) NOT NULL,
        "qd1st" decimal(18,6),
        "dayCount" integer NOT NULL,
        "v" decimal(18,6),
        "createdAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_storageSwelling" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_storageSwelling_experimentId" ON "storageSwelling" ("experimentId")`);
    await queryRunner.query(`CREATE INDEX "IDX_storageSwelling_cellName" ON "storageSwelling" ("cellName")`);
    await queryRunner.query(`CREATE INDEX "IDX_storageSwelling_dayCount" ON "storageSwelling" ("dayCount")`);

    await queryRunner.query(`
      CREATE TABLE "energyEfficiency" (
        "id" uuid NOT NULL,
        "experimentId" uuid NOT NULL,
        "cellName" varchar(64) NOT NULL,
        "de" decimal(18,6), "ce" decimal(18,6),
        "notes" varchar(255),
        "createdAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_energyEfficiency" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_energyEfficiency_experimentId" ON "energyEfficiency" ("experimentId")`);
    await queryRunner.query(`CREATE INDEX "IDX_energyEfficiency_cellName" ON "energyEfficiency" ("cellName")`);

    await queryRunner.query(`
      CREATE TABLE "dcrTest" (
        "id" uuid NOT NULL,
        "experimentId" uuid NOT NULL,
        "cellName" varchar(64) NOT NULL,
        "q0" decimal(18,6),
        "du0" decimal(18,6), "du1" decimal(18,6), "di" decimal(18,6),
        "cu0" decimal(18,6), "cu1" decimal(18,6), "ci" decimal(18,6),
        "createdAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_dcrTest" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_dcrTest_experimentId" ON "dcrTest" ("experimentId")`);
    await queryRunner.query(`CREATE INDEX "IDX_dcrTest_cellName" ON "dcrTest" ("cellName")`);

    await queryRunner.query(`
      CREATE TABLE "fastCharge" (
        "id" uuid NOT NULL,
        "experimentId" uuid NOT NULL,
        "cellName" varchar(64) NOT NULL,
        "c0" decimal(18,6),
        "providedFastChargeTime" decimal(18,6),
        "steps" jsonb,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_fastCharge" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_fastCharge_experimentId" ON "fastCharge" ("experimentId")`);
    await queryRunner.query(`CREATE INDEX "IDX_fastCharge_cellName" ON "fastCharge" ("cellName")`);

    await queryRunner.query(`
      CREATE TABLE "htCycle" (
        "id" uuid NOT NULL,
        "experimentId" uuid NOT NULL,
        "cycle" integer NOT NULL,
        "caps" jsonb NOT NULL,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_htCycle" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_htCycle_experimentId" ON "htCycle" ("experimentId")`);
    await queryRunner.query(`CREATE INDEX "IDX_htCycle_cycle" ON "htCycle" ("cycle")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop in reverse dependency order (logical FKs only, no physical
    // constraints, so order here is just hygiene rather than a requirement).
    await queryRunner.query(`DROP TABLE IF EXISTS "htCycle"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "fastCharge"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "dcrTest"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "energyEfficiency"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "storageSwelling"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "calendarLife"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "processData"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "versionHistory"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "attachments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "inventory"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "experiments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "experimentCollaborators"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "projects"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "roles"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
  }
}
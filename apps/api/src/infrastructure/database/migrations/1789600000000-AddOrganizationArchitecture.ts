import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrganizationArchitecture1789600000000 implements MigrationInterface {
  name = 'AddOrganizationArchitecture1789600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "organization_members_role_enum" AS ENUM('creator')`,
    );

    await queryRunner.query(
      `CREATE TABLE "organizations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "slug" character varying NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_organizations_slug" UNIQUE ("slug"), CONSTRAINT "PK_organizations_id" PRIMARY KEY ("id"))`,
    );

    await queryRunner.query(
      `CREATE TABLE "organization_members" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "organization_id" uuid NOT NULL, "user_id" uuid NOT NULL, "role" "organization_members_role_enum" NOT NULL DEFAULT 'creator', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_organization_members_org_user" UNIQUE ("organization_id", "user_id"), CONSTRAINT "PK_organization_members_id" PRIMARY KEY ("id"))`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_organization_members_org_id" ON "organization_members" ("organization_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_organization_members_user_id" ON "organization_members" ("user_id")`,
    );

    await queryRunner.query(
      `ALTER TABLE "quizzes" ADD "organization_id" uuid`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_quizzes_organization_id" ON "quizzes" ("organization_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_quizzes_creator_id" ON "quizzes" ("creator_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_quizzes_org_creator_id" ON "quizzes" ("organization_id", "creator_id")`,
    );

    await queryRunner.query(
      `ALTER TABLE "organization_members" ADD CONSTRAINT "FK_organization_members_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_members" ADD CONSTRAINT "FK_organization_members_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "quizzes" ADD CONSTRAINT "FK_quizzes_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "quizzes" DROP CONSTRAINT "FK_quizzes_organization"`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_members" DROP CONSTRAINT "FK_organization_members_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_members" DROP CONSTRAINT "FK_organization_members_organization"`,
    );

    await queryRunner.query(`DROP INDEX "IDX_quizzes_org_creator_id"`);
    await queryRunner.query(`DROP INDEX "IDX_quizzes_creator_id"`);
    await queryRunner.query(`DROP INDEX "IDX_quizzes_organization_id"`);

    await queryRunner.query(
      `ALTER TABLE "quizzes" DROP COLUMN "organization_id"`,
    );

    await queryRunner.query(`DROP INDEX "IDX_organization_members_user_id"`);
    await queryRunner.query(`DROP INDEX "IDX_organization_members_org_id"`);

    await queryRunner.query(`DROP TABLE "organization_members"`);
    await queryRunner.query(`DROP TABLE "organizations"`);
    await queryRunner.query(`DROP TYPE "organization_members_role_enum"`);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInstitutionalArchitecture1789700000000 implements MigrationInterface {
  name = 'AddInstitutionalArchitecture1789700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. PlatformRole and must_change_password on users
    await queryRunner.query(
      `CREATE TYPE "public"."users_platform_role_enum" AS ENUM('user', 'platform_admin')`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "platform_role" "public"."users_platform_role_enum" NOT NULL DEFAULT 'user'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "must_change_password" boolean NOT NULL DEFAULT false`,
    );

    // Update existing admin users to platform_admin
    await queryRunner.query(
      `UPDATE "users" SET "platform_role" = 'platform_admin' WHERE "role" = 'admin'`,
    );

    // 2. Organization Members Enum & Columns
    await queryRunner.query(
      `CREATE TYPE "public"."organization_members_admin_type_enum" AS ENUM('principal', 'manager')`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_members" ADD "admin_type" "public"."organization_members_admin_type_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_members" ADD "is_active" boolean NOT NULL DEFAULT true`,
    );

    // Update OrganizationRole Enum safely in postgres
    await queryRunner.query(
      `ALTER TYPE "public"."organization_members_role_enum" ADD VALUE IF NOT EXISTS 'admin'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."organization_members_role_enum" ADD VALUE IF NOT EXISTS 'teacher'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."organization_members_role_enum" ADD VALUE IF NOT EXISTS 'student'`,
    );

    // 3. Classrooms table
    await queryRunner.query(`
      CREATE TABLE "classrooms" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL,
        "name" character varying NOT NULL,
        "description" text,
        "created_by" uuid NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_classrooms" PRIMARY KEY ("id"),
        CONSTRAINT "FK_classrooms_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_classrooms_creator" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_classrooms_organization_id" ON "classrooms" ("organization_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_classrooms_created_by" ON "classrooms" ("created_by")`);

    // 4. Classroom Teachers table
    await queryRunner.query(`
      CREATE TABLE "classroom_teachers" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "classroom_id" uuid NOT NULL,
        "teacher_id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_classroom_teachers" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_classroom_teacher" UNIQUE ("classroom_id", "teacher_id"),
        CONSTRAINT "FK_classroom_teachers_classroom" FOREIGN KEY ("classroom_id") REFERENCES "classrooms"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_classroom_teachers_teacher" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_classroom_teachers_classroom_id" ON "classroom_teachers" ("classroom_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_classroom_teachers_teacher_id" ON "classroom_teachers" ("teacher_id")`);

    // 5. Classroom Students table
    await queryRunner.query(`
      CREATE TABLE "classroom_students" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "classroom_id" uuid NOT NULL,
        "student_id" uuid NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "joined_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_classroom_students" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_classroom_student" UNIQUE ("classroom_id", "student_id"),
        CONSTRAINT "FK_classroom_students_classroom" FOREIGN KEY ("classroom_id") REFERENCES "classrooms"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_classroom_students_student" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_classroom_students_classroom_id" ON "classroom_students" ("classroom_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_classroom_students_student_id" ON "classroom_students" ("student_id")`);

    // 6. Quiz Assignments table
    await queryRunner.query(`
      CREATE TABLE "quiz_assignments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "quiz_id" uuid NOT NULL,
        "quiz_version_id" uuid NOT NULL,
        "organization_id" uuid NOT NULL,
        "classroom_id" uuid,
        "assigned_by" uuid NOT NULL,
        "starts_at" TIMESTAMP WITH TIME ZONE,
        "due_at" TIMESTAMP WITH TIME ZONE,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_quiz_assignments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_quiz_assignments_quiz" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_quiz_assignments_version" FOREIGN KEY ("quiz_version_id") REFERENCES "quiz_versions"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_quiz_assignments_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_quiz_assignments_classroom" FOREIGN KEY ("classroom_id") REFERENCES "classrooms"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_quiz_assignments_assigner" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_quiz_assignments_quiz_id" ON "quiz_assignments" ("quiz_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_quiz_assignments_quiz_version_id" ON "quiz_assignments" ("quiz_version_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_quiz_assignments_organization_id" ON "quiz_assignments" ("organization_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_quiz_assignments_classroom_id" ON "quiz_assignments" ("classroom_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_quiz_assignments_due_at" ON "quiz_assignments" ("due_at")`);

    // 7. Quiz Assignment Recipients table
    await queryRunner.query(`
      CREATE TABLE "quiz_assignment_recipients" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "assignment_id" uuid NOT NULL,
        "student_id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_quiz_assignment_recipients" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_assignment_student" UNIQUE ("assignment_id", "student_id"),
        CONSTRAINT "FK_quiz_recipients_assignment" FOREIGN KEY ("assignment_id") REFERENCES "quiz_assignments"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_quiz_recipients_student" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_quiz_recipients_assignment_id" ON "quiz_assignment_recipients" ("assignment_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_quiz_recipients_student_id" ON "quiz_assignment_recipients" ("student_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "quiz_assignment_recipients"`);
    await queryRunner.query(`DROP TABLE "quiz_assignments"`);
    await queryRunner.query(`DROP TABLE "classroom_students"`);
    await queryRunner.query(`DROP TABLE "classroom_teachers"`);
    await queryRunner.query(`DROP TABLE "classrooms"`);
    await queryRunner.query(`ALTER TABLE "organization_members" DROP COLUMN "is_active"`);
    await queryRunner.query(`ALTER TABLE "organization_members" DROP COLUMN "admin_type"`);
    await queryRunner.query(`DROP TYPE "public"."organization_members_admin_type_enum"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "must_change_password"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "platform_role"`);
    await queryRunner.query(`DROP TYPE "public"."users_platform_role_enum"`);
  }
}

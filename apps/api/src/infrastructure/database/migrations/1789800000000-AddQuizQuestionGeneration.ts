import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddQuizQuestionGeneration1789800000000 implements MigrationInterface {
  name = 'AddQuizQuestionGeneration1789800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."quiz_question_generations_status_enum" AS ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED')`,
    );

    await queryRunner.query(`
      CREATE TABLE "quiz_question_generations" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "organization_id" uuid,
        "creator_id" uuid NOT NULL,
        "quiz_id" uuid NOT NULL,
        "target_version_id" uuid NOT NULL,
        "job_id" character varying(255) NOT NULL,
        "status" "public"."quiz_question_generations_status_enum" NOT NULL DEFAULT 'PENDING',
        "prompt_params" jsonb NOT NULL,
        "generated_questions" jsonb,
        "error_message" text,
        "tokens_used" jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "completed_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_quiz_question_generations" PRIMARY KEY ("id"),
        CONSTRAINT "FK_quiz_question_generations_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_quiz_question_generations_creator" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_quiz_question_generations_quiz" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_quiz_question_generations_target_version" FOREIGN KEY ("target_version_id") REFERENCES "quiz_versions"("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_quiz_question_generations_job_id" ON "quiz_question_generations" ("job_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_quiz_question_generations_org_quiz" ON "quiz_question_generations" ("organization_id", "quiz_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_quiz_question_generations_quiz_target_version" ON "quiz_question_generations" ("quiz_id", "target_version_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_quiz_question_generations_status" ON "quiz_question_generations" ("status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_quiz_question_generations_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_quiz_question_generations_quiz_target_version"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_quiz_question_generations_org_quiz"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_quiz_question_generations_job_id"`);
    await queryRunner.query(`DROP TABLE "quiz_question_generations"`);
    await queryRunner.query(`DROP TYPE "public"."quiz_question_generations_status_enum"`);
  }
}

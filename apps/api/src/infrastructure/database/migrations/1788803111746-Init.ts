import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1788803111746 implements MigrationInterface {
    name = 'Init1788803111746'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."quizzes_status_enum" AS ENUM('draft', 'published', 'archived')`);
        await queryRunner.query(`CREATE TABLE "quizzes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying NOT NULL, "description" text, "status" "public"."quizzes_status_enum" NOT NULL DEFAULT 'draft', "creator_id" uuid NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b24f0f7662cf6b3a0e7dba0a1b4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."quiz_versions_status_enum" AS ENUM('draft', 'published', 'archived')`);
        await queryRunner.query(`CREATE TABLE "quiz_versions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "quiz_id" uuid NOT NULL, "version" integer NOT NULL, "status" "public"."quiz_versions_status_enum" NOT NULL DEFAULT 'draft', "published_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_quiz_version_number" UNIQUE ("quiz_id", "version"), CONSTRAINT "PK_717d68b7545b178d2c78831ce6c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "quizzes" ADD CONSTRAINT "FK_415fa0f36f70c345fc59ec9474e" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "quiz_versions" ADD CONSTRAINT "FK_657e0cf7b77008ede9c63025f25" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "quiz_versions" DROP CONSTRAINT "FK_657e0cf7b77008ede9c63025f25"`);
        await queryRunner.query(`ALTER TABLE "quizzes" DROP CONSTRAINT "FK_415fa0f36f70c345fc59ec9474e"`);
        await queryRunner.query(`DROP TABLE "quiz_versions"`);
        await queryRunner.query(`DROP TYPE "public"."quiz_versions_status_enum"`);
        await queryRunner.query(`DROP TABLE "quizzes"`);
        await queryRunner.query(`DROP TYPE "public"."quizzes_status_enum"`);
    }

}

import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1789484549808 implements MigrationInterface {
    name = 'Init1789484549808'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_one_draft_version_per_quiz" ON "quiz_versions"  ("quiz_id") WHERE "status" = 'draft'`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_active_attempt_user_version" ON "quiz_attempts"  ("user_id", "quiz_version_id") WHERE "status" = 'in_progress'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."UQ_active_attempt_user_version"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_one_draft_version_per_quiz"`);
    }

}

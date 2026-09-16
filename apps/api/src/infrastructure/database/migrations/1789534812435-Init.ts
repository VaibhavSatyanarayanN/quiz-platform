import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1789534812435 implements MigrationInterface {
    name = 'Init1789534812435'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "quiz_versions" ADD "time_limit_seconds" integer`);
        await queryRunner.query(`ALTER TABLE "quiz_attempts" ADD "expires_at" TIMESTAMP WITH TIME ZONE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "quiz_attempts" DROP COLUMN "expires_at"`);
        await queryRunner.query(`ALTER TABLE "quiz_versions" DROP COLUMN "time_limit_seconds"`);
    }

}

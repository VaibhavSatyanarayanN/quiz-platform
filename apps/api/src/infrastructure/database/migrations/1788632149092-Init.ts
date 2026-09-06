import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1788632149092 implements MigrationInterface {
    name = 'Init1788632149092'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "sessions" ADD "replaced_by_session_id" uuid`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "sessions" DROP COLUMN "replaced_by_session_id"`);
    }

}

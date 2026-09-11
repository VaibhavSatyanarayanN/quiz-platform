import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1789136391737 implements MigrationInterface {
    name = 'Init1789136391737'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "answers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "attempt_id" uuid NOT NULL, "question_id" uuid NOT NULL, "answered_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_answer_attempt_question" UNIQUE ("attempt_id", "question_id"), CONSTRAINT "PK_9c32cec6c71e06da0254f2226c6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "answer_options" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "answer_id" uuid NOT NULL, "option_id" uuid NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_answer_option" UNIQUE ("answer_id", "option_id"), CONSTRAINT "PK_6f7aad84d76ce387af24c1231cb" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "answers" ADD CONSTRAINT "FK_e600c136cef60f166f0b315ab19" FOREIGN KEY ("attempt_id") REFERENCES "quiz_attempts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "answers" ADD CONSTRAINT "FK_677120094cf6d3f12df0b9dc5d3" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "answer_options" ADD CONSTRAINT "FK_c9e3904ebdcfc37c86dfcd3f9a3" FOREIGN KEY ("answer_id") REFERENCES "answers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "answer_options" ADD CONSTRAINT "FK_a471e2b4413da05fecea7b9e828" FOREIGN KEY ("option_id") REFERENCES "options"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "answer_options" DROP CONSTRAINT "FK_a471e2b4413da05fecea7b9e828"`);
        await queryRunner.query(`ALTER TABLE "answer_options" DROP CONSTRAINT "FK_c9e3904ebdcfc37c86dfcd3f9a3"`);
        await queryRunner.query(`ALTER TABLE "answers" DROP CONSTRAINT "FK_677120094cf6d3f12df0b9dc5d3"`);
        await queryRunner.query(`ALTER TABLE "answers" DROP CONSTRAINT "FK_e600c136cef60f166f0b315ab19"`);
        await queryRunner.query(`DROP TABLE "answer_options"`);
        await queryRunner.query(`DROP TABLE "answers"`);
    }

}

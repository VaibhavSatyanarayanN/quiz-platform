import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    Unique,
    UpdateDateColumn,
} from 'typeorm';

import { QuizAttempt } from './quiz-attempt.entity.js';
import { Question } from './question.entity.js';

@Entity('answers')
@Unique('UQ_answer_attempt_question', [
    'attemptId',
    'questionId',
])
@Index(['attemptId', 'questionId'])
export class Answer {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({
        name: 'attempt_id',
        type: 'uuid',
    })
    attemptId: string;

    @ManyToOne(() => QuizAttempt, {
        onDelete: 'CASCADE',
    })
    @JoinColumn({
        name: 'attempt_id',
    })
    attempt: QuizAttempt;

    @Column({
        name: 'question_id',
        type: 'uuid',
    })
    questionId: string;

    @ManyToOne(() => Question, {
        onDelete: 'RESTRICT',
    })
    @JoinColumn({
        name: 'question_id',
    })
    question: Question;

    @Column({
        name: 'answered_at',
        type: 'timestamptz',
        nullable: true,
    })
    answeredAt: Date | null;

    @CreateDateColumn({
        name: 'created_at',
    })
    createdAt: Date;

    @UpdateDateColumn({
        name: 'updated_at',
    })
    updatedAt: Date;
}
import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';

import { User } from '../../users/entities/user.entity.js';
import { Quiz } from './quiz.entity.js';
import { QuizVersion } from './quiz-version.entity.js';
import { AttemptStatus } from '../enums/attempt-status.enum.js';

@Index(
    'UQ_active_attempt_user_version',
    ['userId', 'quizVersionId'],
    {
        unique: true,
        where: `"status" = 'in_progress'`,
    },
)
@Index(['quizId', 'status'])
@Index(['quizVersionId', 'status'])
@Entity('quiz_attempts')
export class QuizAttempt {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({
        name: 'user_id',
        type: 'uuid',
    })
    userId: string;

    @ManyToOne(() => User, {
        onDelete: 'RESTRICT',
    })
    @JoinColumn({
        name: 'user_id',
    })
    user: User;

    @Column({
        name: 'quiz_id',
        type: 'uuid',
    })
    quizId: string;

    @ManyToOne(() => Quiz, {
        onDelete: 'RESTRICT',
    })
    @JoinColumn({
        name: 'quiz_id',
    })
    quiz: Quiz;

    @Column({
        name: 'quiz_version_id',
        type: 'uuid',
    })
    quizVersionId: string;

    @ManyToOne(() => QuizVersion, {
        onDelete: 'RESTRICT',
    })
    @JoinColumn({
        name: 'quiz_version_id',
    })
    quizVersion: QuizVersion;

    @Column({
        type: 'enum',
        enum: AttemptStatus,
        default: AttemptStatus.IN_PROGRESS,
    })
    status: AttemptStatus;

    @Column({
        name: 'expires_at',
        type: 'timestamptz',
        nullable: true,
    })
    expiresAt: Date | null;

    @Column({
        name: 'started_at',
        type: 'timestamptz',
    })
    startedAt: Date;

    @Column({
        name: 'submitted_at',
        type: 'timestamptz',
        nullable: true,
    })
    submittedAt: Date | null;

    @Column({
        type: 'integer',
        nullable: true,
    })
    score: number | null;

    @Column({
        name: 'correct_answers',
        type: 'integer',
        nullable: true,
    })
    correctAnswers: number | null;

    @Column({
        name: 'wrong_answers',
        type: 'integer',
        nullable: true,
    })
    wrongAnswers: number | null;

    @Column({
        name: 'unanswered',
        type: 'integer',
        nullable: true,
    })
    unanswered: number | null;

    @Column({
        type: 'decimal',
        precision: 5,
        scale: 2,
        nullable: true,
    })
    percentage: number | null;

    @CreateDateColumn({
        name: 'created_at',
    })
    createdAt: Date;

    @UpdateDateColumn({
        name: 'updated_at',
    })
    updatedAt: Date;
}
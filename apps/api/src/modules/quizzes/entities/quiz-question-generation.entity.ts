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
import { Organization } from '../../organizations/entities/organization.entity.js';
import { Quiz } from './quiz.entity.js';
import { QuizVersion } from './quiz-version.entity.js';
import { GenerationStatus } from '../enums/generation-status.enum.js';

@Entity('quiz_question_generations')
@Index(['organizationId', 'quizId'])
@Index(['quizId', 'targetVersionId'])
@Index(['status'])
@Index(['jobId'], { unique: true })
export class QuizQuestionGeneration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'organization_id',
    type: 'uuid',
    nullable: true,
  })
  organizationId: string | null;

  @ManyToOne(() => Organization, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({
    name: 'organization_id',
  })
  organization: Organization | null;

  @Column({
    name: 'creator_id',
    type: 'uuid',
  })
  creatorId: string;

  @ManyToOne(() => User, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'creator_id',
  })
  creator: User;

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
    name: 'target_version_id',
    type: 'uuid',
  })
  targetVersionId: string;

  @ManyToOne(() => QuizVersion, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'target_version_id',
  })
  targetVersion: QuizVersion;

  @Column({
    name: 'job_id',
    type: 'varchar',
    length: 255,
  })
  jobId: string;

  @Column({
    type: 'enum',
    enum: GenerationStatus,
    default: GenerationStatus.PENDING,
  })
  status: GenerationStatus;

  @Column({
    name: 'prompt_params',
    type: 'jsonb',
  })
  promptParams: Record<string, any>;

  @Column({
    name: 'generated_questions',
    type: 'jsonb',
    nullable: true,
  })
  generatedQuestions: Record<string, any>[] | null;

  @Column({
    name: 'error_message',
    type: 'text',
    nullable: true,
  })
  errorMessage: string | null;

  @Column({
    name: 'tokens_used',
    type: 'jsonb',
    nullable: true,
  })
  tokensUsed: Record<string, any> | null;

  @CreateDateColumn({
    name: 'created_at',
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_at',
  })
  updatedAt: Date;

  @Column({
    name: 'completed_at',
    type: 'timestamptz',
    nullable: true,
  })
  completedAt: Date | null;
}

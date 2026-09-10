import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { Quiz } from './quiz.entity.js';
import { QuizVersionStatus } from '../enums/quiz-version-status.enum.js';

@Entity('quiz_versions')
@Unique('UQ_quiz_version_number', ['quizId', 'version'])
export class QuizVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

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
    type: 'integer',
  })
  version: number;

  @Column({
    type: 'enum',
    enum: QuizVersionStatus,
    default: QuizVersionStatus.DRAFT,
  })
  status: QuizVersionStatus;

  @Column({
    name: 'published_at',
    type: 'timestamptz',
    nullable: true,
  })
  publishedAt: Date | null;

  @CreateDateColumn({
    name: 'created_at',
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_at',
  })
  updatedAt: Date;
}
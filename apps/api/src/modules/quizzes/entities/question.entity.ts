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

import { QuizVersion } from './quiz-version.entity.js';
import { QuestionType } from '../enums/question-type.enum.js';

@Entity('questions')
@Unique('UQ_question_order', ['quizVersionId', 'order'])
export class Question {
  @PrimaryGeneratedColumn('uuid')
  id: string;

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
    type: 'text',
  })
  text: string;

  @Column({
    name: 'question_type',
    type: 'enum',
    enum: QuestionType,
  })
  questionType: QuestionType;

  @Column({
    type: 'integer',
  })
  order: number;

  @Column({
    type: 'integer',
    default: 1,
  })
  marks: number;

  @CreateDateColumn({
    name: 'created_at',
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_at',
  })
  updatedAt: Date;
}
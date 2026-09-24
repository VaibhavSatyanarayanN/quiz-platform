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

import type { Question } from './question.entity.js';

@Entity('options')
@Unique('UQ_option_order', ['questionId', 'order'])
export class Option {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'question_id',
    type: 'uuid',
  })
  questionId: string;

  @ManyToOne('Question', (question: Question) => question.options, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'question_id',
  })
  question: Question;

  @Column({
    type: 'text',
  })
  text: string;

  @Column({
    name: 'is_correct',
    type: 'boolean',
    default: false,
  })
  isCorrect: boolean;

  @Column({
    type: 'integer',
  })
  order: number;

  @CreateDateColumn({
    name: 'created_at',
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_at',
  })
  updatedAt: Date;
}
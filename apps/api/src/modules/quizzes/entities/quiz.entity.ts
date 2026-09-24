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
import { QuizStatus } from '../enums/quiz-status.enum.js';

@Entity('quizzes')
@Index(['organizationId'])
@Index(['creatorId'])
@Index(['organizationId', 'creatorId'])
export class Quiz {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  description: string | null;

  @Column({
    type: 'enum',
    enum: QuizStatus,
    default: QuizStatus.DRAFT,
  })
  status: QuizStatus;

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

  @CreateDateColumn({
    name: 'created_at',
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_at',
  })
  updatedAt: Date;
}
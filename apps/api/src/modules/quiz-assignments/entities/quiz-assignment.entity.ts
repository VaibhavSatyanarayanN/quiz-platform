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
import { Quiz } from '../../quizzes/entities/quiz.entity.js';
import { QuizVersion } from '../../quizzes/entities/quiz-version.entity.js';
import { Organization } from '../../organizations/entities/organization.entity.js';
import { Classroom } from '../../classrooms/entities/classroom.entity.js';
import { User } from '../../users/entities/user.entity.js';

@Entity('quiz_assignments')
@Index(['quizId'])
@Index(['quizVersionId'])
@Index(['organizationId'])
@Index(['classroomId'])
@Index(['dueAt'])
export class QuizAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'quiz_id', type: 'uuid' })
  quizId: string;

  @ManyToOne(() => Quiz, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'quiz_id' })
  quiz: Quiz;

  @Column({ name: 'quiz_version_id', type: 'uuid' })
  quizVersionId: string;

  @ManyToOne(() => QuizVersion, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'quiz_version_id' })
  quizVersion: QuizVersion;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'classroom_id', type: 'uuid', nullable: true })
  classroomId: string | null;

  @ManyToOne(() => Classroom, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'classroom_id' })
  classroom: Classroom | null;

  @Column({ name: 'assigned_by', type: 'uuid' })
  assignedBy: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'assigned_by' })
  assigner: User;

  @Column({ name: 'starts_at', type: 'timestamptz', nullable: true })
  startsAt: Date | null;

  @Column({ name: 'due_at', type: 'timestamptz', nullable: true })
  dueAt: Date | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { QuizAssignment } from './quiz-assignment.entity.js';
import { User } from '../../users/entities/user.entity.js';

@Entity('quiz_assignment_recipients')
@Unique(['assignmentId', 'studentId'])
@Index(['assignmentId'])
@Index(['studentId'])
export class QuizAssignmentRecipient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'assignment_id', type: 'uuid' })
  assignmentId: string;

  @ManyToOne(() => QuizAssignment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'assignment_id' })
  assignment: QuizAssignment;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'student_id' })
  student: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

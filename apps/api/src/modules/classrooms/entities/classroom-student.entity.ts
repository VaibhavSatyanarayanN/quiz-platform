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
import { Classroom } from './classroom.entity.js';
import { User } from '../../users/entities/user.entity.js';

@Entity('classroom_students')
@Unique(['classroomId', 'studentId'])
@Index(['classroomId'])
@Index(['studentId'])
export class ClassroomStudent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'classroom_id', type: 'uuid' })
  classroomId: string;

  @ManyToOne(() => Classroom, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'classroom_id' })
  classroom: Classroom;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'student_id' })
  student: User;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'joined_at' })
  joinedAt: Date;
}

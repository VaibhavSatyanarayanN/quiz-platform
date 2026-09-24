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

@Entity('classroom_teachers')
@Unique(['classroomId', 'teacherId'])
@Index(['classroomId'])
@Index(['teacherId'])
export class ClassroomTeacher {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'classroom_id', type: 'uuid' })
  classroomId: string;

  @ManyToOne(() => Classroom, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'classroom_id' })
  classroom: Classroom;

  @Column({ name: 'teacher_id', type: 'uuid' })
  teacherId: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'teacher_id' })
  teacher: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

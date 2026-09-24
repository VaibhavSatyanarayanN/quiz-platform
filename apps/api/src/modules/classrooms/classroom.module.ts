import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Classroom } from './entities/classroom.entity.js';
import { ClassroomTeacher } from './entities/classroom-teacher.entity.js';
import { ClassroomStudent } from './entities/classroom-student.entity.js';
import { ClassroomService } from './classroom.service.js';
import { ClassroomController } from './classroom.controller.js';
import { OrganizationModule } from '../organizations/organization.module.js';

@Module({
  imports: [
    OrganizationModule,
    TypeOrmModule.forFeature([Classroom, ClassroomTeacher, ClassroomStudent]),
  ],
  controllers: [ClassroomController],
  providers: [ClassroomService],
  exports: [ClassroomService, TypeOrmModule],
})
export class ClassroomModule {}

import { IsNotEmpty, IsUUID } from 'class-validator';

export class AddClassroomTeacherDto {
  @IsUUID()
  @IsNotEmpty()
  teacherId: string;
}

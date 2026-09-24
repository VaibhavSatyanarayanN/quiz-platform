import { IsNotEmpty, IsUUID } from 'class-validator';

export class AddClassroomStudentDto {
  @IsUUID()
  @IsNotEmpty()
  studentId: string;
}

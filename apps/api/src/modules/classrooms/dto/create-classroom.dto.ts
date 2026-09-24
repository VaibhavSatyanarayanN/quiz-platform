import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateClassroomDto {
  @IsUUID()
  @IsNotEmpty()
  organizationId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;
}

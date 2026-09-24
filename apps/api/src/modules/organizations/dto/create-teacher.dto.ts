import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CreateOrgTeacherDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @MinLength(6)
  tempPassword: string;
}

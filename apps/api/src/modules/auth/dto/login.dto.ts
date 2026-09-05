import { IsString, Length } from 'class-validator';

export class LoginDto {
  @IsString()
  @Length(3, 320)
  email: string;

  @IsString()
  @Length(8, 128)
  password: string;
}
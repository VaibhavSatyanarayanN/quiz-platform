import { IsEnum, IsNotEmpty, IsUUID } from 'class-validator';
import { OrganizationRole } from '../enums/organization-role.enum.js';

export class AddMemberDto {
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @IsEnum(OrganizationRole)
  role: OrganizationRole = OrganizationRole.TEACHER;
}

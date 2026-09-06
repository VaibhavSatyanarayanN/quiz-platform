import {
  IsEnum,
  IsNotIn,
} from 'class-validator';

import { UserRole } from '../enums/user-role.enum.js';

export class UpdateUserRoleDto {
  @IsEnum(UserRole)
  @IsNotIn([UserRole.ADMIN])
  role: UserRole;
}
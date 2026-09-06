import {
    Body,
    Controller,
    Param,
    Patch,
} from '@nestjs/common';

import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from './enums/user-role.enum.js';
import { UserService } from './user.service.js';
import { UpdateUserRoleDto } from './dto/update-user-role.dto.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';

@Controller('admin/users')
export class AdminUserController {
    constructor(
        private readonly userService: UserService,
    ) { }

    @Patch(':userId/role')
    @Roles(UserRole.ADMIN)
    async updateRole(
        @Param('userId') userId: string,
        @Body() dto: UpdateUserRoleDto,
        @CurrentUser() currentUser: AuthenticatedUser,
    ) {
        return this.userService.updateRole(
            userId,
            dto.role,
            currentUser.userId,
        );
    }
}
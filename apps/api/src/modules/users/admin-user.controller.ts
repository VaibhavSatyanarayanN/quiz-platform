import {
    Controller,
    Param,
    Patch,
} from '@nestjs/common';

import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from './enums/user-role.enum.js';
import { UserService } from './user.service.js';

@Controller('admin/users')
export class AdminUserController {
    constructor(
        private readonly userService: UserService,
    ) { }

    @Patch(':userId/role')
    @Roles(UserRole.ADMIN)
    async updateRole(
        @Param('userId') userId: string,
    ) {
        return this.userService.updateRole(
            userId,
            UserRole.CREATOR,
        );
    }
}
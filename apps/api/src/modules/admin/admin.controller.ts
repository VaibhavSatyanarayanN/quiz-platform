import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { AdminService } from './admin.service.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../users/enums/user-role.enum.js';
import { CreateOrganizationDto } from '../organizations/dto/create-organization.dto.js';
import { CreateOrganizationCreatorDto } from './dto/create-creator.dto.js';
import { UpdateCreatorStatusDto } from './dto/update-creator-status.dto.js';

@Controller('admin')
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('overview')
  getOverview() {
    return this.adminService.getOverview();
  }

  @Get('organizations')
  getOrganizations() {
    return this.adminService.getOrganizations();
  }

  @Post('organizations')
  createOrganization(@Body() dto: CreateOrganizationDto) {
    return this.adminService.createOrganization(dto);
  }

  @Get('organizations/:organizationId')
  getOrganization(@Param('organizationId') organizationId: string) {
    return this.adminService.getOrganization(organizationId);
  }

  @Get('organizations/:organizationId/creators')
  getOrganizationCreators(@Param('organizationId') organizationId: string) {
    return this.adminService.getOrganizationCreators(organizationId);
  }

  @Post('organizations/:organizationId/creators')
  createOrganizationCreator(
    @Param('organizationId') organizationId: string,
    @Body() dto: CreateOrganizationCreatorDto,
  ) {
    return this.adminService.createOrganizationCreator(organizationId, dto);
  }

  @Patch('organizations/:organizationId/creators/:userId/status')
  updateCreatorStatus(
    @Param('organizationId') organizationId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateCreatorStatusDto,
  ) {
    return this.adminService.updateCreatorStatus(
      organizationId,
      userId,
      dto.isActive,
    );
  }
}

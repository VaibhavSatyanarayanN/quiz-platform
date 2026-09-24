import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organization } from './entities/organization.entity.js';
import { OrganizationMember } from './entities/organization-member.entity.js';
import { OrganizationService } from './organization.service.js';
import { OrganizationController } from './organization.controller.js';

import { UsersModule } from '../users/user.module.js';

@Module({
  imports: [
    UsersModule,
    TypeOrmModule.forFeature([Organization, OrganizationMember]),
  ],
  controllers: [OrganizationController],
  providers: [OrganizationService],
  exports: [OrganizationService, TypeOrmModule],
})
export class OrganizationModule {}

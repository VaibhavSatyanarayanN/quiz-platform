import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import { OrganizationService } from '../organizations/organization.service.js';
import { UserService } from '../users/user.service.js';
import { UserRole } from '../users/enums/user-role.enum.js';
import { OrganizationRole } from '../organizations/enums/organization-role.enum.js';
import { CreateOrganizationCreatorDto } from './dto/create-creator.dto.js';
import { CreateOrganizationDto } from '../organizations/dto/create-organization.dto.js';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity.js';
import { Repository } from 'typeorm';

@Injectable()
export class AdminService {
  constructor(
    private readonly organizationService: OrganizationService,
    private readonly userService: UserService,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async getOverview() {
    const organizations = await this.organizationService.findAll();
    const activeOrganizations = organizations.filter((o) => o.isActive).length;

    let totalCreators = 0;
    for (const org of organizations) {
      totalCreators += await this.organizationService.getCreatorCount(org.id);
    }

    return {
      totalOrganizations: organizations.length,
      activeOrganizations,
      totalCreators,
    };
  }

  async getOrganizations() {
    const orgs = await this.organizationService.findAll();
    const result = await Promise.all(
      orgs.map(async (org) => {
        const creatorsCount = await this.organizationService.getCreatorCount(org.id);
        return {
          id: org.id,
          name: org.name,
          slug: org.slug,
          isActive: org.isActive,
          creatorsCount,
          createdAt: org.createdAt,
          updatedAt: org.updatedAt,
        };
      }),
    );
    return { items: result };
  }

  async getOrganization(organizationId: string) {
    const org = await this.organizationService.findById(organizationId);
    if (!org) {
      throw new NotFoundException('Organization not found');
    }
    const creatorsCount = await this.organizationService.getCreatorCount(org.id);
    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      isActive: org.isActive,
      creatorsCount,
      createdAt: org.createdAt,
      updatedAt: org.updatedAt,
    };
  }

  async createOrganization(dto: CreateOrganizationDto) {
    return this.organizationService.createOrganization(dto.name);
  }

  async getOrganizationCreators(organizationId: string) {
    const org = await this.organizationService.findById(organizationId);
    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    const members = await this.organizationService.getMembers(organizationId);
    return {
      items: members.map((m) => ({
        id: m.id,
        userId: m.user.id,
        name: m.user.username,
        username: m.user.username,
        email: m.user.email,
        isActive: m.user.isActive,
        role: m.role,
        createdAt: m.createdAt,
      })),
    };
  }

  async createOrganizationCreator(
    organizationId: string,
    dto: CreateOrganizationCreatorDto,
  ) {
    const org = await this.organizationService.findById(organizationId);
    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    if (!org.isActive) {
      throw new ConflictException('Cannot add creators to an inactive organization');
    }

    const email = dto.email.trim().toLowerCase();
    const username = dto.username.trim();

    const existingEmail = await this.userService.findByEmail(email);
    if (existingEmail) {
      throw new ConflictException('A user with this email already exists');
    }

    const existingUsername = await this.userService.findByUsername(username);
    if (existingUsername) {
      throw new ConflictException('A user with this username already exists');
    }

    const plainPassword = dto.password || randomBytes(8).toString('hex');
    const passwordHash = await argon2.hash(plainPassword, {
      type: argon2.argon2id,
    });

    const user = await this.userService.create({
      email,
      username,
      passwordHash,
      role: UserRole.CREATOR,
      isActive: true,
    });

    const member = await this.organizationService.addMember(
      organizationId,
      user.id,
      OrganizationRole.TEACHER,
    );

    return {
      id: member.id,
      userId: user.id,
      username: user.username,
      email: user.email,
      isActive: user.isActive,
      platformRole: user.role,
      organizationRole: member.role,
      organizationId: org.id,
      organizationName: org.name,
      createdAt: user.createdAt,
    };
  }

  async updateCreatorStatus(
    organizationId: string,
    userId: string,
    isActive: boolean,
  ) {
    const members = await this.organizationService.getMembers(organizationId);
    const member = members.find((m) => m.user.id === userId);

    if (!member) {
      throw new NotFoundException('Creator not found in this organization');
    }

    const user = member.user;
    user.isActive = isActive;
    await this.userRepository.save(user);

    return {
      userId: user.id,
      username: user.username,
      email: user.email,
      isActive: user.isActive,
    };
  }
}

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from './entities/organization.entity.js';
import { OrganizationMember } from './entities/organization-member.entity.js';
import { OrganizationRole } from './enums/organization-role.enum.js';
import { randomBytes } from 'node:crypto';

function slugify(text: string): string {
  const base = text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'org';
}

@Injectable()
export class OrganizationService {
  constructor(
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,

    @InjectRepository(OrganizationMember)
    private readonly memberRepository: Repository<OrganizationMember>,
  ) {}

  async createOrganization(name: string): Promise<Organization> {
    const trimmedName = name.trim();
    let slug = slugify(trimmedName);

    const existingWithSlug = await this.organizationRepository.findOne({
      where: { slug },
    });

    if (existingWithSlug) {
      slug = `${slug}-${randomBytes(2).toString('hex')}`;
    }

    const organization = this.organizationRepository.create({
      name: trimmedName,
      slug,
      isActive: true,
    });

    return this.organizationRepository.save(organization);
  }

  async findById(id: string): Promise<Organization | null> {
    return this.organizationRepository.findOne({ where: { id } });
  }

  async findBySlug(slug: string): Promise<Organization | null> {
    return this.organizationRepository.findOne({ where: { slug } });
  }

  async findAll(): Promise<Organization[]> {
    return this.organizationRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async getUserMemberships(userId: string): Promise<OrganizationMember[]> {
    return this.memberRepository.find({
      where: { userId },
      relations: { organization: true },
    });
  }

  async getPrimaryMembership(userId: string): Promise<OrganizationMember | null> {
    const memberships = await this.getUserMemberships(userId);
    return memberships.find((m) => m.organization?.isActive) ?? memberships[0] ?? null;
  }

  async addMember(
    organizationId: string,
    userId: string,
    role: OrganizationRole = OrganizationRole.CREATOR,
  ): Promise<OrganizationMember> {
    const organization = await this.findById(organizationId);
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const existingMember = await this.memberRepository.findOne({
      where: { organizationId, userId },
    });

    if (existingMember) {
      throw new ConflictException('User is already a member of this organization');
    }

    const member = this.memberRepository.create({
      organizationId,
      userId,
      role,
    });

    return this.memberRepository.save(member);
  }

  async getMembers(organizationId: string): Promise<OrganizationMember[]> {
    return this.memberRepository.find({
      where: { organizationId },
      relations: { user: true },
      order: { createdAt: 'DESC' },
    });
  }

  async getCreatorCount(organizationId: string): Promise<number> {
    return this.memberRepository.count({
      where: { organizationId },
    });
  }
}

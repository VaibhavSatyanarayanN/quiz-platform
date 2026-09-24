import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Organization } from './organization.entity.js';
import { User } from '../../users/entities/user.entity.js';
import { OrganizationRole } from '../enums/organization-role.enum.js';
import { OrganizationAdminType } from '../enums/organization-admin-type.enum.js';

@Entity('organization_members')
@Unique(['organizationId', 'userId'])
@Index(['organizationId'])
@Index(['userId'])
export class OrganizationMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'enum', enum: OrganizationRole, default: OrganizationRole.TEACHER })
  role: OrganizationRole;

  @Column({ name: 'admin_type', type: 'enum', enum: OrganizationAdminType, nullable: true })
  adminType: OrganizationAdminType | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

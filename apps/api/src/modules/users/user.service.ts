import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity.js';
import { UserRole } from './enums/user-role.enum.js';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) { }

  findByEmail(email: string) {
    return this.userRepository.findOne({
      where: { email },
    });
  }

  findByUsername(username: string) {
    return this.userRepository.findOne({
      where: { username },
    });
  }

  findById(id: string) {
    return this.userRepository.findOne({
      where: { id },
    });
  }

  async updateRole(
    userId: string,
    role: UserRole,
    requestingUserId: string,
  ) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (
      user.role === UserRole.ADMIN &&
      user.id !== requestingUserId
    ) {
      throw new ForbiddenException(
        'Cannot modify another administrator',
      );
    }

    user.role = role;

    return this.userRepository.save(user);
  }

  create(data: Partial<User>) {
    const user = this.userRepository.create(data);

    return this.userRepository.save(user);
  }
}
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity.js';

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

  create(data: Partial<User>) {
    const user = this.userRepository.create(data);

    return this.userRepository.save(user);
  }
}
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity.js';
import { UserService } from './user.service.js';
import { UsersController } from './users.controller.js';
import { AdminUserController } from './admin-user.controller.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
  ],
  providers: [UserService],
  exports: [UserService],
  controllers: [UsersController,AdminUserController],

})
export class UsersModule { }
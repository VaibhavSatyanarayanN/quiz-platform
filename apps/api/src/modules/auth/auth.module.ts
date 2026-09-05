import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Session } from './entities/session.entity.js';
import { UsersModule } from '../users/user.module.js';

@Module({
  imports: [
    UsersModule,
    TypeOrmModule.forFeature([Session])],
  controllers: [AuthController],
  providers: [AuthService]
})
export class AuthModule {}

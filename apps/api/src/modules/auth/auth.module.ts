import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Session } from './entities/session.entity.js';
import { UsersModule } from '../users/user.module.js';
import { JwtModule } from '@nestjs/jwt';
import {  ConfigService} from '@nestjs/config';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    UsersModule,
    TypeOrmModule.forFeature([Session]),

    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: '15m',
        },
      }),
    }),
    
  ],
  controllers: [AuthController],
  providers: [AuthService]
})
export class AuthModule {}

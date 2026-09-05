import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { UserService } from '../users/user.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { createHash, randomBytes } from 'node:crypto';
import { Session } from './entities/session.entity.js';
import { Repository } from 'typeorm/repository/Repository.js';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,

    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
  ) { }

  private generateRefreshToken(): string {
    return randomBytes(64).toString('hex');
  }

  private hashRefreshToken(refreshToken: string): string {
    return createHash('sha256')
      .update(refreshToken)
      .digest('hex');
  }

  private getRefreshTokenExpiry(): Date {
    const expiresAt = new Date();

    expiresAt.setDate(expiresAt.getDate() + 7);

    return expiresAt;
  }

  async register(registerDto: RegisterDto) {
    const email = registerDto.email.trim().toLowerCase();
    const username = registerDto.username.trim();

    const existingEmail = await this.userService.findByEmail(email);

    if (existingEmail) {
      throw new ConflictException('Email or username already exists');
    }

    const existingUsername =
      await this.userService.findByUsername(username);

    if (existingUsername) {
      throw new ConflictException('Email or username already exists');
    }

    const passwordHash = await argon2.hash(registerDto.password, {
      type: argon2.argon2id,
    });

    const user = await this.userService.create({
      email,
      username,
      passwordHash,
    });

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }

  async login(loginDto: LoginDto) {
    const email = loginDto.email.trim().toLowerCase();

    const user = await this.userService.findByEmail(email);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordValid = await argon2.verify(
      user.passwordHash,
      loginDto.password,
    );

    if (!passwordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      role: user.role,
    });

    const refreshToken = this.generateRefreshToken();

    const refreshTokenHash =
      this.hashRefreshToken(refreshToken);

    const expiresAt = this.getRefreshTokenExpiry();

    const session = this.sessionRepository.create({
      userId: user.id,
      refreshTokenHash,
      expiresAt,
    });

    await this.sessionRepository.save(session);

    return {
      accessToken,
      refreshToken,
    };
  }
}
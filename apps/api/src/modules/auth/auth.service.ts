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
import { DataSource } from 'typeorm/data-source/index.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,

    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,

    private readonly dataSource: DataSource, //used to create a transaction for refresh token rotation or atomic operations
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

  async refresh(refreshToken: string) {
    const refreshTokenHash =
      this.hashRefreshToken(refreshToken);

    const session = await this.sessionRepository.findOne({
      where: {
        refreshTokenHash,
      },
    });

    if (!session) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (session.revokedAt) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (session.expiresAt <= new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.userService.findById(session.userId);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      role: user.role,
    });

    const newRefreshToken = this.generateRefreshToken();

    const newRefreshTokenHash =
      this.hashRefreshToken(newRefreshToken);

    const result = await this.dataSource.transaction(
      async (manager) => {
        const sessionRepository =
          manager.getRepository(Session);

        session.revokedAt = new Date();
        session.lastUsedAt = new Date();

        const newSession = sessionRepository.create({
          userId: user.id,
          refreshTokenHash: newRefreshTokenHash,
          expiresAt: this.getRefreshTokenExpiry(),
        });

        const savedSession =
          await sessionRepository.save(newSession);

        session.replacedBySessionId = savedSession.id;

        await sessionRepository.save(session);

        return {
          accessToken,
          refreshToken: newRefreshToken,
        };
      },
    );

    return result;
  }
}
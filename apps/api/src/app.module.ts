import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module.js';
import { AppService } from './app.service.js';
import { AppController } from './app.controller.js';
import { DatabaseModule } from './infrastructure/database/database.module.js';
import { UsersModule } from './modules/users/user.module.js';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module.js';
import { UsersController } from './modules/users/users.controller.js';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard.js';
import { APP_GUARD } from '@nestjs/core';
import { RolesGuard } from './modules/auth/guards/roles.guard.js';
import { QuizModule } from './modules/quizzes/quiz.module.js';

@Module({
  imports: [
     ConfigModule.forRoot({
      isGlobal: true,
    }),
    HealthModule,
    DatabaseModule,
    UsersModule,
    AuthModule,
    QuizModule
  ],
  controllers: [AppController, UsersController],
  providers: [AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
     {
    provide: APP_GUARD,
    useClass: RolesGuard,
  },
  ],
})
export class AppModule {}
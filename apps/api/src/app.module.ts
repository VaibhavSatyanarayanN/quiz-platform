import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module.js';
import { AppService } from './app.service.js';
import { AppController } from './app.controller.js';
import { DatabaseModule } from './infrastructure/database/database.module.js';
import { UsersModule } from './modules/users/user.module.js';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
     ConfigModule.forRoot({
      isGlobal: true,
    }),
    HealthModule,
    DatabaseModule,
    UsersModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
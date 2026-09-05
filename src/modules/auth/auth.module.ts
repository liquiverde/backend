import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import {
  Argon2PasswordHasher,
  PASSWORD_HASHER,
} from '../../common/security/password-hasher';
import type { JwtConfig } from '../../config/configuration';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const { secret, expiresIn } = configService.get<JwtConfig>('jwt')!;
        return {
          secret,
          signOptions: {
            expiresIn: expiresIn as `${number}${'s' | 'm' | 'h' | 'd'}`,
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    { provide: PASSWORD_HASHER, useClass: Argon2PasswordHasher },
  ],
  exports: [PASSWORD_HASHER],
})
export class AuthModule {}

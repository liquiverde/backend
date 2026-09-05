import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, type User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  PASSWORD_HASHER,
  type PasswordHasher,
} from '../../common/security/password-hasher';
import type { RegisterDto } from './dto/register.dto';
import type { LoginDto } from './dto/login.dto';
import type { AuthResponseDto } from './dto/auth-response.dto';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const passwordHash = await this.passwordHasher.hash(dto.password);

    let user: User;
    try {
      user = await this.prisma.user.create({
        data: {
          email: dto.email,
          passwordHash,
          name: dto.name,
          budgetDefault: dto.budgetDefault,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email is already registered');
      }
      throw error;
    }

    return this.buildAuthResponse(user.id, user.email, user.name);
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await this.passwordHasher.verify(
      user.passwordHash,
      dto.password,
    );
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.buildAuthResponse(user.id, user.email, user.name);
  }

  private buildAuthResponse(
    userId: string,
    email: string,
    name: string,
  ): AuthResponseDto {
    const payload: AuthenticatedUser = { sub: userId, email };
    return {
      accessToken: this.jwtService.sign(payload),
      userId,
      email,
      name,
    };
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { UpdateUserDto } from './dto/update-user.dto';
import type { UserResponseDto } from './dto/user-response.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getById(id: string): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.toResponse(user);
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserResponseDto> {
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.budgetDefault !== undefined && {
          budgetDefault: dto.budgetDefault,
        }),
      },
    });
    return this.toResponse(user);
  }

  private toResponse(user: {
    id: string;
    email: string;
    name: string;
    budgetDefault: { toNumber(): number } | null;
    rewardPoints: number;
    createdAt: Date;
  }): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      budgetDefault: user.budgetDefault?.toNumber(),
      rewardPoints: user.rewardPoints,
      createdAt: user.createdAt,
    };
  }
}

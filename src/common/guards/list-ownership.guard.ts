import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../types/authenticated-user.interface';

type RequestWithUser = Request & { user: AuthenticatedUser };

/**
 * Runs after JwtAuthGuard. Loads the ShoppingList named by the route's :id
 * param and ensures it belongs to the authenticated user.
 */
@Injectable()
export class ListOwnershipGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;
    const listId = request.params?.id as string | undefined;

    if (!listId) {
      return true;
    }

    const list = await this.prisma.shoppingList.findUnique({
      where: { id: listId },
      select: { userId: true },
    });

    if (!list) {
      throw new NotFoundException('Shopping list not found');
    }
    if (list.userId !== user.sub) {
      throw new ForbiddenException('You do not own this shopping list');
    }
    return true;
  }
}

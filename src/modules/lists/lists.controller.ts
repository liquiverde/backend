import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ListOwnershipGuard } from '../../common/guards/list-ownership.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.interface';
import { AddItemDto } from './dto/add-item.dto';
import { CreateListDto } from './dto/create-list.dto';
import { ListResponseDto } from './dto/list-response.dto';
import { OptimizeListResponseDto } from './dto/optimize-list-response.dto';
import { SavingsResponseDto } from './dto/savings-response.dto';
import { SubstituteItemDto } from './dto/substitute-item.dto';
import { UpdateListDto } from './dto/update-list.dto';
import { ListsService } from './lists.service';

@ApiTags('lists')
@ApiBearerAuth()
@UseGuards(ListOwnershipGuard)
@Controller('lists')
export class ListsController {
  constructor(private readonly listsService: ListsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new shopping list (DRAFT)' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateListDto,
  ): Promise<ListResponseDto> {
    return this.listsService.create(user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: "List the authenticated user's shopping lists" })
  findAll(@CurrentUser() user: AuthenticatedUser): Promise<ListResponseDto[]> {
    return this.listsService.findAllForUser(user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Shopping list detail' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ListResponseDto> {
    return this.listsService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update budgetMax / plannedDate / status' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateListDto,
  ): Promise<ListResponseDto> {
    return this.listsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a shopping list (cascades to its items)' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.listsService.remove(id);
  }

  @Post(':id/items')
  @ApiOperation({ summary: 'Add a candidate product to the list' })
  addItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddItemDto,
  ): Promise<ListResponseDto> {
    return this.listsService.addItem(id, dto);
  }

  @Delete(':id/items/:itemId')
  @ApiOperation({ summary: 'Remove a candidate product from the list' })
  removeItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ): Promise<ListResponseDto> {
    return this.listsService.removeItem(id, itemId);
  }

  @Post(':id/optimize')
  @ApiOperation({
    summary:
      'Run the multi-objective knapsack optimizer (RF-04) and compute savings (RF-05)',
  })
  optimize(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<OptimizeListResponseDto> {
    return this.listsService.optimize(id);
  }

  @Get(':id/savings')
  @ApiOperation({
    summary: 'Savings breakdown for the last optimization (RF-05)',
  })
  getSavings(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SavingsResponseDto> {
    return this.listsService.getSavings(id);
  }

  @Post(':id/items/:itemId/substitute')
  @ApiOperation({
    summary: 'Accept a suggested substitute for a list item (RF-06)',
  })
  substitute(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: SubstituteItemDto,
  ): Promise<ListResponseDto> {
    return this.listsService.substituteItem(
      id,
      itemId,
      dto.substituteProductId,
    );
  }
}

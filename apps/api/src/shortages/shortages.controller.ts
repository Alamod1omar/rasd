import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, ForbiddenException } from '@nestjs/common';
import { ShortagesService } from './shortages.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser, UserRole, ShortageRequestStatus } from '../common/types';

@Controller('shortages')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ShortagesController {
  constructor(private readonly shortagesService: ShortagesService) {}

  @Get('active')
  async getActive(@CurrentUser() user: AuthUser, @Query('branchId') branchId?: string) {
    if (!user.companyId) {
      throw new ForbiddenException('المستخدم ليس مرتبطاً بشركة');
    }
    const bId = branchId || user.currentBranchId;
    if (!bId) return null;
    return this.shortagesService.getActiveRequest(user.companyId, bId);
  }

  @Get('check-item')
  async checkItem(
    @CurrentUser() user: AuthUser,
    @Query('branchId') branchId?: string,
    @Query('partNumber') partNumber?: string,
    @Query('brand') brand?: string,
    @Query('productId') productId?: string,
  ) {
    if (!user.companyId) {
      throw new ForbiddenException('المستخدم ليس مرتبطاً بشركة');
    }
    const bId = branchId || user.currentBranchId;
    if (!bId || !partNumber) return { exists: false };
    return this.shortagesService.checkItemInActiveRequest(user.companyId, bId, partNumber, brand, productId);
  }

  @Post()
  async createShortageRequest(
    @CurrentUser() user: AuthUser,
    @Body()
    body: {
      branchId?: string;
      items: Array<{
        productId?: string;
        partNumber: string;
        partName?: string;
        brand: string;
        quantity: number;
        priority?: string;
        note?: string;
      }>;
    },
  ) {
    return this.shortagesService.createShortageRequest(user, body);
  }

  @Post('register-item')
  async registerItem(
    @CurrentUser() user: AuthUser,
    @Body()
    body: {
      branchId?: string;
      productId?: string;
      partNumber: string;
      partName?: string;
      brand: string;
      quantity: number;
      note?: string;
    },
  ) {
    return this.shortagesService.registerItem(user, body);
  }

  @Get()
  @Roles(UserRole.OPERATOR, UserRole.COMPANY_ADMIN, UserRole.SYSTEM_ADMIN)
  async findAll(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: ShortageRequestStatus,
    @Query('branchId') branchId?: string,
    @Query('search') search?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.shortagesService.findAll(user, {
      status,
      branchId,
      search,
      dateFrom,
      dateTo,
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 15,
    });
  }

  @Get(':id')
  @Roles(UserRole.OPERATOR, UserRole.COMPANY_ADMIN, UserRole.SYSTEM_ADMIN)
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.shortagesService.findOne(id, user);
  }

  @Post(':id/close')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SYSTEM_ADMIN)
  async close(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.shortagesService.closeRequest(id, user);
  }

  @Patch('items/:itemId')
  @Roles(UserRole.OPERATOR, UserRole.COMPANY_ADMIN, UserRole.SYSTEM_ADMIN)
  async updateItem(
    @Param('itemId') itemId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: { quantity?: number; note?: string },
  ) {
    return this.shortagesService.updateItem(itemId, user, body);
  }

  @Delete('items/:itemId')
  @Roles(UserRole.OPERATOR, UserRole.COMPANY_ADMIN, UserRole.SYSTEM_ADMIN)
  async deleteItem(@Param('itemId') itemId: string, @CurrentUser() user: AuthUser) {
    return this.shortagesService.deleteItem(itemId, user);
  }
}

